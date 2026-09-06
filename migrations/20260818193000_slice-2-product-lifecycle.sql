-- GISP Slice 2 — Product detail, variants, private media and review/publish lifecycle.
-- This migration is isolated on backend branch slice-2-catalog until merge approval.

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS factory_sku TEXT,
  ADD COLUMN IF NOT EXISTS width_mm NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS depth_mm NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS height_mm NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS cbm NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS material_summary TEXT,
  ADD COLUMN IF NOT EXISTS finish_summary TEXT,
  ADD COLUMN IF NOT EXISTS moq NUMERIC(12,2);

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_measurements_check;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_measurements_check CHECK (
    (width_mm IS NULL OR width_mm > 0) AND
    (depth_mm IS NULL OR depth_mm > 0) AND
    (height_mm IS NULL OR height_mm > 0) AND
    (weight_kg IS NULL OR weight_kg > 0) AND
    (cbm IS NULL OR cbm > 0) AND
    (moq IS NULL OR moq > 0)
  );

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS product_media_one_primary_image
  ON public.product_media(product_id)
  WHERE media_type='IMAGE' AND is_primary=TRUE;

CREATE OR REPLACE FUNCTION public.product_validation_result(product_id_input UUID)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  p public.products%ROWTYPE;
  supplier_status_value TEXT;
  issues JSONB := '[]'::JSONB;
  blocking_count INTEGER;
