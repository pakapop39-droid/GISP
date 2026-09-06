-- Slice 5 — versioned GISP Custom Quotation, immutable acceptance snapshot,
-- member decision flow, and auditable lifecycle.

ALTER TABLE public.custom_requests
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_by UUID REFERENCES auth.users(id);

ALTER TABLE public.custom_quotations
  ADD COLUMN IF NOT EXISTS quote_note TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_spec_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

UPDATE public.custom_quotations quotation
SET member_profile_id = request.member_profile_id,
    confirmed_spec_json = jsonb_strip_nulls(jsonb_build_object(
      'description', request.specification,
      'width_mm', request.width_mm,
      'depth_mm', request.depth_mm,
      'height_mm', request.height_mm,
      'material', request.requested_material,
      'color', request.requested_color,
      'function', request.requested_function,
      'requested_options', request.requested_options_json
    )),
    accepted_at = CASE WHEN quotation.status = 'ACCEPTED' THEN quotation.responded_at ELSE quotation.accepted_at END,
    rejected_at = CASE WHEN quotation.status = 'REJECTED' THEN quotation.responded_at ELSE quotation.rejected_at END
FROM public.custom_requests request
WHERE request.id = quotation.custom_request_id;

ALTER TABLE public.custom_quotations
  ALTER COLUMN member_profile_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS custom_quotations_member_status_idx
  ON public.custom_quotations(member_profile_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS project_items_one_custom_quote_item_idx
  ON public.project_items(quotation_item_id)
  WHERE quotation_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_custom_request_quotation_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF OLD.status = 'CONVERTED' AND NEW.status IS DISTINCT FROM 'CONVERTED' THEN
    RAISE EXCEPTION 'CONVERTED_CUSTOM_REQUEST_IMMUTABLE';
  END IF;
  IF NEW.status = 'CANCELLED' AND EXISTS (
    SELECT 1 FROM public.custom_quotations quotation
    WHERE quotation.custom_request_id = OLD.id
      AND quotation.status IN ('DRAFT','SENT','ACCEPTED')
  ) THEN RAISE EXCEPTION 'ACTIVE_QUOTATION_MUST_BE_CANCELLED_FIRST'; END IF;
  IF NEW.status = 'CONVERTED' AND NOT EXISTS (
    SELECT 1 FROM public.custom_quotations quotation
    WHERE quotation.custom_request_id = OLD.id AND quotation.status = 'ACCEPTED'
  ) THEN RAISE EXCEPTION 'ACCEPTED_QUOTATION_REQUIRED'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_request_quotation_transition_guard ON public.custom_requests;
CREATE TRIGGER custom_request_quotation_transition_guard
BEFORE UPDATE OF status ON public.custom_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_custom_request_quotation_transition();

CREATE TABLE IF NOT EXISTS public.custom_quotation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.custom_quotations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  member_profile_id UUID NOT NULL REFERENCES public.member_profiles(id),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  message TEXT,
  visibility TEXT NOT NULL DEFAULT 'MEMBER'
    CHECK (visibility IN ('MEMBER', 'INTERNAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_quotation_history_quote_idx
  ON public.custom_quotation_history(quotation_id, created_at);
CREATE INDEX IF NOT EXISTS custom_quotation_history_member_idx
  ON public.custom_quotation_history(member_profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_custom_quotation_history(
  quotation_id_input UUID,
  action_input TEXT,
  from_status_input TEXT,
  to_status_input TEXT,
  message_input TEXT DEFAULT NULL,
  visibility_input TEXT DEFAULT 'MEMBER'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quotation_record public.custom_quotations%ROWTYPE;
  history_id_value UUID;
BEGIN
  SELECT * INTO quotation_record
  FROM public.custom_quotations
  WHERE id = quotation_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION 'QUOTATION_NOT_FOUND'; END IF;

  INSERT INTO public.custom_quotation_history(
    quotation_id, organization_id, member_profile_id, actor_user_id,
    action, from_status, to_status, message, visibility
  ) VALUES (
    quotation_id_input, quotation_record.organization_id,
    quotation_record.member_profile_id, (SELECT auth.uid()),
    action_input, from_status_input, to_status_input,
    NULLIF(BTRIM(message_input), ''), visibility_input
  ) RETURNING id INTO history_id_value;
  RETURN history_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_custom_quotation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'ACCEPTED' THEN
    RAISE EXCEPTION 'ACCEPTED_QUOTATION_IMMUTABLE';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.member_profile_id IS DISTINCT FROM OLD.member_profile_id
    OR NEW.custom_request_id IS DISTINCT FROM OLD.custom_request_id
    OR NEW.quotation_number IS DISTINCT FROM OLD.quotation_number
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.revision_of_id IS DISTINCT FROM OLD.revision_of_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'QUOTATION_IDENTITY_IMMUTABLE';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'DRAFT' AND NEW.status IN ('SENT','CANCELLED','SUPERSEDED'))
    OR (OLD.status = 'SENT' AND NEW.status IN ('ACCEPTED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED'))
    OR (OLD.status IN ('REJECTED','EXPIRED','CANCELLED') AND NEW.status = 'SUPERSEDED')
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION:%->%', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_custom_quotation_child_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quotation_id_value UUID := COALESCE(NEW.quotation_id, OLD.quotation_id);
  quotation_status TEXT;
BEGIN
  SELECT status INTO quotation_status
  FROM public.custom_quotations
  WHERE id = quotation_id_value;
  IF quotation_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'QUOTATION_CONTENT_IMMUTABLE';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_quotation_items_guard ON public.custom_quotation_items;
CREATE TRIGGER custom_quotation_items_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.custom_quotation_items
FOR EACH ROW EXECUTE FUNCTION public.guard_custom_quotation_child_mutation();

DROP TRIGGER IF EXISTS custom_quotation_costs_guard ON public.custom_quotation_costs;
CREATE TRIGGER custom_quotation_costs_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.custom_quotation_costs
FOR EACH ROW EXECUTE FUNCTION public.guard_custom_quotation_child_mutation();

DROP TRIGGER IF EXISTS custom_quotation_history_append_only ON public.custom_quotation_history;
CREATE TRIGGER custom_quotation_history_append_only
BEFORE UPDATE OR DELETE ON public.custom_quotation_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

DROP FUNCTION IF EXISTS public.create_custom_quotation(UUID, NUMERIC, INTEGER, INTEGER, UUID, NUMERIC);
CREATE FUNCTION public.create_custom_quotation(
  custom_request_id_input UUID,
  subtotal_input NUMERIC,
  lead_time_days_input INTEGER,
  valid_days_input INTEGER DEFAULT NULL,
  supplier_id_input UUID DEFAULT NULL,
  supplier_cost_total_input NUMERIC DEFAULT NULL,
  quote_note_input TEXT DEFAULT NULL,
  confirmed_specification_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  previous_quote public.custom_quotations%ROWTYPE;
  quote_id_value UUID;
  next_version INTEGER;
  quote_number_value TEXT;
  vat_rate_value NUMERIC(5,2);
  vat_amount_value NUMERIC(18,2);
  grand_total_value NUMERIC(18,2);
  validity_days INTEGER;
  confirmed_spec_value TEXT;
  confirmed_spec_json_value JSONB;
BEGIN
  IF NOT public.has_permission('quotations.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF subtotal_input IS NULL OR subtotal_input <= 0
    OR lead_time_days_input IS NULL OR lead_time_days_input <= 0
    OR supplier_id_input IS NULL
    OR supplier_cost_total_input IS NULL OR supplier_cost_total_input <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUOTATION_VALUES';
  END IF;

  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = custom_request_id_input
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND'; END IF;
  IF request_record.status <> 'READY_FOR_QUOTE' THEN
    RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_READY_FOR_QUOTE';
  END IF;
  IF NOT public.has_permission('quotations.manage', request_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.custom_request_supplier_candidates candidate
    JOIN public.suppliers supplier ON supplier.id = candidate.supplier_id
    WHERE candidate.custom_request_id = request_record.id
      AND candidate.supplier_id = supplier_id_input
      AND candidate.candidate_status = 'ACTIVE'
      AND supplier.status = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'SUPPLIER_CANDIDATE_REQUIRED'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.custom_quotations
    WHERE custom_request_id = custom_request_id_input AND status = 'ACCEPTED'
  ) THEN RAISE EXCEPTION 'ACCEPTED_QUOTATION_IMMUTABLE'; END IF;

  SELECT * INTO previous_quote
  FROM public.custom_quotations
  WHERE custom_request_id = custom_request_id_input
    AND status <> 'ACCEPTED'
  ORDER BY version DESC
  LIMIT 1
  FOR UPDATE;

  IF previous_quote.id IS NOT NULL AND previous_quote.status <> 'SUPERSEDED' THEN
    UPDATE public.custom_quotations
    SET status = 'SUPERSEDED', superseded_at = NOW()
    WHERE id = previous_quote.id;
    UPDATE public.assignments
    SET status = 'CANCELLED', completed_at = NOW()
    WHERE entity_type = 'CUSTOM_QUOTATION' AND entity_id = previous_quote.id
      AND status IN ('OPEN','IN_PROGRESS');
    PERFORM public.record_custom_quotation_history(
      previous_quote.id, 'SUPERSEDED', previous_quote.status, 'SUPERSEDED',
      'มีการสร้างใบเสนอราคา Revision ใหม่', 'MEMBER'
    );
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.custom_quotations
  WHERE custom_request_id = custom_request_id_input;
  quote_number_value := COALESCE(previous_quote.quotation_number, public.next_document_number('QT'));

  SELECT default_vat_rate, COALESCE(valid_days_input, default_quote_valid_days)
  INTO vat_rate_value, validity_days
  FROM public.company_settings WHERE singleton = TRUE;
  IF validity_days IS NULL OR validity_days <= 0 OR validity_days > 365 THEN
    RAISE EXCEPTION 'INVALID_VALIDITY_DAYS';
  END IF;

  confirmed_spec_value := COALESCE(
    NULLIF(BTRIM(confirmed_specification_input), ''), request_record.specification
  );
  confirmed_spec_json_value := jsonb_strip_nulls(jsonb_build_object(
    'description', confirmed_spec_value,
    'width_mm', request_record.width_mm,
    'depth_mm', request_record.depth_mm,
    'height_mm', request_record.height_mm,
    'material', request_record.requested_material,
    'color', request_record.requested_color,
    'function', request_record.requested_function,
    'requested_options', request_record.requested_options_json
  ));
  vat_amount_value := ROUND(ROUND(subtotal_input, 2) * vat_rate_value / 100, 2);
  grand_total_value := ROUND(ROUND(subtotal_input, 2) + vat_amount_value, 2);

  INSERT INTO public.custom_quotations(
    organization_id, member_profile_id, custom_request_id,
    quotation_number, version, revision_of_id, subtotal, vat_rate,
    vat_amount, grand_total, lead_time_days, confirmed_specification,
    confirmed_spec_json, quote_note, valid_until, created_by
  ) VALUES (
    request_record.organization_id, request_record.member_profile_id,
    request_record.id, quote_number_value, next_version, previous_quote.id,
    ROUND(subtotal_input, 2), vat_rate_value, vat_amount_value,
    grand_total_value, lead_time_days_input, confirmed_spec_value,
    confirmed_spec_json_value, NULLIF(BTRIM(quote_note_input), ''),
    CURRENT_DATE + validity_days, (SELECT auth.uid())
  ) RETURNING id INTO quote_id_value;

  INSERT INTO public.custom_quotation_items(
    quotation_id, line_number, item_name, specification_snapshot,
    quantity, unit, unit_price, line_subtotal
  ) VALUES (
    quote_id_value, 1, request_record.item_name, confirmed_spec_value,
    request_record.quantity, request_record.unit,
    ROUND(subtotal_input / request_record.quantity, 2), ROUND(subtotal_input, 2)
  );

  INSERT INTO public.custom_quotation_costs(
    quotation_id, supplier_id, supplier_cost_total, created_by
  ) VALUES (
    quote_id_value, supplier_id_input, ROUND(supplier_cost_total_input, 2),
    (SELECT auth.uid())
  );

  UPDATE public.custom_requests
  SET selected_supplier_id = supplier_id_input
  WHERE id = request_record.id;

  PERFORM public.record_custom_quotation_history(
    quote_id_value, 'DRAFT_CREATED', NULL, 'DRAFT',
    FORMAT('สร้าง Revision %s', next_version), 'MEMBER'
  );
  PERFORM public.write_audit_event(
    request_record.organization_id, 'custom_quotation', quote_id_value,
    'DRAFT_CREATED', NULL,
    jsonb_build_object('quotation_number', quote_number_value, 'version', next_version)
  );
  RETURN quote_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_custom_quotation_draft(
  quotation_id_input UUID,
  subtotal_input NUMERIC,
  lead_time_days_input INTEGER,
  valid_days_input INTEGER,
  supplier_id_input UUID,
  supplier_cost_total_input NUMERIC,
  quote_note_input TEXT,
  confirmed_specification_input TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quotation_record public.custom_quotations%ROWTYPE;
  vat_amount_value NUMERIC(18,2);
BEGIN
  SELECT * INTO quotation_record FROM public.custom_quotations
  WHERE id = quotation_id_input FOR UPDATE;
  IF NOT FOUND OR quotation_record.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'QUOTATION_NOT_EDITABLE';
  END IF;
  IF NOT public.has_permission('quotations.manage', quotation_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF subtotal_input IS NULL OR subtotal_input <= 0
    OR lead_time_days_input IS NULL OR lead_time_days_input <= 0
    OR valid_days_input IS NULL OR valid_days_input <= 0 OR valid_days_input > 365
    OR supplier_cost_total_input IS NULL OR supplier_cost_total_input <= 0
    OR NULLIF(BTRIM(confirmed_specification_input), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_QUOTATION_VALUES';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.custom_request_supplier_candidates candidate
    JOIN public.suppliers supplier ON supplier.id = candidate.supplier_id
    WHERE candidate.custom_request_id = quotation_record.custom_request_id
      AND candidate.supplier_id = supplier_id_input
      AND candidate.candidate_status = 'ACTIVE'
      AND supplier.status = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'SUPPLIER_CANDIDATE_REQUIRED'; END IF;

  vat_amount_value := ROUND(ROUND(subtotal_input, 2) * quotation_record.vat_rate / 100, 2);
  UPDATE public.custom_quotations SET
    subtotal = ROUND(subtotal_input, 2), vat_amount = vat_amount_value,
    grand_total = ROUND(ROUND(subtotal_input, 2) + vat_amount_value, 2),
    lead_time_days = lead_time_days_input,
    confirmed_specification = BTRIM(confirmed_specification_input),
    confirmed_spec_json = jsonb_set(
      confirmed_spec_json, '{description}', to_jsonb(BTRIM(confirmed_specification_input)), TRUE
    ),
    quote_note = NULLIF(BTRIM(quote_note_input), ''),
    valid_until = CURRENT_DATE + valid_days_input
  WHERE id = quotation_id_input;

  UPDATE public.custom_quotation_items SET
    specification_snapshot = BTRIM(confirmed_specification_input),
    unit_price = ROUND(subtotal_input / quantity, 2),
    line_subtotal = ROUND(subtotal_input, 2)
  WHERE quotation_id = quotation_id_input;
  UPDATE public.custom_quotation_costs SET
    supplier_id = supplier_id_input,
    supplier_cost_total = ROUND(supplier_cost_total_input, 2)
  WHERE quotation_id = quotation_id_input;

  PERFORM public.record_custom_quotation_history(
    quotation_id_input, 'DRAFT_UPDATED', 'DRAFT', 'DRAFT',
    'ปรับข้อมูลใบเสนอราคา', 'INTERNAL'
  );
  PERFORM public.write_audit_event(
    quotation_record.organization_id, 'custom_quotation', quotation_id_input, 'DRAFT_UPDATED'
  );
  RETURN quotation_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_custom_quotation(quotation_id_input UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE quotation_record public.custom_quotations%ROWTYPE;
BEGIN
  SELECT * INTO quotation_record FROM public.custom_quotations
  WHERE id = quotation_id_input FOR UPDATE;
  IF NOT FOUND OR quotation_record.status <> 'DRAFT' THEN RAISE EXCEPTION 'QUOTATION_NOT_SENDABLE'; END IF;
  IF NOT public.has_permission('quotations.manage', quotation_record.organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF quotation_record.valid_until < CURRENT_DATE THEN RAISE EXCEPTION 'QUOTATION_VALIDITY_REQUIRED'; END IF;

  UPDATE public.custom_quotations SET status = 'SENT', sent_at = NOW()
  WHERE id = quotation_id_input;
  INSERT INTO public.assignments(
    organization_id, entity_type, entity_id, assigned_to, due_at,
    action_required, status, created_by
  )
  SELECT quotation_record.organization_id, 'CUSTOM_QUOTATION', quotation_id_input,
    profile.user_id, quotation_record.valid_until::TIMESTAMPTZ + INTERVAL '1 day' - INTERVAL '1 second',
    'ตรวจสอบและตอบรับใบเสนอราคา', 'OPEN', (SELECT auth.uid())
  FROM public.member_profiles profile
  WHERE profile.id = quotation_record.member_profile_id;
  PERFORM public.record_custom_quotation_history(
    quotation_id_input, 'SENT', 'DRAFT', 'SENT',
    'GISP ส่งใบเสนอราคาให้สมาชิกแล้ว', 'MEMBER'
  );
  PERFORM public.write_audit_event(
    quotation_record.organization_id, 'custom_quotation', quotation_id_input, 'SENT'
  );
  RETURN quotation_id_input;
END;
$$;

DROP FUNCTION IF EXISTS public.respond_custom_quotation(UUID, TEXT);
CREATE FUNCTION public.respond_custom_quotation(
  quotation_id_input UUID,
  response_input TEXT,
  reason_input TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quotation_record public.custom_quotations%ROWTYPE;
  request_record public.custom_requests%ROWTYPE;
  item_record public.custom_quotation_items%ROWTYPE;
  project_item_id_value UUID;
BEGIN
  IF response_input NOT IN ('ACCEPTED','REJECTED') THEN RAISE EXCEPTION 'INVALID_RESPONSE'; END IF;
  IF response_input = 'REJECTED' AND NULLIF(BTRIM(reason_input), '') IS NULL THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;
  SELECT * INTO quotation_record FROM public.custom_quotations
  WHERE id = quotation_id_input FOR UPDATE;
  IF NOT FOUND OR quotation_record.status <> 'SENT'
    OR quotation_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id() THEN
    RAISE EXCEPTION 'QUOTATION_NOT_AVAILABLE';
  END IF;

  IF quotation_record.valid_until < CURRENT_DATE THEN
    UPDATE public.custom_quotations SET
      status = 'EXPIRED', expired_at = NOW(), decision_reason = 'หมดอายุตามวันที่กำหนด'
    WHERE id = quotation_id_input;
    UPDATE public.assignments SET status = 'CANCELLED', completed_at = NOW()
    WHERE entity_type = 'CUSTOM_QUOTATION' AND entity_id = quotation_id_input
      AND status IN ('OPEN','IN_PROGRESS');
    PERFORM public.record_custom_quotation_history(
      quotation_id_input, 'EXPIRED', 'SENT', 'EXPIRED',
      'ใบเสนอราคาหมดอายุแล้ว', 'MEMBER'
    );
    RETURN jsonb_build_object('id', quotation_id_input, 'status', 'EXPIRED');
  END IF;

  UPDATE public.custom_quotations SET
    status = response_input,
    responded_at = NOW(),
    accepted_at = CASE WHEN response_input = 'ACCEPTED' THEN NOW() ELSE accepted_at END,
    rejected_at = CASE WHEN response_input = 'REJECTED' THEN NOW() ELSE rejected_at END,
    decision_reason = NULLIF(BTRIM(reason_input), '')
  WHERE id = quotation_id_input;
  UPDATE public.assignments SET status = 'DONE', completed_at = NOW()
  WHERE entity_type = 'CUSTOM_QUOTATION' AND entity_id = quotation_id_input
    AND status IN ('OPEN','IN_PROGRESS');

  IF response_input = 'ACCEPTED' THEN
    SELECT * INTO request_record FROM public.custom_requests
    WHERE id = quotation_record.custom_request_id FOR UPDATE;
    SELECT * INTO item_record FROM public.custom_quotation_items
    WHERE quotation_id = quotation_id_input ORDER BY line_number LIMIT 1;
    IF request_record.status <> 'READY_FOR_QUOTE' OR item_record.id IS NULL THEN
      RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_CONVERTIBLE';
    END IF;

    INSERT INTO public.project_items(
      project_id, organization_id, area_id, quotation_item_id,
      item_type, item_name, specification_snapshot, selected_options,
      quantity, unit, current_unit_price, vat_rate_snapshot,
      lead_time_days_snapshot, status, created_by
    ) VALUES (
      request_record.project_id, quotation_record.organization_id,
      request_record.area_id, item_record.id, 'CUSTOM', item_record.item_name,
      item_record.specification_snapshot, '[]'::jsonb, item_record.quantity,
      item_record.unit, item_record.unit_price, quotation_record.vat_rate,
      quotation_record.lead_time_days, 'READY_TO_ORDER', (SELECT auth.uid())
    ) RETURNING id INTO project_item_id_value;

    UPDATE public.custom_requests SET
      status = 'CONVERTED', converted_at = NOW(), converted_by = (SELECT auth.uid())
    WHERE id = quotation_record.custom_request_id;
  END IF;

  PERFORM public.record_custom_quotation_history(
    quotation_id_input, response_input, 'SENT', response_input,
    CASE WHEN response_input = 'ACCEPTED' THEN 'สมาชิกยอมรับใบเสนอราคาแล้ว' ELSE BTRIM(reason_input) END,
    'MEMBER'
  );
  PERFORM public.write_audit_event(
    quotation_record.organization_id, 'custom_quotation', quotation_id_input, response_input,
    NULL, jsonb_build_object('project_item_id', project_item_id_value)
  );
  RETURN jsonb_build_object(
    'id', quotation_id_input, 'status', response_input,
    'project_item_id', project_item_id_value
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_transition_custom_quotation(
  quotation_id_input UUID,
  action_input TEXT,
  reason_input TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE quotation_record public.custom_quotations%ROWTYPE; next_status TEXT;
BEGIN
  SELECT * INTO quotation_record FROM public.custom_quotations
  WHERE id = quotation_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('quotations.manage', quotation_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF action_input = 'CANCEL' THEN
    IF quotation_record.status NOT IN ('DRAFT','SENT') OR NULLIF(BTRIM(reason_input), '') IS NULL THEN
      RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED_OR_INVALID_STATUS';
    END IF;
    next_status := 'CANCELLED';
    UPDATE public.custom_quotations SET
      status = next_status, cancelled_at = NOW(), decision_reason = BTRIM(reason_input)
    WHERE id = quotation_id_input;
  ELSIF action_input = 'EXPIRE' THEN
    IF quotation_record.status <> 'SENT' OR quotation_record.valid_until >= CURRENT_DATE THEN
      RAISE EXCEPTION 'QUOTATION_NOT_EXPIRED';
    END IF;
    next_status := 'EXPIRED';
    UPDATE public.custom_quotations SET
      status = next_status, expired_at = NOW(), decision_reason = 'หมดอายุตามวันที่กำหนด'
    WHERE id = quotation_id_input;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;

  UPDATE public.assignments SET status = 'CANCELLED', completed_at = NOW()
  WHERE entity_type = 'CUSTOM_QUOTATION' AND entity_id = quotation_id_input
    AND status IN ('OPEN','IN_PROGRESS');
  PERFORM public.record_custom_quotation_history(
    quotation_id_input, next_status, quotation_record.status, next_status,
    COALESCE(NULLIF(BTRIM(reason_input), ''), 'ใบเสนอราคาหมดอายุแล้ว'), 'MEMBER'
  );
  PERFORM public.write_audit_event(
    quotation_record.organization_id, 'custom_quotation', quotation_id_input, next_status
  );
  RETURN quotation_id_input;
END;
$$;

ALTER TABLE public.custom_quotation_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custom_quotations_org ON public.custom_quotations;
CREATE POLICY custom_quotations_org ON public.custom_quotations
FOR SELECT TO authenticated
USING (
  (member_profile_id = public.current_member_profile_id() AND sent_at IS NOT NULL)
  OR public.has_permission('quotations.manage', organization_id)
);

DROP POLICY IF EXISTS custom_quotation_items_org ON public.custom_quotation_items;
CREATE POLICY custom_quotation_items_org ON public.custom_quotation_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.custom_quotations quotation
  WHERE quotation.id = quotation_id
    AND (
      (quotation.member_profile_id = public.current_member_profile_id() AND quotation.sent_at IS NOT NULL)
      OR public.has_permission('quotations.manage', quotation.organization_id)
    )
));

DROP POLICY IF EXISTS custom_quotation_history_select ON public.custom_quotation_history;
CREATE POLICY custom_quotation_history_select ON public.custom_quotation_history
FOR SELECT TO authenticated
USING (
  (
    member_profile_id = public.current_member_profile_id()
    AND visibility = 'MEMBER'
    AND EXISTS (
      SELECT 1 FROM public.custom_quotations quotation
      WHERE quotation.id = quotation_id AND quotation.sent_at IS NOT NULL
    )
  )
  OR public.has_permission('quotations.manage', organization_id)
);

REVOKE ALL ON public.custom_quotation_history FROM anon, authenticated;
GRANT SELECT (
  id, quotation_id, organization_id, member_profile_id,
  action, from_status, to_status, message, visibility, created_at
) ON public.custom_quotation_history TO authenticated;

REVOKE ALL ON FUNCTION public.record_custom_quotation_history(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_custom_quotation_child_mutation() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_custom_request_quotation_transition() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_custom_quotation(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_custom_quotation_draft(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_transition_custom_quotation(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.create_custom_quotation(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_custom_quotation_draft(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_custom_quotation(UUID,TEXT,TEXT) TO authenticated;
