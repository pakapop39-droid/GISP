-- Development/rehearsal candidate only. Replaces two customer Payment functions;
-- no table/column, role, permission, tax, term, pricing, or existing-row changes.
-- One CUSTOMER_PAYMENT_EVIDENCE file belongs to exactly one transfer forever,
-- including when that transfer is later rejected. Finance must still inspect
-- the actual stored bytes through the application before approval.

CREATE OR REPLACE FUNCTION public.submit_payment_transfer(
  payment_schedule_id_input UUID,
  amount_input NUMERIC,
  transferred_at_input TIMESTAMPTZ,
  evidence_file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  schedule_record public.payment_schedules%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  evidence_record public.file_metadata%ROWTYPE;
  transfer_id_value UUID;
BEGIN
  SELECT ps.* INTO schedule_record
  FROM public.payment_schedules ps
  JOIN public.customer_orders co ON co.id = ps.order_id
  WHERE ps.id = payment_schedule_id_input
    AND co.member_profile_id = public.current_member_profile_id()
  FOR UPDATE OF ps;
  IF NOT FOUND OR schedule_record.status NOT IN ('PENDING', 'PARTIALLY_VERIFIED') THEN
    RAISE EXCEPTION 'PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = schedule_record.order_id;
  IF order_record.id IS NULL
    OR order_record.organization_id IS DISTINCT FROM schedule_record.organization_id
    OR order_record.member_profile_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;
  IF order_record.status IN ('CANCELLED', 'CANCELLATION_REQUESTED') THEN
    RAISE EXCEPTION 'ORDER_NOT_PAYABLE';
  END IF;
  IF amount_input IS NULL OR amount_input <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;

  -- Serializes submissions on the same file, even for different schedules.
  SELECT * INTO evidence_record FROM public.file_metadata
  WHERE id = evidence_file_id_input FOR UPDATE;
  IF evidence_record.id IS NULL
    OR evidence_record.organization_id IS DISTINCT FROM schedule_record.organization_id
    OR evidence_record.member_profile_id IS DISTINCT FROM order_record.member_profile_id
    OR evidence_record.entity_type IS DISTINCT FROM 'CUSTOMER_PAYMENT_EVIDENCE'
    OR evidence_record.entity_id IS NOT NULL
    OR evidence_record.visibility IS DISTINCT FROM 'MEMBER_PRIVATE'
    OR evidence_record.bucket IS DISTINCT FROM 'gisp-member-private'
    OR NULLIF(BTRIM(evidence_record.object_key), '') IS NULL
    OR evidence_record.mime_type IS NULL
    OR evidence_record.mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png')
    OR evidence_record.size_bytes IS NULL
    OR evidence_record.size_bytes NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'PAYMENT_EVIDENCE_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payment_transfers previous_transfer
    WHERE previous_transfer.evidence_file_id = evidence_record.id
  ) THEN
    RAISE EXCEPTION 'PAYMENT_EVIDENCE_ALREADY_USED';
  END IF;

  INSERT INTO public.payment_transfers(
    payment_schedule_id, organization_id, transfer_number, amount,
    transferred_at, evidence_file_id, submitted_by
  ) VALUES (
    schedule_record.id, schedule_record.organization_id, public.next_document_number('PAY'),
    ROUND(amount_input, 2), transferred_at_input, evidence_record.id, (SELECT auth.uid())
  ) RETURNING id INTO transfer_id_value;
  UPDATE public.file_metadata SET entity_id = transfer_id_value
  WHERE id = evidence_record.id AND entity_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_EVIDENCE_BIND_FAILED'; END IF;
  PERFORM public.write_audit_event(
    schedule_record.organization_id, 'payment_transfer', transfer_id_value,
    'SUBMITTED', NULL, jsonb_build_object('amount', ROUND(amount_input, 2))
  );
  RETURN transfer_id_value;
END;
$$;