BEGIN
  IF NOT public.has_permission('catalog.read') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT * INTO p FROM public.products WHERE id=product_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT status INTO supplier_status_value FROM public.suppliers WHERE id=p.supplier_id;

  IF supplier_status_value IS DISTINCT FROM 'ACTIVE' THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','SUPPLIER_NOT_ACTIVE','field','supplierId','message','Supplier ต้องเป็น ACTIVE','section','MASTER'));
  END IF;
  IF p.category_id IS NULL THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','CATEGORY_REQUIRED','field','categoryId','message','กรุณาเลือกหมวดสินค้า','section','MASTER'));
  END IF;
  IF NULLIF(BTRIM(COALESCE(p.description_th,'')),'') IS NULL THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','DESCRIPTION_REQUIRED','field','descriptionTh','message','กรุณากรอกรายละเอียดสินค้า','section','MASTER'));
  END IF;
  IF NULLIF(BTRIM(COALESCE(p.specification_summary,'')),'') IS NULL THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','SPECIFICATION_REQUIRED','field','specificationSummary','message','กรุณากรอกสเปกสินค้า','section','MASTER'));
  END IF;
  IF p.default_lead_time_days IS NULL THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','LEAD_TIME_REQUIRED','field','defaultLeadTimeDays','message','กรุณาระบุ Lead time','section','MASTER'));
  END IF;
  IF NULLIF(BTRIM(COALESCE(p.material_summary,'')),'') IS NULL THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','MATERIAL_REQUIRED','field','materialSummary','message','กรุณาระบุวัสดุหลัก','section','MASTER'));
  END IF;
  IF p.product_type IN ('STANDARD','READY_TO_ORDER','EQUIPMENT','DECORATIVE')
    AND (p.width_mm IS NULL OR p.depth_mm IS NULL OR p.height_mm IS NULL) THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','DIMENSIONS_REQUIRED','field','dimensions','message','สินค้าประเภทนี้ต้องมีขนาด กว้าง × ลึก × สูง','section','MASTER'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id=p.id AND v.status='ACTIVE') THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','ACTIVE_VARIANT_REQUIRED','field','variants','message','ต้องมี Variant ที่ใช้งานอย่างน้อย 1 รายการ','section','VARIANT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_media m WHERE m.product_id=p.id AND m.media_type='IMAGE' AND m.is_primary) THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','PRIMARY_IMAGE_REQUIRED','field','media','message','ต้องมีรูปหลักอย่างน้อย 1 รูป','section','MEDIA'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.product_cost_versions c
    WHERE c.product_id=p.id AND c.variant_id IS NULL AND c.status='ACTIVE'
      AND c.effective_from<=NOW() AND (c.effective_until IS NULL OR c.effective_until>NOW())
  ) THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','ACTIVE_COST_REQUIRED','field','cost','message','ต้องมีต้นทุนหลักที่ใช้งานอยู่','section','PRICE'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.product_prices pp
    WHERE pp.product_id=p.id AND pp.variant_id IS NULL AND pp.status='ACTIVE'
      AND pp.valid_from<=NOW() AND (pp.valid_until IS NULL OR pp.valid_until>NOW())
  ) THEN
    issues := issues || jsonb_build_array(jsonb_build_object('code','ACTIVE_PRICE_REQUIRED','field','price','message','ต้องมีราคาสมาชิกที่ใช้งานอยู่','section','PRICE'));
  END IF;

  blocking_count := jsonb_array_length(issues);
  RETURN jsonb_build_object(
    'productId', p.id,
    'status', p.status,
    'qaStatus', p.qa_status,
    'blockingCount', blocking_count,
    'readyForReview', blocking_count=0 AND p.status IN ('DRAFT','REVIEW'),
    'readyForPublish', blocking_count=0 AND p.status='REVIEW' AND p.qa_status='PASSED',
    'issues', issues
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_catalog_supplier(supplier_id_input UUID)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT to_jsonb(s) INTO before_value FROM public.suppliers s WHERE s.id=supplier_id_input;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  UPDATE public.suppliers SET status='ACTIVE', suspended_reason=NULL, updated_at=NOW()
  WHERE id=supplier_id_input AND status IN ('PROSPECT','INACTIVE','SUSPENDED');
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  PERFORM public.write_audit_event(NULL,'supplier',supplier_id_input,'ACTIVATED',before_value,jsonb_build_object('status','ACTIVE'));
  RETURN supplier_id_input;
END; $$;

CREATE OR REPLACE FUNCTION public.save_product_detail(
  product_id_input UUID, supplier_id_input UUID, category_id_input UUID,
  sku_input TEXT, factory_sku_input TEXT, name_th_input TEXT, name_en_input TEXT,
  name_zh_input TEXT, product_type_input TEXT, country_code_input TEXT,
  description_th_input TEXT, specification_summary_input TEXT,
  default_lead_time_days_input INTEGER, width_mm_input NUMERIC, depth_mm_input NUMERIC,
  height_mm_input NUMERIC, weight_kg_input NUMERIC, cbm_input NUMERIC,
  material_summary_input TEXT, finish_summary_input TEXT, moq_input NUMERIC,
  source_catalog_page_input TEXT, ordering_note_input TEXT
)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE before_value JSONB; current_status TEXT;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT to_jsonb(p),p.status INTO before_value,current_status FROM public.products p WHERE p.id=product_id_input FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF current_status NOT IN ('DRAFT','REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF NULLIF(BTRIM(sku_input),'') IS NULL OR NULLIF(BTRIM(name_th_input),'') IS NULL
    OR product_type_input NOT IN ('STANDARD','CUSTOM_TEMPLATE','READY_TO_ORDER','BUILT_IN','MATERIAL','EQUIPMENT','DECORATIVE')
    OR UPPER(BTRIM(country_code_input)) !~ '^[A-Z]{2}$'
    OR (default_lead_time_days_input IS NOT NULL AND default_lead_time_days_input<=0)
    OR (width_mm_input IS NOT NULL AND width_mm_input<=0)
    OR (depth_mm_input IS NOT NULL AND depth_mm_input<=0)
    OR (height_mm_input IS NOT NULL AND height_mm_input<=0)
    OR (weight_kg_input IS NOT NULL AND weight_kg_input<=0)
    OR (cbm_input IS NOT NULL AND cbm_input<=0)
    OR (moq_input IS NOT NULL AND moq_input<=0)
    OR NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id_input AND s.status IN ('PROSPECT','ACTIVE'))
    OR NOT EXISTS (SELECT 1 FROM public.countries c WHERE c.code=UPPER(BTRIM(country_code_input)) AND c.status='ACTIVE')
    OR (category_id_input IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id=category_id_input AND c.status='ACTIVE'))
  THEN RAISE EXCEPTION 'INVALID_INPUT: PRODUCT_DETAIL'; END IF;

  UPDATE public.products SET
    supplier_id=supplier_id_input, category_id=category_id_input, sku=UPPER(BTRIM(sku_input)),
    factory_sku=NULLIF(BTRIM(factory_sku_input),''), name_th=BTRIM(name_th_input),
    name_en=NULLIF(BTRIM(name_en_input),''), name_zh=NULLIF(BTRIM(name_zh_input),''),
    product_type=product_type_input, country_code=UPPER(BTRIM(country_code_input)),
    description_th=NULLIF(BTRIM(description_th_input),''), specification_summary=NULLIF(BTRIM(specification_summary_input),''),
    default_lead_time_days=default_lead_time_days_input, width_mm=width_mm_input, depth_mm=depth_mm_input,
    height_mm=height_mm_input, weight_kg=weight_kg_input, cbm=cbm_input,
    material_summary=NULLIF(BTRIM(material_summary_input),''), finish_summary=NULLIF(BTRIM(finish_summary_input),''),
    moq=moq_input, source_catalog_page=NULLIF(BTRIM(source_catalog_page_input),''), ordering_note=NULLIF(BTRIM(ordering_note_input),''),
    status='DRAFT', qa_status='NOT_REVIEWED', reviewed_by=NULL, reviewed_at=NULL, review_note=NULL, updated_at=NOW()
  WHERE id=product_id_input;
  PERFORM public.write_audit_event(NULL,'product',product_id_input,'DETAIL_SAVED',before_value,
    jsonb_build_object('sku',UPPER(BTRIM(sku_input)),'status','DRAFT','qaStatus','NOT_REVIEWED'));
  RETURN product_id_input;
