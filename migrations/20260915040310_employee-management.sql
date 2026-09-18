-- EMPLOYEE-MGMT-S1-v1.1
-- Safe internal-staff group replacement and lifecycle management.
-- This migration is authored for Development/UAT only and must not be applied
-- to Production without a separate Release Authorization.

CREATE OR REPLACE FUNCTION public.is_active_super_admin_user(user_id_input UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = user_id_input
      AND ur.organization_id IS NULL
      AND ur.revoked_at IS NULL
      AND r.code = 'SUPER_ADMIN'
      AND u.status = 'ACTIVE'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_member_management_target(target_user_id_input UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.member_profiles mp
      ON mp.user_id = u.id AND mp.organization_id = u.primary_organization_id
    JOIN public.user_roles ur
      ON ur.user_id = u.id AND ur.organization_id = u.primary_organization_id AND ur.revoked_at IS NULL
    JOIN public.roles r ON r.id = ur.role_id AND r.code = 'MEMBER'
    WHERE u.id = target_user_id_input AND u.primary_organization_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles staff_ur JOIN public.roles staff_r ON staff_r.id = staff_ur.role_id
        WHERE staff_ur.user_id = u.id AND staff_ur.organization_id IS NULL
          AND staff_ur.revoked_at IS NULL AND staff_r.code <> 'MEMBER'
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_managed_internal_staff_target(target_user_id_input UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE active_role_codes TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = target_user_id_input
      AND u.primary_organization_id IS NULL
      AND u.status IN ('ACTIVE', 'SUSPENDED')
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = target_user_id_input
      AND ur.organization_id IS NOT NULL
      AND ur.revoked_at IS NULL
  ) THEN
    RETURN FALSE;
  END IF;
  SELECT array_agg(DISTINCT r.code ORDER BY r.code)
  INTO active_role_codes
  FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = target_user_id_input
    AND ur.organization_id IS NULL
    AND ur.revoked_at IS NULL;
  RETURN active_role_codes IS NOT NULL
    AND active_role_codes <@ ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC','FINANCE','LOGISTICS']::TEXT[]
    AND (
      NOT (active_role_codes && ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC']::TEXT[])
      OR active_role_codes @> ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC']::TEXT[]
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_member_management_target(target_user_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT (
    public.has_permission('members.suspend')
    OR public.has_permission('sessions.force_logout')
    OR public.has_permission('members.reset_password')
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT public.is_member_management_target(target_user_id_input) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  RETURN target_user_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_email(target_user_id_input UUID)
RETURNS TEXT
LANGUAGE PLPGSQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE result_email TEXT;
BEGIN
  IF NOT (public.has_permission('members.reset_password') OR public.has_permission('users.internal.create')) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT public.is_member_management_target(target_user_id_input) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  SELECT au.email INTO result_email FROM auth.users au WHERE au.id = target_user_id_input;
  RETURN result_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_staff_user_email(target_user_id_input UUID)
RETURNS TEXT
LANGUAGE PLPGSQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE result_email TEXT;
BEGIN
  IF NOT public.is_active_super_admin_user((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = target_user_id_input
      AND u.primary_organization_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND ur.organization_id IS NULL AND r.code <> 'MEMBER'
      )
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  SELECT au.email INTO result_email FROM auth.users au WHERE au.id = target_user_id_input;
  RETURN result_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_all_app_sessions(target_user_id_input UUID, reason_input TEXT)
RETURNS INTEGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_user_id_value UUID := (SELECT auth.uid());
  actor_is_super_admin BOOLEAN := public.is_active_super_admin_user(actor_user_id_value);
  affected INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = target_user_id_input AND ur.revoked_at IS NULL AND r.code = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  IF target_user_id_input = actor_user_id_value THEN
    IF NOT public.is_member_management_target(target_user_id_input) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  ELSE
    IF NOT public.has_permission('sessions.force_logout') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    IF actor_is_super_admin THEN
      IF NOT (public.is_member_management_target(target_user_id_input)
        OR public.is_managed_internal_staff_target(target_user_id_input)) THEN
        RAISE EXCEPTION 'INVALID_TRANSITION';
      END IF;
    ELSIF NOT public.is_member_management_target(target_user_id_input) THEN
      RAISE EXCEPTION 'INVALID_TRANSITION';
    END IF;
  END IF;
  UPDATE public.app_sessions SET revoked_at = NOW(), revoked_by = actor_user_id_value, revoke_reason = reason_input
  WHERE user_id = target_user_id_input AND revoked_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  PERFORM public.write_security_event('FORCE_LOGOUT', 'SUCCESS', target_user_id_input, NULL, NULL, NULL,
    jsonb_build_object('revokedSessions', affected, 'reason', LEFT(reason_input, 200)));
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_user(target_user_id_input UUID, reason_input TEXT)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_is_super_admin BOOLEAN := public.is_active_super_admin_user((SELECT auth.uid()));
  target_record public.users%ROWTYPE;
BEGIN
  IF NOT public.has_permission('members.suspend') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF actor_is_super_admin THEN
    IF NOT (public.is_member_management_target(target_user_id_input)
      OR public.is_managed_internal_staff_target(target_user_id_input)) THEN
      RAISE EXCEPTION 'INVALID_TRANSITION';
    END IF;
  ELSIF NOT public.is_member_management_target(target_user_id_input) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  SELECT * INTO target_record FROM public.users WHERE id = target_user_id_input FOR UPDATE;
  IF NOT FOUND OR target_record.status <> 'ACTIVE' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.users SET status='SUSPENDED', status_reason=BTRIM(reason_input),
    status_changed_by=(SELECT auth.uid()), status_changed_at=NOW() WHERE id=target_user_id_input;
  UPDATE public.organizations SET status='SUSPENDED' WHERE id=target_record.primary_organization_id;
  PERFORM public.revoke_all_app_sessions(target_user_id_input,'ACCOUNT_SUSPENDED');
  PERFORM public.write_security_event('ACCOUNT_SUSPENDED','SUCCESS',target_user_id_input,NULL,NULL,NULL,
    jsonb_build_object('reason',BTRIM(reason_input)));
  PERFORM public.write_audit_event(target_record.primary_organization_id,'user',target_user_id_input,'SUSPENDED',
    jsonb_build_object('status','ACTIVE'),jsonb_build_object('status','SUSPENDED','reason',BTRIM(reason_input)));
  RETURN target_user_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_user(target_user_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_is_super_admin BOOLEAN := public.is_active_super_admin_user((SELECT auth.uid()));
  target_record public.users%ROWTYPE;
BEGIN
  IF NOT public.has_permission('members.suspend') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF actor_is_super_admin THEN
    IF NOT (public.is_member_management_target(target_user_id_input)
      OR public.is_managed_internal_staff_target(target_user_id_input)) THEN
      RAISE EXCEPTION 'INVALID_TRANSITION';
    END IF;
  ELSIF NOT public.is_member_management_target(target_user_id_input) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  SELECT * INTO target_record FROM public.users WHERE id=target_user_id_input FOR UPDATE;
  IF NOT FOUND OR target_record.status <> 'SUSPENDED' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.users SET status='ACTIVE', status_reason=NULL, status_changed_by=(SELECT auth.uid()), status_changed_at=NOW()
    WHERE id=target_user_id_input;
  UPDATE public.organizations SET status='ACTIVE' WHERE id=target_record.primary_organization_id;
  PERFORM public.write_security_event('ACCOUNT_REACTIVATED','SUCCESS',target_user_id_input);
  PERFORM public.write_audit_event(target_record.primary_organization_id,'user',target_user_id_input,'REACTIVATED',
    jsonb_build_object('status','SUSPENDED'),jsonb_build_object('status','ACTIVE'));
  RETURN target_user_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_internal_user(
  target_user_id_input UUID,
  full_name_input TEXT,
  role_codes_input TEXT[]
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_user_id_value UUID := (SELECT auth.uid());
  role_code_value TEXT;
  role_id_value UUID;
BEGIN
  IF NOT public.is_active_super_admin_user(actor_user_id_value) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF target_user_id_input = actor_user_id_value
    OR NULLIF(BTRIM(full_name_input),'') IS NULL
    OR COALESCE(cardinality(role_codes_input), 0) = 0
    OR cardinality(role_codes_input) <> (SELECT COUNT(DISTINCT code) FROM unnest(role_codes_input) AS input_role(code))
    OR NOT (role_codes_input <@ ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC','FINANCE','LOGISTICS']::TEXT[])
    OR (
      role_codes_input && ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC']::TEXT[]
      AND NOT (role_codes_input @> ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC']::TEXT[])
    )
  THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id_input AND email_verified = TRUE) THEN
    RAISE EXCEPTION 'VERIFIED_USER_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = target_user_id_input
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = target_user_id_input AND ur.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;

  INSERT INTO public.users(id, full_name, status, status_changed_by, status_changed_at)
  VALUES(target_user_id_input, BTRIM(full_name_input), 'ACTIVE', actor_user_id_value, NOW());
  FOREACH role_code_value IN ARRAY role_codes_input LOOP
    SELECT id INTO role_id_value FROM public.roles WHERE code = role_code_value;
    IF role_id_value IS NULL THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
    INSERT INTO public.user_roles(user_id, role_id, organization_id, assigned_by)
    VALUES(target_user_id_input, role_id_value, NULL, actor_user_id_value);
  END LOOP;
  PERFORM public.write_audit_event(NULL, 'user', target_user_id_input, 'INTERNAL_USER_PROVISIONED', NULL,
    jsonb_build_object('roles', role_codes_input));
  RETURN target_user_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_internal_staff_job_groups(
  target_user_id_input UUID,
  job_groups_input TEXT[],
  role_codes_input TEXT[]
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_user_id_value UUID := (SELECT auth.uid());
  target_record public.users%ROWTYPE;
  expected_role_codes TEXT[];
  before_role_codes TEXT[];
  active_role_count INTEGER;
BEGIN
  IF actor_user_id_value IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = actor_user_id_value
      AND ur.organization_id IS NULL
      AND ur.revoked_at IS NULL
      AND r.code = 'SUPER_ADMIN'
      AND u.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF target_user_id_input = actor_user_id_value THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  IF COALESCE(cardinality(job_groups_input), 0) NOT BETWEEN 1 AND 3
    OR EXISTS (SELECT 1 FROM unnest(job_groups_input) AS group_code
      WHERE group_code NOT IN ('OPERATIONS', 'FINANCE', 'LOGISTICS'))
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
    OR EXISTS (SELECT 1 FROM public.user_roles
      WHERE user_id = target_user_id_input AND organization_id IS NOT NULL AND revoked_at IS NULL)
  THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = target_user_id_input AND ur.organization_id IS NULL
      AND ur.revoked_at IS NULL AND r.code = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = target_user_id_input AND ur.organization_id IS NULL
      AND ur.revoked_at IS NULL AND r.code <> 'MEMBER'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = target_user_id_input AND ur.organization_id IS NULL
      AND ur.revoked_at IS NULL
      AND r.code NOT IN ('MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC','FINANCE','LOGISTICS')
  ) OR (
    EXISTS (
      SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = target_user_id_input AND ur.organization_id IS NULL
        AND ur.revoked_at IS NULL
        AND r.code = ANY (ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC'])
    ) AND (
      SELECT COUNT(DISTINCT r.code) FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = target_user_id_input AND ur.organization_id IS NULL
        AND ur.revoked_at IS NULL
        AND r.code = ANY (ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC'])
    ) <> 5
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;

  SELECT array_agg(DISTINCT role_code ORDER BY role_code)
  INTO expected_role_codes
  FROM (
    SELECT unnest(CASE group_code
      WHEN 'OPERATIONS' THEN ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC']::TEXT[]
      WHEN 'FINANCE' THEN ARRAY['FINANCE']::TEXT[]
      WHEN 'LOGISTICS' THEN ARRAY['LOGISTICS']::TEXT[]
    END) AS role_code
    FROM unnest(job_groups_input) AS group_code
  ) expected;

  IF COALESCE(cardinality(role_codes_input), 0) <> cardinality(expected_role_codes)
    OR NOT (role_codes_input @> expected_role_codes AND role_codes_input <@ expected_role_codes)
  THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  SELECT COALESCE(array_agg(r.code ORDER BY r.code), ARRAY[]::TEXT[])
  INTO before_role_codes
  FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = target_user_id_input AND ur.organization_id IS NULL AND ur.revoked_at IS NULL;

  UPDATE public.user_roles ur
  SET revoked_at = NOW()
  FROM public.roles r
  WHERE ur.role_id = r.id
    AND ur.user_id = target_user_id_input
    AND ur.organization_id IS NULL
    AND ur.revoked_at IS NULL
    AND r.code = ANY (ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC','FINANCE','LOGISTICS'])
    AND NOT (r.code = ANY (expected_role_codes));

  INSERT INTO public.user_roles(user_id, role_id, organization_id, assigned_by)
  SELECT target_user_id_input, r.id, NULL, actor_user_id_value
  FROM public.roles r
  WHERE r.code = ANY (expected_role_codes)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = target_user_id_input AND ur.role_id = r.id
        AND ur.organization_id IS NULL AND ur.revoked_at IS NULL
    );

  SELECT COUNT(*) INTO active_role_count
  FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = target_user_id_input AND ur.organization_id IS NULL
    AND ur.revoked_at IS NULL AND r.code = ANY (expected_role_codes);
  IF active_role_count <> cardinality(expected_role_codes) THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;

  PERFORM public.write_audit_event(NULL, 'user', target_user_id_input, 'STAFF_JOB_GROUPS_REPLACED',
    jsonb_build_object('roles', before_role_codes),
    jsonb_build_object('jobGroups', job_groups_input, 'roles', expected_role_codes));
  RETURN target_user_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_internal_staff_lifecycle(
  target_user_id_input UUID,
  action_input TEXT,
  reason_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_user_id_value UUID := (SELECT auth.uid());
  target_record public.users%ROWTYPE;
  active_role_codes TEXT[];
  before_role_codes TEXT[];
  revoked_role_count INTEGER;
BEGIN
  IF actor_user_id_value IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = actor_user_id_value
      AND ur.organization_id IS NULL
      AND ur.revoked_at IS NULL
      AND r.code = 'SUPER_ADMIN'
      AND u.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF action_input NOT IN ('SUSPEND', 'REACTIVATE', 'DEACTIVATE') THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF target_user_id_input = actor_user_id_value THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;

  SELECT * INTO target_record
  FROM public.users
  WHERE id = target_user_id_input
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF target_record.primary_organization_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.user_roles
      WHERE user_id = target_user_id_input AND organization_id IS NOT NULL AND revoked_at IS NULL)
  THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  SELECT array_agg(DISTINCT r.code ORDER BY r.code)
  INTO active_role_codes
  FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = target_user_id_input
    AND ur.organization_id IS NULL
    AND ur.revoked_at IS NULL;

  -- Every lifecycle action is limited to role sets represented exactly by one
  -- or more approved job groups. The five OPERATIONS roles are indivisible;
  -- FINANCE and LOGISTICS are single-role groups.
  IF active_role_codes IS NULL
    OR NOT (active_role_codes <@ ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC','FINANCE','LOGISTICS']::TEXT[])
    OR (
      active_role_codes && ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC']::TEXT[]
      AND NOT (active_role_codes @> ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC']::TEXT[])
    )
  THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;

  IF action_input = 'SUSPEND' THEN
    IF target_record.status <> 'ACTIVE' OR NULLIF(BTRIM(reason_input), '') IS NULL THEN
      RAISE EXCEPTION 'INVALID_TRANSITION';
    END IF;
    PERFORM public.suspend_user(target_user_id_input, BTRIM(reason_input));
  ELSIF action_input = 'REACTIVATE' THEN
    IF target_record.status <> 'SUSPENDED' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
    PERFORM public.reactivate_user(target_user_id_input);
  ELSE
    IF target_record.status NOT IN ('ACTIVE', 'SUSPENDED')
      OR NULLIF(BTRIM(reason_input), '') IS NULL THEN
      RAISE EXCEPTION 'INVALID_TRANSITION';
    END IF;
    SELECT COALESCE(array_agg(r.code ORDER BY r.code), ARRAY[]::TEXT[])
    INTO before_role_codes
    FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = target_user_id_input AND ur.organization_id IS NULL AND ur.revoked_at IS NULL;

    PERFORM public.revoke_all_app_sessions(target_user_id_input, 'ACCOUNT_DEACTIVATED');
    UPDATE public.users
    SET status = 'INACTIVE', status_reason = BTRIM(reason_input),
      status_changed_by = actor_user_id_value, status_changed_at = NOW()
    WHERE id = target_user_id_input;
    UPDATE public.user_roles
    SET revoked_at = NOW()
    WHERE user_id = target_user_id_input AND revoked_at IS NULL;
    GET DIAGNOSTICS revoked_role_count = ROW_COUNT;

    PERFORM public.write_security_event('FORCE_LOGOUT', 'SUCCESS', target_user_id_input,
      NULL, NULL, NULL, jsonb_build_object(
        'source', 'ACCOUNT_DEACTIVATED',
        'reason', BTRIM(reason_input),
        'revokedRoles', revoked_role_count
      ));
    PERFORM public.write_audit_event(NULL, 'user', target_user_id_input, 'DEACTIVATED',
      jsonb_build_object('status', target_record.status, 'roles', before_role_codes),
      jsonb_build_object('status', 'INACTIVE', 'reason', BTRIM(reason_input), 'roles', ARRAY[]::TEXT[]));
  END IF;
  RETURN target_user_id_input;
END;
$$;

REVOKE ALL ON FUNCTION public.is_active_super_admin_user(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_member_management_target(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_managed_internal_staff_target(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_member_management_target(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_user_email(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_staff_user_email(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_all_app_sessions(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.suspend_user(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_user(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provision_internal_user(UUID, TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replace_internal_staff_job_groups(UUID, TEXT[], TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manage_internal_staff_lifecycle(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_production_role(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_production_role(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_member_management_target(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_staff_user_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_all_app_sessions(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_internal_user(UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_internal_staff_job_groups(UUID, TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_internal_staff_lifecycle(UUID, TEXT, TEXT) TO authenticated;
