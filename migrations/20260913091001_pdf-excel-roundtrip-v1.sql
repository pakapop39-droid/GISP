-- PDF Catalog Excel Round-trip v1.0 — Development only.
-- Additive staging, immutable workbook history, RLS and atomic trusted apply RPCs.

CREATE TABLE public.catalog_import_enrichment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.catalog_import_jobs(id) ON DELETE RESTRICT,
  workbook_id UUID NOT NULL UNIQUE,
  schema_version TEXT NOT NULL DEFAULT 'PXR-1.0' CHECK (schema_version='PXR-1.0'),
  status TEXT NOT NULL DEFAULT 'EXPORTED' CHECK (status IN (
    'EXPORTED','READY_FOR_REVIEW','PARTIALLY_APPLIED','COMPLETED','CANCELLED','FAILED'
  )),
  export_file_id UUID REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  upload_file_id UUID REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  export_sha256 TEXT,
  upload_sha256 TEXT,
  exported_with_costs BOOLEAN NOT NULL DEFAULT FALSE,
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows BETWEEN 0 AND 1000),
  ready_detail_rows INTEGER NOT NULL DEFAULT 0 CHECK (ready_detail_rows >= 0),
  ready_cost_rows INTEGER NOT NULL DEFAULT 0 CHECK (ready_cost_rows >= 0),
  invalid_rows INTEGER NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  conflict_rows INTEGER NOT NULL DEFAULT 0 CHECK (conflict_rows >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((upload_file_id IS NULL)=(uploaded_at IS NULL))
);
CREATE INDEX catalog_import_enrichment_batches_job_idx
  ON public.catalog_import_enrichment_batches(import_job_id,created_at DESC);
CREATE TRIGGER catalog_import_enrichment_batches_updated_at
BEFORE UPDATE ON public.catalog_import_enrichment_batches
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE public.catalog_import_enrichment_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.catalog_import_enrichment_batches(id) ON DELETE CASCADE,
  row_key UUID NOT NULL,
  import_row_id UUID NOT NULL REFERENCES public.catalog_import_rows(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  row_number INTEGER NOT NULL CHECK (row_number BETWEEN 1 AND 1000),
  baseline_detail JSONB NOT NULL,
  baseline_cost JSONB,
  baseline_detail_hash TEXT NOT NULL,
  baseline_cost_hash TEXT,
  proposed_detail JSONB NOT NULL DEFAULT '{}'::JSONB,
  proposed_cost JSONB,
  detail_diff JSONB NOT NULL DEFAULT '{}'::JSONB,
  cost_diff JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  warning_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  existing_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  detail_status TEXT NOT NULL DEFAULT 'UNCHANGED' CHECK (detail_status IN (
    'READY','UNCHANGED','INVALID','CONFLICT','WAITING_FOR_DRAFT','APPLIED','CANCELLED'
  )),
  cost_status TEXT NOT NULL DEFAULT 'UNCHANGED' CHECK (cost_status IN (
    'READY','UNCHANGED','INVALID','CONFLICT','WAITING_FOR_DRAFT','APPLIED','CANCELLED'
  )),
  applied_product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  applied_cost_version_id UUID REFERENCES public.product_cost_versions(id) ON DELETE RESTRICT,
  price_preview JSONB,
  detail_applied_at TIMESTAMPTZ,
  cost_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id,row_key),
  UNIQUE(batch_id,import_row_id)
);
CREATE INDEX catalog_import_enrichment_rows_batch_idx
  ON public.catalog_import_enrichment_rows(batch_id,row_number);
CREATE INDEX catalog_import_enrichment_rows_target_idx
  ON public.catalog_import_enrichment_rows(import_row_id,product_id);
CREATE TRIGGER catalog_import_enrichment_rows_updated_at
BEFORE UPDATE ON public.catalog_import_enrichment_rows
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE public.catalog_import_enrichment_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.catalog_import_enrichment_batches(id) ON DELETE RESTRICT,
  action_type TEXT NOT NULL CHECK (action_type IN ('APPLY_DETAILS','APPLY_COSTS','CANCEL')),
  idempotency_key TEXT NOT NULL CHECK (LENGTH(idempotency_key) BETWEEN 8 AND 200),
  selected_row_ids UUID[],
  result JSONB NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id,action_type,idempotency_key)
);
CREATE INDEX catalog_import_enrichment_actions_batch_idx
  ON public.catalog_import_enrichment_actions(batch_id,created_at DESC);

