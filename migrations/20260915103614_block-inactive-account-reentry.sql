-- EMPLOYEE-MGMT-S1-v1.1 follow-up
-- Permanently inactive accounts must not create or revive application access.
-- Development/UAT only. Production requires separate Release Authorization.

CREATE OR REPLACE FUNCTION public.assert_account_not_inactive(user_id_input UUID)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE account_status TEXT;
BEGIN
  SELECT u.status
  INTO account_status
  FROM public.users u
  WHERE u.id = user_id_input
  -- Use an exclusive row lock because guarded flows such as approval and
  -- onboarding can later update this same user. This avoids SHARE-to-UPDATE
  -- lock upgrades when concurrent requests follow the user-first lock order.
  FOR UPDATE;

  -- A newly authenticated user does not have a public.users row until
  -- onboarding. Missing rows must therefore remain eligible.
  IF FOUND AND account_status = 'INACTIVE' THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_inactive_account_reentry()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'INACTIVE' AND NEW.status IS DISTINCT FROM 'INACTIVE' THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_prevent_inactive_account_reentry ON public.users;
CREATE TRIGGER users_prevent_inactive_account_reentry
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inactive_account_reentry();

CREATE OR REPLACE FUNCTION public.register_app_session(
  token_hash_input TEXT,
  expires_at_input TIMESTAMPTZ,
  ip_address_input TEXT DEFAULT NULL,
  user_agent_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE current_user_id UUID := (SELECT auth.uid()); session_id UUID;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  PERFORM public.assert_account_not_inactive(current_user_id);
  IF token_hash_input !~ '^[a-f0-9]{64}$' OR expires_at_input <= NOW() THEN
    RAISE EXCEPTION 'INVALID_SESSION';
  END IF;
  INSERT INTO public.app_sessions(user_id, token_hash, expires_at, ip_address, user_agent)
  VALUES (current_user_id, token_hash_input, expires_at_input, NULLIF(ip_address_input,'')::inet,
    LEFT(user_agent_input, 500)) RETURNING id INTO session_id;
  RETURN session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_app_access_context(token_hash_input TEXT)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'userId', s.user_id,
    'sessionId', s.id,
    'sessionExpiresAt', s.expires_at,
    'userStatus', COALESCE(u.status, 'PENDING'),
    'statusReason', u.status_reason,
    'applicationStatus', COALESCE(ma.status, 'DRAFT'),
    'applicationReason', COALESCE(ma.rejection_reason, ma.review_note),
    'memberProfileId', mp.id,
    'organizationId', mp.organization_id,
    'displayName', COALESCE(u.full_name, mp.contact_name),
    'companyName', mp.company_name,
    'roles', COALESCE((
      SELECT jsonb_agg(DISTINCT r.code ORDER BY r.code)
      FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = s.user_id AND ur.revoked_at IS NULL
    ), '[]'::jsonb),
    'permissions', COALESCE((
      SELECT jsonb_agg(DISTINCT p.code ORDER BY p.code)
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = s.user_id AND ur.revoked_at IS NULL
    ), '[]'::jsonb)
  )
  FROM public.app_sessions s
  LEFT JOIN public.users u ON u.id = s.user_id
  LEFT JOIN public.member_profiles mp ON mp.user_id = s.user_id
  LEFT JOIN public.member_applications ma ON ma.member_profile_id = mp.id
  WHERE s.token_hash = token_hash_input AND s.user_id = (SELECT auth.uid())
    AND s.revoked_at IS NULL AND s.expires_at > NOW()
    AND (u.id IS NULL OR u.status <> 'INACTIVE')
$$;

