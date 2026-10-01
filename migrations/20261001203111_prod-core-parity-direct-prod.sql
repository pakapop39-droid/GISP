-- PROD-CORE-PARITY-DIRECT-PROD v0.2
-- Forward-only release migration. It restores the Development-UAT accepted
-- supplier payment path after the lean guard while retaining organization
-- checks, maker/checker controls and the existing hardened implementations.
-- No business-row DML is performed by this migration.

DO $prerequisites$
DECLARE signature TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_supplier_payment_rlc_impl(uuid,text,numeric,text)',
    'public.review_supplier_payment_rlc_impl(uuid,boolean,text)',
    'public.mark_supplier_payment_paid_rlc_impl(uuid,uuid)',
    'public.add_production_update(uuid,text,text,timestamp with time zone,numeric,timestamp with time zone,timestamp with time zone,text,jsonb)',
    'public.record_qc_inspection(uuid,text,jsonb,text,text,text,text,uuid,jsonb)',
    'public.create_claim(uuid,text,text,text,numeric,text,timestamp with time zone,text,text,uuid)',
    'public.get_fixed_report(text,date,date,text,integer,integer)'
  ] LOOP
    IF to_regprocedure(signature) IS NULL THEN
      RAISE EXCEPTION 'CORE_PARITY_PREREQUISITE_MISSING: %', signature;
    END IF;
  END LOOP;
END
$prerequisites$;

-- The prior lean guard intentionally removed EXECUTE from the function owner.
-- Some managed migration paths validate owner access before CREATE OR REPLACE,
-- so restore only the owner first. Client roles remain unable to call these
-- wrappers until the final grants at the end of this section.
GRANT EXECUTE ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT)
  TO project_admin;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT)
  TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID)
  TO project_admin;

REVOKE ALL ON FUNCTION public.create_supplier_payment_rlc_impl(UUID,TEXT,NUMERIC,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_supplier_payment_rlc_impl(UUID,BOOLEAN,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_supplier_payment_paid_rlc_impl(UUID,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_payment_rlc_impl(UUID,TEXT,NUMERIC,TEXT)
  TO project_admin;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment_rlc_impl(UUID,BOOLEAN,TEXT)
  TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid_rlc_impl(UUID,UUID)
  TO project_admin;

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
  FROM public.supplier_orders so
  WHERE so.id = supplier_order_id_input;
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

REVOKE ALL ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID) TO project_admin;
GRANT EXECUTE ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID) TO authenticated;

DO $acl_assertions$
DECLARE
  signature TEXT;
  public_can_execute BOOLEAN;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_supplier_payment_rlc_impl(uuid,text,numeric,text)',
    'public.review_supplier_payment_rlc_impl(uuid,boolean,text)',
    'public.mark_supplier_payment_paid_rlc_impl(uuid,uuid)'
  ] LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      WHERE p.oid = pg_catalog.to_regprocedure(signature)
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) INTO public_can_execute;
    IF public_can_execute
      OR pg_catalog.has_function_privilege('anon', signature, 'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated', signature, 'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('project_admin', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'CORE_PARITY_PRIVATE_ACL_INVALID: %', signature;
    END IF;
  END LOOP;

  FOREACH signature IN ARRAY ARRAY[
    'public.create_supplier_payment(uuid,text,numeric,text)',
    'public.review_supplier_payment(uuid,boolean,text)',
    'public.mark_supplier_payment_paid(uuid,uuid)'
  ] LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      WHERE p.oid = pg_catalog.to_regprocedure(signature)
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) INTO public_can_execute;
    IF public_can_execute
      OR pg_catalog.has_function_privilege('anon', signature, 'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('authenticated', signature, 'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('project_admin', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'CORE_PARITY_WRAPPER_ACL_INVALID: %', signature;
    END IF;
  END LOOP;
END
$acl_assertions$;

-- Restore the UAT-accepted Production/QC, Logistics, Claims and Reports RPCs.
GRANT EXECUTE ON FUNCTION public.add_production_update(UUID,TEXT,TEXT,TIMESTAMPTZ,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_qc_inspection(UUID,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_custom_qc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dispatch_gate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_dispatch_order_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_qc_inspection(UUID,TEXT) TO authenticated;

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

GRANT EXECUTE ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_executive_dashboard(DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fixed_report(TEXT,DATE,DATE,TEXT,INTEGER,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fixed_report_export(TEXT,JSONB,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_current_user_notification(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
