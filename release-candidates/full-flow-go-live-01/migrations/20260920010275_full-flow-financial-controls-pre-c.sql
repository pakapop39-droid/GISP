-- FULL-FLOW-GO-LIVE-01 v0.1
-- Pre-Release-C financial safeguards. Depends only on Slice 6, PAY private
-- executor and RLC-HARDEN-01. Must run before Release C privileges are restored.
-- No Release D table is referenced by this migration.

INSERT INTO public.permissions(code, name, description)
VALUES (
  'payments.adjust',
  'ปรับปรุงรายการรับเงิน',
  'สร้างและอนุมัติรายการปรับลดหรือกลับรายการรับเงินที่ตรวจแล้ว โดยไม่แก้ธุรกรรมเดิม'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'payments.adjust'
WHERE r.code IN ('SUPER_ADMIN', 'FINANCE')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.payment_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  payment_transfer_id UUID NOT NULL REFERENCES public.payment_transfers(id) ON DELETE RESTRICT,
  payment_schedule_id UUID NOT NULL REFERENCES public.payment_schedules(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('ADJUSTMENT', 'REVERSAL')),
  amount_delta NUMERIC(18,2) NOT NULL CHECK (amount_delta < 0),
  reason TEXT NOT NULL CHECK (LENGTH(BTRIM(reason)) BETWEEN 3 AND 1000),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_adjustments_one_reversal_uidx
  ON public.payment_adjustments(payment_transfer_id)
  WHERE adjustment_type = 'REVERSAL' AND status IN ('PENDING', 'APPROVED');
CREATE INDEX IF NOT EXISTS payment_adjustments_schedule_idx
  ON public.payment_adjustments(payment_schedule_id, status, created_at);
CREATE INDEX IF NOT EXISTS payment_adjustments_org_idx
  ON public.payment_adjustments(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_workflow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  payment_adjustment_id UUID NOT NULL REFERENCES public.payment_adjustments(id) ON DELETE RESTRICT,
  hold_code TEXT NOT NULL DEFAULT 'VERIFIED_PAYMENT_REVERSED'
    CHECK (hold_code IN ('VERIFIED_PAYMENT_REVERSED')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED')),
  reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finance_confirmed_by UUID REFERENCES auth.users(id),
  finance_confirmed_at TIMESTAMPTZ,
  finance_note TEXT,
  order_admin_confirmed_by UUID REFERENCES auth.users(id),
  order_admin_confirmed_at TIMESTAMPTZ,
  order_admin_note TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_workflow_holds_active_order_uidx
  ON public.payment_workflow_holds(customer_order_id)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS payment_workflow_holds_org_idx
  ON public.payment_workflow_holds(organization_id, status, created_at DESC);

ALTER TABLE public.payment_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_workflow_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_adjustments_staff_read ON public.payment_adjustments;
CREATE POLICY payment_adjustments_staff_read ON public.payment_adjustments
FOR SELECT TO authenticated USING (
  public.has_permission('payments.adjust', organization_id)
  OR public.has_permission('payments.verify', organization_id)
  OR public.has_permission('orders.manage', organization_id)
);

DROP POLICY IF EXISTS payment_workflow_holds_staff_read ON public.payment_workflow_holds;
CREATE POLICY payment_workflow_holds_staff_read ON public.payment_workflow_holds
FOR SELECT TO authenticated USING (
  public.has_permission('payments.adjust', organization_id)
  OR public.has_permission('payments.verify', organization_id)
  OR public.has_permission('orders.manage', organization_id)
);

REVOKE ALL ON TABLE public.payment_adjustments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payment_workflow_holds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payment_adjustments TO authenticated;
GRANT SELECT ON TABLE public.payment_workflow_holds TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_verified_payment_transfer_immutable()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'VERIFIED' THEN
    RAISE EXCEPTION 'VERIFIED_PAYMENT_IMMUTABLE';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS payment_transfers_verified_immutable ON public.payment_transfers;
CREATE TRIGGER payment_transfers_verified_immutable
  BEFORE UPDATE OR DELETE ON public.payment_transfers
  FOR EACH ROW EXECUTE FUNCTION public.guard_verified_payment_transfer_immutable();
REVOKE ALL ON FUNCTION public.guard_verified_payment_transfer_immutable()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_payment_adjustment_append_only()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PAYMENT_ADJUSTMENT_APPEND_ONLY';
  END IF;
  IF OLD.status <> 'PENDING'
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.payment_transfer_id IS DISTINCT FROM OLD.payment_transfer_id
    OR NEW.payment_schedule_id IS DISTINCT FROM OLD.payment_schedule_id
    OR NEW.adjustment_type IS DISTINCT FROM OLD.adjustment_type
    OR NEW.amount_delta IS DISTINCT FROM OLD.amount_delta
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
    OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'PAYMENT_ADJUSTMENT_APPEND_ONLY';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS payment_adjustments_append_only ON public.payment_adjustments;
CREATE TRIGGER payment_adjustments_append_only
  BEFORE UPDATE OR DELETE ON public.payment_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.guard_payment_adjustment_append_only();
REVOKE ALL ON FUNCTION public.guard_payment_adjustment_append_only()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.payment_adjustment_actor(
  session_token_hash_input TEXT,
  target_organization_id_input UUID
)
RETURNS TABLE(actor_user_id UUID, app_session_id UUID)
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF session_token_hash_input !~ '^[a-f0-9]{64}$'
    OR target_organization_id_input IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_ADJUSTMENT_SESSION_INVALID';
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
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = s.user_id
        AND ur.revoked_at IS NULL
        AND p.code = 'payments.adjust'
        AND (ur.organization_id IS NULL OR ur.organization_id = target_organization_id_input)
    )
  FOR SHARE OF s;
END;
$$;
REVOKE ALL ON FUNCTION public.payment_adjustment_actor(TEXT,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_adjustment_actor(TEXT,UUID) TO project_admin;

-- Enforce maker/checker at the database boundary, including direct RPC calls.
CREATE OR REPLACE FUNCTION public.review_supplier_payment(
  supplier_payment_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_organization_id UUID;
  request_actor UUID;
BEGIN
  SELECT so.organization_id, sp.requested_by
  INTO target_organization_id, request_actor
  FROM public.supplier_payments sp
  JOIN public.supplier_orders so ON so.id = sp.supplier_order_id
  WHERE sp.id = supplier_payment_id_input
  FOR UPDATE OF sp;

  IF target_organization_id IS NULL
    OR NOT public.has_permission('supplier_payments.manage', target_organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF request_actor = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_MAKER_CHECKER_REQUIRED';
  END IF;

  RETURN public.review_supplier_payment_rlc_impl(
    supplier_payment_id_input, approve_input, decision_note_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_supplier_payment_paid(
  supplier_payment_id_input UUID,
  evidence_file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_organization_id UUID;
  approval_actor UUID;
BEGIN
  SELECT so.organization_id, sp.approved_by
  INTO target_organization_id, approval_actor
  FROM public.supplier_payments sp
  JOIN public.supplier_orders so ON so.id = sp.supplier_order_id
  WHERE sp.id = supplier_payment_id_input
  FOR UPDATE OF sp;

  IF target_organization_id IS NULL
    OR NOT public.has_permission('supplier_payments.manage', target_organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF approval_actor IS NULL THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_MUST_BE_APPROVED';
  END IF;
  IF approval_actor = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_MAKER_CHECKER_REQUIRED';
  END IF;

  RETURN public.mark_supplier_payment_paid_rlc_impl(
    supplier_payment_id_input, evidence_file_id_input);
END;
$$;

REVOKE ALL ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID)
  TO authenticated;

-- Release C installs adjustment executors and hold enforcement before C grants.
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

CREATE OR REPLACE FUNCTION public.block_order_operation_on_payment_hold()
RETURNS TRIGGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE target_order_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'order_items' THEN
    target_order_id := NEW.order_id;
  ELSIF TG_TABLE_NAME = 'supplier_orders' THEN
    target_order_id := NEW.customer_order_id;
  ELSIF TG_TABLE_NAME IN ('purchase_orders', 'supplier_payments') THEN
    SELECT so.customer_order_id INTO target_order_id
    FROM public.supplier_orders so
    WHERE so.id = NEW.supplier_order_id;
  END IF;
  IF target_order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.payment_workflow_holds h
    WHERE h.customer_order_id = target_order_id AND h.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'PAYMENT_WORKFLOW_ON_HOLD';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.block_order_operation_on_payment_hold()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_payment_hold ON public.order_items;
CREATE TRIGGER order_items_payment_hold BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS supplier_orders_payment_hold ON public.supplier_orders;
CREATE TRIGGER supplier_orders_payment_hold BEFORE INSERT OR UPDATE ON public.supplier_orders
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS purchase_orders_payment_hold ON public.purchase_orders;
CREATE TRIGGER purchase_orders_payment_hold BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.block_order_operation_on_payment_hold();
DROP TRIGGER IF EXISTS supplier_payments_payment_hold ON public.supplier_payments;
CREATE TRIGGER supplier_payments_payment_hold BEFORE INSERT OR UPDATE ON public.supplier_payments
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
