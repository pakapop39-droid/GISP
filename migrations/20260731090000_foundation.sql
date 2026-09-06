-- GISP MVP — Slice 1: organization, users, RBAC, settings, audit, files and notifications.
-- Runs as project_admin. Do not wrap this migration in BEGIN/COMMIT.

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_organization_id UUID REFERENCES public.organizations(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE')),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS
  'Application profile linked to auth.users. Passwords are never stored here.';

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX user_roles_scoped_unique
  ON public.user_roles (user_id, role_id, organization_id)
  WHERE organization_id IS NOT NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX user_roles_global_unique
  ON public.user_roles (user_id, role_id)
  WHERE organization_id IS NULL AND revoked_at IS NULL;

CREATE TABLE public.member_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.company_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  company_name TEXT NOT NULL DEFAULT 'Global Interior Supply Platform',
  company_legal_name TEXT,
  tax_id TEXT,
  address TEXT,
  default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 7.00
    CHECK (default_vat_rate >= 0 AND default_vat_rate <= 100),
  default_quote_valid_days INTEGER NOT NULL DEFAULT 30
    CHECK (default_quote_valid_days BETWEEN 1 AND 365),
  default_deposit_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00
    CHECK (default_deposit_percent = 50.00),
  default_balance_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00
    CHECK (default_balance_percent = 50.00),
  reply_to_email TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.company_settings (singleton) VALUES (TRUE);

CREATE TABLE public.document_sequences (
  document_type TEXT NOT NULL,
  sequence_year INTEGER NOT NULL,
  current_value BIGINT NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_type, sequence_year)
);

CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  actor_user_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  request_id TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  url TEXT,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  visibility TEXT NOT NULL
    CHECK (visibility IN ('PUBLIC', 'MEMBER_PRIVATE', 'CONFIDENTIAL')),
  entity_type TEXT,
  entity_id UUID,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bucket, object_key)
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL')),
  recipient TEXT NOT NULL,
  subject TEXT,
  html_body TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_message_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  assigned_to UUID REFERENCES public.users(id),
  assigned_role_code TEXT,
  due_at TIMESTAMPTZ,
  action_required TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CHECK (assigned_to IS NOT NULL OR assigned_role_code IS NOT NULL)
);

CREATE INDEX users_primary_org_idx ON public.users(primary_organization_id);
CREATE INDEX user_roles_user_idx ON public.user_roles(user_id) WHERE revoked_at IS NULL;
CREATE INDEX user_roles_org_idx ON public.user_roles(organization_id) WHERE revoked_at IS NULL;
CREATE INDEX member_applications_status_idx ON public.member_applications(status, submitted_at);
CREATE INDEX audit_events_entity_idx ON public.audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX audit_events_org_idx ON public.audit_events(organization_id, created_at DESC);
CREATE INDEX file_metadata_org_idx ON public.file_metadata(organization_id, entity_type, entity_id);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, read_at, created_at DESC);
CREATE INDEX notification_jobs_retry_idx ON public.notification_jobs(status, next_attempt_at);
CREATE INDEX assignments_user_idx ON public.assignments(assigned_to, status, due_at);
CREATE INDEX assignments_entity_idx ON public.assignments(entity_type, entity_id);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER member_applications_updated_at
  BEFORE UPDATE ON public.member_applications
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

INSERT INTO public.roles (code, name, description) VALUES
  ('SUPER_ADMIN', 'Super Admin', 'สิทธิ์ทั้งหมดของระบบ'),
  ('SYSTEM_ADMIN', 'System Admin', 'ผู้ดูแลระบบและการตั้งค่า'),
  ('MEMBER_ADMIN', 'Member Admin', 'ผู้ดูแลบริษัทสมาชิก'),
  ('MEMBER', 'Member', 'สมาชิกที่ได้รับอนุมัติ'),
  ('PRODUCT_ADMIN', 'Product Admin', 'จัดการสินค้าและโรงงาน'),
  ('PURCHASING', 'Purchasing', 'จัดซื้อและ Supplier Order'),
  ('FINANCE', 'Finance', 'ตรวจรับและจ่ายเงิน'),
  ('QC', 'QC', 'ตรวจคุณภาพสินค้า'),
  ('LOGISTICS', 'Logistics', 'คลัง ขนส่ง และส่งมอบ'),
  ('CLAIM_ADMIN', 'Claim Admin', 'จัดการเคลม'),
  ('EXECUTIVE', 'Executive', 'อ่าน Executive Summary');

