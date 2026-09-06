-- Release readiness security hardening.
-- Runtime users must never inherit EXECUTE on privileged functions from PUBLIC.
DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS function_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      function_record.function_signature
    );
  END LOOP;
END;
$$;

-- These routines previously inherited anonymous access through PUBLIC. They are
-- application RPCs or RLS helpers and require an authenticated InsForge user.
DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS function_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname = ANY (ARRAY[
        'admin_get_user_email',
        'assign_production_role',
        'current_member_profile_id',
        'get_app_access_context',
        'get_member_history',
        'next_record_reference',
        'provision_internal_user',
        'reactivate_user',
        'register_app_session',
        'reject_member_application',
        'revoke_all_app_sessions',
        'revoke_app_session',
        'revoke_production_role',
        'save_member_onboarding',
        'set_role_permission',
        'submit_member_application',
        'suspend_user',
        'touch_app_session',
        'update_company_settings',
        'write_security_event'
      ]::TEXT[])
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO authenticated',
      function_record.function_signature
    );
  END LOOP;
END;
$$;

-- Trigger functions and retired compatibility RPCs are not public API surface.
DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS function_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        p.prorettype = 'trigger'::regtype
        OR p.proname IN ('create_shipment', 'record_delivery', 'submit_custom_request')
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_record.function_signature
    );
  END LOOP;
END;
$$;

-- Make the deny-by-default behavior visible to both PostgreSQL and Advisor.
-- Direct table privileges remain revoked; all legitimate access goes through
-- guarded RPCs.
DROP POLICY IF EXISTS document_sequences_runtime_deny
  ON public.document_sequences;
CREATE POLICY document_sequences_runtime_deny
  ON public.document_sequences
  FOR ALL TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS showroom_visit_requests_runtime_deny
  ON public.showroom_visit_requests;
CREATE POLICY showroom_visit_requests_runtime_deny
  ON public.showroom_visit_requests
  FOR ALL TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS supplier_disclosure_grants_runtime_deny
  ON public.supplier_disclosure_grants;
CREATE POLICY supplier_disclosure_grants_runtime_deny
  ON public.supplier_disclosure_grants
  FOR ALL TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

-- Future migration-created functions must be granted explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE project_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
