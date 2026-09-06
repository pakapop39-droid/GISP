-- Finish Slice 3: project item editing, safe product schedules, showroom visit
-- lifecycle, member-profile supplier disclosure, admin actions, and audit.

INSERT INTO public.permissions (code, name, description)
VALUES ('visits.manage', 'จัดการคำขอเยี่ยมชม', 'อนุมัติ ปฏิเสธ และบันทึกผลการเยี่ยมชม Showroom/โรงงาน')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'visits.manage'
WHERE r.code IN ('SUPER_ADMIN', 'PURCHASING')
ON CONFLICT DO NOTHING;

ALTER TABLE public.project_items
  ADD COLUMN IF NOT EXISTS product_sku_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS category_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS suggested_resale_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS freight_estimate_min NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS freight_estimate_max NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS lead_time_days_snapshot INTEGER;

UPDATE public.project_items pi
SET product_sku_snapshot = COALESCE(pi.product_sku_snapshot, p.sku),
    category_name_snapshot = COALESCE(pi.category_name_snapshot, c.name_th),
    lead_time_days_snapshot = COALESCE(pi.lead_time_days_snapshot, p.default_lead_time_days)
FROM public.products p
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE pi.product_id = p.id;

UPDATE public.project_items pi
SET suggested_resale_amount = COALESCE(pi.suggested_resale_amount, pp.suggested_resale_amount),
    freight_estimate_min = COALESCE(pi.freight_estimate_min, pp.freight_estimate_min),
    freight_estimate_max = COALESCE(pi.freight_estimate_max, pp.freight_estimate_max)
FROM public.product_prices pp
WHERE pp.id = pi.current_price_id;

ALTER TABLE public.showroom_visit_requests
  ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id),
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS visit_instruction TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

UPDATE public.showroom_visit_requests v
SET member_profile_id = p.member_profile_id
FROM public.projects p
WHERE p.id = v.project_id AND v.member_profile_id IS NULL;

UPDATE public.showroom_visit_requests v
SET product_id = COALESCE(v.product_id, (
      SELECT pi.product_id
      FROM public.project_items pi
      WHERE pi.project_id = v.project_id AND pi.product_id IS NOT NULL
      ORDER BY pi.created_at LIMIT 1
    )),
    supplier_id = COALESCE(v.supplier_id, (
      SELECT product.supplier_id
      FROM public.project_items pi
      JOIN public.products product ON product.id = pi.product_id
      WHERE pi.project_id = v.project_id
      ORDER BY pi.created_at LIMIT 1
    ))
WHERE v.product_id IS NULL OR v.supplier_id IS NULL;

ALTER TABLE public.showroom_visit_requests DROP CONSTRAINT IF EXISTS showroom_visit_requests_status_check;
UPDATE public.showroom_visit_requests SET status = 'SUBMITTED' WHERE status = 'REQUESTED';
UPDATE public.showroom_visit_requests SET status = 'APPROVED' WHERE status = 'CONFIRMED';
ALTER TABLE public.showroom_visit_requests
  ADD CONSTRAINT showroom_visit_requests_status_check
  CHECK (status IN ('SUBMITTED','APPROVED','COMPLETED','REJECTED','CANCELLED'));

ALTER TABLE public.showroom_visit_requests
  ALTER COLUMN member_profile_id SET NOT NULL,
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN supplier_id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'SUBMITTED';

CREATE INDEX IF NOT EXISTS showroom_visit_requests_member_idx
  ON public.showroom_visit_requests (member_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS showroom_visit_requests_status_idx
  ON public.showroom_visit_requests (status, preferred_at);
CREATE INDEX IF NOT EXISTS showroom_visit_requests_supplier_idx
  ON public.showroom_visit_requests (supplier_id, created_at DESC);

ALTER TABLE public.supplier_disclosure_grants
  ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id),
  ADD COLUMN IF NOT EXISTS visit_request_id UUID REFERENCES public.showroom_visit_requests(id),
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT;

