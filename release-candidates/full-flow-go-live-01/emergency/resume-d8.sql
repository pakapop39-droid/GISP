
-- TEMPLATE ONLY. Forward resume of D8 after C and D7 are independently verified open.
GRANT EXECUTE ON FUNCTION public.create_warehouse_receipt(UUID,UUID,TIMESTAMPTZ,INTEGER,NUMERIC,NUMERIC,TEXT,JSONB,UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_warehouse_receipt_item(UUID,NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_consolidation(UUID,UUID,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_consolidation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shipment_v2(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_partial_shipment(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_shipment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_shipment_event(UUID,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,BOOLEAN,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_delivery(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_appointment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_delivery_reschedule(UUID,JSONB,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_delivery_reschedule(UUID,BOOLEAN,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_delivery_status(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_delivery_v2(UUID,TIMESTAMPTZ,TEXT,TEXT,JSONB,UUID[],TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_logistics_cost(UUID,UUID,UUID,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,BOOLEAN,TEXT,TEXT,UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_logistics_costs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_freight_invoice(UUID,NUMERIC,TIMESTAMPTZ,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.freight_payment_enabled()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT TRUE $$;
REVOKE ALL ON FUNCTION public.freight_payment_enabled() FROM PUBLIC,anon,authenticated;

-- Restore the exact post-D financial reconciliation bodies after D8 resumes.
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
  active_hold BOOLEAN;
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
  ELSIF ps.schedule_type = 'FREIGHT' THEN
    UPDATE public.freight_invoices
    SET status = CASE
          WHEN new_status = 'VERIFIED' THEN 'PAID'
          WHEN new_status = 'PARTIALLY_VERIFIED' THEN 'PARTIALLY_PAID'
          WHEN new_status = 'OVERPAYMENT_REVIEW' THEN 'OVERPAYMENT_REVIEW'
          ELSE 'ISSUED'
        END,
        paid_at = CASE WHEN new_status = 'VERIFIED' THEN NOW() ELSE NULL END
    WHERE payment_schedule_id = ps.id;
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

  SELECT EXISTS (
    SELECT 1 FROM public.payment_workflow_holds h
    WHERE h.customer_order_id = co.id AND h.status = 'ACTIVE'
  ) INTO active_hold;

  IF ps.schedule_type = 'FREIGHT' AND new_status = 'VERIFIED' AND NOT active_hold THEN
    PERFORM public.maybe_complete_order(co.id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_customer_payment_schedule(UUID,UUID,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_customer_payment_schedule(UUID,UUID,UUID)
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
    PERFORM public.maybe_complete_order(hold_record.customer_order_id);
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
