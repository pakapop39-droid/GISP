-- Slice 9: post-delivery claims, warranty snapshot, responsibility,
-- resolution execution and member confirmation.
-- This migration is scoped to the isolated slice-9-claims backend branch.

-- ---------------------------------------------------------------------------
-- 1. Extend the foundation claim record
-- ---------------------------------------------------------------------------

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES public.order_items(id),
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS claimed_quantity NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS packaging_condition TEXT,
  ADD COLUMN IF NOT EXISTS temporary_action TEXT,
  ADD COLUMN IF NOT EXISTS suggested_responsibility TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_responsibility TEXT,
  ADD COLUMN IF NOT EXISTS responsibility_confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS responsibility_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warranty_version_id UUID REFERENCES public.partner_warranty_versions(id),
  ADD COLUMN IF NOT EXISTS warranty_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS target_resolution_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS information_request TEXT,
  ADD COLUMN IF NOT EXISTS resolution_type TEXT,
  ADD COLUMN IF NOT EXISTS resolution_details TEXT,
  ADD COLUMN IF NOT EXISTS resolution_executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_evidence_file_id UUID REFERENCES public.file_metadata(id),
  ADD COLUMN IF NOT EXISTS member_response TEXT,
  ADD COLUMN IF NOT EXISTS member_response_note TEXT,
  ADD COLUMN IF NOT EXISTS member_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT;

UPDATE public.claims c
SET order_item_id = di.order_item_id,
    member_profile_id = co.member_profile_id,
    subject = COALESCE(c.subject, 'Claim ' || c.claim_number),
    claimed_quantity = COALESCE(c.claimed_quantity, LEAST(di.quantity_delivered, 1)),
    severity = COALESCE(c.severity, 'MEDIUM'),
    discovered_at = COALESCE(c.discovered_at, c.created_at),
    suggested_responsibility = COALESCE(c.suggested_responsibility,
      CASE c.issue_type
        WHEN 'QUALITY' THEN 'SUPPLIER'
        WHEN 'WRONG_ITEM' THEN 'SUPPLIER'
        WHEN 'DAMAGED' THEN 'LOGISTICS_INSURANCE'
        WHEN 'MISSING' THEN 'LOGISTICS_INSURANCE'
        ELSE 'UNDETERMINED'
      END),
    warranty_snapshot = COALESCE(c.warranty_snapshot, jsonb_build_object(
      'title', 'เงื่อนไขรับประกันของ Partner ณ วันที่เปิด Claim',
      'member_summary', 'ทีม GISP จะตรวจสอบตามเงื่อนไขที่ผูกกับรายการสั่งซื้อ',
      'captured_at', c.created_at
    ))
FROM public.delivery_items di
JOIN public.order_items oi ON oi.id = di.order_item_id
JOIN public.customer_orders co ON co.id = oi.order_id
WHERE c.delivery_item_id = di.id;

UPDATE public.claims SET status = 'SUBMITTED' WHERE status = 'OPEN';
UPDATE public.claims SET status = 'IN_PROGRESS' WHERE status = 'RESOLUTION_PROPOSED';

ALTER TABLE public.claims
  ALTER COLUMN order_item_id SET NOT NULL,
  ALTER COLUMN member_profile_id SET NOT NULL,
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN claimed_quantity SET NOT NULL,
  ALTER COLUMN severity SET NOT NULL,
  ALTER COLUMN discovered_at SET NOT NULL,
  ALTER COLUMN suggested_responsibility SET NOT NULL,
  ALTER COLUMN warranty_snapshot SET NOT NULL;

