-- FULL-FLOW-GO-LIVE-01 corrective #17: remove the broken outer private
-- payment verifier wrapper introduced by #16 without changing the verified
-- implementation body or any payment business rule.
DO $repair$
BEGIN
  -- #16 renamed the verified implementation, revoked every caller from it,
  -- then installed a SECURITY DEFINER wrapper that cannot execute the inner
  -- function under project_admin. Repair only that exact split state.
  IF to_regprocedure(
    'public.verify_payment_transfer_private_ffgl_impl(uuid,boolean,text,text,uuid,text,bigint)'
  ) IS NOT NULL THEN
    IF to_regprocedure(
      'public.verify_payment_transfer_private(uuid,boolean,text,text,uuid,text,bigint)'
    ) IS NOT NULL THEN
      DROP FUNCTION public.verify_payment_transfer_private(
        UUID, BOOLEAN, TEXT, TEXT, UUID, TEXT, BIGINT
      );
    END IF;

    ALTER FUNCTION public.verify_payment_transfer_private_ffgl_impl(
      UUID, BOOLEAN, TEXT, TEXT, UUID, TEXT, BIGINT
    ) RENAME TO verify_payment_transfer_private;
  END IF;

  IF to_regprocedure(
    'public.verify_payment_transfer_private(uuid,boolean,text,text,uuid,text,bigint)'
  ) IS NULL THEN
    RAISE EXCEPTION 'FFGL_PRIVATE_PAYMENT_VERIFIER_MISSING';
  END IF;

  IF to_regprocedure(
    'public.verify_payment_transfer_private_ffgl_impl(uuid,boolean,text,text,uuid,text,bigint)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'FFGL_PRIVATE_PAYMENT_VERIFIER_INNER_REMAINS';
  END IF;
END;
$repair$;

REVOKE ALL ON FUNCTION public.verify_payment_transfer_private(
  UUID, BOOLEAN, TEXT, TEXT, UUID, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated, project_admin;
GRANT EXECUTE ON FUNCTION public.verify_payment_transfer_private(
  UUID, BOOLEAN, TEXT, TEXT, UUID, TEXT, BIGINT
) TO project_admin;

DO $acl$
DECLARE
  function_signature TEXT :=
    'public.verify_payment_transfer_private(uuid,boolean,text,text,uuid,text,bigint)';
BEGIN
  IF to_regprocedure(function_signature) IS NULL THEN
    RAISE EXCEPTION 'FFGL_PRIVATE_PAYMENT_VERIFIER_MISSING_AFTER_ACL';
  END IF;
  IF to_regprocedure(
    'public.verify_payment_transfer_private_ffgl_impl(uuid,boolean,text,text,uuid,text,bigint)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'FFGL_PRIVATE_PAYMENT_VERIFIER_INNER_REMAINS_AFTER_ACL';
  END IF;
  IF has_function_privilege('anon', function_signature, 'EXECUTE')
    OR has_function_privilege('authenticated', function_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'FFGL_PRIVATE_PAYMENT_VERIFIER_PUBLIC_EXECUTE';
  END IF;
  IF NOT has_function_privilege('project_admin', function_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'FFGL_PRIVATE_PAYMENT_VERIFIER_PROJECT_ADMIN_MISSING';
  END IF;
END;
$acl$;
