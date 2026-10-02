-- TEMPLATE ONLY. Forward resume of D9 after C,D7,D8 are independently verified open.
GRANT EXECUTE ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;
