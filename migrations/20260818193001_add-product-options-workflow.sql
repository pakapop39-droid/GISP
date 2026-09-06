-- GISP Slice 2 — Supplier source fields and trusted Product Option workflow.
-- The source fields preserve the supplier identity used by the CN01 dry-run.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_product_code TEXT,
  ADD COLUMN IF NOT EXISTS source_row_number INTEGER,
  ADD COLUMN IF NOT EXISTS source_specification_raw TEXT;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_source_row_number_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_source_row_number_check
  CHECK (source_row_number IS NULL OR source_row_number > 0);

CREATE UNIQUE INDEX IF NOT EXISTS products_supplier_source_code_unique
  ON public.products(supplier_id, supplier_product_code)
  WHERE supplier_product_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_options_product_sort_idx
  ON public.product_options(product_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS product_option_values_option_sort_idx
  ON public.product_option_values(option_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION public.save_product_source_detail(
  product_id_input UUID,
  supplier_product_code_input TEXT,
  source_row_number_input INTEGER,
  source_specification_raw_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE before_value JSONB; current_status TEXT;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT to_jsonb(p), p.status INTO before_value, current_status
  FROM public.products p WHERE p.id=product_id_input FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF current_status NOT IN ('DRAFT','REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF source_row_number_input IS NOT NULL AND source_row_number_input<=0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: SOURCE_ROW';
  END IF;

  UPDATE public.products SET
    supplier_product_code=NULLIF(BTRIM(supplier_product_code_input),''),
    source_row_number=source_row_number_input,
    source_specification_raw=NULLIF(BTRIM(source_specification_raw_input),''),
    status='DRAFT', qa_status='NOT_REVIEWED', reviewed_by=NULL, reviewed_at=NULL,
    review_note=NULL, updated_at=NOW()
  WHERE id=product_id_input;
  PERFORM public.write_audit_event(NULL,'product',product_id_input,'SOURCE_DETAIL_SAVED',before_value,
    jsonb_build_object('supplierProductCode',NULLIF(BTRIM(supplier_product_code_input),''),'sourceRowNumber',source_row_number_input));
  RETURN product_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_product_option(
  option_id_input UUID,
  product_id_input UUID,
  name_input TEXT,
  is_required_input BOOLEAN
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE option_id_value UUID; product_status_value TEXT; before_value JSONB; next_sort INTEGER;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(name_input),'') IS NULL OR LENGTH(BTRIM(name_input))>120 THEN
    RAISE EXCEPTION 'INVALID_INPUT: PRODUCT_OPTION';
  END IF;
  SELECT status INTO product_status_value FROM public.products WHERE id=product_id_input FOR UPDATE;
  IF product_status_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF product_status_value NOT IN ('DRAFT','REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  IF option_id_input IS NULL THEN
    SELECT COALESCE(MAX(sort_order),0)+10 INTO next_sort FROM public.product_options WHERE product_id=product_id_input;
    INSERT INTO public.product_options(product_id,name,is_required,sort_order)
    VALUES(product_id_input,BTRIM(name_input),COALESCE(is_required_input,FALSE),next_sort)
    RETURNING id INTO option_id_value;
    PERFORM public.write_audit_event(NULL,'product_option',option_id_value,'CREATED',NULL,
      jsonb_build_object('productId',product_id_input,'name',BTRIM(name_input)));
  ELSE
    SELECT to_jsonb(o) INTO before_value FROM public.product_options o
    WHERE o.id=option_id_input AND o.product_id=product_id_input FOR UPDATE;
    IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    UPDATE public.product_options SET name=BTRIM(name_input),is_required=COALESCE(is_required_input,FALSE)
    WHERE id=option_id_input;
    option_id_value:=option_id_input;
    PERFORM public.write_audit_event(NULL,'product_option',option_id_value,'UPDATED',before_value,
      jsonb_build_object('name',BTRIM(name_input),'isRequired',COALESCE(is_required_input,FALSE)));
  END IF;
  UPDATE public.products SET status='DRAFT',qa_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=NOW()
  WHERE id=product_id_input;
  RETURN option_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_product_option_value(
  option_value_id_input UUID,
  option_id_input UUID,
  label_input TEXT,
  member_price_delta_input NUMERIC,
  factory_cost_delta_input NUMERIC
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE value_id UUID; product_id_value UUID; product_status_value TEXT; before_value JSONB; next_sort INTEGER;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(label_input),'') IS NULL OR LENGTH(BTRIM(label_input))>240
    OR COALESCE(member_price_delta_input,0)<0 OR COALESCE(factory_cost_delta_input,0)<0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: PRODUCT_OPTION_VALUE';
  END IF;
  SELECT o.product_id,p.status INTO product_id_value,product_status_value
  FROM public.product_options o JOIN public.products p ON p.id=o.product_id
  WHERE o.id=option_id_input FOR UPDATE OF p;
  IF product_id_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF product_status_value NOT IN ('DRAFT','REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  IF option_value_id_input IS NULL THEN
    SELECT COALESCE(MAX(sort_order),0)+10 INTO next_sort FROM public.product_option_values WHERE option_id=option_id_input;
    INSERT INTO public.product_option_values(option_id,label,member_price_delta,factory_cost_delta,status,sort_order)
    VALUES(option_id_input,BTRIM(label_input),COALESCE(member_price_delta_input,0),COALESCE(factory_cost_delta_input,0),'ACTIVE',next_sort)
    RETURNING id INTO value_id;
    PERFORM public.write_audit_event(NULL,'product_option_value',value_id,'CREATED',NULL,
      jsonb_build_object('optionId',option_id_input,'label',BTRIM(label_input)));
  ELSE
    SELECT to_jsonb(v) INTO before_value FROM public.product_option_values v
    WHERE v.id=option_value_id_input AND v.option_id=option_id_input FOR UPDATE;
    IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    UPDATE public.product_option_values SET label=BTRIM(label_input),member_price_delta=COALESCE(member_price_delta_input,0),
      factory_cost_delta=COALESCE(factory_cost_delta_input,0),status='ACTIVE'
    WHERE id=option_value_id_input;
    value_id:=option_value_id_input;
    PERFORM public.write_audit_event(NULL,'product_option_value',value_id,'UPDATED',before_value,
      jsonb_build_object('label',BTRIM(label_input),'status','ACTIVE'));
  END IF;
  UPDATE public.products SET status='DRAFT',qa_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=NOW()
  WHERE id=product_id_value;
  RETURN value_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_product_option_value_status(
  option_value_id_input UUID,
  status_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE product_id_value UUID; product_status_value TEXT; before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF status_input NOT IN ('ACTIVE','INACTIVE') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT o.product_id,p.status,to_jsonb(v) INTO product_id_value,product_status_value,before_value
  FROM public.product_option_values v
  JOIN public.product_options o ON o.id=v.option_id
  JOIN public.products p ON p.id=o.product_id
  WHERE v.id=option_value_id_input FOR UPDATE OF p,v;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF product_status_value NOT IN ('DRAFT','REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.product_option_values SET status=status_input WHERE id=option_value_id_input;
  UPDATE public.products SET status='DRAFT',qa_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=NOW()
  WHERE id=product_id_value;
  PERFORM public.write_audit_event(NULL,'product_option_value',option_value_id_input,'STATUS_CHANGED',before_value,
    jsonb_build_object('status',status_input));
  RETURN option_value_id_input;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.product_options, public.product_option_values FROM authenticated;
GRANT SELECT ON public.product_options, public.product_option_values TO authenticated;

REVOKE ALL ON FUNCTION public.save_product_source_detail(UUID,TEXT,INTEGER,TEXT),
  public.save_product_option(UUID,UUID,TEXT,BOOLEAN),
  public.save_product_option_value(UUID,UUID,TEXT,NUMERIC,NUMERIC),
  public.set_product_option_value_status(UUID,TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_product_source_detail(UUID,TEXT,INTEGER,TEXT),
  public.save_product_option(UUID,UUID,TEXT,BOOLEAN),
  public.save_product_option_value(UUID,UUID,TEXT,NUMERIC,NUMERIC),
  public.set_product_option_value_status(UUID,TEXT)
TO authenticated;