INSERT INTO public.permissions (code, name) VALUES
  ('members.read', 'ดูสมาชิก'),
  ('members.approve', 'อนุมัติสมาชิก'),
  ('members.roles.manage', 'กำหนดบทบาท'),
  ('settings.read', 'ดูการตั้งค่า'),
  ('settings.manage', 'แก้การตั้งค่า'),
  ('catalog.read', 'ดู Catalog ภายใน'),
  ('catalog.manage', 'จัดการ Catalog'),
  ('projects.read.all', 'ดูทุก Project'),
  ('rfq.manage', 'จัดการ RFQ'),
  ('quotations.manage', 'จัดการ Quotation'),
  ('orders.manage', 'จัดการ Order'),
  ('payments.verify', 'ตรวจรับเงินลูกค้า'),
  ('supplier_payments.manage', 'จัดการเงินโรงงาน'),
  ('production.manage', 'จัดการการผลิต'),
  ('qc.manage', 'จัดการ QC'),
  ('shipments.manage', 'จัดการ Shipment'),
  ('deliveries.manage', 'จัดการ Delivery'),
  ('claims.manage', 'จัดการ Claim'),
  ('reports.executive.read', 'ดู Executive Summary'),
  ('audit.read', 'ดู Audit'),
  ('files.confidential.read', 'ดูไฟล์ Confidential'),
  ('files.confidential.manage', 'จัดการไฟล์ Confidential');

-- Super Admin receives every permission.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'SUPER_ADMIN';

