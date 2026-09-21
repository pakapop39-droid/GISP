DO $hardening$
DECLARE
  target_function regprocedure;
BEGIN
  FOR target_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      target_function
    );
  END LOOP;
END
$hardening$;

GRANT EXECUTE ON FUNCTION public.current_member_profile_id() TO authenticated;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy policy
    JOIN pg_class table_class ON table_class.oid = policy.polrelid
    JOIN pg_namespace table_schema ON table_schema.oid = table_class.relnamespace
    WHERE table_schema.nspname = 'public'
      AND table_class.relname = 'document_sequences'
      AND policy.polname = 'document_sequences_explicit_deny'
  ) THEN
    CREATE POLICY document_sequences_explicit_deny
      ON public.document_sequences
      FOR ALL
      TO PUBLIC
      USING (false)
      WITH CHECK (false);
  END IF;
END
$policy$;
