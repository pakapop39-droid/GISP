-- Slice 1 server-side admin helpers. All calls remain permission checked.

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
  SELECT au.email INTO result_email FROM auth.users au WHERE au.id=target_user_id_input;
  RETURN result_email;
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
DECLARE role_code_value TEXT; role_id_value UUID; assignment_id UUID;
BEGIN
  IF NOT public.has_permission('users.internal.create') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(full_name_input),'') IS NULL OR COALESCE(array_length(role_codes_input,1),0)=0 THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=target_user_id_input AND email_verified=TRUE) THEN
    RAISE EXCEPTION 'VERIFIED_USER_REQUIRED';
  END IF;
  INSERT INTO public.users(id,full_name,status,status_changed_by,status_changed_at)
  VALUES(target_user_id_input,BTRIM(full_name_input),'ACTIVE',(SELECT auth.uid()),NOW())
  ON CONFLICT(id) DO UPDATE SET full_name=EXCLUDED.full_name,status='ACTIVE',status_reason=NULL,
    status_changed_by=(SELECT auth.uid()),status_changed_at=NOW();
  FOREACH role_code_value IN ARRAY role_codes_input LOOP
    IF role_code_value IN ('MEMBER','MEMBER_ADMIN') THEN
      -- MEMBER_ADMIN remains valid for staff; MEMBER itself is member-profile scoped.
      IF role_code_value='MEMBER' THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
    END IF;
    SELECT id INTO role_id_value FROM public.roles WHERE code=role_code_value;
    IF role_id_value IS NULL THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
    INSERT INTO public.user_roles(user_id,role_id,organization_id,assigned_by)
    VALUES(target_user_id_input,role_id_value,NULL,(SELECT auth.uid()))
    ON CONFLICT DO NOTHING RETURNING id INTO assignment_id;
  END LOOP;
  PERFORM public.write_audit_event(NULL,'user',target_user_id_input,'INTERNAL_USER_PROVISIONED',NULL,
    jsonb_build_object('roles',role_codes_input));
  RETURN target_user_id_input;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_internal_user(UUID,TEXT,TEXT[]) TO authenticated;
