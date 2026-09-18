-- Release D Slice 7 only; apply after separately approved D7 gate and QC function migration.
GRANT EXECUTE ON FUNCTION public.add_production_update(UUID,TEXT,TEXT,TIMESTAMPTZ,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_qc_inspection(UUID,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_custom_qc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dispatch_gate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_dispatch_order_item(UUID) TO authenticated;
-- This function is absent from the Production B baseline. The QC Reopen migration
-- must first create it and QA must verify its own permissions before this grant.
GRANT EXECUTE ON FUNCTION public.reopen_qc_inspection(UUID,TEXT) TO authenticated;
