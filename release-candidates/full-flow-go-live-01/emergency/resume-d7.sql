-- TEMPLATE ONLY. Forward resume of D7 after Release C is independently verified open.
GRANT EXECUTE ON FUNCTION public.add_production_update(UUID,TEXT,TEXT,TIMESTAMPTZ,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_qc_inspection(UUID,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_custom_qc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_qc_inspection(UUID,TEXT) TO authenticated;
