-- Emergency database kill switch for PROD-CORE-PARITY-DIRECT-PROD v0.2.
-- No business rows are changed. Apply only under an authorized incident action.
REVOKE ALL ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID) TO project_admin;
REVOKE ALL ON FUNCTION public.create_supplier_payment_rlc_impl(UUID,TEXT,NUMERIC,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_supplier_payment_rlc_impl(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mark_supplier_payment_paid_rlc_impl(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_payment_rlc_impl(UUID,TEXT,NUMERIC,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment_rlc_impl(UUID,BOOLEAN,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid_rlc_impl(UUID,UUID) TO project_admin;
DO $acl_assertions$
DECLARE
  signature TEXT;
  public_can_execute BOOLEAN;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_supplier_payment(uuid,text,numeric,text)',
    'public.review_supplier_payment(uuid,boolean,text)',
    'public.mark_supplier_payment_paid(uuid,uuid)',
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
      RAISE EXCEPTION 'CORE_PARITY_STOP_ACL_INVALID: %', signature;
    END IF;
  END LOOP;
END
$acl_assertions$;
REVOKE ALL ON FUNCTION public.add_production_update(UUID,TEXT,TEXT,TIMESTAMPTZ,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_qc_inspection(UUID,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.approve_custom_qc(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reopen_qc_inspection(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_warehouse_receipt(UUID,UUID,TIMESTAMPTZ,INTEGER,NUMERIC,NUMERIC,TEXT,JSONB,UUID[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_warehouse_receipt_item(UUID,NUMERIC) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_consolidation(UUID,UUID,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.confirm_consolidation(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_shipment_v2(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,NUMERIC,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.acknowledge_partial_shipment(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.dispatch_shipment(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.add_shipment_event(UUID,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,BOOLEAN,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.schedule_delivery(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.confirm_delivery_appointment(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_delivery_reschedule(UUID,JSONB,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_delivery_reschedule(UUID,BOOLEAN,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.advance_delivery_status(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_delivery_v2(UUID,TIMESTAMPTZ,TEXT,TEXT,JSONB,UUID[],TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.add_logistics_cost(UUID,UUID,UUID,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,BOOLEAN,TEXT,TEXT,UUID[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_logistics_costs(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.issue_freight_invoice(UUID,NUMERIC,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_executive_dashboard(DATE,DATE) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_fixed_report(TEXT,DATE,DATE,TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_fixed_report_export(TEXT,JSONB,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.queue_current_user_notification(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
