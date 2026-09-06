-- GISP Slice 1 — production access, member profile ownership and security controls.
-- Runs as project_admin. InsForge wraps the migration in a transaction.

-- ---------------------------------------------------------------------------
-- 1. Account lifecycle and one-login/one-member-profile model
-- ---------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.member_applications
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ;

ALTER TABLE public.member_applications
  DROP CONSTRAINT IF EXISTS member_applications_status_check;
ALTER TABLE public.member_applications
  ADD CONSTRAINT member_applications_status_check
  CHECK (status IN ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'));

CREATE TABLE IF NOT EXISTS public.member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  company_name TEXT NOT NULL,
  company_legal_name TEXT,
  tax_id TEXT,
  business_type TEXT,
  address_line TEXT,
  district TEXT,
  province TEXT,
  postal_code TEXT,
  country_code CHAR(2) NOT NULL DEFAULT 'TH',
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  product_interests TEXT[] NOT NULL DEFAULT '{}',
  training_interest BOOLEAN NOT NULL DEFAULT FALSE,
  training_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.member_applications
  ADD COLUMN IF NOT EXISTS member_profile_id UUID UNIQUE
  REFERENCES public.member_profiles(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('TERMS', 'PRIVACY', 'MARKETING')),
  policy_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  UNIQUE (user_id, consent_type, policy_version)
);

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS app_sessions_user_active_idx
  ON public.app_sessions(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED', 'SESSION_REVOKED', 'FORCE_LOGOUT',
    'ACCESS_DENIED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_REACTIVATED'
  )),
  outcome TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED')),
  request_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_events_user_idx
  ON public.security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_type_idx
  ON public.security_events(event_type, created_at DESC);

CREATE TRIGGER member_profiles_updated_at
  BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Member-profile ownership, settings, files and number foundations
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id);
ALTER TABLE public.custom_requests ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id);
ALTER TABLE public.custom_quotations ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id);
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id);
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id);
ALTER TABLE public.file_metadata ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id);