END; $$;

CREATE OR REPLACE FUNCTION public.save_product_variant(
  variant_id_input UUID, product_id_input UUID, sku_input TEXT, factory_sku_input TEXT,
  name_input TEXT, specification_summary_input TEXT, width_mm_input NUMERIC,
  depth_mm_input NUMERIC, height_mm_input NUMERIC, weight_kg_input NUMERIC,
  cbm_input NUMERIC, material_summary_input TEXT, finish_summary_input TEXT, moq_input NUMERIC
)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE variant_id_value UUID; product_status_value TEXT; before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT status INTO product_status_value FROM public.products WHERE id=product_id_input FOR UPDATE;
  IF product_status_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF product_status_value NOT IN ('DRAFT','REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF NULLIF(BTRIM(sku_input),'') IS NULL OR NULLIF(BTRIM(name_input),'') IS NULL
    OR (width_mm_input IS NOT NULL AND width_mm_input<=0) OR (depth_mm_input IS NOT NULL AND depth_mm_input<=0)
    OR (height_mm_input IS NOT NULL AND height_mm_input<=0) OR (weight_kg_input IS NOT NULL AND weight_kg_input<=0)
    OR (cbm_input IS NOT NULL AND cbm_input<=0) OR (moq_input IS NOT NULL AND moq_input<=0)
  THEN RAISE EXCEPTION 'INVALID_INPUT: PRODUCT_VARIANT'; END IF;

  IF variant_id_input IS NULL THEN
    INSERT INTO public.product_variants(product_id,sku,factory_sku,name,specification_summary,width_mm,depth_mm,height_mm,weight_kg,cbm,material_summary,finish_summary,moq,status)
    VALUES(product_id_input,UPPER(BTRIM(sku_input)),NULLIF(BTRIM(factory_sku_input),''),BTRIM(name_input),NULLIF(BTRIM(specification_summary_input),''),width_mm_input,depth_mm_input,height_mm_input,weight_kg_input,cbm_input,NULLIF(BTRIM(material_summary_input),''),NULLIF(BTRIM(finish_summary_input),''),moq_input,'ACTIVE')
    RETURNING id INTO variant_id_value;
    PERFORM public.write_audit_event(NULL,'product_variant',variant_id_value,'CREATED',NULL,jsonb_build_object('productId',product_id_input,'sku',UPPER(BTRIM(sku_input))));
  ELSE
    SELECT to_jsonb(v) INTO before_value FROM public.product_variants v WHERE v.id=variant_id_input AND v.product_id=product_id_input FOR UPDATE;
    IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    UPDATE public.product_variants SET sku=UPPER(BTRIM(sku_input)),factory_sku=NULLIF(BTRIM(factory_sku_input),''),name=BTRIM(name_input),specification_summary=NULLIF(BTRIM(specification_summary_input),''),width_mm=width_mm_input,depth_mm=depth_mm_input,height_mm=height_mm_input,weight_kg=weight_kg_input,cbm=cbm_input,material_summary=NULLIF(BTRIM(material_summary_input),''),finish_summary=NULLIF(BTRIM(finish_summary_input),''),moq=moq_input,status='ACTIVE',updated_at=NOW() WHERE id=variant_id_input;
    variant_id_value:=variant_id_input;
    PERFORM public.write_audit_event(NULL,'product_variant',variant_id_value,'UPDATED',before_value,jsonb_build_object('sku',UPPER(BTRIM(sku_input)),'status','ACTIVE'));
  END IF;
  UPDATE public.products SET status='DRAFT',qa_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=NOW() WHERE id=product_id_input;
  RETURN variant_id_value;
END; $$;

CREATE OR REPLACE FUNCTION public.set_product_variant_status(variant_id_input UUID, status_input TEXT)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE product_id_value UUID; before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF status_input NOT IN ('ACTIVE','INACTIVE') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT product_id,to_jsonb(v) INTO product_id_value,before_value FROM public.product_variants v WHERE v.id=variant_id_input FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id=product_id_value AND p.status IN ('DRAFT','REVIEW')) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.product_variants SET status=status_input,updated_at=NOW() WHERE id=variant_id_input;
  UPDATE public.products SET status='DRAFT',qa_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=NOW() WHERE id=product_id_value;
  PERFORM public.write_audit_event(NULL,'product_variant',variant_id_input,'STATUS_CHANGED',before_value,jsonb_build_object('status',status_input));
  RETURN variant_id_input;
