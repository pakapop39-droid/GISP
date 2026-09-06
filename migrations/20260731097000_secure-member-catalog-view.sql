-- member_catalog intentionally hides factory cost, margin, supplier contacts,
-- and internal notes. It is still member-only because it contains Member Price.
ALTER VIEW public.member_catalog SET (security_barrier = true);

REVOKE ALL ON public.member_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_catalog TO authenticated;

COMMENT ON VIEW public.member_catalog IS
  'Member-only sanitized catalog projection. Never includes factory cost, margin, supplier contacts or internal notes.';
