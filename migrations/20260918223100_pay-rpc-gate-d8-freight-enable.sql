-- Separate Release D8 draft. Do not apply with C/D7 or without D8 authorization.
-- The application gate must remain D7 until D8 privileges and this migration
-- have both passed rehearsal and smoke checks.
CREATE OR REPLACE FUNCTION public.freight_payment_enabled()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT TRUE $$;
REVOKE ALL ON FUNCTION public.freight_payment_enabled() FROM PUBLIC, anon, authenticated;