CREATE OR REPLACE FUNCTION public.touch_app_session(token_hash_input TEXT)
RETURNS BOOLEAN
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.app_sessions s SET last_seen_at = NOW()
  WHERE s.token_hash = token_hash_input AND s.user_id = (SELECT auth.uid())
    AND s.revoked_at IS NULL AND s.expires_at > NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = s.user_id AND u.status = 'INACTIVE'
    );
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_member_onboarding(
  contact_name_input TEXT,
  contact_phone_input TEXT,
  company_name_input TEXT,
  company_legal_name_input TEXT,
  tax_id_input TEXT,
  business_type_input TEXT,
  address_line_input TEXT,
  district_input TEXT,
  province_input TEXT,
  postal_code_input TEXT,
  service_areas_input TEXT[],
  product_interests_input TEXT[],
  training_interest_input BOOLEAN,
  training_note_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE current_user_id UUID := (SELECT auth.uid()); org_id UUID; profile_id UUID; member_role_id UUID;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  PERFORM public.assert_account_not_inactive(current_user_id);
  IF NULLIF(BTRIM(contact_name_input),'') IS NULL OR NULLIF(BTRIM(company_name_input),'') IS NULL THEN
    RAISE EXCEPTION 'INVALID_ONBOARDING';
  END IF;
  SELECT mp.id, mp.organization_id INTO profile_id, org_id
  FROM public.member_profiles mp WHERE mp.user_id = current_user_id FOR UPDATE;
  IF profile_id IS NULL THEN
    INSERT INTO public.organizations(code, name, legal_name, tax_id, status)
    VALUES ('ORG-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT,'-','') FROM 1 FOR 10)),
      BTRIM(company_name_input), NULLIF(BTRIM(company_legal_name_input),''), NULLIF(BTRIM(tax_id_input),''), 'PENDING')
    RETURNING id INTO org_id;
    INSERT INTO public.users(id, primary_organization_id, full_name, phone, status)
    VALUES (current_user_id, org_id, BTRIM(contact_name_input), NULLIF(BTRIM(contact_phone_input),''), 'PENDING')
    ON CONFLICT (id) DO UPDATE SET primary_organization_id = EXCLUDED.primary_organization_id,
      full_name = EXCLUDED.full_name, phone = EXCLUDED.phone;
    INSERT INTO public.member_profiles(user_id, organization_id, contact_name, contact_phone, company_name,
      company_legal_name, tax_id, business_type, address_line, district, province, postal_code,
      service_areas, product_interests, training_interest, training_note)
    VALUES (current_user_id, org_id, BTRIM(contact_name_input), NULLIF(BTRIM(contact_phone_input),''),
      BTRIM(company_name_input), NULLIF(BTRIM(company_legal_name_input),''), NULLIF(BTRIM(tax_id_input),''),
      NULLIF(BTRIM(business_type_input),''), NULLIF(BTRIM(address_line_input),''), NULLIF(BTRIM(district_input),''),
      NULLIF(BTRIM(province_input),''), NULLIF(BTRIM(postal_code_input),''), COALESCE(service_areas_input,'{}'),
      COALESCE(product_interests_input,'{}'), COALESCE(training_interest_input,FALSE), NULLIF(BTRIM(training_note_input),''))
    RETURNING id INTO profile_id;
    SELECT id INTO member_role_id FROM public.roles WHERE code = 'MEMBER';
    INSERT INTO public.user_roles(user_id, role_id, organization_id, assigned_by)
    VALUES (current_user_id, member_role_id, org_id, current_user_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.member_applications(user_id, organization_id, member_profile_id, status, submitted_at)
    VALUES (current_user_id, org_id, profile_id, 'DRAFT', NOW());
  ELSE
    UPDATE public.member_profiles SET contact_name = BTRIM(contact_name_input),
      contact_phone = NULLIF(BTRIM(contact_phone_input),''), company_name = BTRIM(company_name_input),
      company_legal_name = NULLIF(BTRIM(company_legal_name_input),''), tax_id = NULLIF(BTRIM(tax_id_input),''),
      business_type = NULLIF(BTRIM(business_type_input),''), address_line = NULLIF(BTRIM(address_line_input),''),
      district = NULLIF(BTRIM(district_input),''), province = NULLIF(BTRIM(province_input),''),
      postal_code = NULLIF(BTRIM(postal_code_input),''), service_areas = COALESCE(service_areas_input,'{}'),
      product_interests = COALESCE(product_interests_input,'{}'), training_interest = COALESCE(training_interest_input,FALSE),
      training_note = NULLIF(BTRIM(training_note_input),'') WHERE id = profile_id;
    UPDATE public.users SET full_name = BTRIM(contact_name_input), phone = NULLIF(BTRIM(contact_phone_input),'')
    WHERE id = current_user_id;
    UPDATE public.organizations SET name = BTRIM(company_name_input), legal_name = NULLIF(BTRIM(company_legal_name_input),''),
      tax_id = NULLIF(BTRIM(tax_id_input),'') WHERE id = org_id;
  END IF;
  RETURN profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_member_application()
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE current_user_id UUID := (SELECT auth.uid()); app_record public.member_applications%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  -- Always lock the user before the application to match the admin approval path.
  PERFORM public.assert_account_not_inactive(current_user_id);
  SELECT ma.* INTO app_record FROM public.member_applications ma
  JOIN public.member_profiles mp ON mp.id = ma.member_profile_id
  WHERE mp.user_id = current_user_id AND ma.user_id = current_user_id FOR UPDATE OF ma;
  IF NOT FOUND OR app_record.status NOT IN ('DRAFT','REJECTED') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.member_applications SET status = 'PENDING', submitted_at = NOW(),
    resubmitted_at = CASE WHEN app_record.status = 'REJECTED' THEN NOW() ELSE resubmitted_at END,
    rejection_reason = NULL, review_note = NULL WHERE id = app_record.id;
  PERFORM public.write_audit_event(app_record.organization_id, 'member_application', app_record.id,
    CASE WHEN app_record.status = 'REJECTED' THEN 'RESUBMITTED' ELSE 'SUBMITTED' END,
    jsonb_build_object('status', app_record.status), jsonb_build_object('status','PENDING'));
  RETURN app_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_member_application(application_id_input UUID, review_note_input TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_user_id UUID;
  app_record public.member_applications%ROWTYPE;
BEGIN
  IF NOT public.has_permission('members.approve') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;

  -- Resolve without taking the application lock, then lock its user first.
  SELECT ma.user_id INTO target_user_id
  FROM public.member_applications ma
  WHERE ma.id = application_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  PERFORM public.assert_account_not_inactive(target_user_id);

  SELECT ma.* INTO app_record
  FROM public.member_applications ma
  WHERE ma.id = application_id_input
  FOR UPDATE;
  IF NOT FOUND OR app_record.user_id <> target_user_id
    OR app_record.status NOT IN ('PENDING','UNDER_REVIEW') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  UPDATE public.member_applications SET status='APPROVED', reviewed_at=NOW(), reviewed_by=(SELECT auth.uid()),
    review_note=review_note_input, rejection_reason=NULL WHERE id=application_id_input;
  UPDATE public.organizations SET status='ACTIVE', approved_at=COALESCE(approved_at,NOW()) WHERE id=app_record.organization_id;
  UPDATE public.users SET status='ACTIVE', status_reason=NULL, status_changed_by=(SELECT auth.uid()), status_changed_at=NOW()
    WHERE id=app_record.user_id;
  PERFORM public.write_audit_event(app_record.organization_id,'member_application',application_id_input,'APPROVED',
    jsonb_build_object('status',app_record.status),jsonb_build_object('status','APPROVED','note',review_note_input));
  RETURN application_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_member_profile(
  full_name_input TEXT,
  organization_name_input TEXT,
  phone_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  new_org_id UUID;
  member_role_id UUID;
  application_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  PERFORM public.assert_account_not_inactive(current_user_id);
  IF NULLIF(BTRIM(full_name_input), '') IS NULL
    OR NULLIF(BTRIM(organization_name_input), '') IS NULL THEN
    RAISE EXCEPTION 'name and organization are required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE id = current_user_id) THEN
    RAISE EXCEPTION 'profile already exists';
  END IF;

  INSERT INTO public.organizations (code, name)
  VALUES (
    'ORG-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
    BTRIM(organization_name_input)
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.users (
    id, primary_organization_id, full_name, phone, status
  )
  VALUES (
    current_user_id, new_org_id, BTRIM(full_name_input),
    NULLIF(BTRIM(phone_input), ''), 'PENDING'
  );

  SELECT id INTO member_role_id FROM public.roles WHERE code = 'MEMBER';
  INSERT INTO public.user_roles (
    user_id, role_id, organization_id, assigned_by
  )
  VALUES (current_user_id, member_role_id, new_org_id, current_user_id);

  INSERT INTO public.member_applications (user_id, organization_id)
  VALUES (current_user_id, new_org_id)
  RETURNING id INTO application_id;

  PERFORM public.write_audit_event(
    new_org_id, 'member_application', application_id, 'SUBMITTED',
    NULL, jsonb_build_object('status', 'PENDING')
  );
  RETURN application_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_account_not_inactive(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_inactive_account_reentry() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.register_app_session(TEXT,TIMESTAMPTZ,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_app_access_context(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_app_session(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_member_onboarding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT[],BOOLEAN,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_member_application() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_member_application(UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_member_profile(TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_app_session(TEXT,TIMESTAMPTZ,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_access_context(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_app_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_member_onboarding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT[],BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_member_application() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_member_application(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_member_profile(TEXT,TEXT,TEXT) TO authenticated;
