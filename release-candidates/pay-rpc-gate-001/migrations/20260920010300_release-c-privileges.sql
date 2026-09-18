-- Release C candidate: permissions only. No schema, business data or pricing changes.
-- Apply only after an environment-specific pg_proc/ACL audit and Release authorization.
-- C first closes every known D direct-RPC entry point from the consolidated baseline.
-- D7/D8/D9/D10 migrations below reopen only their own slice when separately approved.

REVOKE ALL ON FUNCTION public.add_production_update(UUID,TEXT,TEXT,TIMESTAMPTZ,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_qc_inspection(UUID,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.approve_custom_qc(UUID) FROM PUBLIC,anon,authenticated;
-- get_dispatch_gate is a read helper called by C Order detail; keep its grant.
-- QC Reopen is present in Development but absent from Production B baseline.
DO $$
BEGIN
  IF to_regprocedure('public.reopen_qc_inspection(uuid,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.reopen_qc_inspection(UUID,TEXT) FROM PUBLIC,anon,authenticated';
  END IF;
END;
$$;

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
-- Retired v1 entry points stay unavailable even if the consolidated baseline retains them.
REVOKE ALL ON FUNCTION public.create_shipment(TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_delivery(UUID,TEXT,UUID,BOOLEAN) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.get_executive_dashboard(DATE,DATE) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_fixed_report(TEXT,DATE,DATE,TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_fixed_report_export(TEXT,JSONB,INTEGER) FROM PUBLIC,anon,authenticated;

-- Release B explicitly revoked these Member transaction functions. Restore only C.
GRANT EXECUTE ON FUNCTION public.submit_custom_request(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_custom_request_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_custom_request(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_transfer(UUID,NUMERIC,TIMESTAMPTZ,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_order_cancellation(UUID,TEXT,UUID) TO authenticated;
