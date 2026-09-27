-- STAFF-RENAME-01: owner-managed display-name changes for internal accounts.
-- This migration changes only public.users.full_name and records an audit event.

CREATE OR REPLACE FUNCTION public.rename_internal_staff_user(
  target_user_id_input UUID,
  full_name_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_user_id_value UUID := (SELECT auth.uid());
  target_record public.users%ROWTYPE;
  normalized_full_name TEXT := BTRIM(full_name_input);
BEGIN
  IF actor_user_id_value IS NULL
    OR NOT public.is_active_super_admin_user(actor_user_id_value)
  THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF normalized_full_name IS NULL
    OR CHAR_LENGTH(normalized_full_name) NOT BETWEEN 2 AND 120
  THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  SELECT * INTO target_record
  FROM public.users
  WHERE id = target_user_id_input
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF target_record.primary_organization_id IS NOT NULL
    OR target_record.status NOT IN ('ACTIVE', 'SUSPENDED')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = target_user_id_input
        AND ur.organization_id IS NOT NULL
        AND ur.revoked_at IS NULL
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = target_user_id_input
        AND ur.organization_id IS NULL
        AND ur.revoked_at IS NULL
        AND r.code <> 'MEMBER'
    )
  THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;

  IF target_record.full_name = normalized_full_name THEN
    RETURN target_user_id_input;
  END IF;

  UPDATE public.users
  SET full_name = normalized_full_name
  WHERE id = target_user_id_input;

  PERFORM public.write_audit_event(
    NULL,
    'user',
    target_user_id_input,
    'INTERNAL_USER_RENAMED',
    jsonb_build_object('fullName', target_record.full_name),
    jsonb_build_object('fullName', normalized_full_name)
  );
  RETURN target_user_id_input;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_internal_staff_user(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_internal_staff_user(UUID, TEXT) TO authenticated;
