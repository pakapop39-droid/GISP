-- Release D Slice 9 only; earlier D slices and their smoke tests must pass.
GRANT EXECUTE ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;