ALTER TABLE public.claims
  DROP CONSTRAINT IF EXISTS claims_issue_type_check,
  DROP CONSTRAINT IF EXISTS claims_status_check,
  ADD CONSTRAINT claims_issue_type_check CHECK (issue_type IN (
    'MISSING','WRONG_ITEM','DAMAGED','PRODUCTION_QUALITY',
    'TRANSIT_DAMAGE','INSTALLATION','OTHER'
  )),
  ADD CONSTRAINT claims_status_check CHECK (status IN (
    'SUBMITTED','UNDER_REVIEW','WAITING_INFORMATION','COORDINATING_SUPPLIER',
    'REPAIR_APPROVED','REPLACEMENT_APPROVED','COMPENSATION_PROPOSED',
    'IN_PROGRESS','RESOLVED','CLOSED','REJECTED'
  )),
  ADD CONSTRAINT claims_quantity_check CHECK (claimed_quantity > 0),
  ADD CONSTRAINT claims_severity_check CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ADD CONSTRAINT claims_suggested_responsibility_check CHECK (suggested_responsibility IN (
    'SUPPLIER','LOGISTICS_INSURANCE','INSTALLER','GISP','MEMBER','UNDETERMINED'
  )),
  ADD CONSTRAINT claims_confirmed_responsibility_check CHECK (
    confirmed_responsibility IS NULL OR confirmed_responsibility IN (
      'SUPPLIER','LOGISTICS_INSURANCE','INSTALLER','GISP','MEMBER'
    )
  ),
  ADD CONSTRAINT claims_resolution_type_check CHECK (
    resolution_type IS NULL OR resolution_type IN (
      'REPAIR','REPLACEMENT','SPARE_PART','REWORK','COMPENSATION','CREDIT','NO_ACTION'
    )
  ),
  ADD CONSTRAINT claims_member_response_check CHECK (
    member_response IS NULL OR member_response IN ('RESOLVED','STILL_ISSUE','CONTACT_ME')
  ),
  ADD CONSTRAINT claims_rejection_reason_check CHECK (
    status <> 'REJECTED' OR NULLIF(BTRIM(rejection_reason), '') IS NOT NULL
  ),
  ADD CONSTRAINT claims_closed_requirements_check CHECK (
    status <> 'CLOSED' OR (
      NULLIF(BTRIM(resolution_details), '') IS NOT NULL
      AND resolution_evidence_file_id IS NOT NULL
      AND member_confirmed_at IS NOT NULL
      AND closed_at IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS claims_member_status_idx
  ON public.claims(member_profile_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS claims_admin_queue_idx
  ON public.claims(status, target_resolution_at, created_at DESC);
CREATE INDEX IF NOT EXISTS claims_order_item_idx
  ON public.claims(order_item_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Evidence and internal-only cost
-- ---------------------------------------------------------------------------

CREATE TABLE public.claim_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN (
    'ISSUE','PACKAGING','DELIVERY_NOTE','MEASUREMENT','REQUESTED_INFO','RESOLUTION'
  )),
  note TEXT,
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(claim_id, file_id)
);

CREATE INDEX claim_evidence_claim_idx
  ON public.claim_evidence(claim_id, created_at);

CREATE TABLE public.claim_internal_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  cost_type TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  internal_note TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX claim_internal_costs_claim_idx
  ON public.claim_internal_costs(claim_id, created_at);

-- Warranty snapshots are immutable after the claim is created.
CREATE OR REPLACE FUNCTION public.protect_claim_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.warranty_snapshot IS DISTINCT FROM OLD.warranty_snapshot
     OR NEW.warranty_version_id IS DISTINCT FROM OLD.warranty_version_id THEN
    RAISE EXCEPTION 'warranty snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claims_warranty_snapshot_immutable ON public.claims;
CREATE TRIGGER claims_warranty_snapshot_immutable
BEFORE UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.protect_claim_warranty_snapshot();

-- ---------------------------------------------------------------------------
-- 3. RLS: member owns the case, internal costs stay internal
-- ---------------------------------------------------------------------------

ALTER TABLE public.claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_internal_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claims_org ON public.claims;
CREATE POLICY claims_visible ON public.claims
FOR SELECT TO authenticated USING (
  member_profile_id = public.current_member_profile_id()
  OR public.has_permission('claims.manage', organization_id)
);

DROP POLICY IF EXISTS claim_events_visible ON public.claim_events;
CREATE POLICY claim_events_visible ON public.claim_events
FOR SELECT TO authenticated USING (
  public.has_permission('claims.manage', organization_id)
  OR (
    is_member_visible
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_id
        AND c.member_profile_id = public.current_member_profile_id()
    )
  )
);

CREATE POLICY claim_evidence_visible ON public.claim_evidence
FOR SELECT TO authenticated USING (
  public.has_permission('claims.manage', organization_id)
  OR (
    is_member_visible
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_id
        AND c.member_profile_id = public.current_member_profile_id()
    )
  )
);

CREATE POLICY claim_internal_costs_internal_only ON public.claim_internal_costs
FOR SELECT TO authenticated USING (
  public.has_permission('claims.manage', organization_id)
);

REVOKE ALL ON public.claims, public.claim_events, public.claim_evidence,
  public.claim_internal_costs FROM anon, authenticated;
