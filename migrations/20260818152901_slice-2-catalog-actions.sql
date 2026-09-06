-- GISP Slice 2 — trusted Supplier and Product Draft actions.
-- Runs only on the isolated slice-2-catalog backend branch until merge approval.

CREATE OR REPLACE FUNCTION public.create_catalog_supplier(
  code_input TEXT,
  name_input TEXT,
  legal_name_input TEXT,
  country_code_input TEXT,
  default_currency_input TEXT,
  contact_name_input TEXT,
  contact_email_input TEXT,
  contact_phone_input TEXT,
  website_url_input TEXT,
  default_lead_time_days_input INTEGER
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  supplier_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NULLIF(BTRIM(code_input), '') IS NULL
    OR NULLIF(BTRIM(name_input), '') IS NULL
    OR UPPER(BTRIM(country_code_input)) !~ '^[A-Z]{2}$'
    OR UPPER(BTRIM(default_currency_input)) !~ '^[A-Z]{3}$'
    OR (default_lead_time_days_input IS NOT NULL AND default_lead_time_days_input <= 0)
    OR NOT EXISTS (
      SELECT 1 FROM public.countries c
      WHERE c.code = UPPER(BTRIM(country_code_input)) AND c.status = 'ACTIVE'
    )
  THEN
    RAISE EXCEPTION 'INVALID_INPUT: CATALOG_SUPPLIER';
  END IF;

  INSERT INTO public.suppliers(
    code, name, legal_name, country_code, default_currency,
    contact_name, contact_email, contact_phone, website_url,
    default_lead_time_days, status
  ) VALUES (
    UPPER(BTRIM(code_input)), BTRIM(name_input), NULLIF(BTRIM(legal_name_input), ''),
    UPPER(BTRIM(country_code_input)), UPPER(BTRIM(default_currency_input)),
    NULLIF(BTRIM(contact_name_input), ''), NULLIF(LOWER(BTRIM(contact_email_input)), ''),
    NULLIF(BTRIM(contact_phone_input), ''), NULLIF(BTRIM(website_url_input), ''),
    default_lead_time_days_input, 'PROSPECT'
  )
  RETURNING id INTO supplier_id_value;

  PERFORM public.write_audit_event(
    NULL, 'supplier', supplier_id_value, 'CREATED', NULL,
    jsonb_build_object(
      'code', UPPER(BTRIM(code_input)),
      'name', BTRIM(name_input),
      'status', 'PROSPECT'
    )
  );
  RETURN supplier_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_catalog_product_draft(
  supplier_id_input UUID,
  category_id_input UUID,
  sku_input TEXT,
  factory_sku_input TEXT,
  name_th_input TEXT,
  name_en_input TEXT,
  product_type_input TEXT,
  country_code_input TEXT,
  default_lead_time_days_input INTEGER
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  product_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NULLIF(BTRIM(sku_input), '') IS NULL
    OR NULLIF(BTRIM(name_th_input), '') IS NULL
    OR product_type_input NOT IN (
      'STANDARD','CUSTOM_TEMPLATE','READY_TO_ORDER','BUILT_IN',
      'MATERIAL','EQUIPMENT','DECORATIVE'
    )
    OR UPPER(BTRIM(country_code_input)) !~ '^[A-Z]{2}$'
    OR (default_lead_time_days_input IS NOT NULL AND default_lead_time_days_input <= 0)
    OR NOT EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_id_input AND s.status IN ('PROSPECT','ACTIVE')
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.countries c
      WHERE c.code = UPPER(BTRIM(country_code_input)) AND c.status = 'ACTIVE'
    )
    OR (category_id_input IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_id_input AND c.status = 'ACTIVE'
    ))
  THEN
    RAISE EXCEPTION 'INVALID_INPUT: CATALOG_PRODUCT';
  END IF;

  INSERT INTO public.products(
    supplier_id, category_id, sku, factory_sku, name_th, name_en,
    product_type, country_code, default_lead_time_days,
    status, qa_status, created_by
  ) VALUES (
    supplier_id_input, category_id_input, UPPER(BTRIM(sku_input)),
    NULLIF(BTRIM(factory_sku_input), ''), BTRIM(name_th_input),
    NULLIF(BTRIM(name_en_input), ''), product_type_input,
    UPPER(BTRIM(country_code_input)), default_lead_time_days_input,
    'DRAFT', 'NOT_REVIEWED', (SELECT auth.uid())
  )
  RETURNING id INTO product_id_value;

  PERFORM public.write_audit_event(
    NULL, 'product', product_id_value, 'DRAFT_CREATED', NULL,
    jsonb_build_object(
      'sku', UPPER(BTRIM(sku_input)),
      'supplierId', supplier_id_input,
      'workflow', 'DRAFT_COST_FORMULA_PRICE'
    )
  );
  RETURN product_id_value;
END;
$$;

REVOKE ALL ON FUNCTION public.create_catalog_supplier(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_catalog_product_draft(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_catalog_supplier(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_catalog_product_draft(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER
) TO authenticated;
