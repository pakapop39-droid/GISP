-- TEMPLATE ONLY. Release D7 emergency stop; preserves Release C.
REVOKE ALL ON FUNCTION public.add_production_update(UUID,TEXT,TEXT,TIMESTAMPTZ,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_qc_inspection(UUID,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.approve_custom_qc(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reopen_qc_inspection(UUID,TEXT) FROM PUBLIC,anon,authenticated;