CREATE INDEX IF NOT EXISTS projects_member_profile_idx ON public.projects(member_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS custom_requests_member_profile_idx ON public.custom_requests(member_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS custom_quotations_member_profile_idx ON public.custom_quotations(member_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_orders_member_profile_idx ON public.customer_orders(member_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS claims_member_profile_idx ON public.claims(member_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS file_metadata_member_profile_idx ON public.file_metadata(member_profile_id, created_at DESC);

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'THB',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok';

INSERT INTO public.company_settings (singleton, company_name, currency, timezone)
VALUES (TRUE, 'Global Interior Supply Platform', 'THB', 'Asia/Bangkok')
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_document_number(target_document_type TEXT)
RETURNS TEXT
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  next_value BIGINT;
  output_prefix TEXT;
BEGIN
  IF target_document_type NOT IN (
    'QT', 'ORD', 'SO', 'PO', 'INV', 'INV-DEP', 'INV-BAL', 'INV-FRT',
    'PAY', 'SHP', 'DLV', 'CLM'
  ) THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE';
  END IF;
  output_prefix := target_document_type;
  INSERT INTO public.document_sequences(document_type, sequence_year, current_value)
  VALUES (target_document_type, target_year, 1)
  ON CONFLICT (document_type, sequence_year)
  DO UPDATE SET current_value = public.document_sequences.current_value + 1,
                updated_at = NOW()
  RETURNING current_value INTO next_value;
  RETURN output_prefix || '-' || target_year || '-' || LPAD(next_value::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_record_reference(target_prefix TEXT)
RETURNS TEXT
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  next_value BIGINT;
BEGIN
  IF target_prefix NOT IN ('PRJ', 'CRQ', 'QCI', 'WRC', 'CNS') THEN
    RAISE EXCEPTION 'INVALID_RECORD_PREFIX';
  END IF;
  INSERT INTO public.document_sequences(document_type, sequence_year, current_value)
  VALUES ('REF-' || target_prefix, target_year, 1)
  ON CONFLICT (document_type, sequence_year)
  DO UPDATE SET current_value = public.document_sequences.current_value + 1,
                updated_at = NOW()
  RETURNING current_value INTO next_value;
  RETURN target_prefix || '-' || target_year || '-' || LPAD(next_value::TEXT, 6, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Fixed production role catalog and permission matrix
-- ---------------------------------------------------------------------------

UPDATE public.roles SET code = 'EXECUTIVE_VIEWER', name = 'Executive Viewer'
WHERE code = 'EXECUTIVE' AND NOT EXISTS (
  SELECT 1 FROM public.roles WHERE code = 'EXECUTIVE_VIEWER'
);
DELETE FROM public.roles WHERE code IN ('SYSTEM_ADMIN', 'CLAIM_ADMIN', 'EXECUTIVE');

INSERT INTO public.roles(code, name, description, is_system) VALUES
  ('MEMBER', 'Member', 'สมาชิกที่ได้รับอนุมัติ', TRUE),
  ('MEMBER_ADMIN', 'Member Admin', 'ดูแลการรับสมาชิกและบัญชีสมาชิก', TRUE),
  ('PRODUCT_ADMIN', 'Product Admin', 'ดูแลสินค้าและโรงงาน', TRUE),
  ('ORDER_ADMIN', 'Order Admin', 'ดูแลใบเสนอราคา ออเดอร์ และเคลม', TRUE),
  ('PURCHASING', 'Purchasing', 'ดูแลงานจัดซื้อและ Supplier Order', TRUE),
  ('FINANCE', 'Finance', 'ดูแลรับและจ่ายเงิน', TRUE),
  ('QC', 'QC', 'ดูแลการตรวจคุณภาพ', TRUE),
  ('LOGISTICS', 'Logistics', 'ดูแลคลัง ขนส่ง และส่งมอบ', TRUE),
  ('EXECUTIVE_VIEWER', 'Executive Viewer', 'อ่านรายงานผู้บริหารเท่านั้น', TRUE),
  ('SUPER_ADMIN', 'Super Admin', 'สิทธิ์สูงสุดของระบบ', TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE;

INSERT INTO public.permissions(code, name, description) VALUES
  ('members.read', 'ดูสมาชิก', 'ดูรายการและรายละเอียดคำขอสมาชิก'),
  ('members.approve', 'อนุมัติสมาชิก', 'อนุมัติหรือปฏิเสธคำขอสมาชิก'),
  ('members.suspend', 'ระงับสมาชิก', 'ระงับและเปิดใช้บัญชีสมาชิก'),
  ('members.reset_password', 'ส่งลิงก์รีเซ็ต', 'ส่งลิงก์เปลี่ยนรหัสผ่าน'),
  ('members.roles.manage', 'กำหนดบทบาท', 'กำหนดและถอดหลายบทบาท'),
  ('users.internal.create', 'สร้างผู้ใช้ภายใน', 'สร้างบัญชีผู้ใช้ภายใน'),
  ('sessions.force_logout', 'บังคับออกจากระบบ', 'ยกเลิกทุก GISP App Session'),
  ('permissions.manage', 'แก้ Permission Matrix', 'แก้สิทธิ์ของ Role คงที่'),
  ('security.read', 'ดู Security Log', 'ดูเหตุการณ์ความปลอดภัย'),
  ('files.member.manage', 'จัดการไฟล์สมัคร', 'อัปโหลดและอ่านไฟล์สมัครสมาชิก')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Schema-only branches do not copy reference rows; ensure all original permissions exist.
INSERT INTO public.permissions(code, name) VALUES
  ('settings.read', 'ดูการตั้งค่า'), ('settings.manage', 'แก้การตั้งค่า'),
  ('catalog.read', 'ดู Catalog ภายใน'), ('catalog.manage', 'จัดการ Catalog'),
  ('projects.read.all', 'ดูทุก Project'), ('rfq.manage', 'จัดการ RFQ'),
  ('quotations.manage', 'จัดการ Quotation'), ('orders.manage', 'จัดการ Order'),
  ('payments.verify', 'ตรวจรับเงินลูกค้า'), ('supplier_payments.manage', 'จัดการเงินโรงงาน'),
  ('production.manage', 'จัดการการผลิต'), ('qc.manage', 'จัดการ QC'),
  ('shipments.manage', 'จัดการ Shipment'), ('deliveries.manage', 'จัดการ Delivery'),
  ('claims.manage', 'จัดการ Claim'), ('reports.executive.read', 'ดู Executive Summary'),
  ('audit.read', 'ดู Audit'), ('files.confidential.read', 'ดูไฟล์ Confidential'),
  ('files.confidential.manage', 'จัดการไฟล์ Confidential')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

DELETE FROM public.role_permissions;

-- Super Admin has the complete matrix.
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'SUPER_ADMIN';

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r JOIN public.permissions p ON
  (r.code = 'MEMBER_ADMIN' AND p.code IN (
    'members.read','members.approve','members.suspend','members.reset_password',
    'members.roles.manage','sessions.force_logout','files.member.manage'
  )) OR
  (r.code = 'PRODUCT_ADMIN' AND p.code IN ('catalog.read','catalog.manage')) OR
  (r.code = 'ORDER_ADMIN' AND p.code IN (
    'projects.read.all','rfq.manage','quotations.manage','orders.manage','claims.manage'
  )) OR
  (r.code = 'PURCHASING' AND p.code IN (
    'catalog.read','rfq.manage','orders.manage','supplier_payments.manage','production.manage'
  )) OR
  (r.code = 'FINANCE' AND p.code IN (
    'payments.verify','supplier_payments.manage','reports.executive.read','audit.read',
    'files.confidential.read'
  )) OR
  (r.code = 'QC' AND p.code IN ('production.manage','qc.manage')) OR
  (r.code = 'LOGISTICS' AND p.code IN ('shipments.manage','deliveries.manage')) OR
  (r.code = 'EXECUTIVE_VIEWER' AND p.code IN ('reports.executive.read','settings.read'));

-- ---------------------------------------------------------------------------
-- 4. Access helpers, app session registry and safe logging
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_is_internal()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = (SELECT auth.uid()) AND ur.revoked_at IS NULL
      AND ur.organization_id IS NULL AND u.status = 'ACTIVE'
      AND r.code IN ('MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING',
        'FINANCE','QC','LOGISTICS','EXECUTIVE_VIEWER','SUPER_ADMIN')
  )
$$;

CREATE OR REPLACE FUNCTION public.current_member_profile_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT mp.id FROM public.member_profiles mp
  JOIN public.users u ON u.id = mp.user_id
  WHERE mp.user_id = (SELECT auth.uid()) AND u.status = 'ACTIVE'
$$;

CREATE OR REPLACE FUNCTION public.has_permission(permission_code TEXT, target_organization_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = (SELECT auth.uid()) AND ur.revoked_at IS NULL
      AND u.status = 'ACTIVE' AND p.code = permission_code
      AND (ur.organization_id IS NULL OR target_organization_id IS NULL OR ur.organization_id = target_organization_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.write_security_event(
  event_type_input TEXT,
  outcome_input TEXT DEFAULT 'SUCCESS',
  target_user_id_input UUID DEFAULT NULL,
  request_id_input TEXT DEFAULT NULL,
  ip_address_input TEXT DEFAULT NULL,
  user_agent_input TEXT DEFAULT NULL,
  metadata_input JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE event_id UUID;
BEGIN
  IF event_type_input NOT IN ('LOGIN_SUCCEEDED','LOGIN_FAILED','LOGOUT','PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED','SESSION_REVOKED','FORCE_LOGOUT','ACCESS_DENIED',
    'ACCOUNT_SUSPENDED','ACCOUNT_REACTIVATED') THEN
    RAISE EXCEPTION 'INVALID_SECURITY_EVENT';
  END IF;
  IF metadata_input ?| ARRAY['password','token','access_token','refresh_token','session_token','token_hash'] THEN
    RAISE EXCEPTION 'SECURITY_EVENT_CONTAINS_SECRET';
  END IF;
  INSERT INTO public.security_events(user_id, actor_user_id, event_type, outcome, request_id,
    ip_address, user_agent, metadata)
  VALUES (COALESCE(target_user_id_input, (SELECT auth.uid())), (SELECT auth.uid()),
    event_type_input, outcome_input, request_id_input, NULLIF(ip_address_input,'')::inet,
    LEFT(user_agent_input, 500), COALESCE(metadata_input, '{}'::jsonb))
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;

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
$$;

CREATE OR REPLACE FUNCTION public.touch_app_session(token_hash_input TEXT)
RETURNS BOOLEAN
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.app_sessions SET last_seen_at = NOW()
  WHERE token_hash = token_hash_input AND user_id = (SELECT auth.uid())
    AND revoked_at IS NULL AND expires_at > NOW();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_app_session(token_hash_input TEXT, reason_input TEXT DEFAULT 'SIGN_OUT')
RETURNS BOOLEAN
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.app_sessions SET revoked_at = NOW(), revoked_by = (SELECT auth.uid()), revoke_reason = reason_input
  WHERE token_hash = token_hash_input AND user_id = (SELECT auth.uid()) AND revoked_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_all_app_sessions(target_user_id_input UUID, reason_input TEXT)
RETURNS INTEGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE affected INTEGER;
BEGIN
  IF target_user_id_input <> (SELECT auth.uid()) AND NOT public.has_permission('sessions.force_logout') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  UPDATE public.app_sessions SET revoked_at = NOW(), revoked_by = (SELECT auth.uid()), revoke_reason = reason_input
  WHERE user_id = target_user_id_input AND revoked_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  PERFORM public.write_security_event('FORCE_LOGOUT', 'SUCCESS', target_user_id_input, NULL, NULL, NULL,
    jsonb_build_object('revokedSessions', affected, 'reason', LEFT(reason_input, 200)));
  RETURN affected;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Onboarding and audited lifecycle actions
-- ---------------------------------------------------------------------------

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
DECLARE app_record public.member_applications%ROWTYPE;
BEGIN
  SELECT ma.* INTO app_record FROM public.member_applications ma
  JOIN public.member_profiles mp ON mp.id = ma.member_profile_id
  WHERE mp.user_id = (SELECT auth.uid()) FOR UPDATE;
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
DECLARE app_record public.member_applications%ROWTYPE;
BEGIN
  IF NOT public.has_permission('members.approve') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO app_record FROM public.member_applications WHERE id = application_id_input FOR UPDATE;
  IF NOT FOUND OR app_record.status NOT IN ('PENDING','UNDER_REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
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

CREATE OR REPLACE FUNCTION public.reject_member_application(application_id_input UUID, reason_input TEXT)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE app_record public.member_applications%ROWTYPE;
BEGIN
  IF NOT public.has_permission('members.approve') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO app_record FROM public.member_applications WHERE id=application_id_input FOR UPDATE;
  IF NOT FOUND OR app_record.status NOT IN ('PENDING','UNDER_REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.member_applications SET status='REJECTED', reviewed_at=NOW(), reviewed_by=(SELECT auth.uid()),
    rejection_reason=BTRIM(reason_input), review_note=BTRIM(reason_input) WHERE id=application_id_input;
  PERFORM public.write_audit_event(app_record.organization_id,'member_application',application_id_input,'REJECTED',
    jsonb_build_object('status',app_record.status),jsonb_build_object('status','REJECTED','reason',BTRIM(reason_input)));
  RETURN application_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_user(target_user_id_input UUID, reason_input TEXT)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE target_record public.users%ROWTYPE;
BEGIN
  IF NOT public.has_permission('members.suspend') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO target_record FROM public.users WHERE id=target_user_id_input FOR UPDATE;
  IF NOT FOUND OR target_record.status <> 'ACTIVE' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=target_user_id_input AND ur.revoked_at IS NULL AND r.code='SUPER_ADMIN')
    AND (SELECT COUNT(DISTINCT ur.user_id) FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
      JOIN public.users u ON u.id=ur.user_id WHERE ur.revoked_at IS NULL AND r.code='SUPER_ADMIN' AND u.status='ACTIVE') <= 1
  THEN RAISE EXCEPTION 'LAST_SUPER_ADMIN_PROTECTED'; END IF;
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
DECLARE target_record public.users%ROWTYPE;
BEGIN
  IF NOT public.has_permission('members.suspend') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
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

CREATE OR REPLACE FUNCTION public.assign_production_role(target_user_id_input UUID, role_code_input TEXT)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE role_id_value UUID; assignment_id UUID;
BEGIN
  IF NOT public.has_permission('members.roles.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT id INTO role_id_value FROM public.roles WHERE code=role_code_input;
  IF role_id_value IS NULL OR role_code_input='MEMBER' THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  SELECT id INTO assignment_id FROM public.user_roles WHERE user_id=target_user_id_input AND role_id=role_id_value
    AND organization_id IS NULL AND revoked_at IS NULL;
  IF assignment_id IS NULL THEN
    INSERT INTO public.user_roles(user_id,role_id,organization_id,assigned_by)
    VALUES(target_user_id_input,role_id_value,NULL,(SELECT auth.uid())) RETURNING id INTO assignment_id;
    PERFORM public.write_audit_event(NULL,'user_role',assignment_id,'ASSIGNED',NULL,
      jsonb_build_object('userId',target_user_id_input,'role',role_code_input));
  END IF;
  RETURN assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_production_role(target_user_id_input UUID, role_code_input TEXT)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE assignment_record public.user_roles%ROWTYPE;
BEGIN
  IF NOT public.has_permission('members.roles.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT ur.* INTO assignment_record FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
  WHERE ur.user_id=target_user_id_input AND r.code=role_code_input AND ur.revoked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF role_code_input='SUPER_ADMIN' AND (SELECT COUNT(DISTINCT ur.user_id) FROM public.user_roles ur
    JOIN public.roles r ON r.id=ur.role_id JOIN public.users u ON u.id=ur.user_id
    WHERE r.code='SUPER_ADMIN' AND ur.revoked_at IS NULL AND u.status='ACTIVE') <= 1
  THEN RAISE EXCEPTION 'LAST_SUPER_ADMIN_PROTECTED'; END IF;
  UPDATE public.user_roles SET revoked_at=NOW() WHERE id=assignment_record.id;
  PERFORM public.write_audit_event(NULL,'user_role',assignment_record.id,'REVOKED',
    jsonb_build_object('userId',target_user_id_input,'role',role_code_input),NULL);
  RETURN assignment_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_role_permission(role_code_input TEXT, permission_code_input TEXT, enabled_input BOOLEAN)
RETURNS BOOLEAN
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE role_id_value UUID; permission_id_value UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    JOIN public.users u ON u.id=ur.user_id WHERE ur.user_id=(SELECT auth.uid()) AND ur.revoked_at IS NULL
      AND r.code='SUPER_ADMIN' AND u.status='ACTIVE') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF role_code_input IN ('SUPER_ADMIN','MEMBER') THEN RAISE EXCEPTION 'FIXED_ROLE_MATRIX'; END IF;
  SELECT id INTO role_id_value FROM public.roles WHERE code=role_code_input;
  SELECT id INTO permission_id_value FROM public.permissions WHERE code=permission_code_input;
  IF role_id_value IS NULL OR permission_id_value IS NULL THEN RAISE EXCEPTION 'INVALID_PERMISSION'; END IF;
  IF enabled_input THEN
    INSERT INTO public.role_permissions(role_id,permission_id) VALUES(role_id_value,permission_id_value)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.role_permissions WHERE role_id=role_id_value AND permission_id=permission_id_value;
  END IF;
  PERFORM public.write_audit_event(NULL,'role_permission',role_id_value,'MATRIX_CHANGED',NULL,
    jsonb_build_object('role',role_code_input,'permission',permission_code_input,'enabled',enabled_input));
  RETURN enabled_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_company_settings(
  company_name_input TEXT, company_legal_name_input TEXT, tax_id_input TEXT,
  address_input TEXT, company_email_input TEXT, vat_rate_input NUMERIC,
  currency_input TEXT, timezone_input TEXT
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE before_row JSONB;
BEGIN
  IF NOT public.has_permission('settings.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT to_jsonb(cs) INTO before_row FROM public.company_settings cs WHERE singleton=TRUE FOR UPDATE;
  UPDATE public.company_settings SET company_name=BTRIM(company_name_input),
    company_legal_name=NULLIF(BTRIM(company_legal_name_input),''), tax_id=NULLIF(BTRIM(tax_id_input),''),
    address=NULLIF(BTRIM(address_input),''), company_email=NULLIF(BTRIM(company_email_input),''),
    default_vat_rate=vat_rate_input, currency=UPPER(currency_input), timezone=timezone_input,
    updated_by=(SELECT auth.uid()) WHERE singleton=TRUE;
  PERFORM public.write_audit_event(NULL,'company_settings',NULL,'UPDATED',before_row,
    (SELECT to_jsonb(cs) FROM public.company_settings cs WHERE singleton=TRUE));
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.operator_bootstrap_super_admin(target_user_id_input UUID, full_name_input TEXT)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE super_role_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(71883491);
  IF EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE r.code='SUPER_ADMIN' AND ur.revoked_at IS NULL) THEN RAISE EXCEPTION 'SUPER_ADMIN_ALREADY_EXISTS'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id=target_user_id_input AND au.email_verified=TRUE) THEN
    RAISE EXCEPTION 'VERIFIED_OWNER_REQUIRED';
  END IF;
  INSERT INTO public.users(id,full_name,status,status_changed_at)
  VALUES(target_user_id_input,BTRIM(full_name_input),'ACTIVE',NOW())
  ON CONFLICT(id) DO UPDATE SET full_name=EXCLUDED.full_name,status='ACTIVE',status_reason=NULL,status_changed_at=NOW();
  SELECT id INTO super_role_id FROM public.roles WHERE code='SUPER_ADMIN';
  INSERT INTO public.user_roles(user_id,role_id,organization_id,assigned_by)
  VALUES(target_user_id_input,super_role_id,NULL,target_user_id_input) RETURNING id INTO super_role_id;
  INSERT INTO public.audit_events(actor_user_id,entity_type,entity_id,action,after_data)
  VALUES(target_user_id_input,'user_role',super_role_id,'OPERATOR_BOOTSTRAP',jsonb_build_object('role','SUPER_ADMIN'));
  RETURN target_user_id_input;
END;
$$;

-- Suspended members may retrieve only identifiers, labels and status history.
CREATE OR REPLACE FUNCTION public.get_member_history()
RETURNS TABLE(item_type TEXT, item_id UUID, reference TEXT, title TEXT, status TEXT, event_at TIMESTAMPTZ)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT history.item_type, history.item_id, history.reference, history.title,
    history.status, history.event_at
  FROM (
    SELECT 'PROJECT'::TEXT AS item_type, p.id AS item_id, p.project_number AS reference,
      p.name AS title, p.status, p.updated_at AS event_at
    FROM public.projects p JOIN public.member_profiles mp ON mp.id=p.member_profile_id
    WHERE mp.user_id=(SELECT auth.uid())
    UNION ALL
    SELECT 'ORDER'::TEXT, o.id, o.order_number, 'คำสั่งซื้อ ' || o.order_number,
      o.status, o.updated_at
    FROM public.customer_orders o JOIN public.member_profiles mp ON mp.id=o.member_profile_id
    WHERE mp.user_id=(SELECT auth.uid())
  ) history
  ORDER BY history.event_at DESC
$$;

-- ---------------------------------------------------------------------------
-- 6. Append-only guards, grants and RLS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_append_only_change()
RETURNS TRIGGER LANGUAGE PLPGSQL
SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY'; END; $$;

DROP TRIGGER IF EXISTS audit_events_append_only ON public.audit_events;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();
DROP TRIGGER IF EXISTS security_events_append_only ON public.security_events;
CREATE TRIGGER security_events_append_only BEFORE UPDATE OR DELETE ON public.security_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_profiles_select ON public.member_profiles FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) OR public.has_permission('members.read'));
CREATE POLICY member_profiles_update_self ON public.member_profiles FOR UPDATE TO authenticated
USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));

CREATE POLICY user_consents_self ON public.user_consents FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()));
CREATE POLICY user_consents_insert_self ON public.user_consents FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid()));

CREATE POLICY app_sessions_self_select ON public.app_sessions FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()));
CREATE POLICY security_events_staff_select ON public.security_events FOR SELECT TO authenticated
USING (public.has_permission('security.read'));

DROP POLICY IF EXISTS users_update_self ON public.users;
DROP POLICY IF EXISTS member_applications_select ON public.member_applications;
CREATE POLICY member_applications_select ON public.member_applications FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) OR public.has_permission('members.read'));