GRANT SELECT ON public.claims, public.claim_events, public.claim_evidence TO authenticated;
GRANT SELECT ON public.claim_internal_costs TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Shared event helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.append_claim_event(
  claim_id_input UUID,
  organization_id_input UUID,
  action_input TEXT,
  note_input TEXT DEFAULT NULL,
  is_member_visible_input BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE event_id_value UUID;
BEGIN
  INSERT INTO public.claim_events(
    claim_id, organization_id, action, note, actor_user_id, is_member_visible
  ) VALUES (
    claim_id_input, organization_id_input, action_input,
    NULLIF(BTRIM(note_input), ''), (SELECT auth.uid()), is_member_visible_input
  ) RETURNING id INTO event_id_value;
  RETURN event_id_value;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Member actions
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.open_claim(UUID,TEXT,TEXT,UUID);
CREATE OR REPLACE FUNCTION public.create_claim(
  delivery_item_id_input UUID,
  issue_type_input TEXT,
  subject_input TEXT,
  description_input TEXT,
  claimed_quantity_input NUMERIC,
  severity_input TEXT,
  discovered_at_input TIMESTAMPTZ,
  packaging_condition_input TEXT,
  temporary_action_input TEXT,
  evidence_file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  delivery_record RECORD;
  file_record RECORD;
  warranty_record RECORD;
  claim_id_value UUID;
  claim_number_value TEXT;
  responsibility_value TEXT;
  already_claimed NUMERIC;
  warranty_value JSONB;
BEGIN
  IF public.current_member_profile_id() IS NULL THEN RAISE EXCEPTION 'member access required'; END IF;
  IF issue_type_input NOT IN (
    'MISSING','WRONG_ITEM','DAMAGED','PRODUCTION_QUALITY','TRANSIT_DAMAGE','INSTALLATION','OTHER'
  ) THEN RAISE EXCEPTION 'invalid claim type'; END IF;
  IF severity_input NOT IN ('LOW','MEDIUM','HIGH','CRITICAL') THEN RAISE EXCEPTION 'invalid severity'; END IF;
  IF NULLIF(BTRIM(subject_input), '') IS NULL OR LENGTH(BTRIM(subject_input)) < 5 THEN
    RAISE EXCEPTION 'claim subject is required';
  END IF;
  IF NULLIF(BTRIM(description_input), '') IS NULL OR LENGTH(BTRIM(description_input)) < 10 THEN
    RAISE EXCEPTION 'claim description is required';
  END IF;

  SELECT di.*, d.status AS delivery_status, oi.order_id, oi.project_item_id,
         co.member_profile_id, co.project_id, soi.supplier_order_id, so.supplier_id,
         pi.product_id
  INTO delivery_record
  FROM public.delivery_items di
  JOIN public.deliveries d ON d.id = di.delivery_id
  JOIN public.order_items oi ON oi.id = di.order_item_id
  JOIN public.customer_orders co ON co.id = oi.order_id
  LEFT JOIN public.supplier_order_items soi ON soi.order_item_id = oi.id
  LEFT JOIN public.supplier_orders so ON so.id = soi.supplier_order_id
  LEFT JOIN public.project_items pi ON pi.id = oi.project_item_id
  WHERE di.id = delivery_item_id_input
    AND co.member_profile_id = public.current_member_profile_id();

  IF NOT FOUND OR delivery_record.delivery_status NOT IN ('DELIVERED','DELIVERED_WITH_ISSUE') THEN
    RAISE EXCEPTION 'delivered item not found';
  END IF;
  IF claimed_quantity_input IS NULL OR claimed_quantity_input <= 0 THEN
    RAISE EXCEPTION 'claimed quantity must be greater than zero';
  END IF;

  SELECT COALESCE(SUM(c.claimed_quantity), 0) INTO already_claimed
  FROM public.claims c
  WHERE c.delivery_item_id = delivery_item_id_input
    AND c.status NOT IN ('REJECTED','CLOSED');
  IF already_claimed + claimed_quantity_input > delivery_record.quantity_delivered THEN
    RAISE EXCEPTION 'claimed quantity exceeds delivered quantity';
  END IF;

  SELECT fm.id, fm.member_profile_id INTO file_record
  FROM public.file_metadata fm
  WHERE fm.id = evidence_file_id_input
    AND fm.member_profile_id = public.current_member_profile_id()
    AND fm.visibility IN ('MEMBER_PRIVATE','MEMBER_VISIBLE');
  IF NOT FOUND THEN RAISE EXCEPTION 'claim evidence required'; END IF;

  responsibility_value := CASE issue_type_input
    WHEN 'WRONG_ITEM' THEN 'SUPPLIER'
    WHEN 'PRODUCTION_QUALITY' THEN 'SUPPLIER'
    WHEN 'DAMAGED' THEN 'LOGISTICS_INSURANCE'
    WHEN 'MISSING' THEN 'LOGISTICS_INSURANCE'
    WHEN 'TRANSIT_DAMAGE' THEN 'LOGISTICS_INSURANCE'
    WHEN 'INSTALLATION' THEN 'INSTALLER'
    ELSE 'UNDETERMINED'
  END;

  SELECT pw.id, pw.version_number, pw.title, pw.member_summary,
         pw.terms_text, pw.duration_months, pw.effective_from
  INTO warranty_record
  FROM public.partner_warranty_versions pw
  WHERE pw.supplier_id = delivery_record.supplier_id
    AND pw.status = 'ACTIVE'
    AND (pw.product_id = delivery_record.product_id OR pw.product_id IS NULL)
  ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
  LIMIT 1;

  warranty_value := CASE WHEN warranty_record.id IS NOT NULL THEN jsonb_build_object(
    'version_number', warranty_record.version_number,
    'title', warranty_record.title,
    'member_summary', warranty_record.member_summary,
    'terms_text', warranty_record.terms_text,
    'duration_months', warranty_record.duration_months,
    'effective_from', warranty_record.effective_from,
    'captured_at', NOW()
  ) ELSE jsonb_build_object(
    'version_number', 1,
    'title', 'เงื่อนไขรับประกันของ Partner ณ วันที่เปิด Claim',
    'member_summary', 'ทีม GISP จะตรวจสอบความรับผิดชอบตามหลักฐานและเงื่อนไขของรายการสั่งซื้อ',
    'terms_text', 'การอนุมัติซ่อม เปลี่ยนสินค้า หรือชดเชย ต้องผ่านการตรวจสอบของ Order Admin และไม่เกิดขึ้นอัตโนมัติ',
    'duration_months', NULL,
    'captured_at', NOW()
  ) END;

  claim_number_value := public.next_document_number('CLM');
  INSERT INTO public.claims(
    organization_id, member_profile_id, delivery_item_id, order_item_id,
    claim_number, issue_type, subject, description, claimed_quantity, severity,
    discovered_at, packaging_condition, temporary_action, evidence_file_id,
    status, suggested_responsibility, warranty_version_id, warranty_snapshot,
    opened_by
  ) VALUES (
    delivery_record.organization_id, delivery_record.member_profile_id,
    delivery_record.id, delivery_record.order_item_id, claim_number_value,
    issue_type_input, BTRIM(subject_input), BTRIM(description_input),
    claimed_quantity_input, severity_input, COALESCE(discovered_at_input, NOW()),
    NULLIF(BTRIM(packaging_condition_input), ''),
    NULLIF(BTRIM(temporary_action_input), ''), evidence_file_id_input,
    'SUBMITTED', responsibility_value, warranty_record.id, warranty_value,
    (SELECT auth.uid())
  ) RETURNING id INTO claim_id_value;

  INSERT INTO public.claim_evidence(
    claim_id, organization_id, file_id, evidence_type, note, uploaded_by
  ) VALUES (
    claim_id_value, delivery_record.organization_id, evidence_file_id_input,
    'ISSUE', 'หลักฐานตอนเปิด Claim', (SELECT auth.uid())
  );
  UPDATE public.file_metadata
  SET entity_id = claim_id_value, entity_type = 'CLAIM_EVIDENCE'
  WHERE id = evidence_file_id_input;

  PERFORM public.append_claim_event(
    claim_id_value, delivery_record.organization_id, 'SUBMITTED',
    'สมาชิกส่ง Claim และหลักฐานแล้ว', TRUE
  );
  PERFORM public.write_audit_event(
    delivery_record.organization_id, 'claim', claim_id_value, 'SUBMITTED',
    NULL, jsonb_build_object('claim_number', claim_number_value, 'issue_type', issue_type_input)
  );
  RETURN claim_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.member_claim_action(
  claim_id_input UUID,
  action_input TEXT,
  note_input TEXT DEFAULT NULL,
  evidence_file_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE claim_record public.claims%ROWTYPE;
DECLARE evidence_type_value TEXT;
BEGIN
  SELECT * INTO claim_record FROM public.claims
  WHERE id = claim_id_input
    AND member_profile_id = public.current_member_profile_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim not found'; END IF;
  IF claim_record.status IN ('CLOSED','REJECTED') THEN RAISE EXCEPTION 'claim is already final'; END IF;

  IF evidence_file_id_input IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.file_metadata fm
      WHERE fm.id = evidence_file_id_input
        AND fm.member_profile_id = public.current_member_profile_id()
    ) THEN RAISE EXCEPTION 'evidence file not found'; END IF;
    evidence_type_value := CASE WHEN action_input = 'ADD_INFORMATION' THEN 'REQUESTED_INFO' ELSE 'ISSUE' END;
    INSERT INTO public.claim_evidence(
      claim_id, organization_id, file_id, evidence_type, note, uploaded_by
    ) VALUES (
      claim_record.id, claim_record.organization_id, evidence_file_id_input,
      evidence_type_value, NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
    );
    UPDATE public.file_metadata
    SET entity_id = claim_record.id, entity_type = 'CLAIM_EVIDENCE'
    WHERE id = evidence_file_id_input;
  END IF;

  CASE action_input
    WHEN 'ADD_INFORMATION' THEN
      IF NULLIF(BTRIM(note_input), '') IS NULL AND evidence_file_id_input IS NULL THEN
        RAISE EXCEPTION 'information or evidence is required';
      END IF;
      UPDATE public.claims SET status = 'UNDER_REVIEW', information_request = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'INFORMATION_ADDED', COALESCE(note_input, 'สมาชิกแนบหลักฐานเพิ่ม'), TRUE);
    WHEN 'CONFIRM_RESOLVED' THEN
      IF claim_record.status <> 'RESOLVED' OR claim_record.resolution_evidence_file_id IS NULL THEN
        RAISE EXCEPTION 'resolution is not ready for confirmation';
      END IF;
      UPDATE public.claims SET member_response = 'RESOLVED',
        member_response_note = NULLIF(BTRIM(note_input), ''),
        member_responded_at = NOW(), member_confirmed_at = NOW()
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'MEMBER_CONFIRMED_RESOLVED', COALESCE(note_input, 'สมาชิกยืนยันว่าแก้ไขแล้ว'), TRUE);
    WHEN 'STILL_ISSUE' THEN
      IF claim_record.status <> 'RESOLVED' THEN RAISE EXCEPTION 'claim is not awaiting response'; END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'member note is required'; END IF;
      UPDATE public.claims SET status = 'IN_PROGRESS', member_response = 'STILL_ISSUE',
        member_response_note = BTRIM(note_input), member_responded_at = NOW(),
        member_confirmed_at = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'MEMBER_REPORTED_ISSUE', note_input, TRUE);
    WHEN 'CONTACT_ME' THEN
      IF claim_record.status <> 'RESOLVED' THEN RAISE EXCEPTION 'claim is not awaiting response'; END IF;
      UPDATE public.claims SET status = 'IN_PROGRESS', member_response = 'CONTACT_ME',
        member_response_note = NULLIF(BTRIM(note_input), ''), member_responded_at = NOW(),
        member_confirmed_at = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'MEMBER_REQUESTED_CONTACT', COALESCE(note_input, 'สมาชิกขอให้ติดต่อกลับ'), TRUE);
    ELSE RAISE EXCEPTION 'invalid member claim action';
  END CASE;

  PERFORM public.write_audit_event(claim_record.organization_id, 'claim', claim_record.id,
    action_input, NULL, jsonb_build_object('member_action', TRUE));
  RETURN claim_record.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Order Admin actions
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.resolve_claim(UUID,TEXT,TEXT);
CREATE OR REPLACE FUNCTION public.admin_claim_action(
  claim_id_input UUID,
  action_input TEXT,
  note_input TEXT DEFAULT NULL,
  responsibility_input TEXT DEFAULT NULL,
  resolution_type_input TEXT DEFAULT NULL,
  evidence_file_id_input UUID DEFAULT NULL,
  assigned_to_input UUID DEFAULT NULL,
  target_resolution_at_input TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE claim_record public.claims%ROWTYPE;
DECLARE next_status TEXT;
BEGIN
  SELECT * INTO claim_record FROM public.claims WHERE id = claim_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim not found'; END IF;
  IF NOT public.has_permission('claims.manage', claim_record.organization_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  CASE action_input
    WHEN 'START_REVIEW' THEN
      IF claim_record.status NOT IN ('SUBMITTED','WAITING_INFORMATION') THEN RAISE EXCEPTION 'claim cannot start review'; END IF;
      UPDATE public.claims SET status = 'UNDER_REVIEW', assigned_to = COALESCE(assigned_to_input, (SELECT auth.uid())),
        target_resolution_at = COALESCE(target_resolution_at_input, target_resolution_at)
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'UNDER_REVIEW', COALESCE(note_input, 'Order Admin เริ่มตรวจ Claim'), TRUE);
    WHEN 'REQUEST_INFORMATION' THEN
      IF claim_record.status IN ('CLOSED','REJECTED') THEN RAISE EXCEPTION 'claim is final'; END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'information request is required'; END IF;
      UPDATE public.claims SET status = 'WAITING_INFORMATION', information_request = BTRIM(note_input)
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'WAITING_INFORMATION', note_input, TRUE);
    WHEN 'CONFIRM_RESPONSIBILITY' THEN
      IF claim_record.status IN ('CLOSED','REJECTED') THEN RAISE EXCEPTION 'claim is final'; END IF;
      IF responsibility_input NOT IN ('SUPPLIER','LOGISTICS_INSURANCE','INSTALLER','GISP','MEMBER') THEN
        RAISE EXCEPTION 'invalid responsibility';
      END IF;
      UPDATE public.claims SET confirmed_responsibility = responsibility_input,
        responsibility_confirmed_by = (SELECT auth.uid()), responsibility_confirmed_at = NOW()
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'RESPONSIBILITY_CONFIRMED', 'Order Admin ยืนยันผู้รับผิดชอบ: ' || responsibility_input, TRUE);
    WHEN 'COORDINATE' THEN
      IF claim_record.confirmed_responsibility IS NULL THEN RAISE EXCEPTION 'responsibility confirmation required'; END IF;
      UPDATE public.claims SET status = 'COORDINATING_SUPPLIER'
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'COORDINATING', COALESCE(note_input, 'กำลังประสานผู้รับผิดชอบ'), TRUE);
    WHEN 'PROPOSE_RESOLUTION' THEN
      IF claim_record.confirmed_responsibility IS NULL THEN RAISE EXCEPTION 'responsibility confirmation required'; END IF;
      IF resolution_type_input NOT IN ('REPAIR','REPLACEMENT','SPARE_PART','REWORK','COMPENSATION','CREDIT','NO_ACTION') THEN
        RAISE EXCEPTION 'invalid resolution type';
      END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'resolution details are required'; END IF;
      next_status := CASE resolution_type_input
        WHEN 'REPAIR' THEN 'REPAIR_APPROVED'
        WHEN 'REPLACEMENT' THEN 'REPLACEMENT_APPROVED'
        WHEN 'COMPENSATION' THEN 'COMPENSATION_PROPOSED'
        WHEN 'CREDIT' THEN 'COMPENSATION_PROPOSED'
        ELSE 'IN_PROGRESS'
      END;
      UPDATE public.claims SET status = next_status, resolution_type = resolution_type_input,
        resolution_details = BTRIM(note_input), resolution = BTRIM(note_input),
        target_resolution_at = COALESCE(target_resolution_at_input, target_resolution_at)
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'RESOLUTION_PROPOSED', note_input, TRUE);
    WHEN 'MARK_IN_PROGRESS' THEN
      IF claim_record.resolution_type IS NULL THEN RAISE EXCEPTION 'resolution proposal required'; END IF;
      UPDATE public.claims SET status = 'IN_PROGRESS' WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'IN_PROGRESS', COALESCE(note_input, 'เริ่มดำเนินการตาม Resolution'), TRUE);
    WHEN 'COMPLETE_RESOLUTION' THEN
      IF claim_record.resolution_type IS NULL OR NULLIF(BTRIM(claim_record.resolution_details), '') IS NULL THEN
        RAISE EXCEPTION 'resolution proposal required';
      END IF;
      IF evidence_file_id_input IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.file_metadata fm WHERE fm.id = evidence_file_id_input
      ) THEN RAISE EXCEPTION 'resolution evidence is required'; END IF;
      INSERT INTO public.claim_evidence(
        claim_id, organization_id, file_id, evidence_type, note, uploaded_by
      ) VALUES (
        claim_record.id, claim_record.organization_id, evidence_file_id_input,
        'RESOLUTION', NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
      ) ON CONFLICT (claim_id, file_id) DO NOTHING;
      UPDATE public.file_metadata SET entity_id = claim_record.id, entity_type = 'CLAIM_EVIDENCE'
      WHERE id = evidence_file_id_input;
      UPDATE public.claims SET status = 'RESOLVED', resolution_executed_at = NOW(),
        resolution_evidence_file_id = evidence_file_id_input,
        resolved_by = (SELECT auth.uid()), resolved_at = NOW(),
        member_response = NULL, member_response_note = NULL, member_responded_at = NULL,
        member_confirmed_at = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'RESOLVED', COALESCE(note_input, 'ดำเนินการตาม Resolution แล้ว รอสมาชิกยืนยัน'), TRUE);
    WHEN 'REJECT' THEN
      IF claim_record.status IN ('CLOSED','REJECTED') THEN RAISE EXCEPTION 'claim is final'; END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'rejection reason is required'; END IF;
      UPDATE public.claims SET status = 'REJECTED', rejection_reason = BTRIM(note_input),
        resolved_by = (SELECT auth.uid()), resolved_at = NOW()
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'REJECTED', note_input, TRUE);
    WHEN 'CLOSE' THEN
      IF claim_record.status <> 'RESOLVED' OR claim_record.member_confirmed_at IS NULL
         OR claim_record.resolution_evidence_file_id IS NULL
         OR NULLIF(BTRIM(claim_record.resolution_details), '') IS NULL THEN
        RAISE EXCEPTION 'member confirmation and execution evidence are required';
      END IF;
      UPDATE public.claims SET status = 'CLOSED', closed_by = (SELECT auth.uid()), closed_at = NOW()
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'CLOSED', COALESCE(note_input, 'Order Admin ตรวจทานและปิด Claim'), TRUE);
    WHEN 'REOPEN' THEN
      IF claim_record.status NOT IN ('CLOSED','REJECTED','RESOLVED') THEN RAISE EXCEPTION 'claim is not final'; END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'reopen reason is required'; END IF;
      UPDATE public.claims SET status = 'UNDER_REVIEW', reopened_by = (SELECT auth.uid()),
        reopened_at = NOW(), reopen_reason = BTRIM(note_input), closed_by = NULL,
        closed_at = NULL, member_confirmed_at = NULL, rejection_reason = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'REOPENED', note_input, TRUE);
    ELSE RAISE EXCEPTION 'invalid admin claim action';
  END CASE;

  PERFORM public.write_audit_event(claim_record.organization_id, 'claim', claim_record.id,
    action_input, NULL, jsonb_build_object('admin_action', TRUE));
  RETURN claim_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_claim_internal_cost(
  claim_id_input UUID,
  cost_type_input TEXT,
  amount_input NUMERIC,
  currency_input TEXT DEFAULT 'THB',
  internal_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE claim_record public.claims%ROWTYPE;
DECLARE cost_id_value UUID;
BEGIN
  SELECT * INTO claim_record FROM public.claims WHERE id = claim_id_input;
  IF NOT FOUND OR NOT public.has_permission('claims.manage', claim_record.organization_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF NULLIF(BTRIM(cost_type_input), '') IS NULL OR amount_input IS NULL OR amount_input < 0 THEN
    RAISE EXCEPTION 'invalid internal cost';
  END IF;
  INSERT INTO public.claim_internal_costs(
    claim_id, organization_id, cost_type, amount, currency, internal_note, recorded_by
  ) VALUES (
    claim_record.id, claim_record.organization_id, BTRIM(cost_type_input), amount_input,
    UPPER(currency_input), NULLIF(BTRIM(internal_note_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO cost_id_value;
  PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
    'INTERNAL_COST_RECORDED', 'บันทึกต้นทุนภายในแล้ว', FALSE);
  PERFORM public.write_audit_event(claim_record.organization_id, 'claim', claim_record.id,
    'INTERNAL_COST_RECORDED', NULL, jsonb_build_object('amount', amount_input, 'currency', UPPER(currency_input)));
  RETURN cost_id_value;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Function privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.append_claim_event(UUID,UUID,TEXT,TEXT,BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_claim_warranty_snapshot() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;
