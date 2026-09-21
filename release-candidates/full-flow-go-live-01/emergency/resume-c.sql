
-- TEMPLATE ONLY. Forward resume of Release C after reconciliation and approval.
-- Preconditions: exact function-definition and ACL hashes match the frozen
-- PAY-RPC-GATE-001 package and the incident-time ACL snapshot. Do not run if
-- any pre-stop staff ACL differs from authenticated-only.

-- Restore the frozen private preview executor body.
CREATE OR REPLACE FUNCTION public.record_customer_payment_evidence_preview(
  transfer_id_input UUID, session_token_hash_input TEXT,
  evidence_file_id_input UUID, sha256_input TEXT,
  size_bytes_input BIGINT, mime_type_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  t public.payment_transfers%ROWTYPE;
  ps public.payment_schedules%ROWTYPE;
  o public.customer_orders%ROWTYPE;
  fm public.file_metadata%ROWTYPE;
  finance_actor UUID;
  finance_session UUID;
  receipt_id UUID;
BEGIN
  SELECT * INTO t FROM public.payment_transfers WHERE id = transfer_id_input;
  IF t.id IS NULL OR t.organization_id IS NULL THEN RAISE EXCEPTION 'EVIDENCE_NOT_AVAILABLE'; END IF;
  SELECT actor_user_id, app_session_id INTO finance_actor, finance_session
  FROM public.payment_finance_actor(session_token_hash_input, t.organization_id);
  IF finance_actor IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO ps FROM public.payment_schedules WHERE id = t.payment_schedule_id;
  IF ps.schedule_type = 'FREIGHT' AND NOT public.freight_payment_enabled() THEN
    RAISE EXCEPTION 'FREIGHT_PAYMENT_NOT_RELEASED';
  END IF;
  SELECT * INTO o FROM public.customer_orders WHERE id = ps.order_id;
  SELECT * INTO fm FROM public.file_metadata WHERE id = t.evidence_file_id;
  IF ps.id IS NULL OR o.id IS NULL OR fm.id IS NULL
    OR ps.organization_id IS DISTINCT FROM t.organization_id
    OR o.organization_id IS DISTINCT FROM t.organization_id
    OR o.member_profile_id IS NULL
    OR fm.id IS DISTINCT FROM evidence_file_id_input
    OR fm.organization_id IS DISTINCT FROM t.organization_id
    OR fm.member_profile_id IS DISTINCT FROM o.member_profile_id
    OR fm.entity_type IS DISTINCT FROM 'CUSTOMER_PAYMENT_EVIDENCE'
    OR fm.entity_id IS DISTINCT FROM t.id
    OR fm.visibility IS DISTINCT FROM 'MEMBER_PRIVATE'
    OR fm.bucket IS DISTINCT FROM 'gisp-member-private'
    OR NULLIF(BTRIM(fm.object_key), '') IS NULL
    OR fm.size_bytes IS DISTINCT FROM size_bytes_input
    OR fm.mime_type IS DISTINCT FROM mime_type_input
    OR fm.mime_type IS NULL
    OR fm.mime_type NOT IN ('application/pdf','image/jpeg','image/png')
    OR sha256_input IS NULL
    OR sha256_input !~ '^[a-f0-9]{64}$'
    OR size_bytes_input NOT BETWEEN 1 AND 10485760
    OR EXISTS (SELECT 1 FROM public.payment_transfers other_transfer
      WHERE other_transfer.evidence_file_id = fm.id AND other_transfer.id <> t.id)
  THEN RAISE EXCEPTION 'EVIDENCE_NOT_AVAILABLE'; END IF;
  INSERT INTO public.audit_events(
    organization_id, actor_user_id, entity_type, entity_id, action, after_data
  ) VALUES (
    t.organization_id, finance_actor, 'payment_transfer', t.id, 'EVIDENCE_PREVIEWED',
    jsonb_build_object('fileId',fm.id,'sha256',sha256_input,'sizeBytes',size_bytes_input,
      'mimeType',mime_type_input,'sessionId',finance_session)
  ) RETURNING id INTO receipt_id;
  RETURN receipt_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_customer_payment_evidence_preview(UUID,TEXT,UUID,TEXT,BIGINT,TEXT)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_payment_evidence_preview(UUID,TEXT,UUID,TEXT,BIGINT,TEXT)
  TO project_admin;

-- Restore the frozen private Finance executor body.

CREATE OR REPLACE FUNCTION public.verify_payment_transfer_private(
  transfer_id_input UUID, approve_input BOOLEAN, finance_note_input TEXT,
  session_token_hash_input TEXT, evidence_file_id_input UUID,
  sha256_input TEXT, size_bytes_input BIGINT
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE result_id UUID;
BEGIN
  result_id := public.verify_payment_transfer_private_ffgl_impl(
    transfer_id_input, approve_input, finance_note_input,
    session_token_hash_input, evidence_file_id_input, sha256_input, size_bytes_input);
  RETURN result_id;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)
  TO project_admin;

CREATE OR REPLACE FUNCTION public.recalculate_customer_payment_schedule(
  payment_schedule_id_input UUID,
  adjustment_id_input UUID,
  actor_user_id_input UUID
)
RETURNS VOID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  ps public.payment_schedules%ROWTYPE;
  co public.customer_orders%ROWTYPE;
  verified_total NUMERIC(18,2);
  adjustment_total NUMERIC(18,2);
  effective_total NUMERIC(18,2);
  new_status TEXT;
BEGIN
  SELECT * INTO ps
  FROM public.payment_schedules
  WHERE id = payment_schedule_id_input
  FOR UPDATE;
  IF ps.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_SCHEDULE_NOT_AVAILABLE'; END IF;

  SELECT * INTO co
  FROM public.customer_orders
  WHERE id = ps.order_id
  FOR UPDATE;
  IF co.id IS NULL OR co.organization_id IS DISTINCT FROM ps.organization_id THEN
    RAISE EXCEPTION 'PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;

  SELECT COALESCE(ROUND(SUM(t.amount), 2), 0)
  INTO verified_total
  FROM public.payment_transfers t
  WHERE t.payment_schedule_id = ps.id
    AND t.status = 'VERIFIED';

  SELECT COALESCE(ROUND(SUM(a.amount_delta), 2), 0)
  INTO adjustment_total
  FROM public.payment_adjustments a
  WHERE a.payment_schedule_id = ps.id
    AND a.status = 'APPROVED';

  effective_total := ROUND(verified_total + adjustment_total, 2);
  IF effective_total < 0 THEN RAISE EXCEPTION 'PAYMENT_ADJUSTMENT_EXCEEDS_VERIFIED_TOTAL'; END IF;

  new_status := CASE
    WHEN effective_total > ps.due_amount THEN 'OVERPAYMENT_REVIEW'
    WHEN effective_total = ps.due_amount THEN 'VERIFIED'
    WHEN effective_total > 0 THEN 'PARTIALLY_VERIFIED'
    ELSE 'PENDING'
  END;

  UPDATE public.payment_schedules
  SET verified_amount = effective_total,
      status = new_status,
      verified_at = CASE WHEN new_status = 'VERIFIED' THEN NOW() ELSE NULL END
  WHERE id = ps.id;

  IF ps.schedule_type = 'DEPOSIT' THEN
    UPDATE public.customer_orders
    SET deposit_verified_at = CASE WHEN new_status = 'VERIFIED' THEN NOW() ELSE NULL END,
        status = CASE
          WHEN new_status = 'VERIFIED' AND status = 'PENDING_DEPOSIT' THEN 'DEPOSIT_VERIFIED'
          WHEN new_status <> 'VERIFIED' AND status = 'DEPOSIT_VERIFIED' THEN 'PENDING_DEPOSIT'
          ELSE status
        END
    WHERE id = co.id;
  ELSIF ps.schedule_type = 'BALANCE' THEN
    UPDATE public.customer_orders
    SET balance_verified_at = CASE WHEN new_status = 'VERIFIED' THEN NOW() ELSE NULL END
    WHERE id = co.id;
  END IF;

  IF new_status <> 'VERIFIED'
    AND co.status NOT IN ('PENDING_DEPOSIT', 'DEPOSIT_VERIFIED', 'CANCELLATION_REQUESTED', 'CANCELLED')
  THEN
    INSERT INTO public.payment_workflow_holds(
      organization_id, customer_order_id, payment_adjustment_id,
      reason, created_by
    ) VALUES (
      co.organization_id, co.id, adjustment_id_input,
      'Verified payment was reduced after PO or operations started; Finance and Order Admin review is required.',
      actor_user_id_input
    )
    ON CONFLICT (customer_order_id) WHERE status = 'ACTIVE' DO NOTHING;
  END IF;

END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_customer_payment_schedule(UUID,UUID,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_customer_payment_schedule(UUID,UUID,UUID)
  TO project_admin;

CREATE OR REPLACE FUNCTION public.create_payment_adjustment_private(
  transfer_id_input UUID,
  adjustment_type_input TEXT,
  amount_input NUMERIC,
  reason_input TEXT,
  session_token_hash_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  t public.payment_transfers%ROWTYPE;
  ps public.payment_schedules%ROWTYPE;
  actor_id UUID;
  session_id UUID;
  requested_delta NUMERIC(18,2);
  reserved_delta NUMERIC(18,2);
  adjustment_id UUID;
BEGIN
  SELECT * INTO t
  FROM public.payment_transfers
  WHERE id = transfer_id_input
  FOR SHARE;
  IF t.id IS NULL OR t.status <> 'VERIFIED' OR t.organization_id IS NULL THEN
    RAISE EXCEPTION 'VERIFIED_TRANSFER_REQUIRED';
  END IF;

  SELECT actor_user_id, app_session_id INTO actor_id, session_id
  FROM public.payment_adjustment_actor(session_token_hash_input, t.organization_id);
  IF actor_id IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;

  SELECT * INTO ps
  FROM public.payment_schedules
  WHERE id = t.payment_schedule_id;
  IF ps.id IS NULL OR ps.organization_id IS DISTINCT FROM t.organization_id THEN
    RAISE EXCEPTION 'PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;

  IF adjustment_type_input NOT IN ('ADJUSTMENT', 'REVERSAL')
    OR NULLIF(BTRIM(reason_input), '') IS NULL
    OR LENGTH(BTRIM(reason_input)) < 3 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_ADJUSTMENT';
  END IF;

  requested_delta := CASE
    WHEN adjustment_type_input = 'REVERSAL' THEN -ROUND(t.amount, 2)
    WHEN amount_input IS NOT NULL AND amount_input < 0 THEN ROUND(amount_input, 2)
    ELSE NULL
  END;
  IF requested_delta IS NULL OR requested_delta >= 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_ADJUSTMENT';
  END IF;

  SELECT COALESCE(ROUND(SUM(a.amount_delta), 2), 0)
  INTO reserved_delta
  FROM public.payment_adjustments a
  WHERE a.payment_transfer_id = t.id
    AND a.status IN ('PENDING', 'APPROVED');

  IF ABS(reserved_delta + requested_delta) > ROUND(t.amount, 2) THEN
    RAISE EXCEPTION 'PAYMENT_ADJUSTMENT_EXCEEDS_TRANSFER';
  END IF;

  INSERT INTO public.payment_adjustments(
    organization_id, payment_transfer_id, payment_schedule_id,
    adjustment_type, amount_delta, reason, requested_by
  ) VALUES (
    t.organization_id, t.id, ps.id,
    adjustment_type_input, requested_delta, BTRIM(reason_input), actor_id
  ) RETURNING id INTO adjustment_id;

  INSERT INTO public.audit_events(
    organization_id, actor_user_id, entity_type, entity_id, action, after_data
  ) VALUES (
    t.organization_id, actor_id, 'payment_adjustment', adjustment_id, 'REQUESTED',
    jsonb_build_object(
      'transferId', t.id,
      'scheduleId', ps.id,
      'adjustmentType', adjustment_type_input,
      'amountDelta', requested_delta,
      'reason', BTRIM(reason_input),
      'sessionId', session_id
    )
  );
  RETURN adjustment_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_payment_adjustment_private(UUID,TEXT,NUMERIC,TEXT,TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_adjustment_private(UUID,TEXT,NUMERIC,TEXT,TEXT)
  TO project_admin;

CREATE OR REPLACE FUNCTION public.review_payment_adjustment_private(
  adjustment_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT,
  session_token_hash_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  a public.payment_adjustments%ROWTYPE;
  actor_id UUID;
  session_id UUID;
  next_status TEXT;
  effective_total NUMERIC(18,2);
BEGIN
  SELECT * INTO a
  FROM public.payment_adjustments
  WHERE id = adjustment_id_input
  FOR UPDATE;
  IF a.id IS NULL OR a.status <> 'PENDING' THEN
    RAISE EXCEPTION 'PAYMENT_ADJUSTMENT_NOT_REVIEWABLE';
  END IF;

  SELECT actor_user_id, app_session_id INTO actor_id, session_id
  FROM public.payment_adjustment_actor(session_token_hash_input, a.organization_id);
  IF actor_id IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF approve_input IS NULL THEN RAISE EXCEPTION 'INVALID_PAYMENT_ADJUSTMENT_DECISION'; END IF;
  IF NOT approve_input AND NULLIF(BTRIM(decision_note_input), '') IS NULL THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;

  IF approve_input THEN
    SELECT ROUND(
      COALESCE((SELECT SUM(t.amount)
        FROM public.payment_transfers t
        WHERE t.payment_schedule_id = a.payment_schedule_id AND t.status = 'VERIFIED'), 0)
      + COALESCE((SELECT SUM(other.amount_delta)
        FROM public.payment_adjustments other
        WHERE other.payment_schedule_id = a.payment_schedule_id
          AND other.status = 'APPROVED'), 0)
      + a.amount_delta,
      2
    ) INTO effective_total;
    IF effective_total < 0 THEN
      RAISE EXCEPTION 'PAYMENT_ADJUSTMENT_EXCEEDS_VERIFIED_TOTAL';
    END IF;
  END IF;

  next_status := CASE WHEN approve_input THEN 'APPROVED' ELSE 'REJECTED' END;
  UPDATE public.payment_adjustments
  SET status = next_status,
      approved_by = actor_id,
      approved_at = NOW(),
      decision_note = NULLIF(BTRIM(decision_note_input), '')
  WHERE id = a.id;

  IF approve_input THEN
    PERFORM public.recalculate_customer_payment_schedule(
      a.payment_schedule_id, a.id, actor_id);
  END IF;

  INSERT INTO public.audit_events(
    organization_id, actor_user_id, entity_type, entity_id, action, after_data
  ) VALUES (
    a.organization_id, actor_id, 'payment_adjustment', a.id, next_status,
    jsonb_build_object(
      'amountDelta', a.amount_delta,
      'decisionNote', NULLIF(BTRIM(decision_note_input), ''),
      'sessionId', session_id
    )
  );
  RETURN a.id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_payment_adjustment_private(UUID,BOOLEAN,TEXT,TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_payment_adjustment_private(UUID,BOOLEAN,TEXT,TEXT)
  TO project_admin;

CREATE OR REPLACE FUNCTION public.confirm_payment_workflow_hold_private(
  hold_id_input UUID,
  decision_role_input TEXT,
  note_input TEXT,
  session_token_hash_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  hold_record public.payment_workflow_holds%ROWTYPE;
  schedule_record public.payment_schedules%ROWTYPE;
  actor_id UUID;
  session_id UUID;
  required_permission TEXT;
  next_finance_actor UUID;
  next_order_actor UUID;
BEGIN
  SELECT * INTO hold_record FROM public.payment_workflow_holds
  WHERE id = hold_id_input FOR UPDATE;
  IF hold_record.id IS NULL OR hold_record.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'PAYMENT_HOLD_NOT_ACTIVE';
  END IF;
  IF decision_role_input NOT IN ('FINANCE', 'ORDER_ADMIN')
    OR LENGTH(BTRIM(COALESCE(note_input, ''))) < 3 THEN
    RAISE EXCEPTION 'PAYMENT_HOLD_DECISION_INVALID';
  END IF;

  required_permission := CASE decision_role_input
    WHEN 'FINANCE' THEN 'payments.adjust' ELSE 'orders.manage' END;
  SELECT actor_user_id, app_session_id INTO actor_id, session_id
  FROM public.payment_hold_actor(
    session_token_hash_input, hold_record.organization_id, required_permission);
  IF actor_id IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;

  SELECT ps.* INTO schedule_record
  FROM public.payment_adjustments a
  JOIN public.payment_schedules ps ON ps.id = a.payment_schedule_id
  WHERE a.id = hold_record.payment_adjustment_id
    AND ps.order_id = hold_record.customer_order_id
    AND ps.organization_id = hold_record.organization_id
  FOR SHARE OF ps;
  IF schedule_record.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_HOLD_BALANCE_NOT_RESTORED'; END IF;
  -- A later verified replacement transfer is reconciled together with the
  -- append-only negative adjustment before either reviewer can resume work.
  PERFORM public.recalculate_customer_payment_schedule(
    schedule_record.id, hold_record.payment_adjustment_id, actor_id);
  SELECT * INTO schedule_record FROM public.payment_schedules
  WHERE id = schedule_record.id FOR SHARE;
  IF schedule_record.status <> 'VERIFIED'
    OR schedule_record.verified_amount <> schedule_record.due_amount THEN
    RAISE EXCEPTION 'PAYMENT_HOLD_BALANCE_NOT_RESTORED';
  END IF;

  IF decision_role_input = 'FINANCE' THEN
    IF hold_record.finance_confirmed_by IS NOT NULL THEN RAISE EXCEPTION 'PAYMENT_HOLD_ROLE_ALREADY_CONFIRMED'; END IF;
    IF hold_record.order_admin_confirmed_by = actor_id THEN RAISE EXCEPTION 'PAYMENT_HOLD_MAKER_CHECKER_REQUIRED'; END IF;
    UPDATE public.payment_workflow_holds
    SET finance_confirmed_by = actor_id, finance_confirmed_at = NOW(), finance_note = BTRIM(note_input)
    WHERE id = hold_record.id;
    next_finance_actor := actor_id;
    next_order_actor := hold_record.order_admin_confirmed_by;
  ELSE
    IF hold_record.order_admin_confirmed_by IS NOT NULL THEN RAISE EXCEPTION 'PAYMENT_HOLD_ROLE_ALREADY_CONFIRMED'; END IF;
    IF hold_record.finance_confirmed_by = actor_id THEN RAISE EXCEPTION 'PAYMENT_HOLD_MAKER_CHECKER_REQUIRED'; END IF;
    UPDATE public.payment_workflow_holds
    SET order_admin_confirmed_by = actor_id, order_admin_confirmed_at = NOW(), order_admin_note = BTRIM(note_input)
    WHERE id = hold_record.id;
    next_finance_actor := hold_record.finance_confirmed_by;
    next_order_actor := actor_id;
  END IF;

  IF next_finance_actor IS NOT NULL AND next_order_actor IS NOT NULL THEN
    IF next_finance_actor = next_order_actor THEN RAISE EXCEPTION 'PAYMENT_HOLD_MAKER_CHECKER_REQUIRED'; END IF;
    UPDATE public.payment_workflow_holds
    SET status = 'RESOLVED', resolved_by = actor_id, resolved_at = NOW(),
        resolution_note = 'Finance and Order Admin confirmed restored payment and safe resume.'
    WHERE id = hold_record.id;
  END IF;

  INSERT INTO public.audit_events(
    organization_id, actor_user_id, entity_type, entity_id, action, after_data
  ) VALUES (
    hold_record.organization_id, actor_id, 'payment_workflow_hold', hold_record.id,
    CASE WHEN next_finance_actor IS NOT NULL AND next_order_actor IS NOT NULL
      THEN 'RESOLVED' ELSE decision_role_input || '_CONFIRMED' END,
    jsonb_build_object('decisionRole', decision_role_input, 'note', BTRIM(note_input),
      'sessionId', session_id, 'scheduleId', schedule_record.id)
  );
  RETURN hold_record.id;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_payment_workflow_hold_private(UUID,TEXT,TEXT,TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_workflow_hold_private(UUID,TEXT,TEXT,TEXT)
  TO project_admin;

REVOKE ALL ON FUNCTION public.payment_adjustment_actor(TEXT,UUID)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_adjustment_actor(TEXT,UUID) TO project_admin;
REVOKE ALL ON FUNCTION public.payment_hold_actor(TEXT,UUID,TEXT)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_hold_actor(TEXT,UUID,TEXT) TO project_admin;

-- Legacy/direct bypasses remain unavailable after resume.
REVOKE ALL ON FUNCTION public.verify_payment_transfer(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_payment_transfer_bound_impl(UUID,NUMERIC,TIMESTAMPTZ,UUID) FROM PUBLIC,anon,authenticated;

-- Exact Release C Member ACL, no D grant.
GRANT EXECUTE ON FUNCTION public.submit_custom_request(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_custom_request_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_custom_request(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_transfer(UUID,NUMERIC,TIMESTAMPTZ,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_order_cancellation(UUID,TEXT,UUID) TO authenticated;

-- Restore only the frozen pre-stop ACL of the nine staff continuations.
GRANT EXECUTE ON FUNCTION public.create_custom_quotation(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_custom_quotation_draft(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_custom_quotation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_custom_quotation(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_supplier_orders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_order_cancellation(UUID,BOOLEAN,TEXT,NUMERIC,NUMERIC) TO authenticated;
