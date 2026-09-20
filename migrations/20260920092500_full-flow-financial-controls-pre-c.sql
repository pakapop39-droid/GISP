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
