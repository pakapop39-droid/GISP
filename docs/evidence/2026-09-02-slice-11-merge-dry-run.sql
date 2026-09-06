-- Generated 2026-09-02T00:58:24.884Z
-- ⚠️ MERGE BLOCKED: 1 conflict(s) detected. Resolve before applying.

-- [CONFLICT] config_row schedules.jobs
--   parent_t0_hash:  b176e1268e807ad22bc8f9b15ac01387c9edbda9631b87309b308bf9c1f37e90
--   parent_now_hash: 604f21dc2ce1f998695d73b045455639a9d54ac444f1c2ff8e2c654ed998cd13
--   branch_now_hash: 02b7bec1f97ded1d207f08f8fa8cfec370535433eab0436bcaa71b4056852b5f
--   hint: Both parent and branch modified this object after branch creation. Resolve manually.

-- The SQL below is what would be applied if no conflicts existed; do NOT run as-is.

BEGIN;

-- ===== MIGRATION =====
-- [MIGRATION] migration system.20260901002810 (add)
-- Migration 20260901002810: slice-11-samples-warranty
ALTER TABLE public.material_samples
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS member_note TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;
UPDATE public.material_samples ms
SET display_name = COALESCE(
  NULLIF(BTRIM(ms.display_name), ''),
  (SELECT p.name_th FROM public.products p WHERE p.id = ms.product_id),
  (SELECT pov.label FROM public.product_option_values pov WHERE pov.id = ms.option_value_id),
  ms.sample_code
)
WHERE ms.display_name IS NULL OR BTRIM(ms.display_name) = '';
ALTER TABLE public.material_samples
  ALTER COLUMN display_name SET NOT NULL,
  DROP CONSTRAINT IF EXISTS material_samples_display_name_check,
  ADD CONSTRAINT material_samples_display_name_check
    CHECK (CHAR_LENGTH(BTRIM(display_name)) BETWEEN 2 AND 160),
  DROP CONSTRAINT IF EXISTS material_samples_sort_order_check,
  ADD CONSTRAINT material_samples_sort_order_check CHECK (sort_order BETWEEN 0 AND 10000);
CREATE INDEX IF NOT EXISTS material_samples_product_status_sort_idx
  ON public.material_samples(product_id, availability_status, sort_order, sample_code)
  WHERE product_id IS NOT NULL;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS warranty_version_id UUID
    REFERENCES public.partner_warranty_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS warranty_terms_snapshot JSONB;
