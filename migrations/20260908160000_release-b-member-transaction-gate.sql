-- Release B is a Member Pilot for catalog, project, shared catalog and sourcing.
-- Keep transaction-writing RPCs unavailable until Release C is approved.
-- Release C must add an explicit migration that grants the approved signatures again.

REVOKE ALL ON FUNCTION public.submit_custom_request(UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_custom_request_v2(UUID)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_custom_request(UUID,TEXT)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_customer_order(UUID,JSONB)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_payment_transfer(UUID,NUMERIC,TIMESTAMPTZ,UUID)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_order_cancellation(UUID,TEXT,UUID)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.approve_custom_qc(UUID)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.acknowledge_partial_shipment(UUID,TEXT)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.confirm_delivery_appointment(UUID)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_delivery_reschedule(UUID,JSONB,TEXT,TEXT,TEXT,TEXT,JSONB)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID)
  FROM PUBLIC,anon,authenticated;
