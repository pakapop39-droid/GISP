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
DECLARE
  t public.payment_transfers%ROWTYPE;
  ps public.payment_schedules%ROWTYPE;
  o public.customer_orders%ROWTYPE;
  fm public.file_metadata%ROWTYPE;
  finance_actor UUID;
  finance_session UUID;
  preview_id UUID;
  verified_total NUMERIC(18,2);
  new_status TEXT;
BEGIN
  SELECT * INTO t FROM public.payment_transfers WHERE id = transfer_id_input FOR UPDATE;
  IF t.id IS NULL OR t.organization_id IS NULL THEN RAISE EXCEPTION 'TRANSFER_NOT_VERIFIABLE'; END IF;
  SELECT actor_user_id, app_session_id INTO finance_actor, finance_session
  FROM public.payment_finance_actor(session_token_hash_input, t.organization_id);
  IF finance_actor IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF approve_input IS NULL OR t.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'TRANSFER_NOT_VERIFIABLE'; END IF;
  SELECT * INTO ps FROM public.payment_schedules WHERE id = t.payment_schedule_id FOR UPDATE;
  SELECT * INTO o FROM public.customer_orders WHERE id = ps.order_id FOR UPDATE;
  IF ps.id IS NULL OR o.id IS NULL
    OR ps.organization_id IS DISTINCT FROM t.organization_id
    OR o.organization_id IS DISTINCT FROM t.organization_id
    OR o.member_profile_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;
  IF ps.schedule_type = 'FREIGHT' AND NOT public.freight_payment_enabled() THEN
    RAISE EXCEPTION 'FREIGHT_PAYMENT_NOT_RELEASED';
  END IF;

  IF NOT approve_input THEN
    IF NULLIF(BTRIM(finance_note_input), '') IS NULL THEN
      RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
    END IF;
    UPDATE public.payment_transfers SET status='REJECTED', finance_verified_by=finance_actor,
      finance_verified_at=NOW(), finance_note=BTRIM(finance_note_input) WHERE id=t.id;
    INSERT INTO public.payment_verification_logs(organization_id,payment_transfer_id,action,
      amount_snapshot,schedule_verified_amount_snapshot,schedule_status_snapshot,note,actor_user_id)
    VALUES(t.organization_id,t.id,'REJECTED',t.amount,ps.verified_amount,ps.status,
      BTRIM(finance_note_input),finance_actor);
    INSERT INTO public.audit_events(organization_id,actor_user_id,entity_type,entity_id,action,after_data)
    VALUES(t.organization_id,finance_actor,'payment_transfer',t.id,'REJECTED',
      jsonb_build_object('note',BTRIM(finance_note_input)));
    RETURN t.id;
  END IF;

  SELECT * INTO fm FROM public.file_metadata WHERE id = t.evidence_file_id FOR UPDATE;
  IF fm.id IS NULL
    OR fm.id IS DISTINCT FROM evidence_file_id_input
    OR fm.organization_id IS DISTINCT FROM t.organization_id
    OR fm.member_profile_id IS DISTINCT FROM o.member_profile_id
    OR fm.entity_type IS DISTINCT FROM 'CUSTOMER_PAYMENT_EVIDENCE'
    OR fm.entity_id IS DISTINCT FROM t.id
    OR fm.visibility IS DISTINCT FROM 'MEMBER_PRIVATE'
    OR fm.bucket IS DISTINCT FROM 'gisp-member-private'
    OR NULLIF(BTRIM(fm.object_key), '') IS NULL
    OR fm.size_bytes IS DISTINCT FROM size_bytes_input
    OR fm.mime_type IS NULL
    OR fm.mime_type NOT IN ('application/pdf','image/jpeg','image/png')
    OR sha256_input IS NULL
    OR sha256_input !~ '^[a-f0-9]{64}$'
    OR size_bytes_input NOT BETWEEN 1 AND 10485760
    OR EXISTS (SELECT 1 FROM public.payment_transfers other_transfer
      WHERE other_transfer.evidence_file_id = fm.id AND other_transfer.id <> t.id)
  THEN RAISE EXCEPTION 'PAYMENT_EVIDENCE_NOT_BOUND'; END IF;
  SELECT ae.id INTO preview_id FROM public.audit_events ae
  WHERE ae.organization_id = t.organization_id
    AND ae.actor_user_id = finance_actor
    AND ae.entity_type = 'payment_transfer' AND ae.entity_id = t.id
    AND ae.action = 'EVIDENCE_PREVIEWED'
    AND ae.created_at >= NOW() - INTERVAL '10 minutes'
    AND ae.after_data->>'fileId' = fm.id::TEXT
    AND ae.after_data->>'sessionId' = finance_session::TEXT
    AND ae.after_data->>'sha256' = sha256_input
    AND ae.after_data->>'sizeBytes' = size_bytes_input::TEXT
    AND ae.after_data->>'mimeType' = fm.mime_type
  ORDER BY ae.created_at DESC LIMIT 1;
  IF preview_id IS NULL THEN RAISE EXCEPTION 'EVIDENCE_PREVIEW_REQUIRED'; END IF;

  UPDATE public.payment_transfers SET status='VERIFIED', finance_verified_by=finance_actor,
    finance_verified_at=NOW(), finance_note=NULLIF(BTRIM(finance_note_input),'') WHERE id=t.id;
  SELECT COALESCE(ROUND(SUM(amount),2),0) INTO verified_total FROM public.payment_transfers
  WHERE payment_schedule_id=ps.id AND status='VERIFIED';
  new_status := CASE WHEN verified_total>ps.due_amount THEN 'OVERPAYMENT_REVIEW'
    WHEN verified_total=ps.due_amount THEN 'VERIFIED'
    WHEN verified_total>0 THEN 'PARTIALLY_VERIFIED' ELSE 'PENDING' END;
  UPDATE public.payment_schedules SET verified_amount=verified_total,status=new_status,
    verified_at=CASE WHEN new_status='VERIFIED' THEN NOW() END WHERE id=ps.id;
  IF ps.schedule_type='DEPOSIT' THEN
    UPDATE public.customer_orders SET deposit_verified_at=CASE WHEN new_status='VERIFIED' THEN NOW() END,
      status=CASE WHEN new_status='VERIFIED' AND status='PENDING_DEPOSIT' THEN 'DEPOSIT_VERIFIED'
        WHEN new_status<>'VERIFIED' AND status='DEPOSIT_VERIFIED' THEN 'PENDING_DEPOSIT' ELSE status END
    WHERE id=ps.order_id;
  ELSIF ps.schedule_type='BALANCE' THEN
    UPDATE public.customer_orders SET balance_verified_at=CASE WHEN new_status='VERIFIED' THEN NOW() END
    WHERE id=ps.order_id;
  ELSIF ps.schedule_type='FREIGHT' THEN
    UPDATE public.freight_invoices SET status=CASE
      WHEN new_status='VERIFIED' THEN 'PAID' WHEN new_status='PARTIALLY_VERIFIED' THEN 'PARTIALLY_PAID'
      WHEN new_status='OVERPAYMENT_REVIEW' THEN 'OVERPAYMENT_REVIEW' ELSE 'ISSUED' END,
      paid_at=CASE WHEN new_status='VERIFIED' THEN NOW() END WHERE payment_schedule_id=ps.id;
    PERFORM public.maybe_complete_order(ps.order_id);
  END IF;
  INSERT INTO public.payment_verification_logs(organization_id,payment_transfer_id,action,
    amount_snapshot,schedule_verified_amount_snapshot,schedule_status_snapshot,note,actor_user_id)
  VALUES(t.organization_id,t.id,'VERIFIED',t.amount,verified_total,new_status,
    NULLIF(BTRIM(finance_note_input),''),finance_actor);
  INSERT INTO public.audit_events(organization_id,actor_user_id,entity_type,entity_id,action,after_data)
  VALUES(t.organization_id,finance_actor,'payment_transfer',t.id,'VERIFIED',
    jsonb_build_object('amount',t.amount,'schedule_verified_amount',verified_total,
      'schedule_status',new_status,'previewReceiptId',preview_id));
  RETURN t.id;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)
  TO project_admin;

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