-- Operational role grants.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON
  (r.code = 'SYSTEM_ADMIN' AND p.code IN (
    'members.read', 'members.approve', 'members.roles.manage',
    'settings.read', 'settings.manage', 'audit.read',
    'files.confidential.read', 'files.confidential.manage'
  ))
  OR (r.code = 'PRODUCT_ADMIN' AND p.code IN ('catalog.read', 'catalog.manage'))
  OR (r.code = 'PURCHASING' AND p.code IN (
    'catalog.read', 'rfq.manage', 'quotations.manage', 'orders.manage',
    'supplier_payments.manage', 'production.manage'
  ))
  OR (r.code = 'FINANCE' AND p.code IN (
    'members.read', 'payments.verify', 'supplier_payments.manage',
    'reports.executive.read', 'audit.read', 'files.confidential.read'
  ))
  OR (r.code = 'QC' AND p.code IN ('production.manage', 'qc.manage'))
  OR (r.code = 'LOGISTICS' AND p.code IN (
    'shipments.manage', 'deliveries.manage'
  ))
  OR (r.code = 'CLAIM_ADMIN' AND p.code = 'claims.manage')
  OR (r.code = 'EXECUTIVE' AND p.code IN (
    'reports.executive.read', 'settings.read'
  ));

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT u.primary_organization_id
  FROM public.users u
  WHERE u.id = (SELECT auth.uid())
    AND u.status = 'ACTIVE'
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_internal()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.revoked_at IS NULL
      AND ur.organization_id IS NULL
      AND u.status = 'ACTIVE'
      AND r.code IN (
        'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PRODUCT_ADMIN', 'PURCHASING',
        'FINANCE', 'QC', 'LOGISTICS', 'CLAIM_ADMIN', 'EXECUTIVE'
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(
  permission_code TEXT,
  target_organization_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.revoked_at IS NULL
      AND u.status = 'ACTIVE'
      AND p.code = permission_code
      AND (
        ur.organization_id IS NULL
        OR target_organization_id IS NULL
        OR ur.organization_id = target_organization_id
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_org(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    public.current_user_is_internal()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.organizations o ON o.id = u.primary_organization_id
      WHERE u.id = (SELECT auth.uid())
        AND u.status = 'ACTIVE'
        AND o.status = 'ACTIVE'
        AND u.primary_organization_id = target_organization_id
    )
$$;

CREATE OR REPLACE FUNCTION public.write_audit_event(
  target_organization_id UUID,
  target_entity_type TEXT,
  target_entity_id UUID,
  target_action TEXT,
  target_before_data JSONB DEFAULT NULL,
  target_after_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, action,
    before_data, after_data
  )
  VALUES (
    target_organization_id, (SELECT auth.uid()), target_entity_type,
    target_entity_id, target_action, target_before_data, target_after_data
  )
  RETURNING id INTO audit_id;
  RETURN audit_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_document_number(target_document_type TEXT)
RETURNS TEXT
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  next_value BIGINT;
BEGIN
  IF target_document_type NOT IN ('QT', 'ORD', 'PO', 'SHP', 'CLM', 'PAY') THEN
    RAISE EXCEPTION 'unsupported document type: %', target_document_type;
  END IF;

  INSERT INTO public.document_sequences (
    document_type, sequence_year, current_value
  )
  VALUES (target_document_type, target_year, 1)
  ON CONFLICT (document_type, sequence_year)
  DO UPDATE SET
    current_value = public.document_sequences.current_value + 1,
    updated_at = NOW()
  RETURNING current_value INTO next_value;

  RETURN target_document_type || '-' || target_year || '-' ||
    LPAD(next_value::TEXT, 6, '0');
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

CREATE OR REPLACE FUNCTION public.approve_member_application(
  application_id_input UUID,
  review_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  application_record public.member_applications%ROWTYPE;
BEGIN
  IF NOT public.has_permission('members.approve') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT * INTO application_record
  FROM public.member_applications
  WHERE id = application_id_input
  FOR UPDATE;

  IF NOT FOUND OR application_record.status NOT IN ('PENDING', 'UNDER_REVIEW') THEN
    RAISE EXCEPTION 'application is not approvable';
  END IF;

  UPDATE public.member_applications
  SET status = 'APPROVED',
      reviewed_at = NOW(),
      reviewed_by = (SELECT auth.uid()),
      review_note = review_note_input
  WHERE id = application_id_input;

  UPDATE public.organizations
  SET status = 'ACTIVE', approved_at = NOW()
  WHERE id = application_record.organization_id;

  UPDATE public.users
  SET status = 'ACTIVE'
  WHERE id = application_record.user_id;

  PERFORM public.write_audit_event(
    application_record.organization_id, 'member_application',
    application_id_input, 'APPROVED',
    jsonb_build_object('status', application_record.status),
    jsonb_build_object('status', 'APPROVED', 'review_note', review_note_input)
  );
  RETURN application_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_initial_super_admin(
  full_name_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  internal_org_id UUID;
  super_role_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  PERFORM pg_advisory_xact_lock(71883491);
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE r.code = 'SUPER_ADMIN' AND ur.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'initial super admin has already been claimed';
  END IF;

  SELECT id INTO internal_org_id
  FROM public.organizations
  WHERE code = 'GISP'
  LIMIT 1;

  IF internal_org_id IS NULL THEN
    INSERT INTO public.organizations (
      code, name, status, approved_at
    )
    VALUES ('GISP', 'Global Interior Supply Platform', 'ACTIVE', NOW())
    RETURNING id INTO internal_org_id;
  END IF;

  INSERT INTO public.users (
    id, primary_organization_id, full_name, status
  )
  VALUES (current_user_id, internal_org_id, full_name_input, 'ACTIVE')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    primary_organization_id = internal_org_id,
    status = 'ACTIVE';

  SELECT id INTO super_role_id FROM public.roles WHERE code = 'SUPER_ADMIN';
  INSERT INTO public.user_roles (
    user_id, role_id, organization_id, assigned_by
  )
  VALUES (current_user_id, super_role_id, NULL, current_user_id);

  PERFORM public.write_audit_event(
    internal_org_id, 'user', current_user_id, 'INITIAL_SUPER_ADMIN_CLAIMED'
  );
  RETURN current_user_id;
END;
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated
  USING (public.can_access_org(id));

CREATE POLICY organizations_manage ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_permission('settings.manage', id))
  WITH CHECK (public.has_permission('settings.manage', id));

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.has_permission('members.read', primary_organization_id)
  );

CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY roles_read ON public.roles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY permissions_read ON public.permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_permission('members.roles.manage', organization_id)
  );

CREATE POLICY member_applications_select ON public.member_applications
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_permission('members.read', organization_id)
  );

CREATE POLICY company_settings_select ON public.company_settings
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY company_settings_update ON public.company_settings
  FOR UPDATE TO authenticated
  USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

CREATE POLICY audit_events_select_internal ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.has_permission('audit.read', organization_id));