DROP POLICY IF EXISTS projects_org_select ON public.projects;
DROP POLICY IF EXISTS projects_org_insert ON public.projects;
DROP POLICY IF EXISTS projects_org_update ON public.projects;
CREATE POLICY projects_profile_select ON public.projects FOR SELECT TO authenticated
USING ((member_profile_id=public.current_member_profile_id() AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id=(SELECT auth.uid()) AND u.status='ACTIVE'
)) OR public.has_permission('projects.read.all'));
CREATE POLICY projects_profile_insert ON public.projects FOR INSERT TO authenticated
WITH CHECK (member_profile_id=public.current_member_profile_id());
CREATE POLICY projects_profile_update ON public.projects FOR UPDATE TO authenticated
USING (member_profile_id=public.current_member_profile_id())
WITH CHECK (member_profile_id=public.current_member_profile_id());

DROP POLICY IF EXISTS customer_orders_org ON public.customer_orders;
CREATE POLICY customer_orders_profile ON public.customer_orders FOR SELECT TO authenticated
USING ((member_profile_id=public.current_member_profile_id() AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id=(SELECT auth.uid()) AND u.status='ACTIVE'
)) OR public.has_permission('orders.manage'));

DROP POLICY IF EXISTS file_metadata_select ON public.file_metadata;
DROP POLICY IF EXISTS file_metadata_insert ON public.file_metadata;
DROP POLICY IF EXISTS file_metadata_update ON public.file_metadata;
DROP POLICY IF EXISTS file_metadata_delete ON public.file_metadata;
CREATE POLICY file_metadata_select ON public.file_metadata FOR SELECT TO authenticated
USING (member_profile_id IN (SELECT mp.id FROM public.member_profiles mp WHERE mp.user_id=(SELECT auth.uid()))
  OR public.has_permission('files.member.manage')
  OR (visibility='CONFIDENTIAL' AND public.has_permission('files.confidential.read')));

