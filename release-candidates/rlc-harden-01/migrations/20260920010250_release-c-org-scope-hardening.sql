-- RLC-HARDEN-01 v0.1
-- Forward-only Release C authorization and integrity hardening.
-- No business-row transformation or deletion. Apply before Release C privileges.

CREATE OR REPLACE FUNCTION public.assert_account_not_inactive(user_id_input UUID)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE account_status TEXT;
BEGIN
  SELECT u.status INTO account_status
  FROM public.users u
  WHERE u.id = user_id_input
  FOR UPDATE;
  IF FOUND AND account_status = 'INACTIVE' THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_account_not_inactive(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_inactive_account_reentry()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'INACTIVE' AND NEW.status IS DISTINCT FROM 'INACTIVE' THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS users_prevent_inactive_account_reentry ON public.users;
CREATE TRIGGER users_prevent_inactive_account_reentry
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inactive_account_reentry();
REVOKE ALL ON FUNCTION public.prevent_inactive_account_reentry()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_app_session(
  token_hash_input TEXT,
  expires_at_input TIMESTAMPTZ,
  ip_address_input TEXT DEFAULT NULL,
  user_agent_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE current_user_id UUID := (SELECT auth.uid()); session_id UUID;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  PERFORM public.assert_account_not_inactive(current_user_id);
  IF token_hash_input !~ '^[a-f0-9]{64}$' OR expires_at_input <= NOW() THEN
    RAISE EXCEPTION 'INVALID_SESSION';
  END IF;
  INSERT INTO public.app_sessions(user_id, token_hash, expires_at, ip_address, user_agent)
  VALUES (current_user_id, token_hash_input, expires_at_input, NULLIF(ip_address_input,'')::inet,
    LEFT(user_agent_input, 500)) RETURNING id INTO session_id;
  RETURN session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_app_access_context(token_hash_input TEXT)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'userId', s.user_id,
    'sessionId', s.id,
    'sessionExpiresAt', s.expires_at,
    'userStatus', COALESCE(u.status, 'PENDING'),
    'statusReason', u.status_reason,
    'applicationStatus', COALESCE(ma.status, 'DRAFT'),
    'applicationReason', COALESCE(ma.rejection_reason, ma.review_note),
    'memberProfileId', mp.id,
    'organizationId', mp.organization_id,
    'displayName', COALESCE(u.full_name, mp.contact_name),
    'companyName', mp.company_name,
    'roles', COALESCE((
      SELECT jsonb_agg(role_code ORDER BY role_code)
      FROM (
        SELECT DISTINCT r.code AS role_code
        FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = s.user_id AND ur.revoked_at IS NULL
      ) active_roles
    ), '[]'::jsonb),
    'permissions', COALESCE((
      SELECT jsonb_agg(permission_code ORDER BY permission_code)
      FROM (
        SELECT DISTINCT p.code AS permission_code
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = s.user_id AND ur.revoked_at IS NULL
      ) active_permissions
    ), '[]'::jsonb),
    'permissionScopes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('code', permission_code, 'organizationId', organization_id)
        ORDER BY permission_code, organization_id NULLS FIRST
      )
      FROM (
        SELECT DISTINCT p.code AS permission_code, ur.organization_id
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = s.user_id AND ur.revoked_at IS NULL
      ) scoped_permissions
    ), '[]'::jsonb)
  )
  FROM public.app_sessions s
  LEFT JOIN public.users u ON u.id = s.user_id
  LEFT JOIN public.member_profiles mp ON mp.user_id = s.user_id
  LEFT JOIN public.member_applications ma ON ma.member_profile_id = mp.id
  WHERE s.token_hash = token_hash_input AND s.user_id = (SELECT auth.uid())
    AND s.revoked_at IS NULL AND s.expires_at > NOW()
    AND (u.id IS NULL OR u.status <> 'INACTIVE')
$$;

