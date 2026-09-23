-- Forward Resume C. Deferred Supplier Payment, Claims, Reports and notification enqueue remain closed.
GRANT EXECUTE ON FUNCTION public.submit_custom_request(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_custom_request_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_custom_request(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_transfer(UUID,NUMERIC,TIMESTAMPTZ,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_order_cancellation(UUID,TEXT,UUID) TO authenticated;