UPDATE public.supplier_disclosure_grants g
SET member_profile_id = p.member_profile_id
FROM public.projects p
WHERE p.id = g.project_id AND g.member_profile_id IS NULL;

UPDATE public.supplier_disclosure_grants
SET status = 'ACTIVE',
    granted_by = COALESCE(granted_by, reviewed_by),
    granted_at = COALESCE(granted_at, reviewed_at, created_at)
WHERE status = 'APPROVED';

ALTER TABLE public.supplier_disclosure_grants
  DROP CONSTRAINT IF EXISTS supplier_disclosure_grants_status_check,
  DROP CONSTRAINT IF EXISTS supplier_disclosure_grants_organization_id_project_id_suppl_key;
ALTER TABLE public.supplier_disclosure_grants
  ADD CONSTRAINT supplier_disclosure_grants_status_check
  CHECK (status IN ('REQUESTED','REJECTED','ACTIVE','REVOKED'));
ALTER TABLE public.supplier_disclosure_grants ALTER COLUMN member_profile_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_disclosure_grants_member_supplier_unique
  ON public.supplier_disclosure_grants (member_profile_id, supplier_id);
CREATE INDEX IF NOT EXISTS supplier_disclosure_grants_active_idx
  ON public.supplier_disclosure_grants (member_profile_id, supplier_id)
  WHERE status = 'ACTIVE';

DROP POLICY IF EXISTS showroom_visit_requests_org_select ON public.showroom_visit_requests;
DROP POLICY IF EXISTS supplier_disclosure_grants_org_select ON public.supplier_disclosure_grants;
REVOKE ALL ON public.showroom_visit_requests, public.supplier_disclosure_grants FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.slice3_is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.revoked_at IS NULL
      AND u.status = 'ACTIVE'
      AND r.code = 'SUPER_ADMIN'
  )
$$;
REVOKE ALL ON FUNCTION public.slice3_is_super_admin() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.request_supplier_disclosure(UUID,UUID,TEXT);
DROP FUNCTION IF EXISTS public.request_showroom_visit(UUID,TIMESTAMPTZ,INTEGER,TEXT);