END; $$;

CREATE OR REPLACE FUNCTION public.attach_product_file(
  product_id_input UUID, file_id_input UUID, file_kind_input TEXT,
  document_type_input TEXT, source_page_input TEXT, is_primary_input BOOLEAN,
  is_member_visible_input BOOLEAN
)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE relation_id UUID; current_status TEXT; image_count INTEGER; document_count INTEGER;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT status INTO current_status FROM public.products WHERE id=product_id_input FOR UPDATE;
  IF current_status IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF current_status NOT IN ('DRAFT','REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.file_metadata f WHERE f.id=file_id_input AND f.entity_id=product_id_input AND f.bucket='gisp-confidential' AND f.visibility='CONFIDENTIAL') THEN RAISE EXCEPTION 'INVALID_FILE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(product_id_input::TEXT,0));
  IF file_kind_input='IMAGE' THEN
    SELECT COUNT(*) INTO image_count FROM public.product_media WHERE product_id=product_id_input AND media_type='IMAGE';
    IF image_count>=12 THEN RAISE EXCEPTION 'FILE_LIMIT_REACHED'; END IF;
    IF is_primary_input OR image_count=0 THEN UPDATE public.product_media SET is_primary=FALSE WHERE product_id=product_id_input AND media_type='IMAGE'; END IF;
    INSERT INTO public.product_media(product_id,file_id,media_type,is_primary,sort_order)
    VALUES(product_id_input,file_id_input,'IMAGE',(is_primary_input OR image_count=0),image_count*10) RETURNING id INTO relation_id;
  ELSIF file_kind_input='DOCUMENT' THEN
    IF document_type_input NOT IN ('CATALOG','PRICE_LIST','SPECIFICATION','WARRANTY','OTHER') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
    SELECT COUNT(*) INTO document_count FROM public.product_documents WHERE product_id=product_id_input;
    IF document_count>=10 THEN RAISE EXCEPTION 'FILE_LIMIT_REACHED'; END IF;
    INSERT INTO public.product_documents(product_id,file_id,document_type,source_page,is_member_visible,created_by)
    VALUES(product_id_input,file_id_input,document_type_input,NULLIF(BTRIM(source_page_input),''),is_member_visible_input,(SELECT auth.uid())) RETURNING id INTO relation_id;
  ELSE RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  UPDATE public.products SET status='DRAFT',qa_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=NOW() WHERE id=product_id_input;
  PERFORM public.write_audit_event(NULL,'product_file',relation_id,'ATTACHED',NULL,jsonb_build_object('productId',product_id_input,'fileId',file_id_input,'kind',file_kind_input));
  RETURN relation_id;
