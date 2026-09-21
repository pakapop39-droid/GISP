CREATE OR REPLACE FUNCTION public.operator_find_auth_user_id(email_input TEXT)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT au.id FROM auth.users au WHERE LOWER(au.email)=LOWER(BTRIM(email_input))
$$;

REVOKE ALL ON FUNCTION public.operator_find_auth_user_id(TEXT) FROM PUBLIC, anon, authenticated;
