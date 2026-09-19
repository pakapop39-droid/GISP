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
