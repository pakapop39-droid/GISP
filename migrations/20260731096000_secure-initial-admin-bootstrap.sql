-- The first SUPER_ADMIN must be assigned through a privileged, audited
-- operator workflow after the owner has verified their email address.
-- Do not allow an arbitrary authenticated user to win the bootstrap race.
REVOKE ALL ON FUNCTION public.claim_initial_super_admin(TEXT)
  FROM PUBLIC, anon, authenticated;
