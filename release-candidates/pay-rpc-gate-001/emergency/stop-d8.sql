-- TEMPLATE ONLY. Release D8 emergency stop; preserves C and D7.
-- Freight is disabled in the same transaction as the D8 EXECUTE revokes.
CREATE OR REPLACE FUNCTION public.freight_payment_enabled()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT FALSE $$;
REVOKE ALL ON FUNCTION public.freight_payment_enabled() FROM PUBLIC,anon,authenticated;

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
REVOKE ALL ON FUNCTION public.create_shipment(TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_delivery(UUID,TEXT,UUID,BOOLEAN) FROM PUBLIC,anon,authenticated;