CREATE OR REPLACE FUNCTION public.touch_app_session(token_hash_input TEXT)
RETURNS BOOLEAN
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.app_sessions s SET last_seen_at = NOW()
  WHERE s.token_hash = token_hash_input AND s.user_id = (SELECT auth.uid())
    AND s.revoked_at IS NULL AND s.expires_at > NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = s.user_id AND u.status = 'INACTIVE'
    );
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.register_app_session(TEXT,TIMESTAMPTZ,TEXT,TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_app_access_context(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_app_session(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_app_session(TEXT,TIMESTAMPTZ,TEXT,TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_access_context(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_app_session(TEXT) TO authenticated;

-- Preserve the approved Order implementation behind a private entry point and
-- validate duplicate Project Item IDs before the implementation can allocate a
-- document number, create an Order/Audit row, or update ordered quantities.
DO $$
BEGIN
  IF to_regprocedure('public.create_customer_order_rlc_impl(uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION public.create_customer_order(UUID,JSONB)
      RENAME TO create_customer_order_rlc_impl;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.create_customer_order_rlc_impl(UUID,JSONB)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  project_id_input UUID,
  selections_input JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(selections_input) <> 'array'
    OR jsonb_array_length(selections_input) = 0 THEN
    RAISE EXCEPTION 'AT_LEAST_ONE_ITEM_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(selections_input) AS selection(project_item_id UUID, quantity NUMERIC)
    GROUP BY selection.project_item_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_PROJECT_ITEM';
  END IF;
  RETURN public.create_customer_order_rlc_impl(project_id_input, selections_input);
END;
$$;
REVOKE ALL ON FUNCTION public.create_customer_order(UUID,JSONB)
  FROM PUBLIC, anon, authenticated;
-- Release C privilege migration restores authenticated EXECUTE after every
-- hardening prerequisite is in place.

-- The following wrappers resolve the target organization before calling the
-- already-approved mutation implementation. The renamed implementations are
-- private, so a caller cannot bypass the target check with a direct RPC.
DO $$
BEGIN
  IF to_regprocedure('public.issue_supplier_orders_rlc_impl(uuid)') IS NULL THEN
    ALTER FUNCTION public.issue_supplier_orders(UUID)
      RENAME TO issue_supplier_orders_rlc_impl;
  END IF;
  IF to_regprocedure('public.create_supplier_payment_rlc_impl(uuid,text,numeric,text)') IS NULL THEN
    ALTER FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT)
      RENAME TO create_supplier_payment_rlc_impl;
  END IF;
  IF to_regprocedure('public.review_supplier_payment_rlc_impl(uuid,boolean,text)') IS NULL THEN
    ALTER FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT)
      RENAME TO review_supplier_payment_rlc_impl;
  END IF;
  IF to_regprocedure('public.mark_supplier_payment_paid_rlc_impl(uuid,uuid)') IS NULL THEN
    ALTER FUNCTION public.mark_supplier_payment_paid(UUID,UUID)
      RENAME TO mark_supplier_payment_paid_rlc_impl;
  END IF;
  IF to_regprocedure('public.decide_order_cancellation_rlc_impl(uuid,boolean,text,numeric,numeric)') IS NULL THEN
    ALTER FUNCTION public.decide_order_cancellation(UUID,BOOLEAN,TEXT,NUMERIC,NUMERIC)
      RENAME TO decide_order_cancellation_rlc_impl;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_supplier_orders_rlc_impl(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_supplier_payment_rlc_impl(UUID,TEXT,NUMERIC,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_supplier_payment_rlc_impl(UUID,BOOLEAN,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_supplier_payment_paid_rlc_impl(UUID,UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_order_cancellation_rlc_impl(UUID,BOOLEAN,TEXT,NUMERIC,NUMERIC)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.issue_supplier_orders(order_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE target_organization_id UUID;
BEGIN
  SELECT co.organization_id INTO target_organization_id
  FROM public.customer_orders co WHERE co.id = order_id_input;
  IF target_organization_id IS NULL
    OR NOT public.has_permission('orders.manage', target_organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  RETURN public.issue_supplier_orders_rlc_impl(order_id_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_supplier_payment(
  supplier_order_id_input UUID,
  payment_type_input TEXT,
  amount_input NUMERIC,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE target_organization_id UUID;
BEGIN
  SELECT so.organization_id INTO target_organization_id
  FROM public.supplier_orders so WHERE so.id = supplier_order_id_input;
  IF target_organization_id IS NULL
    OR NOT public.has_permission('supplier_payments.request', target_organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  RETURN public.create_supplier_payment_rlc_impl(
    supplier_order_id_input, payment_type_input, amount_input, note_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_supplier_payment(
  supplier_payment_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE target_organization_id UUID;
BEGIN
  SELECT so.organization_id INTO target_organization_id
  FROM public.supplier_payments sp
  JOIN public.supplier_orders so ON so.id = sp.supplier_order_id
  WHERE sp.id = supplier_payment_id_input;
  IF target_organization_id IS NULL
    OR NOT public.has_permission('supplier_payments.manage', target_organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
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
DECLARE target_organization_id UUID;
BEGIN
  SELECT so.organization_id INTO target_organization_id
  FROM public.supplier_payments sp
  JOIN public.supplier_orders so ON so.id = sp.supplier_order_id
  WHERE sp.id = supplier_payment_id_input;
  IF target_organization_id IS NULL
    OR NOT public.has_permission('supplier_payments.manage', target_organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  RETURN public.mark_supplier_payment_paid_rlc_impl(
    supplier_payment_id_input, evidence_file_id_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_order_cancellation(
  cancellation_request_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT,
  approved_refund_amount_input NUMERIC DEFAULT 0,
  approved_deduction_amount_input NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE target_organization_id UUID;
BEGIN
  SELECT cr.organization_id INTO target_organization_id
  FROM public.cancellation_requests cr
  WHERE cr.id = cancellation_request_id_input;
  IF target_organization_id IS NULL
    OR NOT public.has_permission('orders.manage', target_organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  RETURN public.decide_order_cancellation_rlc_impl(
    cancellation_request_id_input, approve_input, decision_note_input,
    approved_refund_amount_input, approved_deduction_amount_input);
END;
$$;

-- These internal Release C RPCs were already authenticated-callable before
-- this migration. Restore only that existing surface; all private renamed
-- implementations remain unreachable to runtime roles.
REVOKE ALL ON FUNCTION public.issue_supplier_orders(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_order_cancellation(UUID,BOOLEAN,TEXT,NUMERIC,NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_supplier_orders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_order_cancellation(UUID,BOOLEAN,TEXT,NUMERIC,NUMERIC)
  TO authenticated;

DROP POLICY IF EXISTS supplier_payments_internal ON public.supplier_payments;
DROP POLICY IF EXISTS supplier_payments_slice6_internal ON public.supplier_payments;
DROP POLICY IF EXISTS supplier_payments_staff_read ON public.supplier_payments;
CREATE POLICY supplier_payments_staff_read ON public.supplier_payments
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM public.supplier_orders so
    WHERE so.id = supplier_payments.supplier_order_id
      AND (
        public.has_permission('supplier_payments.request', so.organization_id)
        OR public.has_permission('supplier_payments.manage', so.organization_id)
      )
  )
);

-- Replace the two remaining Release C SELECT policies that flattened scoped
-- roles into global access. Existing table grants and member/public branches
-- remain unchanged; only staff permission checks gain the target organization.
DROP POLICY IF EXISTS custom_quotation_costs_internal ON public.custom_quotation_costs;
CREATE POLICY custom_quotation_costs_internal ON public.custom_quotation_costs
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM public.custom_quotations cq
    WHERE cq.id = custom_quotation_costs.quotation_id
      AND public.has_permission('quotations.manage', cq.organization_id)
  )
);

DROP POLICY IF EXISTS file_metadata_select ON public.file_metadata;
CREATE POLICY file_metadata_select ON public.file_metadata
FOR SELECT TO authenticated USING (
  visibility = 'PUBLIC'
  OR member_profile_id IN (
    SELECT mp.id
    FROM public.member_profiles mp
    WHERE mp.user_id = (SELECT auth.uid())
  )
  OR (
    organization_id IS NOT NULL
    AND public.has_permission('files.member.manage', organization_id)
  )
  OR (
    visibility = 'CONFIDENTIAL'
    AND organization_id IS NOT NULL
    AND public.has_permission('files.confidential.read', organization_id)
  )
);