END; $$;

CREATE OR REPLACE FUNCTION public.set_product_primary_media(product_id_input UUID, media_id_input UUID)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id=product_id_input AND p.status IN ('DRAFT','REVIEW')) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_media m WHERE m.id=media_id_input AND m.product_id=product_id_input AND m.media_type='IMAGE') THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  UPDATE public.product_media SET is_primary=FALSE WHERE product_id=product_id_input AND media_type='IMAGE';
  UPDATE public.product_media SET is_primary=TRUE WHERE id=media_id_input;
  UPDATE public.products SET status='DRAFT',qa_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=NOW() WHERE id=product_id_input;
  PERFORM public.write_audit_event(NULL,'product_media',media_id_input,'SET_PRIMARY',NULL,jsonb_build_object('productId',product_id_input));
  RETURN media_id_input;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_product_for_review(product_id_input UUID)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE result_value JSONB; current_status TEXT;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT status INTO current_status FROM public.products WHERE id=product_id_input FOR UPDATE;
  IF current_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  result_value:=public.product_validation_result(product_id_input);
  IF (result_value->>'blockingCount')::INTEGER>0 THEN RAISE EXCEPTION 'PRODUCT_NOT_READY'; END IF;
  UPDATE public.products SET status='REVIEW',qa_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=NOW() WHERE id=product_id_input;
  PERFORM public.write_audit_event(NULL,'product',product_id_input,'SUBMITTED_FOR_REVIEW',jsonb_build_object('status','DRAFT'),jsonb_build_object('status','REVIEW'));
  RETURN product_id_input;
END; $$;

CREATE OR REPLACE FUNCTION public.review_catalog_product(product_id_input UUID, decision_input TEXT, note_input TEXT)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE result_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.publish') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF decision_input NOT IN ('PASSED','NEEDS_FIX') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id=product_id_input AND p.status='REVIEW' FOR UPDATE) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF decision_input='PASSED' THEN
    result_value:=public.product_validation_result(product_id_input);
    IF (result_value->>'blockingCount')::INTEGER>0 THEN RAISE EXCEPTION 'PRODUCT_NOT_READY'; END IF;
    UPDATE public.products SET qa_status='PASSED',reviewed_by=(SELECT auth.uid()),reviewed_at=NOW(),review_note=NULLIF(BTRIM(note_input),''),updated_at=NOW() WHERE id=product_id_input;
  ELSE
    IF NULLIF(BTRIM(note_input),'') IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
    UPDATE public.products SET status='DRAFT',qa_status='NEEDS_FIX',reviewed_by=(SELECT auth.uid()),reviewed_at=NOW(),review_note=BTRIM(note_input),updated_at=NOW() WHERE id=product_id_input;
  END IF;
  PERFORM public.write_audit_event(NULL,'product',product_id_input,'REVIEW_'||decision_input,NULL,jsonb_build_object('decision',decision_input,'note',NULLIF(BTRIM(note_input),'')));
  RETURN product_id_input;