CREATE OR REPLACE FUNCTION public.resolve_partner_warranty_snapshot(
  supplier_id_input UUID,
  product_id_input UUID,
  captured_at_input TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(warranty_version_id UUID, warranty_snapshot JSONB)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH selected AS (
    SELECT pw.*
    FROM public.partner_warranty_versions pw
    WHERE pw.supplier_id = supplier_id_input
      AND (pw.product_id = product_id_input OR pw.product_id IS NULL)
      AND pw.status IN ('ACTIVE', 'RETIRED')
      AND pw.effective_from <= captured_at_input
      AND (pw.effective_until IS NULL OR pw.effective_until > captured_at_input)
    ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
    LIMIT 1
  )
  SELECT
    selected.id,
    jsonb_build_object(
      'version_number', selected.version_number,
      'title', selected.title,
      'member_summary', selected.member_summary,
      'terms_text', selected.terms_text,
      'duration_months', selected.duration_months,
      'effective_from', selected.effective_from,
      'captured_at', captured_at_input,
      'source', 'PARTNER_WARRANTY'
    )
  FROM selected
  UNION ALL
  SELECT
    NULL::UUID,
    jsonb_build_object(
      'version_number', 1,
      'title', 'เงื่อนไขรับประกันของ Partner ณ วันที่สั่งซื้อ',
      'member_summary', 'ทีม GISP จะตรวจสอบตามหลักฐานและเงื่อนไขที่ผูกกับรายการสั่งซื้อ',
      'terms_text', 'การซ่อม เปลี่ยนสินค้า หรือชดเชยต้องผ่านการตรวจสอบของ Order Admin และไม่เกิดขึ้นอัตโนมัติ',
      'duration_months', NULL,
      'captured_at', captured_at_input,
      'source', 'DEFAULT'
    )
  WHERE NOT EXISTS (SELECT 1 FROM selected)
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.capture_order_item_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  product_id_value UUID;
  supplier_id_value UUID;
  resolved RECORD;
BEGIN
  SELECT pi.product_id INTO product_id_value
  FROM public.project_items pi
  WHERE pi.id = NEW.project_item_id;

  IF product_id_value IS NOT NULL THEN
    SELECT p.supplier_id INTO supplier_id_value
    FROM public.products p
    WHERE p.id = product_id_value;
  ELSE
    SELECT cqc.supplier_id INTO supplier_id_value
    FROM public.project_items pi
    JOIN public.custom_quotation_items cqi ON cqi.id = pi.quotation_item_id
    JOIN public.custom_quotation_costs cqc ON cqc.quotation_id = cqi.quotation_id
    WHERE pi.id = NEW.project_item_id;
  END IF;

  SELECT * INTO resolved
  FROM public.resolve_partner_warranty_snapshot(
    supplier_id_value,
    product_id_value,
    COALESCE(NEW.created_at, NOW())
  );

  NEW.warranty_version_id := resolved.warranty_version_id;
  NEW.warranty_terms_snapshot := resolved.warranty_snapshot;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_items_capture_warranty_snapshot ON public.order_items;
CREATE TRIGGER order_items_capture_warranty_snapshot
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.capture_order_item_warranty_snapshot();
DO $$
DECLARE
  item RECORD;
  resolved RECORD;
BEGIN
  FOR item IN
    SELECT oi.id, oi.created_at, pi.product_id, so.supplier_id
    FROM public.order_items oi
    JOIN public.project_items pi ON pi.id = oi.project_item_id
    LEFT JOIN public.supplier_order_items soi ON soi.order_item_id = oi.id
    LEFT JOIN public.supplier_orders so ON so.id = soi.supplier_order_id
    WHERE oi.warranty_terms_snapshot IS NULL
  LOOP
    SELECT * INTO resolved
    FROM public.resolve_partner_warranty_snapshot(
      item.supplier_id,
      item.product_id,
      item.created_at
    );
    UPDATE public.order_items
    SET warranty_version_id = resolved.warranty_version_id,
        warranty_terms_snapshot = resolved.warranty_snapshot
    WHERE id = item.id;
  END LOOP;
END;
$$;
ALTER TABLE public.order_items
  ALTER COLUMN warranty_terms_snapshot SET NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_warranty_version_idx
  ON public.order_items(warranty_version_id)
  WHERE warranty_version_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.protect_order_item_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  IF NEW.warranty_version_id IS DISTINCT FROM OLD.warranty_version_id
     OR NEW.warranty_terms_snapshot IS DISTINCT FROM OLD.warranty_terms_snapshot THEN
    RAISE EXCEPTION 'ORDER_WARRANTY_SNAPSHOT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_items_warranty_snapshot_immutable ON public.order_items;
CREATE TRIGGER order_items_warranty_snapshot_immutable
BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.protect_order_item_warranty_snapshot();
CREATE OR REPLACE FUNCTION public.apply_claim_order_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  order_item_record RECORD;
BEGIN
  SELECT oi.warranty_version_id, oi.warranty_terms_snapshot
  INTO order_item_record
  FROM public.order_items oi
  WHERE oi.id = NEW.order_item_id;

  IF order_item_record.warranty_terms_snapshot IS NOT NULL THEN
    NEW.warranty_version_id := order_item_record.warranty_version_id;
    NEW.warranty_snapshot := order_item_record.warranty_terms_snapshot;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS claims_apply_order_warranty_snapshot ON public.claims;
CREATE TRIGGER claims_apply_order_warranty_snapshot
BEFORE INSERT ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.apply_claim_order_warranty_snapshot();
CREATE OR REPLACE FUNCTION public.create_supplier_sample_location(
  supplier_id_input UUID,
  country_code_input TEXT,
  city_input TEXT,
  location_type_input TEXT,
  public_label_input TEXT,
  address_line_input TEXT DEFAULT NULL,
  contact_name_input TEXT DEFAULT NULL,
  contact_email_input TEXT DEFAULT NULL,
  contact_phone_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  location_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.sample.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF location_type_input NOT IN ('FACTORY','SHOWROOM','WAREHOUSE')
     OR NULLIF(BTRIM(city_input), '') IS NULL
     OR NULLIF(BTRIM(public_label_input), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: SAMPLE_LOCATION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id_input AND s.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT: SUPPLIER';
  END IF;

  INSERT INTO public.supplier_locations(
    supplier_id, country_code, city, location_type, public_label,
    address_line, contact_name, contact_email, contact_phone, status
  ) VALUES (
    supplier_id_input, UPPER(BTRIM(country_code_input)), BTRIM(city_input),
    location_type_input, BTRIM(public_label_input), NULLIF(BTRIM(address_line_input), ''),
    NULLIF(BTRIM(contact_name_input), ''), NULLIF(BTRIM(contact_email_input), ''),
    NULLIF(BTRIM(contact_phone_input), ''), 'ACTIVE'
  ) RETURNING id INTO location_id_value;

  PERFORM public.write_audit_event(
    NULL, 'supplier_location', location_id_value, 'CREATED', NULL,
    jsonb_build_object('supplierId', supplier_id_input, 'publicLabel', BTRIM(public_label_input))
  );
  RETURN location_id_value;
END;
$$;
CREATE OR REPLACE FUNCTION public.create_material_sample(
  product_id_input UUID,
  supplier_location_id_input UUID,
  sample_code_input TEXT,
  sample_type_input TEXT,
  display_name_input TEXT,
  member_note_input TEXT DEFAULT NULL,
  shelf_location_input TEXT DEFAULT NULL,
  internal_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  product_record RECORD;
  location_record RECORD;
  sample_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.sample.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF sample_type_input NOT IN ('MATERIAL_SWATCH','BUILT_IN_DISPLAY')
     OR NULLIF(BTRIM(sample_code_input), '') IS NULL
     OR CHAR_LENGTH(BTRIM(display_name_input)) < 2 THEN
    RAISE EXCEPTION 'INVALID_INPUT: MATERIAL_SAMPLE';
  END IF;

  SELECT p.id, p.supplier_id, p.product_type, p.status
  INTO product_record
  FROM public.products p
  WHERE p.id = product_id_input;
  SELECT sl.id, sl.supplier_id, sl.status
  INTO location_record
  FROM public.supplier_locations sl
  WHERE sl.id = supplier_location_id_input;

  IF product_record.id IS NULL OR location_record.id IS NULL
     OR product_record.supplier_id IS DISTINCT FROM location_record.supplier_id
     OR location_record.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'INVALID_INPUT: SAMPLE_PRODUCT_LOCATION';
  END IF;
  IF sample_type_input = 'BUILT_IN_DISPLAY'
     AND product_record.product_type <> 'BUILT_IN' THEN
    RAISE EXCEPTION 'INVALID_INPUT: BUILT_IN_DISPLAY_REQUIRES_BUILT_IN_PRODUCT';
  END IF;

  INSERT INTO public.material_samples(
    sample_code, sample_type, product_id, supplier_location_id, display_name,
    member_note, shelf_location, availability_status, internal_note, created_by
  ) VALUES (
    UPPER(BTRIM(sample_code_input)), sample_type_input, product_id_input,
    supplier_location_id_input, BTRIM(display_name_input),
    NULLIF(BTRIM(member_note_input), ''), NULLIF(BTRIM(shelf_location_input), ''),
    'AVAILABLE', NULLIF(BTRIM(internal_note_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO sample_id_value;

  PERFORM public.write_audit_event(
    NULL, 'material_sample', sample_id_value, 'CREATED', NULL,
    jsonb_build_object('sampleCode', UPPER(BTRIM(sample_code_input)),
      'sampleType', sample_type_input, 'productId', product_id_input)
  );
  RETURN sample_id_value;
END;
$$;
CREATE OR REPLACE FUNCTION public.set_material_sample_status(
  sample_id_input UUID,
  status_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.sample.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF status_input NOT IN ('AVAILABLE','BORROWED','UNAVAILABLE') THEN
    RAISE EXCEPTION 'INVALID_INPUT: SAMPLE_STATUS';
  END IF;
  SELECT to_jsonb(ms) INTO before_value
  FROM public.material_samples ms WHERE ms.id = sample_id_input FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  UPDATE public.material_samples
  SET availability_status = status_input
  WHERE id = sample_id_input;
  PERFORM public.write_audit_event(
    NULL, 'material_sample', sample_id_input, 'STATUS_CHANGED', before_value,
    jsonb_build_object('availabilityStatus', status_input)
  );
  RETURN sample_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.create_partner_warranty_draft(
  supplier_id_input UUID,
  product_id_input UUID,
  title_input TEXT,
  member_summary_input TEXT,
  terms_text_input TEXT,
  duration_months_input INTEGER,
  effective_from_input TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  warranty_id_value UUID;
  version_number_value INTEGER;
BEGIN
  IF NOT public.has_permission('catalog.warranty.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NULLIF(BTRIM(title_input), '') IS NULL
     OR NULLIF(BTRIM(member_summary_input), '') IS NULL
     OR NULLIF(BTRIM(terms_text_input), '') IS NULL
     OR (duration_months_input IS NOT NULL AND duration_months_input <= 0) THEN
    RAISE EXCEPTION 'INVALID_INPUT: PARTNER_WARRANTY';
  END IF;
  PERFORM 1 FROM public.suppliers s WHERE s.id = supplier_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id_input AND p.supplier_id = supplier_id_input
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT: WARRANTY_PRODUCT_SUPPLIER';
  END IF;

  SELECT COALESCE(MAX(pw.version_number), 0) + 1
  INTO version_number_value
  FROM public.partner_warranty_versions pw
  WHERE pw.supplier_id = supplier_id_input
    AND pw.product_id IS NOT DISTINCT FROM product_id_input;

  INSERT INTO public.partner_warranty_versions(
    supplier_id, product_id, version_number, title, member_summary, terms_text,
    duration_months, status, effective_from, created_by
  ) VALUES (
    supplier_id_input, product_id_input, version_number_value, BTRIM(title_input),
    BTRIM(member_summary_input), BTRIM(terms_text_input), duration_months_input,
    'DRAFT', COALESCE(effective_from_input, NOW()), (SELECT auth.uid())
  ) RETURNING id INTO warranty_id_value;

  PERFORM public.write_audit_event(
    NULL, 'partner_warranty', warranty_id_value, 'DRAFT_CREATED', NULL,
    jsonb_build_object('supplierId', supplier_id_input, 'productId', product_id_input,
      'versionNumber', version_number_value)
  );
  RETURN warranty_id_value;
END;
$$;
CREATE OR REPLACE FUNCTION public.activate_partner_warranty_version(
  warranty_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_record public.partner_warranty_versions%ROWTYPE;
BEGIN
  IF NOT public.has_permission('catalog.warranty.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  SELECT * INTO target_record
  FROM public.partner_warranty_versions
  WHERE id = warranty_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF target_record.status <> 'DRAFT' OR target_record.effective_from > NOW() THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: WARRANTY_NOT_ACTIVATABLE';
  END IF;

  UPDATE public.partner_warranty_versions
  SET status = 'RETIRED', effective_until = NOW()
  WHERE supplier_id = target_record.supplier_id
    AND product_id IS NOT DISTINCT FROM target_record.product_id
    AND status = 'ACTIVE';

  UPDATE public.partner_warranty_versions
  SET status = 'ACTIVE', effective_until = NULL,
      activated_by = (SELECT auth.uid()), activated_at = NOW()
  WHERE id = warranty_id_input;

  PERFORM public.write_audit_event(
    NULL, 'partner_warranty', warranty_id_input, 'ACTIVATED',
    jsonb_build_object('status', target_record.status),
    jsonb_build_object('status', 'ACTIVE', 'versionNumber', target_record.version_number)
  );
  RETURN warranty_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.retire_partner_warranty_version(
  warranty_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.warranty.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  SELECT to_jsonb(pw) INTO before_value
  FROM public.partner_warranty_versions pw
  WHERE pw.id = warranty_id_input AND pw.status = 'ACTIVE' FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  UPDATE public.partner_warranty_versions
  SET status = 'RETIRED', effective_until = NOW()
  WHERE id = warranty_id_input;
  PERFORM public.write_audit_event(
    NULL, 'partner_warranty', warranty_id_input, 'RETIRED', before_value,
    jsonb_build_object('status', 'RETIRED')
  );
  RETURN warranty_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_member_product_catalog_extras(
  product_id_input UUID
)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  samples_value JSONB;
  warranty_value JSONB;
BEGIN
  IF public.current_member_profile_id() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id_input AND p.status = 'PUBLISHED' AND p.qa_status = 'PASSED'
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ms.id,
    'sample_code', ms.sample_code,
    'sample_type', ms.sample_type,
    'display_name', ms.display_name,
    'member_note', ms.member_note,
    'availability_status', ms.availability_status,
    'country_code', sl.country_code,
    'city', sl.city,
    'public_location_label', sl.public_label
  ) ORDER BY ms.sort_order, ms.sample_code), '[]'::JSONB)
  INTO samples_value
  FROM public.material_samples ms
  JOIN public.supplier_locations sl ON sl.id = ms.supplier_location_id
  WHERE ms.product_id = product_id_input AND sl.status = 'ACTIVE';

  SELECT jsonb_build_object(
    'version_number', pw.version_number,
    'title', pw.title,
    'member_summary', pw.member_summary,
    'terms_text', pw.terms_text,
    'duration_months', pw.duration_months,
    'effective_from', pw.effective_from
  )
  INTO warranty_value
  FROM public.partner_warranty_versions pw
  JOIN public.products p ON p.id = product_id_input
  WHERE pw.supplier_id = p.supplier_id
    AND (pw.product_id = product_id_input OR pw.product_id IS NULL)
    AND pw.status = 'ACTIVE'
    AND pw.effective_from <= NOW()
    AND (pw.effective_until IS NULL OR pw.effective_until > NOW())
  ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'samples', samples_value,
    'warranty', warranty_value
  );
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_partner_warranty_snapshot(UUID,UUID,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_order_item_warranty_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_order_item_warranty_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_claim_order_warranty_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_supplier_sample_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_material_sample(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_material_sample_status(UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_partner_warranty_draft(UUID,UUID,TEXT,TEXT,TEXT,INTEGER,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_partner_warranty_version(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retire_partner_warranty_version(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_member_product_catalog_extras(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_sample_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_material_sample(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_material_sample_status(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_partner_warranty_draft(UUID,UUID,TEXT,TEXT,TEXT,INTEGER,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_partner_warranty_version(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retire_partner_warranty_version(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_product_catalog_extras(UUID) TO authenticated;
INSERT INTO "system"."custom_migrations" ("version", "name", "statements", "created_at") VALUES ('20260901002810', 'slice-11-samples-warranty', ARRAY['ALTER TABLE public.material_samples
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS member_note TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100', 'UPDATE public.material_samples ms
SET display_name = COALESCE(
  NULLIF(BTRIM(ms.display_name), ''''),
  (SELECT p.name_th FROM public.products p WHERE p.id = ms.product_id),
  (SELECT pov.label FROM public.product_option_values pov WHERE pov.id = ms.option_value_id),
  ms.sample_code
)
WHERE ms.display_name IS NULL OR BTRIM(ms.display_name) = ''''', 'ALTER TABLE public.material_samples
  ALTER COLUMN display_name SET NOT NULL,
  DROP CONSTRAINT IF EXISTS material_samples_display_name_check,
  ADD CONSTRAINT material_samples_display_name_check
    CHECK (CHAR_LENGTH(BTRIM(display_name)) BETWEEN 2 AND 160),
  DROP CONSTRAINT IF EXISTS material_samples_sort_order_check,
  ADD CONSTRAINT material_samples_sort_order_check CHECK (sort_order BETWEEN 0 AND 10000)', 'CREATE INDEX IF NOT EXISTS material_samples_product_status_sort_idx
  ON public.material_samples(product_id, availability_status, sort_order, sample_code)
  WHERE product_id IS NOT NULL', 'ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS warranty_version_id UUID
    REFERENCES public.partner_warranty_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS warranty_terms_snapshot JSONB', 'CREATE OR REPLACE FUNCTION public.resolve_partner_warranty_snapshot(
  supplier_id_input UUID,
  product_id_input UUID,
  captured_at_input TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(warranty_version_id UUID, warranty_snapshot JSONB)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH selected AS (
    SELECT pw.*
    FROM public.partner_warranty_versions pw
    WHERE pw.supplier_id = supplier_id_input
      AND (pw.product_id = product_id_input OR pw.product_id IS NULL)
      AND pw.status IN (''ACTIVE'', ''RETIRED'')
      AND pw.effective_from <= captured_at_input
      AND (pw.effective_until IS NULL OR pw.effective_until > captured_at_input)
    ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
    LIMIT 1
  )
  SELECT
    selected.id,
    jsonb_build_object(
      ''version_number'', selected.version_number,
      ''title'', selected.title,
      ''member_summary'', selected.member_summary,
      ''terms_text'', selected.terms_text,
      ''duration_months'', selected.duration_months,
      ''effective_from'', selected.effective_from,
      ''captured_at'', captured_at_input,
      ''source'', ''PARTNER_WARRANTY''
    )
  FROM selected
  UNION ALL
  SELECT
    NULL::UUID,
    jsonb_build_object(
      ''version_number'', 1,
      ''title'', ''เงื่อนไขรับประกันของ Partner ณ วันที่สั่งซื้อ'',
      ''member_summary'', ''ทีม GISP จะตรวจสอบตามหลักฐานและเงื่อนไขที่ผูกกับรายการสั่งซื้อ'',
      ''terms_text'', ''การซ่อม เปลี่ยนสินค้า หรือชดเชยต้องผ่านการตรวจสอบของ Order Admin และไม่เกิดขึ้นอัตโนมัติ'',
      ''duration_months'', NULL,
      ''captured_at'', captured_at_input,
      ''source'', ''DEFAULT''
    )
  WHERE NOT EXISTS (SELECT 1 FROM selected)
  LIMIT 1;
$$', 'CREATE OR REPLACE FUNCTION public.capture_order_item_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  product_id_value UUID;
  supplier_id_value UUID;
  resolved RECORD;
BEGIN
  SELECT pi.product_id INTO product_id_value
  FROM public.project_items pi
  WHERE pi.id = NEW.project_item_id;

  IF product_id_value IS NOT NULL THEN
    SELECT p.supplier_id INTO supplier_id_value
    FROM public.products p
    WHERE p.id = product_id_value;
  ELSE
    SELECT cqc.supplier_id INTO supplier_id_value
    FROM public.project_items pi
    JOIN public.custom_quotation_items cqi ON cqi.id = pi.quotation_item_id
    JOIN public.custom_quotation_costs cqc ON cqc.quotation_id = cqi.quotation_id
    WHERE pi.id = NEW.project_item_id;
  END IF;

  SELECT * INTO resolved
  FROM public.resolve_partner_warranty_snapshot(
    supplier_id_value,
    product_id_value,
    COALESCE(NEW.created_at, NOW())
  );

  NEW.warranty_version_id := resolved.warranty_version_id;
  NEW.warranty_terms_snapshot := resolved.warranty_snapshot;
  RETURN NEW;
END;
$$', 'DROP TRIGGER IF EXISTS order_items_capture_warranty_snapshot ON public.order_items', 'CREATE TRIGGER order_items_capture_warranty_snapshot
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.capture_order_item_warranty_snapshot()', 'DO $$
DECLARE
  item RECORD;
  resolved RECORD;
BEGIN
  FOR item IN
    SELECT oi.id, oi.created_at, pi.product_id, so.supplier_id
    FROM public.order_items oi
    JOIN public.project_items pi ON pi.id = oi.project_item_id
    LEFT JOIN public.supplier_order_items soi ON soi.order_item_id = oi.id
    LEFT JOIN public.supplier_orders so ON so.id = soi.supplier_order_id
    WHERE oi.warranty_terms_snapshot IS NULL
  LOOP
    SELECT * INTO resolved
    FROM public.resolve_partner_warranty_snapshot(
      item.supplier_id,
      item.product_id,
      item.created_at
    );
    UPDATE public.order_items
    SET warranty_version_id = resolved.warranty_version_id,
        warranty_terms_snapshot = resolved.warranty_snapshot
    WHERE id = item.id;
  END LOOP;
END;
$$', 'ALTER TABLE public.order_items
  ALTER COLUMN warranty_terms_snapshot SET NOT NULL', 'CREATE INDEX IF NOT EXISTS order_items_warranty_version_idx
  ON public.order_items(warranty_version_id)
  WHERE warranty_version_id IS NOT NULL', 'CREATE OR REPLACE FUNCTION public.protect_order_item_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  IF NEW.warranty_version_id IS DISTINCT FROM OLD.warranty_version_id
     OR NEW.warranty_terms_snapshot IS DISTINCT FROM OLD.warranty_terms_snapshot THEN
    RAISE EXCEPTION ''ORDER_WARRANTY_SNAPSHOT_IMMUTABLE'';
  END IF;
  RETURN NEW;
END;
$$', 'DROP TRIGGER IF EXISTS order_items_warranty_snapshot_immutable ON public.order_items', 'CREATE TRIGGER order_items_warranty_snapshot_immutable
BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.protect_order_item_warranty_snapshot()', 'CREATE OR REPLACE FUNCTION public.apply_claim_order_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  order_item_record RECORD;
BEGIN
  SELECT oi.warranty_version_id, oi.warranty_terms_snapshot
  INTO order_item_record
  FROM public.order_items oi
  WHERE oi.id = NEW.order_item_id;

  IF order_item_record.warranty_terms_snapshot IS NOT NULL THEN
    NEW.warranty_version_id := order_item_record.warranty_version_id;
    NEW.warranty_snapshot := order_item_record.warranty_terms_snapshot;
  END IF;
  RETURN NEW;
END;
$$', 'DROP TRIGGER IF EXISTS claims_apply_order_warranty_snapshot ON public.claims', 'CREATE TRIGGER claims_apply_order_warranty_snapshot
BEFORE INSERT ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.apply_claim_order_warranty_snapshot()', 'CREATE OR REPLACE FUNCTION public.create_supplier_sample_location(
  supplier_id_input UUID,
  country_code_input TEXT,
  city_input TEXT,
  location_type_input TEXT,
  public_label_input TEXT,
  address_line_input TEXT DEFAULT NULL,
  contact_name_input TEXT DEFAULT NULL,
  contact_email_input TEXT DEFAULT NULL,
  contact_phone_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  location_id_value UUID;
BEGIN
  IF NOT public.has_permission(''catalog.sample.manage'') THEN
    RAISE EXCEPTION ''PERMISSION_DENIED'';
  END IF;
  IF location_type_input NOT IN (''FACTORY'',''SHOWROOM'',''WAREHOUSE'')
     OR NULLIF(BTRIM(city_input), '''') IS NULL
     OR NULLIF(BTRIM(public_label_input), '''') IS NULL THEN
    RAISE EXCEPTION ''INVALID_INPUT: SAMPLE_LOCATION'';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id_input AND s.status = ''ACTIVE''
  ) THEN
    RAISE EXCEPTION ''INVALID_INPUT: SUPPLIER'';
  END IF;

  INSERT INTO public.supplier_locations(
    supplier_id, country_code, city, location_type, public_label,
    address_line, contact_name, contact_email, contact_phone, status
  ) VALUES (
    supplier_id_input, UPPER(BTRIM(country_code_input)), BTRIM(city_input),
    location_type_input, BTRIM(public_label_input), NULLIF(BTRIM(address_line_input), ''''),
    NULLIF(BTRIM(contact_name_input), ''''), NULLIF(BTRIM(contact_email_input), ''''),
    NULLIF(BTRIM(contact_phone_input), ''''), ''ACTIVE''
  ) RETURNING id INTO location_id_value;

  PERFORM public.write_audit_event(
    NULL, ''supplier_location'', location_id_value, ''CREATED'', NULL,
    jsonb_build_object(''supplierId'', supplier_id_input, ''publicLabel'', BTRIM(public_label_input))
  );
  RETURN location_id_value;
END;
$$', 'CREATE OR REPLACE FUNCTION public.create_material_sample(
  product_id_input UUID,
  supplier_location_id_input UUID,
  sample_code_input TEXT,
  sample_type_input TEXT,
  display_name_input TEXT,
  member_note_input TEXT DEFAULT NULL,
  shelf_location_input TEXT DEFAULT NULL,
  internal_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  product_record RECORD;
  location_record RECORD;
  sample_id_value UUID;
BEGIN
  IF NOT public.has_permission(''catalog.sample.manage'') THEN
    RAISE EXCEPTION ''PERMISSION_DENIED'';
  END IF;
  IF sample_type_input NOT IN (''MATERIAL_SWATCH'',''BUILT_IN_DISPLAY'')
     OR NULLIF(BTRIM(sample_code_input), '''') IS NULL
     OR CHAR_LENGTH(BTRIM(display_name_input)) < 2 THEN
    RAISE EXCEPTION ''INVALID_INPUT: MATERIAL_SAMPLE'';
  END IF;

  SELECT p.id, p.supplier_id, p.product_type, p.status
  INTO product_record
  FROM public.products p
  WHERE p.id = product_id_input;
  SELECT sl.id, sl.supplier_id, sl.status
  INTO location_record
  FROM public.supplier_locations sl
  WHERE sl.id = supplier_location_id_input;

  IF product_record.id IS NULL OR location_record.id IS NULL
     OR product_record.supplier_id IS DISTINCT FROM location_record.supplier_id
     OR location_record.status <> ''ACTIVE'' THEN
    RAISE EXCEPTION ''INVALID_INPUT: SAMPLE_PRODUCT_LOCATION'';
  END IF;
  IF sample_type_input = ''BUILT_IN_DISPLAY''
     AND product_record.product_type <> ''BUILT_IN'' THEN
    RAISE EXCEPTION ''INVALID_INPUT: BUILT_IN_DISPLAY_REQUIRES_BUILT_IN_PRODUCT'';
  END IF;

  INSERT INTO public.material_samples(
    sample_code, sample_type, product_id, supplier_location_id, display_name,
    member_note, shelf_location, availability_status, internal_note, created_by
  ) VALUES (
    UPPER(BTRIM(sample_code_input)), sample_type_input, product_id_input,
    supplier_location_id_input, BTRIM(display_name_input),
    NULLIF(BTRIM(member_note_input), ''''), NULLIF(BTRIM(shelf_location_input), ''''),
    ''AVAILABLE'', NULLIF(BTRIM(internal_note_input), ''''), (SELECT auth.uid())
  ) RETURNING id INTO sample_id_value;

  PERFORM public.write_audit_event(
    NULL, ''material_sample'', sample_id_value, ''CREATED'', NULL,
    jsonb_build_object(''sampleCode'', UPPER(BTRIM(sample_code_input)),
      ''sampleType'', sample_type_input, ''productId'', product_id_input)
  );
  RETURN sample_id_value;
END;
$$', 'CREATE OR REPLACE FUNCTION public.set_material_sample_status(
  sample_id_input UUID,
  status_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  before_value JSONB;
BEGIN
  IF NOT public.has_permission(''catalog.sample.manage'') THEN
    RAISE EXCEPTION ''PERMISSION_DENIED'';
  END IF;
  IF status_input NOT IN (''AVAILABLE'',''BORROWED'',''UNAVAILABLE'') THEN
    RAISE EXCEPTION ''INVALID_INPUT: SAMPLE_STATUS'';
  END IF;
  SELECT to_jsonb(ms) INTO before_value
  FROM public.material_samples ms WHERE ms.id = sample_id_input FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION ''NOT_FOUND''; END IF;

  UPDATE public.material_samples
  SET availability_status = status_input
  WHERE id = sample_id_input;
  PERFORM public.write_audit_event(
    NULL, ''material_sample'', sample_id_input, ''STATUS_CHANGED'', before_value,
    jsonb_build_object(''availabilityStatus'', status_input)
  );
  RETURN sample_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.create_partner_warranty_draft(
  supplier_id_input UUID,
  product_id_input UUID,
  title_input TEXT,
  member_summary_input TEXT,
  terms_text_input TEXT,
  duration_months_input INTEGER,
  effective_from_input TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  warranty_id_value UUID;
  version_number_value INTEGER;
BEGIN
  IF NOT public.has_permission(''catalog.warranty.manage'') THEN
    RAISE EXCEPTION ''PERMISSION_DENIED'';
  END IF;
  IF NULLIF(BTRIM(title_input), '''') IS NULL
     OR NULLIF(BTRIM(member_summary_input), '''') IS NULL
     OR NULLIF(BTRIM(terms_text_input), '''') IS NULL
     OR (duration_months_input IS NOT NULL AND duration_months_input <= 0) THEN
    RAISE EXCEPTION ''INVALID_INPUT: PARTNER_WARRANTY'';
  END IF;
  PERFORM 1 FROM public.suppliers s WHERE s.id = supplier_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''NOT_FOUND''; END IF;
  IF product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id_input AND p.supplier_id = supplier_id_input
  ) THEN
    RAISE EXCEPTION ''INVALID_INPUT: WARRANTY_PRODUCT_SUPPLIER'';
  END IF;

  SELECT COALESCE(MAX(pw.version_number), 0) + 1
  INTO version_number_value
  FROM public.partner_warranty_versions pw
  WHERE pw.supplier_id = supplier_id_input
    AND pw.product_id IS NOT DISTINCT FROM product_id_input;

  INSERT INTO public.partner_warranty_versions(
    supplier_id, product_id, version_number, title, member_summary, terms_text,
    duration_months, status, effective_from, created_by
  ) VALUES (
    supplier_id_input, product_id_input, version_number_value, BTRIM(title_input),
    BTRIM(member_summary_input), BTRIM(terms_text_input), duration_months_input,
    ''DRAFT'', COALESCE(effective_from_input, NOW()), (SELECT auth.uid())
  ) RETURNING id INTO warranty_id_value;

  PERFORM public.write_audit_event(
    NULL, ''partner_warranty'', warranty_id_value, ''DRAFT_CREATED'', NULL,
    jsonb_build_object(''supplierId'', supplier_id_input, ''productId'', product_id_input,
      ''versionNumber'', version_number_value)
  );
  RETURN warranty_id_value;
END;
$$', 'CREATE OR REPLACE FUNCTION public.activate_partner_warranty_version(
  warranty_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_record public.partner_warranty_versions%ROWTYPE;
BEGIN
  IF NOT public.has_permission(''catalog.warranty.manage'') THEN
    RAISE EXCEPTION ''PERMISSION_DENIED'';
  END IF;
  SELECT * INTO target_record
  FROM public.partner_warranty_versions
  WHERE id = warranty_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''NOT_FOUND''; END IF;
  IF target_record.status <> ''DRAFT'' OR target_record.effective_from > NOW() THEN
    RAISE EXCEPTION ''INVALID_TRANSITION: WARRANTY_NOT_ACTIVATABLE'';
  END IF;

  UPDATE public.partner_warranty_versions
  SET status = ''RETIRED'', effective_until = NOW()
  WHERE supplier_id = target_record.supplier_id
    AND product_id IS NOT DISTINCT FROM target_record.product_id
    AND status = ''ACTIVE'';

  UPDATE public.partner_warranty_versions
  SET status = ''ACTIVE'', effective_until = NULL,
      activated_by = (SELECT auth.uid()), activated_at = NOW()
  WHERE id = warranty_id_input;

  PERFORM public.write_audit_event(
    NULL, ''partner_warranty'', warranty_id_input, ''ACTIVATED'',
    jsonb_build_object(''status'', target_record.status),
    jsonb_build_object(''status'', ''ACTIVE'', ''versionNumber'', target_record.version_number)
  );
  RETURN warranty_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.retire_partner_warranty_version(
  warranty_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  before_value JSONB;
BEGIN
  IF NOT public.has_permission(''catalog.warranty.manage'') THEN
    RAISE EXCEPTION ''PERMISSION_DENIED'';
  END IF;
  SELECT to_jsonb(pw) INTO before_value
  FROM public.partner_warranty_versions pw
  WHERE pw.id = warranty_id_input AND pw.status = ''ACTIVE'' FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION ''INVALID_TRANSITION''; END IF;

  UPDATE public.partner_warranty_versions
  SET status = ''RETIRED'', effective_until = NOW()
  WHERE id = warranty_id_input;
  PERFORM public.write_audit_event(
    NULL, ''partner_warranty'', warranty_id_input, ''RETIRED'', before_value,
    jsonb_build_object(''status'', ''RETIRED'')
  );
  RETURN warranty_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.get_member_product_catalog_extras(
  product_id_input UUID
)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  samples_value JSONB;
  warranty_value JSONB;
BEGIN
  IF public.current_member_profile_id() IS NULL THEN
    RAISE EXCEPTION ''PERMISSION_DENIED'';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id_input AND p.status = ''PUBLISHED'' AND p.qa_status = ''PASSED''
  ) THEN
    RAISE EXCEPTION ''NOT_FOUND'';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    ''id'', ms.id,
    ''sample_code'', ms.sample_code,
    ''sample_type'', ms.sample_type,
    ''display_name'', ms.display_name,
    ''member_note'', ms.member_note,
    ''availability_status'', ms.availability_status,
    ''country_code'', sl.country_code,
    ''city'', sl.city,
    ''public_location_label'', sl.public_label
  ) ORDER BY ms.sort_order, ms.sample_code), ''[]''::JSONB)
  INTO samples_value
  FROM public.material_samples ms
  JOIN public.supplier_locations sl ON sl.id = ms.supplier_location_id
  WHERE ms.product_id = product_id_input AND sl.status = ''ACTIVE'';

  SELECT jsonb_build_object(
    ''version_number'', pw.version_number,
    ''title'', pw.title,
    ''member_summary'', pw.member_summary,
    ''terms_text'', pw.terms_text,
    ''duration_months'', pw.duration_months,
    ''effective_from'', pw.effective_from
  )
  INTO warranty_value
  FROM public.partner_warranty_versions pw
  JOIN public.products p ON p.id = product_id_input
  WHERE pw.supplier_id = p.supplier_id
    AND (pw.product_id = product_id_input OR pw.product_id IS NULL)
    AND pw.status = ''ACTIVE''
    AND pw.effective_from <= NOW()
    AND (pw.effective_until IS NULL OR pw.effective_until > NOW())
  ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    ''samples'', samples_value,
    ''warranty'', warranty_value
  );
END;
$$', 'REVOKE ALL ON FUNCTION public.resolve_partner_warranty_snapshot(UUID,UUID,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.capture_order_item_warranty_snapshot() FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.protect_order_item_warranty_snapshot() FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.apply_claim_order_warranty_snapshot() FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.create_supplier_sample_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.create_material_sample(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.set_material_sample_status(UUID,TEXT) FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.create_partner_warranty_draft(UUID,UUID,TEXT,TEXT,TEXT,INTEGER,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.activate_partner_warranty_version(UUID) FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.retire_partner_warranty_version(UUID) FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.get_member_product_catalog_extras(UUID) FROM PUBLIC, anon, authenticated', 'GRANT EXECUTE ON FUNCTION public.create_supplier_sample_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.create_material_sample(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.set_material_sample_status(UUID,TEXT) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.create_partner_warranty_draft(UUID,UUID,TEXT,TEXT,TEXT,INTEGER,TIMESTAMPTZ) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.activate_partner_warranty_version(UUID) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.retire_partner_warranty_version(UUID) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.get_member_product_catalog_extras(UUID) TO authenticated'], '2026-09-01T00:30:31.265337+00:00')
  ON CONFLICT ("version") DO UPDATE SET "name" = EXCLUDED."name", "statements" = EXCLUDED."statements", "created_at" = EXCLUDED."created_at";

-- ===== DDL =====
-- [DDL] table public.order_items (modify)
-- not auto-applied: table modify diffs are not auto-applied — capture the change in a migration on branch.

-- [DDL] table public.material_samples (modify)
-- not auto-applied: table modify diffs are not auto-applied — capture the change in a migration on branch.

-- [DDL] function public.apply_claim_order_warranty_snapshot() (add)
CREATE OR REPLACE FUNCTION public.apply_claim_order_warranty_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  order_item_record RECORD;
BEGIN
  SELECT oi.warranty_version_id, oi.warranty_terms_snapshot
  INTO order_item_record
  FROM public.order_items oi
  WHERE oi.id = NEW.order_item_id;

  IF order_item_record.warranty_terms_snapshot IS NOT NULL THEN
    NEW.warranty_version_id := order_item_record.warranty_version_id;
    NEW.warranty_snapshot := order_item_record.warranty_terms_snapshot;
  END IF;
  RETURN NEW;
END;
$function$;

-- [DDL] function public.capture_order_item_warranty_snapshot() (add)
CREATE OR REPLACE FUNCTION public.capture_order_item_warranty_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  product_id_value UUID;
  supplier_id_value UUID;
  resolved RECORD;
BEGIN
  SELECT pi.product_id INTO product_id_value
  FROM public.project_items pi
  WHERE pi.id = NEW.project_item_id;

  IF product_id_value IS NOT NULL THEN
    SELECT p.supplier_id INTO supplier_id_value
    FROM public.products p
    WHERE p.id = product_id_value;
  ELSE
    SELECT cqc.supplier_id INTO supplier_id_value
    FROM public.project_items pi
    JOIN public.custom_quotation_items cqi ON cqi.id = pi.quotation_item_id
    JOIN public.custom_quotation_costs cqc ON cqc.quotation_id = cqi.quotation_id
    WHERE pi.id = NEW.project_item_id;
  END IF;

  SELECT * INTO resolved
  FROM public.resolve_partner_warranty_snapshot(
    supplier_id_value,
    product_id_value,
    COALESCE(NEW.created_at, NOW())
  );

  NEW.warranty_version_id := resolved.warranty_version_id;
  NEW.warranty_terms_snapshot := resolved.warranty_snapshot;
  RETURN NEW;
END;
$function$;

-- [DDL] function public.protect_order_item_warranty_snapshot() (add)
CREATE OR REPLACE FUNCTION public.protect_order_item_warranty_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.warranty_version_id IS DISTINCT FROM OLD.warranty_version_id
     OR NEW.warranty_terms_snapshot IS DISTINCT FROM OLD.warranty_terms_snapshot THEN
    RAISE EXCEPTION 'ORDER_WARRANTY_SNAPSHOT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$function$;

-- [DDL] function public.retire_partner_warranty_version(warranty_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.retire_partner_warranty_version(warranty_id_input uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.warranty.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  SELECT to_jsonb(pw) INTO before_value
  FROM public.partner_warranty_versions pw
  WHERE pw.id = warranty_id_input AND pw.status = 'ACTIVE' FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  UPDATE public.partner_warranty_versions
  SET status = 'RETIRED', effective_until = NOW()
  WHERE id = warranty_id_input;
  PERFORM public.write_audit_event(
    NULL, 'partner_warranty', warranty_id_input, 'RETIRED', before_value,
    jsonb_build_object('status', 'RETIRED')
  );
  RETURN warranty_id_input;
END;
$function$;

-- [DDL] function public.get_member_product_catalog_extras(product_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.get_member_product_catalog_extras(product_id_input uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  samples_value JSONB;
  warranty_value JSONB;
BEGIN
  IF public.current_member_profile_id() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id_input AND p.status = 'PUBLISHED' AND p.qa_status = 'PASSED'
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ms.id,
    'sample_code', ms.sample_code,
    'sample_type', ms.sample_type,
    'display_name', ms.display_name,
    'member_note', ms.member_note,
    'availability_status', ms.availability_status,
    'country_code', sl.country_code,
    'city', sl.city,
    'public_location_label', sl.public_label
  ) ORDER BY ms.sort_order, ms.sample_code), '[]'::JSONB)
  INTO samples_value
  FROM public.material_samples ms
  JOIN public.supplier_locations sl ON sl.id = ms.supplier_location_id
  WHERE ms.product_id = product_id_input AND sl.status = 'ACTIVE';

  SELECT jsonb_build_object(
    'version_number', pw.version_number,
    'title', pw.title,
    'member_summary', pw.member_summary,
    'terms_text', pw.terms_text,
    'duration_months', pw.duration_months,
    'effective_from', pw.effective_from
  )
  INTO warranty_value
  FROM public.partner_warranty_versions pw
  JOIN public.products p ON p.id = product_id_input
  WHERE pw.supplier_id = p.supplier_id
    AND (pw.product_id = product_id_input OR pw.product_id IS NULL)
    AND pw.status = 'ACTIVE'
    AND pw.effective_from <= NOW()
    AND (pw.effective_until IS NULL OR pw.effective_until > NOW())
  ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'samples', samples_value,
    'warranty', warranty_value
  );
END;
$function$;

-- [DDL] function public.activate_partner_warranty_version(warranty_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.activate_partner_warranty_version(warranty_id_input uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  target_record public.partner_warranty_versions%ROWTYPE;
BEGIN
  IF NOT public.has_permission('catalog.warranty.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  SELECT * INTO target_record
  FROM public.partner_warranty_versions
  WHERE id = warranty_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF target_record.status <> 'DRAFT' OR target_record.effective_from > NOW() THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: WARRANTY_NOT_ACTIVATABLE';
  END IF;

  UPDATE public.partner_warranty_versions
  SET status = 'RETIRED', effective_until = NOW()
  WHERE supplier_id = target_record.supplier_id
    AND product_id IS NOT DISTINCT FROM target_record.product_id
    AND status = 'ACTIVE';

  UPDATE public.partner_warranty_versions
  SET status = 'ACTIVE', effective_until = NULL,
      activated_by = (SELECT auth.uid()), activated_at = NOW()
  WHERE id = warranty_id_input;

  PERFORM public.write_audit_event(
    NULL, 'partner_warranty', warranty_id_input, 'ACTIVATED',
    jsonb_build_object('status', target_record.status),
    jsonb_build_object('status', 'ACTIVE', 'versionNumber', target_record.version_number)
  );
  RETURN warranty_id_input;
END;
$function$;

-- [DDL] function public.set_material_sample_status(sample_id_input uuid, status_input text) (add)
CREATE OR REPLACE FUNCTION public.set_material_sample_status(sample_id_input uuid, status_input text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.sample.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF status_input NOT IN ('AVAILABLE','BORROWED','UNAVAILABLE') THEN
    RAISE EXCEPTION 'INVALID_INPUT: SAMPLE_STATUS';
  END IF;
  SELECT to_jsonb(ms) INTO before_value
  FROM public.material_samples ms WHERE ms.id = sample_id_input FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  UPDATE public.material_samples
  SET availability_status = status_input
  WHERE id = sample_id_input;
  PERFORM public.write_audit_event(
    NULL, 'material_sample', sample_id_input, 'STATUS_CHANGED', before_value,
    jsonb_build_object('availabilityStatus', status_input)
  );
  RETURN sample_id_input;
END;
$function$;

-- [DDL] function public.resolve_partner_warranty_snapshot(supplier_id_input uuid, product_id_input uuid, captured_at_input timestamp with time zone) (add)
CREATE OR REPLACE FUNCTION public.resolve_partner_warranty_snapshot(supplier_id_input uuid, product_id_input uuid, captured_at_input timestamp with time zone DEFAULT now())
 RETURNS TABLE(warranty_version_id uuid, warranty_snapshot jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  WITH selected AS (
    SELECT pw.*
    FROM public.partner_warranty_versions pw
    WHERE pw.supplier_id = supplier_id_input
      AND (pw.product_id = product_id_input OR pw.product_id IS NULL)
      AND pw.status IN ('ACTIVE', 'RETIRED')
      AND pw.effective_from <= captured_at_input
      AND (pw.effective_until IS NULL OR pw.effective_until > captured_at_input)
    ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
    LIMIT 1
  )
  SELECT
    selected.id,
    jsonb_build_object(
      'version_number', selected.version_number,
      'title', selected.title,
      'member_summary', selected.member_summary,
      'terms_text', selected.terms_text,
      'duration_months', selected.duration_months,
      'effective_from', selected.effective_from,
      'captured_at', captured_at_input,
      'source', 'PARTNER_WARRANTY'
    )
  FROM selected
  UNION ALL
  SELECT
    NULL::UUID,
    jsonb_build_object(
      'version_number', 1,
      'title', 'เงื่อนไขรับประกันของ Partner ณ วันที่สั่งซื้อ',
      'member_summary', 'ทีม GISP จะตรวจสอบตามหลักฐานและเงื่อนไขที่ผูกกับรายการสั่งซื้อ',
      'terms_text', 'การซ่อม เปลี่ยนสินค้า หรือชดเชยต้องผ่านการตรวจสอบของ Order Admin และไม่เกิดขึ้นอัตโนมัติ',
      'duration_months', NULL,
      'captured_at', captured_at_input,
      'source', 'DEFAULT'
    )
  WHERE NOT EXISTS (SELECT 1 FROM selected)
  LIMIT 1;
$function$;

-- [DDL] function public.create_partner_warranty_draft(supplier_id_input uuid, product_id_input uuid, title_input text, member_summary_input text, terms_text_input text, duration_months_input integer, effective_from_input timestamp with time zone) (add)
CREATE OR REPLACE FUNCTION public.create_partner_warranty_draft(supplier_id_input uuid, product_id_input uuid, title_input text, member_summary_input text, terms_text_input text, duration_months_input integer, effective_from_input timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  warranty_id_value UUID;
  version_number_value INTEGER;
BEGIN
  IF NOT public.has_permission('catalog.warranty.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NULLIF(BTRIM(title_input), '') IS NULL
     OR NULLIF(BTRIM(member_summary_input), '') IS NULL
     OR NULLIF(BTRIM(terms_text_input), '') IS NULL
     OR (duration_months_input IS NOT NULL AND duration_months_input <= 0) THEN
    RAISE EXCEPTION 'INVALID_INPUT: PARTNER_WARRANTY';
  END IF;
  PERFORM 1 FROM public.suppliers s WHERE s.id = supplier_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id_input AND p.supplier_id = supplier_id_input
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT: WARRANTY_PRODUCT_SUPPLIER';
  END IF;

  SELECT COALESCE(MAX(pw.version_number), 0) + 1
  INTO version_number_value
  FROM public.partner_warranty_versions pw
  WHERE pw.supplier_id = supplier_id_input
    AND pw.product_id IS NOT DISTINCT FROM product_id_input;

  INSERT INTO public.partner_warranty_versions(
    supplier_id, product_id, version_number, title, member_summary, terms_text,
    duration_months, status, effective_from, created_by
  ) VALUES (
    supplier_id_input, product_id_input, version_number_value, BTRIM(title_input),
    BTRIM(member_summary_input), BTRIM(terms_text_input), duration_months_input,
    'DRAFT', COALESCE(effective_from_input, NOW()), (SELECT auth.uid())
  ) RETURNING id INTO warranty_id_value;

  PERFORM public.write_audit_event(
    NULL, 'partner_warranty', warranty_id_value, 'DRAFT_CREATED', NULL,
    jsonb_build_object('supplierId', supplier_id_input, 'productId', product_id_input,
      'versionNumber', version_number_value)
  );
  RETURN warranty_id_value;
END;
$function$;

-- [DDL] function public.create_material_sample(product_id_input uuid, supplier_location_id_input uuid, sample_code_input text, sample_type_input text, display_name_input text, member_note_input text, shelf_location_input text, internal_note_input text) (add)
CREATE OR REPLACE FUNCTION public.create_material_sample(product_id_input uuid, supplier_location_id_input uuid, sample_code_input text, sample_type_input text, display_name_input text, member_note_input text DEFAULT NULL::text, shelf_location_input text DEFAULT NULL::text, internal_note_input text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  product_record RECORD;
  location_record RECORD;
  sample_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.sample.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF sample_type_input NOT IN ('MATERIAL_SWATCH','BUILT_IN_DISPLAY')
     OR NULLIF(BTRIM(sample_code_input), '') IS NULL
     OR CHAR_LENGTH(BTRIM(display_name_input)) < 2 THEN
    RAISE EXCEPTION 'INVALID_INPUT: MATERIAL_SAMPLE';
  END IF;

  SELECT p.id, p.supplier_id, p.product_type, p.status
  INTO product_record
  FROM public.products p
  WHERE p.id = product_id_input;
  SELECT sl.id, sl.supplier_id, sl.status
  INTO location_record
  FROM public.supplier_locations sl
  WHERE sl.id = supplier_location_id_input;

  IF product_record.id IS NULL OR location_record.id IS NULL
     OR product_record.supplier_id IS DISTINCT FROM location_record.supplier_id
     OR location_record.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'INVALID_INPUT: SAMPLE_PRODUCT_LOCATION';
  END IF;
  IF sample_type_input = 'BUILT_IN_DISPLAY'
     AND product_record.product_type <> 'BUILT_IN' THEN
    RAISE EXCEPTION 'INVALID_INPUT: BUILT_IN_DISPLAY_REQUIRES_BUILT_IN_PRODUCT';
  END IF;

  INSERT INTO public.material_samples(
    sample_code, sample_type, product_id, supplier_location_id, display_name,
    member_note, shelf_location, availability_status, internal_note, created_by
  ) VALUES (
    UPPER(BTRIM(sample_code_input)), sample_type_input, product_id_input,
    supplier_location_id_input, BTRIM(display_name_input),
    NULLIF(BTRIM(member_note_input), ''), NULLIF(BTRIM(shelf_location_input), ''),
    'AVAILABLE', NULLIF(BTRIM(internal_note_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO sample_id_value;

  PERFORM public.write_audit_event(
    NULL, 'material_sample', sample_id_value, 'CREATED', NULL,
    jsonb_build_object('sampleCode', UPPER(BTRIM(sample_code_input)),
      'sampleType', sample_type_input, 'productId', product_id_input)
  );
  RETURN sample_id_value;
END;
$function$;

-- [DDL] function public.create_supplier_sample_location(supplier_id_input uuid, country_code_input text, city_input text, location_type_input text, public_label_input text, address_line_input text, contact_name_input text, contact_email_input text, contact_phone_input text) (add)
CREATE OR REPLACE FUNCTION public.create_supplier_sample_location(supplier_id_input uuid, country_code_input text, city_input text, location_type_input text, public_label_input text, address_line_input text DEFAULT NULL::text, contact_name_input text DEFAULT NULL::text, contact_email_input text DEFAULT NULL::text, contact_phone_input text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  location_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.sample.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF location_type_input NOT IN ('FACTORY','SHOWROOM','WAREHOUSE')
     OR NULLIF(BTRIM(city_input), '') IS NULL
     OR NULLIF(BTRIM(public_label_input), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: SAMPLE_LOCATION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id_input AND s.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT: SUPPLIER';
  END IF;

  INSERT INTO public.supplier_locations(
    supplier_id, country_code, city, location_type, public_label,
    address_line, contact_name, contact_email, contact_phone, status
  ) VALUES (
    supplier_id_input, UPPER(BTRIM(country_code_input)), BTRIM(city_input),
    location_type_input, BTRIM(public_label_input), NULLIF(BTRIM(address_line_input), ''),
    NULLIF(BTRIM(contact_name_input), ''), NULLIF(BTRIM(contact_email_input), ''),
    NULLIF(BTRIM(contact_phone_input), ''), 'ACTIVE'
  ) RETURNING id INTO location_id_value;

  PERFORM public.write_audit_event(
    NULL, 'supplier_location', location_id_value, 'CREATED', NULL,
    jsonb_build_object('supplierId', supplier_id_input, 'publicLabel', BTRIM(public_label_input))
  );
  RETURN location_id_value;
END;
$function$;

COMMIT;