-- Keep the latest Slice 8 Deposit/Balance/Freight reconciliation exactly as the
-- baseline, while targeting Finance permission to this transfer's organization.
-- Legacy unbound (entity_id NULL) evidence can be rejected but not approved;
-- no historical row is changed or silently grandfathered into a real receipt.
CREATE OR REPLACE FUNCTION public.verify_payment_transfer(
  transfer_id_input UUID,
  approve_input BOOLEAN,
  finance_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  t public.payment_transfers%ROWTYPE;
  ps public.payment_schedules%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  evidence_record public.file_metadata%ROWTYPE;
  verified_total NUMERIC(18,2);
  new_status TEXT;
BEGIN
  SELECT * INTO t FROM public.payment_transfers WHERE id = transfer_id_input FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'TRANSFER_NOT_VERIFIABLE'; END IF;
  IF t.organization_id IS NULL
    OR NOT public.has_permission('payments.verify', t.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF approve_input IS NULL THEN RAISE EXCEPTION 'INVALID_APPROVAL_DECISION'; END IF;
  IF t.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'TRANSFER_NOT_VERIFIABLE'; END IF;

  SELECT * INTO ps FROM public.payment_schedules
  WHERE id = t.payment_schedule_id FOR UPDATE;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = ps.order_id FOR UPDATE;
  IF ps.id IS NULL OR order_record.id IS NULL
    OR ps.organization_id IS DISTINCT FROM t.organization_id
    OR order_record.organization_id IS DISTINCT FROM t.organization_id
    OR order_record.member_profile_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;

  IF NOT approve_input THEN
    IF NULLIF(BTRIM(finance_note_input), '') IS NULL THEN
      RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
    END IF;
    UPDATE public.payment_transfers SET status='REJECTED', finance_verified_by=(SELECT auth.uid()),
      finance_verified_at=NOW(), finance_note=BTRIM(finance_note_input) WHERE id=t.id;
    INSERT INTO public.payment_verification_logs(organization_id,payment_transfer_id,action,
      amount_snapshot,schedule_verified_amount_snapshot,schedule_status_snapshot,note,actor_user_id)
    VALUES(t.organization_id,t.id,'REJECTED',t.amount,ps.verified_amount,ps.status,
      BTRIM(finance_note_input),(SELECT auth.uid()));
    PERFORM public.write_audit_event(t.organization_id,'payment_transfer',t.id,'REJECTED',NULL,
      jsonb_build_object('note',BTRIM(finance_note_input)));
    RETURN t.id;
  END IF;

  SELECT * INTO evidence_record FROM public.file_metadata
  WHERE id = t.evidence_file_id FOR UPDATE;
  IF evidence_record.id IS NULL
    OR evidence_record.organization_id IS DISTINCT FROM t.organization_id
    OR evidence_record.member_profile_id IS DISTINCT FROM order_record.member_profile_id
    OR evidence_record.entity_type IS DISTINCT FROM 'CUSTOMER_PAYMENT_EVIDENCE'
    OR evidence_record.entity_id IS DISTINCT FROM t.id
    OR evidence_record.visibility IS DISTINCT FROM 'MEMBER_PRIVATE'
    OR evidence_record.bucket IS DISTINCT FROM 'gisp-member-private'
    OR NULLIF(BTRIM(evidence_record.object_key), '') IS NULL
    OR evidence_record.mime_type IS NULL
    OR evidence_record.mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png')
    OR evidence_record.size_bytes IS NULL
    OR evidence_record.size_bytes NOT BETWEEN 1 AND 10485760
    OR EXISTS (
      SELECT 1 FROM public.payment_transfers other_transfer
      WHERE other_transfer.evidence_file_id = evidence_record.id
        AND other_transfer.id <> t.id
    ) THEN
    RAISE EXCEPTION 'PAYMENT_EVIDENCE_NOT_BOUND';
  END IF;

  UPDATE public.payment_transfers SET status='VERIFIED', finance_verified_by=(SELECT auth.uid()),
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
    NULLIF(BTRIM(finance_note_input),''),(SELECT auth.uid()));
  PERFORM public.write_audit_event(t.organization_id,'payment_transfer',t.id,'VERIFIED',NULL,
    jsonb_build_object('amount',t.amount,'schedule_verified_amount',verified_total,'schedule_status',new_status));
  RETURN t.id;
END;
$$;