END; $$;

CREATE OR REPLACE FUNCTION public.publish_product(product_id_input UUID)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE result_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.publish') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id=product_id_input AND p.status='REVIEW' AND p.qa_status='PASSED' FOR UPDATE) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  result_value:=public.product_validation_result(product_id_input);
  IF NOT (result_value->>'readyForPublish')::BOOLEAN THEN RAISE EXCEPTION 'PRODUCT_NOT_READY'; END IF;
  UPDATE public.products SET status='PUBLISHED',published_at=NOW(),updated_at=NOW() WHERE id=product_id_input;
  PERFORM public.write_audit_event(NULL,'product',product_id_input,'PUBLISHED',jsonb_build_object('status','REVIEW'),jsonb_build_object('status','PUBLISHED','publishedAt',NOW()));
  RETURN product_id_input;
END; $$;

CREATE OR REPLACE FUNCTION public.unpublish_product(product_id_input UUID, note_input TEXT)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_permission('catalog.publish') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(note_input),'') IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  UPDATE public.products SET status='REVIEW',published_at=NULL,review_note=BTRIM(note_input),updated_at=NOW() WHERE id=product_id_input AND status='PUBLISHED';
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  PERFORM public.write_audit_event(NULL,'product',product_id_input,'UNPUBLISHED',jsonb_build_object('status','PUBLISHED'),jsonb_build_object('status','REVIEW','note',BTRIM(note_input)));
  RETURN product_id_input;
END; $$;

DROP POLICY IF EXISTS products_manage ON public.products;
DROP POLICY IF EXISTS product_variants_manage ON public.product_variants;
DROP POLICY IF EXISTS product_media_manage ON public.product_media;
DROP POLICY IF EXISTS product_documents_internal ON public.product_documents;
CREATE POLICY product_documents_read ON public.product_documents FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));

REVOKE INSERT, UPDATE, DELETE ON public.products, public.product_variants, public.product_media, public.product_documents FROM authenticated;
GRANT SELECT ON public.products, public.product_variants, public.product_media, public.product_documents TO authenticated;

REVOKE ALL ON FUNCTION public.product_validation_result(UUID), public.activate_catalog_supplier(UUID),
  public.save_product_detail(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,TEXT,TEXT),
  public.save_product_variant(UUID,UUID,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC),
  public.set_product_variant_status(UUID,TEXT), public.attach_product_file(UUID,UUID,TEXT,TEXT,TEXT,BOOLEAN,BOOLEAN),
  public.set_product_primary_media(UUID,UUID), public.submit_product_for_review(UUID),
  public.review_catalog_product(UUID,TEXT,TEXT), public.publish_product(UUID), public.unpublish_product(UUID,TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.product_validation_result(UUID), public.activate_catalog_supplier(UUID),
  public.save_product_detail(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,TEXT,TEXT),
  public.save_product_variant(UUID,UUID,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC),
  public.set_product_variant_status(UUID,TEXT), public.attach_product_file(UUID,UUID,TEXT,TEXT,TEXT,BOOLEAN,BOOLEAN),
  public.set_product_primary_media(UUID,UUID), public.submit_product_for_review(UUID),
  public.review_catalog_product(UUID,TEXT,TEXT), public.publish_product(UUID), public.unpublish_product(UUID,TEXT)
TO authenticated;