ALTER TABLE public.catalog_import_enrichment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_enrichment_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_enrichment_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_import_enrichment_batches_read
ON public.catalog_import_enrichment_batches FOR SELECT TO authenticated
USING (public.has_permission('catalog.import'));

-- Rows contain confidential cost proposals. Non-cost users read the redacted
-- API projection; direct table reads require both import and cost-read rights.
CREATE POLICY catalog_import_enrichment_rows_cost_read
ON public.catalog_import_enrichment_rows FOR SELECT TO authenticated
USING (public.has_permission('catalog.import') AND public.has_permission('catalog.cost.read'));

REVOKE ALL ON public.catalog_import_enrichment_batches,
  public.catalog_import_enrichment_rows,
  public.catalog_import_enrichment_actions
FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.catalog_import_enrichment_batches TO authenticated;
GRANT SELECT ON public.catalog_import_enrichment_rows TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_catalog_enrichment_batch(batch_id_input UUID)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $$
DECLARE result JSONB; detail_ready INTEGER; cost_ready INTEGER; invalid_count INTEGER; conflict_count INTEGER; pending_count INTEGER; applied_count INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE detail_status='READY'),
    COUNT(*) FILTER (WHERE cost_status='READY'),
    COUNT(*) FILTER (WHERE detail_status='INVALID' OR cost_status='INVALID'),
    COUNT(*) FILTER (WHERE detail_status='CONFLICT' OR cost_status='CONFLICT'),
    COUNT(*) FILTER (WHERE detail_status IN ('READY','WAITING_FOR_DRAFT') OR cost_status IN ('READY','WAITING_FOR_DRAFT')),
    COUNT(*) FILTER (WHERE detail_status='APPLIED' OR cost_status='APPLIED')
  INTO detail_ready,cost_ready,invalid_count,conflict_count,pending_count,applied_count
  FROM public.catalog_import_enrichment_rows WHERE batch_id=batch_id_input;

  UPDATE public.catalog_import_enrichment_batches SET
    ready_detail_rows=detail_ready,ready_cost_rows=cost_ready,
    invalid_rows=invalid_count,conflict_rows=conflict_count,
    status=CASE
      WHEN status='CANCELLED' THEN 'CANCELLED'
      WHEN pending_count=0 AND applied_count>0 THEN 'COMPLETED'
      WHEN applied_count>0 THEN 'PARTIALLY_APPLIED'
      ELSE 'READY_FOR_REVIEW'
    END
  WHERE id=batch_id_input;
  result:=jsonb_build_object('batchId',batch_id_input,'readyDetails',detail_ready,'readyCosts',cost_ready,'invalid',invalid_count,'conflicts',conflict_count);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_catalog_enrichment_details(
  batch_id_input UUID,row_ids_input UUID[],idempotency_key_input TEXT
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $$
DECLARE batch_record RECORD; enrichment_record RECORD; import_record RECORD; product_record RECORD; current_detail JSONB; next_detail JSONB; result JSONB; selected_count INTEGER:=0; duplicate_id UUID;
BEGIN
  IF NOT public.has_permission('catalog.import') OR NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF idempotency_key_input IS NULL OR LENGTH(BTRIM(idempotency_key_input)) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'INVALID_INPUT: IDEMPOTENCY_KEY'; END IF;
  IF row_ids_input IS NOT NULL AND (cardinality(row_ids_input)<1 OR cardinality(row_ids_input)>500 OR cardinality(row_ids_input)<>(SELECT COUNT(DISTINCT value) FROM unnest(row_ids_input) value)) THEN RAISE EXCEPTION 'INVALID_INPUT: ROW_SELECTION'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(batch_id_input::TEXT||':DETAILS',0));
  SELECT action.result INTO result FROM public.catalog_import_enrichment_actions action
    WHERE action.batch_id=batch_id_input AND action.action_type='APPLY_DETAILS' AND action.idempotency_key=idempotency_key_input;
  IF result IS NOT NULL THEN RETURN result; END IF;
  SELECT batch.*,job.source_type,job.status AS job_status INTO batch_record
    FROM public.catalog_import_enrichment_batches batch
    JOIN public.catalog_import_jobs job ON job.id=batch.import_job_id
    WHERE batch.id=batch_id_input FOR UPDATE OF batch;
  IF batch_record.id IS NULL OR batch_record.source_type<>'PDF' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF batch_record.status IN ('CANCELLED','FAILED') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  SELECT COUNT(*) INTO selected_count FROM public.catalog_import_enrichment_rows row_record
    WHERE row_record.batch_id=batch_id_input AND row_record.detail_status='READY'
      AND (row_ids_input IS NULL OR row_record.id=ANY(row_ids_input));
  IF selected_count<1 OR selected_count>500 OR (row_ids_input IS NOT NULL AND selected_count<>cardinality(row_ids_input)) THEN RAISE EXCEPTION 'SELECTION_NOT_VALID'; END IF;

  FOR enrichment_record IN SELECT * FROM public.catalog_import_enrichment_rows row_record
    WHERE row_record.batch_id=batch_id_input AND row_record.detail_status='READY'
      AND (row_ids_input IS NULL OR row_record.id=ANY(row_ids_input)) ORDER BY row_number FOR UPDATE
  LOOP
    SELECT * INTO import_record FROM public.catalog_import_rows
      WHERE id=enrichment_record.import_row_id AND import_job_id=batch_record.import_job_id FOR UPDATE;
    IF import_record.id IS NULL OR import_record.product_id IS DISTINCT FROM enrichment_record.product_id THEN RAISE EXCEPTION 'CONFLICT: TARGET_LINKAGE'; END IF;
    IF enrichment_record.product_id IS NULL THEN
      current_detail:=jsonb_build_object(
        'sku',import_record.sku,'factory_sku',import_record.factory_sku,'name_th',import_record.name_th_draft,
        'name_en',import_record.name_en,'name_zh',import_record.name_zh,'product_type',import_record.product_type,
        'category_id',import_record.category_id,'country_code',BTRIM(import_record.country_code),
        'lead_time_days',import_record.lead_time_days,'width_mm',import_record.width_mm,'depth_mm',import_record.depth_mm,
        'height_mm',import_record.height_mm,'weight_kg',import_record.weight_kg,'cbm',import_record.cbm,
        'material_summary',import_record.material_summary,'finish_summary',import_record.finish_summary,'moq',import_record.moq,
        'description_th',import_record.description_th,'specification_summary',import_record.specification_summary);
    ELSE
      SELECT * INTO product_record FROM public.products WHERE id=enrichment_record.product_id FOR UPDATE;
      IF product_record.id IS NULL OR product_record.status NOT IN ('DRAFT','REVIEW') THEN RAISE EXCEPTION 'CONFLICT: PRODUCT_LIFECYCLE'; END IF;
      current_detail:=jsonb_build_object(
        'sku',product_record.sku,'factory_sku',product_record.factory_sku,'name_th',product_record.name_th,
        'name_en',product_record.name_en,'name_zh',product_record.name_zh,'product_type',product_record.product_type,
        'category_id',product_record.category_id,'country_code',BTRIM(product_record.country_code),
        'lead_time_days',product_record.default_lead_time_days,'width_mm',product_record.width_mm,'depth_mm',product_record.depth_mm,
        'height_mm',product_record.height_mm,'weight_kg',product_record.weight_kg,'cbm',product_record.cbm,
        'material_summary',product_record.material_summary,'finish_summary',product_record.finish_summary,'moq',product_record.moq,
        'description_th',product_record.description_th,'specification_summary',product_record.specification_summary);
    END IF;
    IF current_detail IS DISTINCT FROM enrichment_record.baseline_detail THEN RAISE EXCEPTION 'CONFLICT: DETAIL_BASELINE'; END IF;
    next_detail:=current_detail||enrichment_record.proposed_detail;
    IF NULLIF(BTRIM(next_detail->>'sku'),'') IS NULL OR NULLIF(BTRIM(next_detail->>'name_th'),'') IS NULL
      OR NULLIF(BTRIM(next_detail->>'product_type'),'') IS NULL OR NULLIF(BTRIM(next_detail->>'country_code'),'') IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT: REQUIRED_DETAIL'; END IF;
    IF (next_detail->>'product_type') NOT IN ('STANDARD','CUSTOM_TEMPLATE','READY_TO_ORDER','BUILT_IN','MATERIAL','EQUIPMENT','DECORATIVE')
      OR (next_detail->>'country_code') !~ '^[A-Z]{2}$' OR NOT EXISTS(SELECT 1 FROM public.countries c WHERE c.code=next_detail->>'country_code' AND c.status='ACTIVE')
      OR ((next_detail->>'category_id') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.categories c WHERE c.id=(next_detail->>'category_id')::UUID AND c.status='ACTIVE'))
      THEN RAISE EXCEPTION 'INVALID_INPUT: DETAIL_REFERENCE'; END IF;
    SELECT p.id INTO duplicate_id FROM public.products p WHERE UPPER(BTRIM(p.sku))=UPPER(BTRIM(next_detail->>'sku'))
      AND p.id IS DISTINCT FROM enrichment_record.product_id LIMIT 1;
    IF duplicate_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.catalog_import_rows other_row WHERE other_row.import_job_id=batch_record.import_job_id
      AND other_row.id<>import_record.id AND UPPER(BTRIM(other_row.sku))=UPPER(BTRIM(next_detail->>'sku'))) THEN RAISE EXCEPTION 'DUPLICATE_SKU'; END IF;

    IF enrichment_record.product_id IS NULL THEN
      UPDATE public.catalog_import_rows SET
        sku=UPPER(BTRIM(next_detail->>'sku')),factory_sku=next_detail->>'factory_sku',name_th_draft=next_detail->>'name_th',
        name_en=next_detail->>'name_en',name_zh=next_detail->>'name_zh',product_type=next_detail->>'product_type',
        category_id=(next_detail->>'category_id')::UUID,country_code=next_detail->>'country_code',
        lead_time_days=(next_detail->>'lead_time_days')::INTEGER,width_mm=(next_detail->>'width_mm')::NUMERIC,
        depth_mm=(next_detail->>'depth_mm')::NUMERIC,height_mm=(next_detail->>'height_mm')::NUMERIC,
        weight_kg=(next_detail->>'weight_kg')::NUMERIC,cbm=(next_detail->>'cbm')::NUMERIC,
        material_summary=next_detail->>'material_summary',finish_summary=next_detail->>'finish_summary',moq=(next_detail->>'moq')::NUMERIC,
        description_th=next_detail->>'description_th',specification_summary=next_detail->>'specification_summary',
        validation_status=CASE WHEN (next_detail->>'category_id') IS NULL OR selected_image_file_id IS NULL THEN 'REQUIRES_REVIEW' ELSE 'VALID' END,
        review_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,existing_product_id=NULL,updated_at=NOW()
      WHERE id=import_record.id;
    ELSE
      UPDATE public.products SET
        sku=UPPER(BTRIM(next_detail->>'sku')),factory_sku=next_detail->>'factory_sku',name_th=next_detail->>'name_th',
        name_en=next_detail->>'name_en',name_zh=next_detail->>'name_zh',product_type=next_detail->>'product_type',
        category_id=(next_detail->>'category_id')::UUID,country_code=next_detail->>'country_code',
        default_lead_time_days=(next_detail->>'lead_time_days')::INTEGER,width_mm=(next_detail->>'width_mm')::NUMERIC,
        depth_mm=(next_detail->>'depth_mm')::NUMERIC,height_mm=(next_detail->>'height_mm')::NUMERIC,
        weight_kg=(next_detail->>'weight_kg')::NUMERIC,cbm=(next_detail->>'cbm')::NUMERIC,
        material_summary=next_detail->>'material_summary',finish_summary=next_detail->>'finish_summary',moq=(next_detail->>'moq')::NUMERIC,
        description_th=next_detail->>'description_th',specification_summary=next_detail->>'specification_summary',
        status='DRAFT',qa_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,updated_at=NOW()
      WHERE id=enrichment_record.product_id;
    END IF;
    UPDATE public.catalog_import_enrichment_rows SET detail_status='APPLIED',applied_product_id=COALESCE(product_id,enrichment_record.product_id),detail_applied_at=NOW() WHERE id=enrichment_record.id;
    PERFORM public.write_audit_event(NULL,'catalog_import_enrichment_row',enrichment_record.id,'CATALOG_ENRICHMENT_DETAILS_APPLIED',current_detail,next_detail);
  END LOOP;
  result:=jsonb_build_object('batchId',batch_id_input,'applied',selected_count,'action','APPLY_DETAILS');
  INSERT INTO public.catalog_import_enrichment_actions(batch_id,action_type,idempotency_key,selected_row_ids,result,actor_user_id)
    VALUES(batch_id_input,'APPLY_DETAILS',idempotency_key_input,row_ids_input,result,(SELECT auth.uid()));
  PERFORM public.refresh_catalog_enrichment_batch(batch_id_input);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_catalog_enrichment_costs(
  batch_id_input UUID,row_ids_input UUID[],idempotency_key_input TEXT
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $$
DECLARE batch_record RECORD; enrichment_record RECORD; import_record RECORD; current_cost JSONB; result JSONB; selected_count INTEGER:=0; target_product_id UUID; cost_version_id UUID; preview JSONB; warnings TEXT[];
BEGIN
  IF NOT public.has_permission('catalog.import') OR NOT public.has_permission('catalog.cost.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF idempotency_key_input IS NULL OR LENGTH(BTRIM(idempotency_key_input)) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'INVALID_INPUT: IDEMPOTENCY_KEY'; END IF;
  IF row_ids_input IS NOT NULL AND (cardinality(row_ids_input)<1 OR cardinality(row_ids_input)>500 OR cardinality(row_ids_input)<>(SELECT COUNT(DISTINCT value) FROM unnest(row_ids_input) value)) THEN RAISE EXCEPTION 'INVALID_INPUT: ROW_SELECTION'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(batch_id_input::TEXT||':COSTS',0));
  SELECT action.result INTO result FROM public.catalog_import_enrichment_actions action
    WHERE action.batch_id=batch_id_input AND action.action_type='APPLY_COSTS' AND action.idempotency_key=idempotency_key_input;
  IF result IS NOT NULL THEN RETURN result; END IF;
  SELECT batch.*,job.source_type INTO batch_record FROM public.catalog_import_enrichment_batches batch
    JOIN public.catalog_import_jobs job ON job.id=batch.import_job_id WHERE batch.id=batch_id_input FOR UPDATE OF batch;
  IF batch_record.id IS NULL OR batch_record.source_type<>'PDF' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF batch_record.status IN ('CANCELLED','FAILED') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  -- Refresh pre-Draft proposals after the original PDF confirm links a product.
  UPDATE public.catalog_import_enrichment_rows enrichment SET product_id=import_row.product_id,cost_status='READY'
    FROM public.catalog_import_rows import_row
    WHERE enrichment.batch_id=batch_id_input AND enrichment.import_row_id=import_row.id
      AND enrichment.cost_status='WAITING_FOR_DRAFT' AND import_row.product_id IS NOT NULL
      AND enrichment.baseline_cost IS NULL AND NOT EXISTS(SELECT 1 FROM public.product_cost_versions cost WHERE cost.product_id=import_row.product_id AND cost.status='ACTIVE');

  SELECT COUNT(*) INTO selected_count FROM public.catalog_import_enrichment_rows row_record
    WHERE row_record.batch_id=batch_id_input AND row_record.cost_status='READY' AND row_record.proposed_cost IS NOT NULL
      AND (row_ids_input IS NULL OR row_record.id=ANY(row_ids_input));
  IF selected_count<1 OR selected_count>500 OR (row_ids_input IS NOT NULL AND selected_count<>cardinality(row_ids_input)) THEN RAISE EXCEPTION 'SELECTION_NOT_VALID'; END IF;

  FOR enrichment_record IN SELECT * FROM public.catalog_import_enrichment_rows row_record
    WHERE row_record.batch_id=batch_id_input AND row_record.cost_status='READY' AND row_record.proposed_cost IS NOT NULL
      AND (row_ids_input IS NULL OR row_record.id=ANY(row_ids_input)) ORDER BY row_number FOR UPDATE
  LOOP
    SELECT * INTO import_record FROM public.catalog_import_rows WHERE id=enrichment_record.import_row_id AND import_job_id=batch_record.import_job_id FOR UPDATE;
    target_product_id:=COALESCE(enrichment_record.product_id,import_record.product_id);
    IF target_product_id IS NULL OR import_record.product_id IS DISTINCT FROM target_product_id
      OR NOT EXISTS(SELECT 1 FROM public.products p WHERE p.id=target_product_id AND p.status IN ('DRAFT','REVIEW')) THEN RAISE EXCEPTION 'CONFLICT: PRODUCT_LIFECYCLE'; END IF;
    SELECT jsonb_build_object('factory_cost',cost.factory_cost,'currency',BTRIM(cost.currency),'exchange_rate_to_thb',cost.exchange_rate_to_thb,
      'effective_from',cost.effective_from,'status',cost.status) INTO current_cost
      FROM public.product_cost_versions cost WHERE cost.product_id=target_product_id AND cost.variant_id IS NULL AND cost.status='ACTIVE' LIMIT 1;
    IF current_cost IS DISTINCT FROM enrichment_record.baseline_cost THEN RAISE EXCEPTION 'CONFLICT: COST_BASELINE'; END IF;
    cost_version_id:=public.create_product_cost_version(target_product_id,NULL,(enrichment_record.proposed_cost->>'factory_cost')::NUMERIC,
      enrichment_record.proposed_cost->>'currency',(enrichment_record.proposed_cost->>'exchange_rate_to_thb')::NUMERIC,
      COALESCE((enrichment_record.proposed_cost->>'effective_from')::TIMESTAMPTZ,NOW()));
    preview:=NULL; warnings:=enrichment_record.warning_codes;
    BEGIN
      preview:=public.pricing_calculate_product_price(target_product_id,NULL,NULL,NOW());
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%ACTIVE_PRICING_FORMULA_REQUIRED%' THEN warnings:=array_append(warnings,'PRICE_FORMULA_NOT_AVAILABLE');
      ELSE RAISE; END IF;
    END;
    UPDATE public.catalog_import_enrichment_rows SET product_id=target_product_id,cost_status='APPLIED',
      applied_product_id=target_product_id,applied_cost_version_id=cost_version_id,price_preview=preview,
      warning_codes=warnings,cost_applied_at=NOW() WHERE id=enrichment_record.id;
    PERFORM public.write_audit_event(NULL,'catalog_import_enrichment_row',enrichment_record.id,'CATALOG_ENRICHMENT_COST_APPLIED',current_cost,
      jsonb_build_object('costVersionId',cost_version_id,'pricePreview',preview,'memberPriceActivated',FALSE));
  END LOOP;
  result:=jsonb_build_object('batchId',batch_id_input,'applied',selected_count,'action','APPLY_COSTS','memberPriceActivated',FALSE);
  INSERT INTO public.catalog_import_enrichment_actions(batch_id,action_type,idempotency_key,selected_row_ids,result,actor_user_id)
    VALUES(batch_id_input,'APPLY_COSTS',idempotency_key_input,row_ids_input,result,(SELECT auth.uid()));
  PERFORM public.refresh_catalog_enrichment_batch(batch_id_input);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_catalog_enrichment_batch(batch_id_input UUID)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $$
DECLARE batch_record RECORD; result JSONB;
BEGIN
  IF NOT public.has_permission('catalog.import') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO batch_record FROM public.catalog_import_enrichment_batches WHERE id=batch_id_input FOR UPDATE;
  IF batch_record.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF batch_record.status IN ('CANCELLED','FAILED','COMPLETED') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.catalog_import_enrichment_rows SET
    detail_status=CASE WHEN detail_status='APPLIED' THEN 'APPLIED' ELSE 'CANCELLED' END,
    cost_status=CASE WHEN cost_status='APPLIED' THEN 'APPLIED' ELSE 'CANCELLED' END
  WHERE batch_id=batch_id_input;
  UPDATE public.catalog_import_enrichment_batches SET status='CANCELLED',cancelled_by=(SELECT auth.uid()),cancelled_at=NOW() WHERE id=batch_id_input;
  result:=jsonb_build_object('batchId',batch_id_input,'status','CANCELLED');
  PERFORM public.write_audit_event(NULL,'catalog_import_enrichment_batch',batch_id_input,'CATALOG_ENRICHMENT_CANCELLED',NULL,result);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_catalog_enrichment_batch(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_catalog_enrichment_details(UUID,UUID[],TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_catalog_enrichment_costs(UUID,UUID[],TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_catalog_enrichment_batch(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_enrichment_details(UUID,UUID[],TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_enrichment_costs(UUID,UUID[],TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_catalog_enrichment_batch(UUID) TO authenticated;