-- All file writes and signed URL creation go through the server API/admin client.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS storage_objects_owner_select ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_insert ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_update ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_delete ON storage.objects;

REVOKE INSERT, UPDATE, DELETE ON public.users, public.member_applications, public.roles,
  public.permissions, public.role_permissions, public.user_roles, public.company_settings,
  public.audit_events, public.security_events, public.app_sessions, public.file_metadata
FROM anon, authenticated;
GRANT SELECT ON public.member_profiles, public.member_applications, public.user_consents,
  public.app_sessions, public.security_events, public.roles, public.permissions,
  public.role_permissions, public.user_roles, public.company_settings, public.audit_events,
  public.file_metadata TO authenticated;
GRANT UPDATE (contact_name, contact_phone, company_name, company_legal_name, tax_id,
  business_type, address_line, district, province, postal_code, service_areas,
  product_interests, training_interest, training_note)
ON public.member_profiles TO authenticated;
GRANT INSERT ON public.user_consents TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_app_session(TEXT,TIMESTAMPTZ,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_access_context(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_app_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_app_session(TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_all_app_sessions(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_security_event(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_member_onboarding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT[],BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_member_application() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_member_application(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_member_application(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_user(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_production_role(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_production_role(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_role_permission(TEXT,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_company_settings(TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_history() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_record_reference(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.operator_bootstrap_super_admin(UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_initial_super_admin(TEXT) FROM PUBLIC, anon, authenticated;