CREATE OR REPLACE FUNCTION public.request_showroom_visit(
  project_id_input UUID,
  product_id_input UUID,
  preferred_at_input TIMESTAMPTZ,
  attendee_count_input INTEGER,
  note_input TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  supplier_id_value UUID;
  request_id_value UUID;
BEGIN
  SELECT * INTO project_record
  FROM public.projects
  WHERE id = project_id_input
    AND member_profile_id = public.current_member_profile_id()
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF project_record.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'project is locked'; END IF;
  IF preferred_at_input <= NOW() THEN RAISE EXCEPTION 'preferred date must be in the future'; END IF;
  IF attendee_count_input NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'attendee count out of range'; END IF;

  SELECT supplier_id INTO supplier_id_value
  FROM public.products
  WHERE id = product_id_input AND status = 'PUBLISHED';
  IF supplier_id_value IS NULL THEN RAISE EXCEPTION 'published product not found'; END IF;

  INSERT INTO public.showroom_visit_requests (
    organization_id, member_profile_id, project_id, product_id, supplier_id,
    preferred_at, attendee_count, note, status, created_by
  ) VALUES (
    project_record.organization_id, project_record.member_profile_id, project_id_input,
    product_id_input, supplier_id_value, preferred_at_input, attendee_count_input,
    NULLIF(BTRIM(note_input),''), 'SUBMITTED', (SELECT auth.uid())
  ) RETURNING id INTO request_id_value;

  PERFORM public.write_audit_event(
    project_record.organization_id, 'showroom_visit', request_id_value, 'SUBMITTED', NULL,
    jsonb_build_object('project_id', project_id_input, 'product_id', product_id_input)
  );
  RETURN request_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_showroom_visit(visit_id_input UUID, reason_input TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE visit_record public.showroom_visit_requests%ROWTYPE;
BEGIN
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'reason required'; END IF;
  SELECT * INTO visit_record
  FROM public.showroom_visit_requests
  WHERE id = visit_id_input AND member_profile_id = public.current_member_profile_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit not found'; END IF;
  IF visit_record.status NOT IN ('SUBMITTED','APPROVED') THEN RAISE EXCEPTION 'invalid visit transition'; END IF;

  UPDATE public.showroom_visit_requests
  SET status = 'CANCELLED', review_note = BTRIM(reason_input), cancelled_at = NOW(), updated_at = NOW()
  WHERE id = visit_id_input;
  PERFORM public.write_audit_event(
    visit_record.organization_id, 'showroom_visit', visit_id_input, 'CANCELLED',
    jsonb_build_object('status', visit_record.status),
    jsonb_build_object('status', 'CANCELLED', 'reason', BTRIM(reason_input))
  );
  RETURN visit_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_showroom_visit(
  visit_id_input UUID,
  action_input TEXT,
  note_input TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  visit_record public.showroom_visit_requests%ROWTYPE;
  next_status TEXT;
  grant_id_value UUID;
BEGIN
  IF NOT public.has_permission('visits.manage') THEN RAISE EXCEPTION 'permission denied'; END IF;
  IF action_input NOT IN ('APPROVE','REJECT','COMPLETE') THEN RAISE EXCEPTION 'invalid action'; END IF;
  SELECT * INTO visit_record FROM public.showroom_visit_requests WHERE id = visit_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit not found'; END IF;

  IF action_input = 'APPROVE' THEN
    IF visit_record.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'invalid visit transition'; END IF;
    IF NULLIF(BTRIM(note_input),'') IS NULL THEN RAISE EXCEPTION 'visit instruction required'; END IF;
    next_status := 'APPROVED';
    UPDATE public.showroom_visit_requests
    SET status = next_status, visit_instruction = BTRIM(note_input), review_note = NULL,
        reviewed_by = (SELECT auth.uid()), reviewed_at = NOW(), updated_at = NOW()
    WHERE id = visit_id_input;
  ELSIF action_input = 'REJECT' THEN
    IF visit_record.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'invalid visit transition'; END IF;
    IF NULLIF(BTRIM(note_input),'') IS NULL THEN RAISE EXCEPTION 'rejection reason required'; END IF;
    next_status := 'REJECTED';
    UPDATE public.showroom_visit_requests
    SET status = next_status, review_note = BTRIM(note_input),
        reviewed_by = (SELECT auth.uid()), reviewed_at = NOW(), updated_at = NOW()
    WHERE id = visit_id_input;
  ELSE
    IF visit_record.status <> 'APPROVED' THEN RAISE EXCEPTION 'invalid visit transition'; END IF;
    next_status := 'COMPLETED';
    UPDATE public.showroom_visit_requests
    SET status = next_status, review_note = NULLIF(BTRIM(note_input),''),
        reviewed_by = (SELECT auth.uid()), reviewed_at = NOW(), completed_at = NOW(), updated_at = NOW()
    WHERE id = visit_id_input;

    INSERT INTO public.supplier_disclosure_grants (
      organization_id, member_profile_id, project_id, supplier_id, visit_request_id,
      reason, status, requested_by, reviewed_by, reviewed_at, granted_by, granted_at
    ) VALUES (
      visit_record.organization_id, visit_record.member_profile_id, visit_record.project_id,
      visit_record.supplier_id, visit_record.id, 'VISIT_COMPLETED', 'ACTIVE',
      visit_record.created_by, (SELECT auth.uid()), NOW(), (SELECT auth.uid()), NOW()
    )
    ON CONFLICT (member_profile_id, supplier_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        project_id = EXCLUDED.project_id,
        visit_request_id = EXCLUDED.visit_request_id,
        reason = 'VISIT_COMPLETED', status = 'ACTIVE', requested_by = EXCLUDED.requested_by,
        reviewed_by = EXCLUDED.reviewed_by, reviewed_at = NOW(), granted_by = EXCLUDED.granted_by,
        granted_at = NOW(), revoked_by = NULL, revoked_at = NULL, revoke_reason = NULL
    RETURNING id INTO grant_id_value;

    PERFORM public.write_audit_event(
      visit_record.organization_id, 'supplier_disclosure', grant_id_value, 'GRANTED', NULL,
      jsonb_build_object('member_profile_id', visit_record.member_profile_id,
        'supplier_id', visit_record.supplier_id, 'visit_request_id', visit_record.id)
    );
  END IF;

  PERFORM public.write_audit_event(
    visit_record.organization_id, 'showroom_visit', visit_id_input, next_status,
    jsonb_build_object('status', visit_record.status),
    jsonb_build_object('status', next_status, 'note', NULLIF(BTRIM(note_input),''))
  );
  RETURN visit_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_supplier_disclosure(grant_id_input UUID, reason_input TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE grant_record public.supplier_disclosure_grants%ROWTYPE;
BEGIN
  IF NOT public.slice3_is_super_admin() THEN RAISE EXCEPTION 'super admin required'; END IF;
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'revoke reason required'; END IF;
  SELECT * INTO grant_record FROM public.supplier_disclosure_grants WHERE id = grant_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'disclosure grant not found'; END IF;
  IF grant_record.status <> 'ACTIVE' THEN RAISE EXCEPTION 'grant is not active'; END IF;

  UPDATE public.supplier_disclosure_grants
  SET status = 'REVOKED', revoked_by = (SELECT auth.uid()), revoked_at = NOW(),
      revoke_reason = BTRIM(reason_input), reviewed_by = (SELECT auth.uid()), reviewed_at = NOW()
  WHERE id = grant_id_input;
  PERFORM public.write_audit_event(
    grant_record.organization_id, 'supplier_disclosure', grant_id_input, 'REVOKED',
    jsonb_build_object('status', 'ACTIVE'),
    jsonb_build_object('status', 'REVOKED', 'reason', BTRIM(reason_input))
  );
  RETURN grant_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_showroom_visits(project_id_input UUID)
RETURNS TABLE (
  id UUID, product_id UUID, product_name TEXT, preferred_at TIMESTAMPTZ,
  attendee_count INTEGER, note TEXT, status TEXT, review_note TEXT,
  visit_instruction TEXT, created_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT v.id, v.product_id, p.name_th, v.preferred_at, v.attendee_count, v.note,
    v.status, v.review_note, v.visit_instruction, v.created_at, v.completed_at
  FROM public.showroom_visit_requests v
  JOIN public.projects project ON project.id = v.project_id
  JOIN public.products p ON p.id = v.product_id
  WHERE v.project_id = project_id_input
    AND v.member_profile_id = public.current_member_profile_id()
    AND project.member_profile_id = public.current_member_profile_id()
  ORDER BY v.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_member_project_disclosures(project_id_input UUID)
RETURNS TABLE (
  id UUID, reason TEXT, status TEXT, supplier_name TEXT, supplier_legal_name TEXT,
  supplier_address TEXT, supplier_city TEXT, contact_name TEXT, contact_email TEXT,
  contact_phone TEXT, granted_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, revoke_reason TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT g.id, g.reason, g.status,
    CASE WHEN g.status = 'ACTIVE' THEN s.name END,
    CASE WHEN g.status = 'ACTIVE' THEN s.legal_name END,
    CASE WHEN g.status = 'ACTIVE' THEN s.address_line END,
    CASE WHEN g.status = 'ACTIVE' THEN s.city END,
    CASE WHEN g.status = 'ACTIVE' THEN s.contact_name END,
    CASE WHEN g.status = 'ACTIVE' THEN s.contact_email END,
    CASE WHEN g.status = 'ACTIVE' THEN s.contact_phone END,
    g.granted_at, g.revoked_at, g.revoke_reason
  FROM public.supplier_disclosure_grants g
  JOIN public.projects p ON p.id = project_id_input
  JOIN public.suppliers s ON s.id = g.supplier_id
  WHERE g.member_profile_id = public.current_member_profile_id()
    AND p.member_profile_id = public.current_member_profile_id()
    AND (g.project_id = project_id_input OR g.status = 'ACTIVE')
  ORDER BY g.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_member_project_schedule(project_id_input UUID)
RETURNS TABLE (
  item_id UUID, area_name TEXT, product_id UUID, sku TEXT, product_name TEXT,
  category_name TEXT, specification TEXT, selected_options JSONB, quantity NUMERIC,
  unit TEXT, member_price NUMERIC, suggested_resale NUMERIC, freight_min NUMERIC,
  freight_max NUMERIC, lead_time_days INTEGER, item_status TEXT,
  supplier_name TEXT, supplier_address TEXT, supplier_contact TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT pi.id, COALESCE(a.name, 'ไม่ระบุพื้นที่'), pi.product_id,
    COALESCE(pi.product_sku_snapshot, product.sku), pi.item_name,
    COALESCE(pi.category_name_snapshot, category.name_th), pi.specification_snapshot,
    pi.selected_options, pi.quantity, pi.unit, pi.current_unit_price,
    pi.suggested_resale_amount, pi.freight_estimate_min, pi.freight_estimate_max,
    pi.lead_time_days_snapshot, pi.status,
    CASE WHEN grant_row.id IS NOT NULL THEN supplier.name END,
    CASE WHEN grant_row.id IS NOT NULL THEN CONCAT_WS(', ', supplier.address_line, supplier.city, supplier.country_code) END,
    CASE WHEN grant_row.id IS NOT NULL THEN CONCAT_WS(' · ', supplier.contact_name, supplier.contact_phone, supplier.contact_email) END
  FROM public.project_items pi
  JOIN public.projects project ON project.id = pi.project_id
  LEFT JOIN public.project_areas a ON a.id = pi.area_id
  LEFT JOIN public.products product ON product.id = pi.product_id
  LEFT JOIN public.categories category ON category.id = product.category_id
  LEFT JOIN public.suppliers supplier ON supplier.id = product.supplier_id
  LEFT JOIN public.supplier_disclosure_grants grant_row
    ON grant_row.member_profile_id = project.member_profile_id
   AND grant_row.supplier_id = product.supplier_id
   AND grant_row.status = 'ACTIVE'
  WHERE pi.project_id = project_id_input
    AND project.member_profile_id = public.current_member_profile_id()
  ORDER BY a.sort_order NULLS LAST, pi.created_at
$$;

CREATE OR REPLACE FUNCTION public.get_showroom_visit_queue()
RETURNS TABLE (
  id UUID, organization_id UUID, project_id UUID, project_number TEXT, project_name TEXT,
  member_company TEXT, product_name TEXT, supplier_name TEXT, preferred_at TIMESTAMPTZ,
  attendee_count INTEGER, note TEXT, status TEXT, visit_instruction TEXT,
  review_note TEXT, created_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  grant_id UUID, grant_status TEXT, grant_revoked_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT v.id, v.organization_id, v.project_id, project.project_number, project.name,
    member.company_name, product.name_th, supplier.name, v.preferred_at,
    v.attendee_count, v.note, v.status, v.visit_instruction, v.review_note,
    v.created_at, v.completed_at, grant_row.id, grant_row.status, grant_row.revoked_at
  FROM public.showroom_visit_requests v
  JOIN public.projects project ON project.id = v.project_id
  JOIN public.member_profiles member ON member.id = v.member_profile_id
  JOIN public.products product ON product.id = v.product_id
  JOIN public.suppliers supplier ON supplier.id = v.supplier_id
  LEFT JOIN public.supplier_disclosure_grants grant_row
    ON grant_row.member_profile_id = v.member_profile_id AND grant_row.supplier_id = v.supplier_id
  WHERE public.has_permission('visits.manage')
  ORDER BY CASE v.status WHEN 'SUBMITTED' THEN 1 WHEN 'APPROVED' THEN 2 ELSE 3 END,
    v.preferred_at
$$;

CREATE OR REPLACE FUNCTION public.add_standard_project_item_v2(
  project_id_input UUID, area_id_input UUID, product_id_input UUID,
  variant_id_input UUID, selected_options_input JSONB, quantity_input NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  product_record public.products%ROWTYPE;
  variant_record public.product_variants%ROWTYPE;
  price_record public.product_prices%ROWTYPE;
  category_name_value TEXT;
  item_id_value UUID;
  vat_rate_value NUMERIC(5,2);
  ready_value BOOLEAN := TRUE;
BEGIN
  SELECT * INTO project_record FROM public.projects
  WHERE id = project_id_input AND member_profile_id = public.current_member_profile_id()
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF project_record.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'project is locked'; END IF;
  IF quantity_input <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id = area_id_input AND project_id = project_id_input
  ) THEN RAISE EXCEPTION 'area not found'; END IF;

  SELECT * INTO product_record FROM public.products
  WHERE id = product_id_input AND product_type = 'STANDARD' AND status = 'PUBLISHED';
  IF NOT FOUND THEN RAISE EXCEPTION 'published standard product not found'; END IF;
  SELECT name_th INTO category_name_value FROM public.categories WHERE id = product_record.category_id;

  IF variant_id_input IS NOT NULL THEN
    SELECT * INTO variant_record FROM public.product_variants
    WHERE id = variant_id_input AND product_id = product_id_input AND status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'active variant not found'; END IF;
  ELSIF EXISTS (
    SELECT 1 FROM public.product_variants WHERE product_id = product_id_input AND status = 'ACTIVE'
  ) THEN ready_value := FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(selected_options_input,'[]'::jsonb)) selected
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_options option_row
      JOIN public.product_option_values value_row ON value_row.option_id = option_row.id
      WHERE option_row.product_id = product_id_input
        AND option_row.id::TEXT = selected->>'optionId'
        AND value_row.id::TEXT = selected->>'valueId'
        AND option_row.status = 'ACTIVE' AND value_row.status = 'ACTIVE'
    )
  ) THEN RAISE EXCEPTION 'invalid product option'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_options required_option
    WHERE required_option.product_id = product_id_input AND required_option.is_required
      AND required_option.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(selected_options_input,'[]'::jsonb)) selected
        WHERE selected->>'optionId' = required_option.id::TEXT
      )
  ) THEN ready_value := FALSE; END IF;

  SELECT * INTO price_record FROM public.product_prices
  WHERE product_id = product_id_input
    AND (variant_id = variant_id_input OR (variant_id IS NULL AND variant_id_input IS NULL))
    AND status = 'ACTIVE' AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
  ORDER BY valid_from DESC LIMIT 1;
  IF NOT FOUND AND variant_id_input IS NOT NULL THEN
    SELECT * INTO price_record FROM public.product_prices
    WHERE product_id = product_id_input AND variant_id IS NULL
      AND status = 'ACTIVE' AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
    ORDER BY valid_from DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'active member price not found'; END IF;

  SELECT default_vat_rate INTO vat_rate_value FROM public.company_settings WHERE singleton = TRUE;
  INSERT INTO public.project_items (
    project_id, organization_id, area_id, product_id, variant_id, item_type, item_name,
    specification_snapshot, selected_options, quantity, current_price_id, current_unit_price,
    vat_rate_snapshot, status, created_by, product_sku_snapshot, category_name_snapshot,
    suggested_resale_amount, freight_estimate_min, freight_estimate_max, lead_time_days_snapshot
  ) VALUES (
    project_id_input, project_record.organization_id, area_id_input, product_id_input, variant_id_input,
    'STANDARD', product_record.name_th, COALESCE(variant_record.name, product_record.specification_summary),
    COALESCE(selected_options_input,'[]'::jsonb), quantity_input, price_record.id, price_record.amount,
    vat_rate_value, CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT' END, (SELECT auth.uid()),
    product_record.sku, category_name_value, price_record.suggested_resale_amount,
    price_record.freight_estimate_min, price_record.freight_estimate_max,
    product_record.default_lead_time_days
  ) RETURNING id INTO item_id_value;

  PERFORM public.write_audit_event(
    project_record.organization_id, 'project_item', item_id_value,
    CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT_CREATED' END
  );
  RETURN item_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_project_item_v2(
  project_item_id_input UUID, area_id_input UUID, variant_id_input UUID,
  selected_options_input JSONB, quantity_input NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  item_record public.project_items%ROWTYPE;
  project_record public.projects%ROWTYPE;
  product_record public.products%ROWTYPE;
  variant_record public.product_variants%ROWTYPE;
  price_record public.product_prices%ROWTYPE;
  ready_value BOOLEAN := TRUE;
BEGIN
  SELECT * INTO item_record FROM public.project_items WHERE id = project_item_id_input FOR UPDATE;
  IF NOT FOUND OR item_record.item_type <> 'STANDARD' THEN RAISE EXCEPTION 'standard project item not found'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id = item_record.project_id AND member_profile_id = public.current_member_profile_id()
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF item_record.status IN ('PARTIALLY_ORDERED','ORDERED','CANCELLED') THEN RAISE EXCEPTION 'item is locked'; END IF;
  IF quantity_input <= 0 OR quantity_input < item_record.ordered_quantity THEN RAISE EXCEPTION 'invalid quantity'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id = area_id_input AND project_id = item_record.project_id
  ) THEN RAISE EXCEPTION 'area not found'; END IF;

  SELECT * INTO product_record FROM public.products
  WHERE id = item_record.product_id AND product_type = 'STANDARD' AND status = 'PUBLISHED';
  IF NOT FOUND THEN RAISE EXCEPTION 'published standard product not found'; END IF;

  IF variant_id_input IS NOT NULL THEN
    SELECT * INTO variant_record FROM public.product_variants
    WHERE id = variant_id_input AND product_id = item_record.product_id AND status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'active variant not found'; END IF;
  ELSIF EXISTS (
    SELECT 1 FROM public.product_variants WHERE product_id = item_record.product_id AND status = 'ACTIVE'
  ) THEN ready_value := FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(selected_options_input,'[]'::jsonb)) selected
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_options option_row
      JOIN public.product_option_values value_row ON value_row.option_id = option_row.id
      WHERE option_row.product_id = item_record.product_id
        AND option_row.id::TEXT = selected->>'optionId'
        AND value_row.id::TEXT = selected->>'valueId'
        AND option_row.status = 'ACTIVE' AND value_row.status = 'ACTIVE'
    )
  ) THEN RAISE EXCEPTION 'invalid product option'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.product_options required_option
    WHERE required_option.product_id = item_record.product_id AND required_option.is_required
      AND required_option.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(selected_options_input,'[]'::jsonb)) selected
        WHERE selected->>'optionId' = required_option.id::TEXT
      )
  ) THEN ready_value := FALSE; END IF;

  SELECT * INTO price_record FROM public.product_prices
  WHERE product_id = item_record.product_id
    AND (variant_id = variant_id_input OR (variant_id IS NULL AND variant_id_input IS NULL))
    AND status = 'ACTIVE' AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
  ORDER BY valid_from DESC LIMIT 1;
  IF NOT FOUND AND variant_id_input IS NOT NULL THEN
    SELECT * INTO price_record FROM public.product_prices
    WHERE product_id = item_record.product_id AND variant_id IS NULL
      AND status = 'ACTIVE' AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
    ORDER BY valid_from DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'active member price not found'; END IF;

  UPDATE public.project_items
  SET area_id = area_id_input, variant_id = variant_id_input,
      specification_snapshot = COALESCE(variant_record.name, product_record.specification_summary),
      selected_options = COALESCE(selected_options_input,'[]'::jsonb), quantity = quantity_input,
      current_price_id = price_record.id, current_unit_price = price_record.amount,
      suggested_resale_amount = price_record.suggested_resale_amount,
      freight_estimate_min = price_record.freight_estimate_min,
      freight_estimate_max = price_record.freight_estimate_max,
      lead_time_days_snapshot = product_record.default_lead_time_days,
      status = CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT' END,
      updated_at = NOW()
  WHERE id = project_item_id_input;

  PERFORM public.write_audit_event(
    project_record.organization_id, 'project_item', project_item_id_input, 'UPDATED',
    jsonb_build_object('area_id', item_record.area_id, 'variant_id', item_record.variant_id,
      'quantity', item_record.quantity, 'status', item_record.status),
    jsonb_build_object('area_id', area_id_input, 'variant_id', variant_id_input,
      'quantity', quantity_input, 'status', CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT' END)
  );
  RETURN project_item_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_project_item_ready(project_item_id_input UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE item_record public.project_items%ROWTYPE; project_record public.projects%ROWTYPE;
BEGIN
  SELECT * INTO item_record FROM public.project_items WHERE id = project_item_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'project item not found'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id = item_record.project_id AND member_profile_id = public.current_member_profile_id()
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF item_record.status <> 'DRAFT' THEN RAISE EXCEPTION 'item is not draft'; END IF;
  IF item_record.variant_id IS NULL AND EXISTS (
    SELECT 1 FROM public.product_variants WHERE product_id = item_record.product_id AND status = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'variant required'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.product_options required_option
    WHERE required_option.product_id = item_record.product_id AND required_option.is_required
      AND required_option.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(item_record.selected_options) selected
        WHERE selected->>'optionId' = required_option.id::TEXT
      )
  ) THEN RAISE EXCEPTION 'required options missing'; END IF;

  UPDATE public.project_items SET status = 'READY_TO_ORDER', updated_at = NOW()
  WHERE id = project_item_id_input;
  PERFORM public.write_audit_event(
    project_record.organization_id, 'project_item', item_record.id, 'READY_TO_ORDER',
    jsonb_build_object('status', item_record.status), jsonb_build_object('status', 'READY_TO_ORDER')
  );
  RETURN item_record.id;
END;
$$;

REVOKE UPDATE ON public.project_items FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.request_showroom_visit(UUID,UUID,TIMESTAMPTZ,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_showroom_visit(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_showroom_visit(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.revoke_supplier_disclosure(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_member_showroom_visits(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_member_project_disclosures(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_member_project_schedule(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_showroom_visit_queue() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.add_standard_project_item_v2(UUID,UUID,UUID,UUID,JSONB,NUMERIC) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_project_item_v2(UUID,UUID,UUID,JSONB,NUMERIC) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_project_item_ready(UUID) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.request_showroom_visit(UUID,UUID,TIMESTAMPTZ,INTEGER,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_showroom_visit(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_showroom_visit(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_supplier_disclosure(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_showroom_visits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_project_disclosures(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_project_schedule(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_showroom_visit_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_standard_project_item_v2(UUID,UUID,UUID,UUID,JSONB,NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_project_item_v2(UUID,UUID,UUID,JSONB,NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_item_ready(UUID) TO authenticated;
