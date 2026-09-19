-- TEMPLATE ONLY. Release D9 emergency stop; preserves C, D7 and D8.
REVOKE ALL ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