CREATE POLICY file_metadata_select ON public.file_metadata
  FOR SELECT TO authenticated
  USING (
    visibility = 'PUBLIC'
    OR (
      visibility = 'MEMBER_PRIVATE'
      AND organization_id IS NOT NULL
      AND public.can_access_org(organization_id)
    )
    OR (
      visibility = 'CONFIDENTIAL'
      AND public.has_permission('files.confidential.read', organization_id)
    )
  );

CREATE POLICY file_metadata_insert ON public.file_metadata
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND (
      (visibility IN ('PUBLIC', 'MEMBER_PRIVATE')
        AND organization_id IS NOT NULL
        AND public.can_access_org(organization_id))
      OR (
        visibility = 'CONFIDENTIAL'
        AND public.has_permission('files.confidential.manage', organization_id)
      )
    )
  );

CREATE POLICY file_metadata_update ON public.file_metadata
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR public.has_permission('files.confidential.manage', organization_id)
  )
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    OR public.has_permission('files.confidential.manage', organization_id)
  );

CREATE POLICY file_metadata_delete ON public.file_metadata
  FOR DELETE TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR public.has_permission('files.confidential.manage', organization_id)
  );

CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY notification_jobs_internal ON public.notification_jobs
  FOR SELECT TO authenticated
  USING (public.current_user_is_internal());

CREATE POLICY assignments_select ON public.assignments
  FOR SELECT TO authenticated
  USING (
    assigned_to = (SELECT auth.uid())
    OR public.current_user_is_internal()
    OR (
      organization_id IS NOT NULL
      AND public.can_access_org(organization_id)
    )
  );

REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_is_internal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_permission(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_access_org(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.write_audit_event(UUID, TEXT, UUID, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_document_number(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_member_profile(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_member_application(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_initial_super_admin(TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.organizations, public.users, public.roles,
  public.permissions, public.role_permissions, public.user_roles,
  public.member_applications, public.company_settings,
  public.document_sequences, public.audit_events, public.file_metadata,
  public.notifications, public.notification_jobs, public.assignments
  FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.organizations, public.users, public.roles,
  public.permissions, public.role_permissions, public.user_roles,
  public.member_applications, public.company_settings, public.audit_events,
  public.file_metadata, public.notifications, public.notification_jobs,
  public.assignments TO authenticated;

GRANT UPDATE (full_name, phone, last_seen_at) ON public.users TO authenticated;
GRANT UPDATE ON public.organizations, public.company_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.file_metadata TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

REVOKE UPDATE, DELETE ON public.audit_events FROM authenticated;
REVOKE ALL ON public.document_sequences FROM authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_internal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_member_profile(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_member_application(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_initial_super_admin(TEXT) TO authenticated;
