-- FULL-FLOW-GO-LIVE-01 v0.1
-- Post-Release-D payment hold, reconciliation and dual-control resume.
-- Depends on the pre-C financial safeguards and Release D7-D10 tables/functions.
-- No business rows are transformed or deleted.

DO $$
BEGIN
  IF to_regprocedure('public.verify_payment_transfer_private_ffgl_impl(uuid,boolean,text,text,uuid,text,bigint)') IS NULL THEN
    ALTER FUNCTION public.verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)
      RENAME TO verify_payment_transfer_private_ffgl_impl;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_payment_transfer_private_ffgl_impl(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)
  FROM PUBLIC, anon, authenticated, project_admin;

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
  PERFORM set_config('gisp.payment_hold_finance_maintenance', 'on', TRUE);
  result_id := public.verify_payment_transfer_private_ffgl_impl(
    transfer_id_input, approve_input, finance_note_input,
    session_token_hash_input, evidence_file_id_input, sha256_input, size_bytes_input);
  PERFORM set_config('gisp.payment_hold_finance_maintenance', 'off', TRUE);
  RETURN result_id;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)
  TO project_admin;

CREATE OR REPLACE FUNCTION public.block_order_operation_on_payment_hold()
RETURNS TRIGGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE target_order_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'order_items' THEN
    target_order_id := NEW.order_id;
  ELSIF TG_TABLE_NAME = 'qc_member_decisions' THEN
    SELECT oi.order_id INTO target_order_id
    FROM public.order_items oi
    WHERE oi.id = NEW.order_item_id;
  ELSIF TG_TABLE_NAME = 'supplier_orders' THEN
    target_order_id := NEW.customer_order_id;
  ELSIF TG_TABLE_NAME IN ('purchase_orders', 'supplier_payments', 'production_updates') THEN
    SELECT so.customer_order_id INTO target_order_id
    FROM public.supplier_orders so
    WHERE so.id = NEW.supplier_order_id;
  ELSIF TG_TABLE_NAME = 'qc_inspections' THEN
    SELECT oi.order_id INTO target_order_id
    FROM public.order_items oi
    WHERE oi.id = NEW.order_item_id;
  ELSIF TG_TABLE_NAME IN (
    'warehouse_receipts', 'consolidation_groups', 'shipments',
    'deliveries', 'logistics_cost_items', 'freight_invoices'
  ) THEN
    target_order_id := NEW.customer_order_id;
  END IF;

  IF target_order_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.payment_workflow_holds h
    WHERE h.customer_order_id = target_order_id
      AND h.status = 'ACTIVE'
  ) THEN
    IF TG_TABLE_NAME = 'freight_invoices'
      AND TG_OP = 'UPDATE'
      AND current_setting('gisp.payment_hold_finance_maintenance', TRUE) = 'on'
      AND (to_jsonb(NEW) - ARRAY['status', 'paid_at', 'updated_at'])
        IS NOT DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['status', 'paid_at', 'updated_at'])
    THEN
      -- Replacement-payment verification and the private reconciliation
      -- executor may maintain only derived settlement fields. Pricing,
      -- invoice identity, due date, notes and every operational field remain
      -- blocked while the hold is active.
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'PAYMENT_WORKFLOW_ON_HOLD';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.block_order_operation_on_payment_hold()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_payment_hold ON public.order_items;
CREATE TRIGGER order_items_payment_hold
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS qc_member_decisions_payment_hold ON public.qc_member_decisions;
CREATE TRIGGER qc_member_decisions_payment_hold
  BEFORE INSERT OR UPDATE ON public.qc_member_decisions
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS supplier_orders_payment_hold ON public.supplier_orders;
CREATE TRIGGER supplier_orders_payment_hold
  BEFORE INSERT OR UPDATE ON public.supplier_orders
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS purchase_orders_payment_hold ON public.purchase_orders;
CREATE TRIGGER purchase_orders_payment_hold
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS supplier_payments_payment_hold ON public.supplier_payments;
CREATE TRIGGER supplier_payments_payment_hold
  BEFORE INSERT OR UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS production_updates_payment_hold ON public.production_updates;
CREATE TRIGGER production_updates_payment_hold
  BEFORE INSERT OR UPDATE ON public.production_updates
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS qc_inspections_payment_hold ON public.qc_inspections;
CREATE TRIGGER qc_inspections_payment_hold
  BEFORE INSERT OR UPDATE ON public.qc_inspections
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS warehouse_receipts_payment_hold ON public.warehouse_receipts;
CREATE TRIGGER warehouse_receipts_payment_hold
  BEFORE INSERT OR UPDATE ON public.warehouse_receipts
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS consolidation_groups_payment_hold ON public.consolidation_groups;
CREATE TRIGGER consolidation_groups_payment_hold
  BEFORE INSERT OR UPDATE ON public.consolidation_groups
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS shipments_payment_hold ON public.shipments;
CREATE TRIGGER shipments_payment_hold
  BEFORE INSERT OR UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS deliveries_payment_hold ON public.deliveries;
CREATE TRIGGER deliveries_payment_hold
  BEFORE INSERT OR UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS logistics_cost_items_payment_hold ON public.logistics_cost_items;
CREATE TRIGGER logistics_cost_items_payment_hold
  BEFORE INSERT OR UPDATE ON public.logistics_cost_items
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS freight_invoices_payment_hold ON public.freight_invoices;
CREATE TRIGGER freight_invoices_payment_hold
  BEFORE INSERT OR UPDATE ON public.freight_invoices
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();

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

CREATE OR REPLACE FUNCTION public.payment_hold_actor(
  session_token_hash_input TEXT,
  target_organization_id_input UUID,
  permission_code_input TEXT
)
RETURNS TABLE(actor_user_id UUID, app_session_id UUID)
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF session_token_hash_input !~ '^[a-f0-9]{64}$'
    OR target_organization_id_input IS NULL
    OR permission_code_input NOT IN ('payments.adjust', 'orders.manage') THEN
    RAISE EXCEPTION 'PAYMENT_HOLD_SESSION_INVALID';
  END IF;
  RETURN QUERY
  SELECT s.user_id, s.id
  FROM public.app_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = session_token_hash_input
    AND s.revoked_at IS NULL
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = s.user_id
        AND ur.revoked_at IS NULL
        AND p.code = permission_code_input
        AND (ur.organization_id IS NULL OR ur.organization_id = target_organization_id_input)
    )
  FOR SHARE OF s;
END;
$$;
REVOKE ALL ON FUNCTION public.payment_hold_actor(TEXT,UUID,TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_hold_actor(TEXT,UUID,TEXT) TO project_admin;

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
  PERFORM set_config('gisp.payment_hold_finance_maintenance', 'on', TRUE);
  PERFORM public.recalculate_customer_payment_schedule(
    schedule_record.id, hold_record.payment_adjustment_id, actor_id);
  PERFORM set_config('gisp.payment_hold_finance_maintenance', 'off', TRUE);
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
