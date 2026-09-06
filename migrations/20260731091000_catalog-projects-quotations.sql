-- GISP MVP — Slices 2-5: catalog, projects, custom RFQ and GISP quotation.

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  legal_name TEXT,
  country_code CHAR(2) NOT NULL DEFAULT 'CN',
  default_currency CHAR(3) NOT NULL DEFAULT 'CNY',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  internal_note TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PROSPECT', 'ACTIVE', 'SUSPENDED', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.categories(id),
  code TEXT NOT NULL UNIQUE,
  name_th TEXT NOT NULL,
  name_en TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  category_id UUID REFERENCES public.categories(id),
  sku TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL DEFAULT 'STANDARD'
    CHECK (product_type IN ('STANDARD', 'CUSTOM_TEMPLATE')),
  name_th TEXT NOT NULL,
  name_en TEXT,
  description_th TEXT,
  specification_summary TEXT,
  default_lead_time_days INTEGER CHECK (default_lead_time_days > 0),
  factory_cost NUMERIC(18,2) CHECK (factory_cost IS NULL OR factory_cost >= 0),
  factory_currency CHAR(3) NOT NULL DEFAULT 'CNY',
  internal_note TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'REVIEW', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED')),
  published_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  specification_summary TEXT,
  factory_cost NUMERIC(18,2) CHECK (factory_cost IS NULL OR factory_cost >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.product_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  member_price_delta NUMERIC(18,2) NOT NULL DEFAULT 0,
  factory_cost_delta NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  price_type TEXT NOT NULL DEFAULT 'MEMBER'
    CHECK (price_type = 'MEMBER'),
  amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE UNIQUE INDEX product_prices_active_base_unique
  ON public.product_prices(product_id)
  WHERE variant_id IS NULL AND status = 'ACTIVE';

CREATE UNIQUE INDEX product_prices_active_variant_unique
  ON public.product_prices(product_id, variant_id)
  WHERE variant_id IS NOT NULL AND status = 'ACTIVE';

CREATE TABLE public.product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO', 'DOCUMENT')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.end_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  end_customer_id UUID REFERENCES public.end_customers(id),
  project_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  site_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.project_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  area_id UUID REFERENCES public.project_areas(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quotation_item_id UUID,
  item_type TEXT NOT NULL CHECK (item_type IN ('STANDARD', 'CUSTOM')),
  item_name TEXT NOT NULL,
  specification_snapshot TEXT,
  selected_options JSONB NOT NULL DEFAULT '[]'::JSONB,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'EA',
  current_price_id UUID REFERENCES public.product_prices(id),
  current_unit_price NUMERIC(18,2) NOT NULL CHECK (current_unit_price >= 0),
  vat_rate_snapshot NUMERIC(5,2) NOT NULL DEFAULT 7.00
    CHECK (vat_rate_snapshot >= 0 AND vat_rate_snapshot <= 100),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'NEEDS_RFQ', 'WAITING_QUOTATION', 'READY_TO_ORDER',
      'PARTIALLY_ORDERED', 'ORDERED', 'CANCELLED'
    )),
  ordered_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (ordered_quantity >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ordered_quantity <= quantity)
);

CREATE TABLE public.custom_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  request_number TEXT NOT NULL UNIQUE,
  item_name TEXT NOT NULL,
  specification TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'EA',
  selected_supplier_id UUID REFERENCES public.suppliers(id),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEED_INFO',
      'READY_FOR_QUOTE', 'QUOTED', 'CLOSED', 'CANCELLED'
    )),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.custom_request_files (
  custom_request_id UUID NOT NULL REFERENCES public.custom_requests(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (custom_request_id, file_id)
);

CREATE TABLE public.custom_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  custom_request_id UUID NOT NULL REFERENCES public.custom_requests(id),
  quotation_number TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED',
      'CANCELLED', 'SUPERSEDED'
    )),
  revision_of_id UUID REFERENCES public.custom_quotations(id),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  subtotal NUMERIC(18,2) NOT NULL CHECK (subtotal >= 0),
  vat_rate NUMERIC(5,2) NOT NULL CHECK (vat_rate >= 0 AND vat_rate <= 100),
  vat_amount NUMERIC(18,2) NOT NULL CHECK (vat_amount >= 0),
  grand_total NUMERIC(18,2) NOT NULL CHECK (grand_total >= 0),
  lead_time_days INTEGER NOT NULL CHECK (lead_time_days > 0),
  confirmed_specification TEXT NOT NULL,
  valid_until DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (custom_request_id, version),
  UNIQUE (quotation_number, version)
);

CREATE UNIQUE INDEX custom_quotations_one_active
  ON public.custom_quotations(custom_request_id)
  WHERE status IN ('DRAFT', 'SENT', 'ACCEPTED');

CREATE TABLE public.custom_quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.custom_quotations(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  item_name TEXT NOT NULL,
  specification_snapshot TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'EA',
  unit_price NUMERIC(18,2) NOT NULL CHECK (unit_price >= 0),
  line_subtotal NUMERIC(18,2) NOT NULL CHECK (line_subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quotation_id, line_number)
);

CREATE TABLE public.custom_quotation_costs (
  quotation_id UUID PRIMARY KEY
    REFERENCES public.custom_quotations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  supplier_cost_total NUMERIC(18,2) NOT NULL CHECK (supplier_cost_total > 0),
  supplier_currency CHAR(3) NOT NULL DEFAULT 'CNY',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_items
  ADD CONSTRAINT project_items_quotation_item_fk
  FOREIGN KEY (quotation_item_id)
  REFERENCES public.custom_quotation_items(id);

CREATE INDEX products_supplier_idx ON public.products(supplier_id, status);
CREATE INDEX products_category_idx ON public.products(category_id, status);
CREATE INDEX product_variants_product_idx ON public.product_variants(product_id);
CREATE INDEX product_prices_lookup_idx ON public.product_prices(product_id, variant_id, status, valid_from, valid_until);
CREATE INDEX projects_org_idx ON public.projects(organization_id, status, updated_at DESC);
CREATE INDEX project_items_project_idx ON public.project_items(project_id, status);
CREATE INDEX project_items_org_idx ON public.project_items(organization_id);
CREATE INDEX custom_requests_org_idx ON public.custom_requests(organization_id, status, created_at DESC);
CREATE INDEX custom_requests_project_idx ON public.custom_requests(project_id);
CREATE INDEX custom_quotations_org_idx ON public.custom_quotations(organization_id, status, created_at DESC);
CREATE INDEX custom_quotations_request_idx ON public.custom_quotations(custom_request_id, version DESC);

CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER end_customers_updated_at BEFORE UPDATE ON public.end_customers
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER project_items_updated_at BEFORE UPDATE ON public.project_items
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER custom_requests_updated_at BEFORE UPDATE ON public.custom_requests
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER custom_quotations_updated_at BEFORE UPDATE ON public.custom_quotations
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE OR REPLACE FUNCTION public.guard_custom_quotation_update()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  IF OLD.status = 'ACCEPTED' THEN
    RAISE EXCEPTION 'accepted quotation is immutable';
  END IF;

  IF NEW.custom_request_id IS DISTINCT FROM OLD.custom_request_id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.quotation_number IS DISTINCT FROM OLD.quotation_number
    OR NEW.version IS DISTINCT FROM OLD.version THEN
    RAISE EXCEPTION 'quotation identity fields are immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'DRAFT' AND NEW.status IN ('SENT', 'CANCELLED', 'SUPERSEDED'))
    OR (OLD.status = 'SENT' AND NEW.status IN (
      'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'
    ))
    OR (OLD.status IN ('REJECTED', 'EXPIRED', 'CANCELLED')
      AND NEW.status = 'SUPERSEDED')
  ) THEN
    RAISE EXCEPTION 'invalid quotation transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER custom_quotations_guard
  BEFORE UPDATE ON public.custom_quotations
  FOR EACH ROW EXECUTE FUNCTION public.guard_custom_quotation_update();

CREATE OR REPLACE FUNCTION public.create_project(
  name_input TEXT,
  end_customer_name_input TEXT,
  site_address_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_org_id UUID := public.current_user_org_id();
  customer_id UUID;
  new_project_id UUID;
  project_number_value TEXT;
BEGIN
  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'approved member required';
  END IF;
  IF NULLIF(BTRIM(name_input), '') IS NULL
    OR NULLIF(BTRIM(end_customer_name_input), '') IS NULL
    OR NULLIF(BTRIM(site_address_input), '') IS NULL THEN
    RAISE EXCEPTION 'project fields are required';
  END IF;

  project_number_value :=
    'PRJ-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));

  INSERT INTO public.end_customers (
    organization_id, name, created_by
  )
  VALUES (current_org_id, BTRIM(end_customer_name_input), (SELECT auth.uid()))
  RETURNING id INTO customer_id;

  INSERT INTO public.projects (
    organization_id, end_customer_id, project_number, name,
    site_address, status, created_by
  )
  VALUES (
    current_org_id, customer_id, project_number_value, BTRIM(name_input),
    BTRIM(site_address_input), 'ACTIVE', (SELECT auth.uid())
  )
  RETURNING id INTO new_project_id;

  PERFORM public.write_audit_event(
    current_org_id, 'project', new_project_id, 'CREATED',
    NULL, jsonb_build_object('project_number', project_number_value)
  );
  RETURN new_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_product_draft(
  sku_input TEXT,
  name_th_input TEXT,
  supplier_id_input UUID,
  member_price_input NUMERIC
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  product_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF member_price_input < 0 THEN
    RAISE EXCEPTION 'member price must be non-negative';
  END IF;

  INSERT INTO public.products (
    supplier_id, sku, name_th, status, created_by
  )
  VALUES (
    supplier_id_input, UPPER(BTRIM(sku_input)), BTRIM(name_th_input),
    'DRAFT', (SELECT auth.uid())
  )
  RETURNING id INTO product_id_value;

  INSERT INTO public.product_prices (
    product_id, amount, created_by
  )
  VALUES (
    product_id_value, ROUND(member_price_input, 2), (SELECT auth.uid())
  );

  PERFORM public.write_audit_event(
    NULL, 'product', product_id_value, 'DRAFT_CREATED',
    NULL, jsonb_build_object('sku', UPPER(BTRIM(sku_input)))
  );
  RETURN product_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_product(product_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_prices pp ON pp.product_id = p.id
    WHERE p.id = product_id_input
      AND pp.status = 'ACTIVE'
      AND pp.valid_from <= NOW()
      AND (pp.valid_until IS NULL OR pp.valid_until > NOW())
  ) THEN
    RAISE EXCEPTION 'active member price is required';
  END IF;

  UPDATE public.products
  SET status = 'PUBLISHED', published_at = NOW()
  WHERE id = product_id_input AND status IN ('DRAFT', 'REVIEW', 'SUSPENDED');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product is not publishable';
  END IF;

  PERFORM public.write_audit_event(
    NULL, 'product', product_id_input, 'PUBLISHED'
  );
  RETURN product_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_standard_project_item(
  project_id_input UUID,
  product_id_input UUID,
  quantity_input NUMERIC
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  product_record public.products%ROWTYPE;
  price_record public.product_prices%ROWTYPE;
  item_id_value UUID;
  vat_rate_value NUMERIC(5,2);
BEGIN
  SELECT * INTO project_record
  FROM public.projects
  WHERE id = project_id_input AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF quantity_input <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;

  SELECT * INTO product_record
  FROM public.products
  WHERE id = product_id_input
    AND product_type = 'STANDARD'
    AND status = 'PUBLISHED';
  IF NOT FOUND THEN RAISE EXCEPTION 'published standard product not found'; END IF;

  SELECT * INTO price_record
  FROM public.product_prices
  WHERE product_id = product_id_input
    AND variant_id IS NULL
    AND status = 'ACTIVE'
    AND valid_from <= NOW()
    AND (valid_until IS NULL OR valid_until > NOW())
  ORDER BY valid_from DESC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'active member price not found'; END IF;
  SELECT default_vat_rate INTO vat_rate_value
  FROM public.company_settings WHERE singleton = TRUE;

  INSERT INTO public.project_items (
    project_id, organization_id, product_id, item_type, item_name,
    specification_snapshot, quantity, current_price_id, current_unit_price,
    vat_rate_snapshot, status, created_by
  )
  VALUES (
    project_record.id, project_record.organization_id, product_record.id,
    'STANDARD', product_record.name_th, product_record.specification_summary,
    quantity_input, price_record.id, price_record.amount,
    vat_rate_value, 'READY_TO_ORDER', (SELECT auth.uid())
  )
  RETURNING id INTO item_id_value;

  PERFORM public.write_audit_event(
    project_record.organization_id, 'project_item', item_id_value,
    'STANDARD_READY_TO_ORDER'
  );
  RETURN item_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_custom_request(
  project_id_input UUID,
  item_name_input TEXT,
  specification_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  request_id_value UUID;
  request_number_value TEXT;
BEGIN
  SELECT * INTO project_record
  FROM public.projects
  WHERE id = project_id_input AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;

  request_number_value :=
    'RFQ-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));

  INSERT INTO public.custom_requests (
    organization_id, project_id, request_number, item_name,
    specification, status, submitted_by, submitted_at
  )
  VALUES (
    project_record.organization_id, project_record.id, request_number_value,
    BTRIM(item_name_input), BTRIM(specification_input), 'SUBMITTED',
    (SELECT auth.uid()), NOW()
  )
  RETURNING id INTO request_id_value;

  PERFORM public.write_audit_event(
    project_record.organization_id, 'custom_request', request_id_value,
    'SUBMITTED', NULL, jsonb_build_object('request_number', request_number_value)
  );
  RETURN request_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_custom_quotation(
  custom_request_id_input UUID,
  subtotal_input NUMERIC,
  lead_time_days_input INTEGER,
  valid_days_input INTEGER DEFAULT NULL,
  supplier_id_input UUID DEFAULT NULL,
  supplier_cost_total_input NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  quote_id_value UUID;
  previous_quote_id UUID;
  next_version INTEGER;
  quote_number_value TEXT;
  vat_rate_value NUMERIC(5,2);
  vat_amount_value NUMERIC(18,2);
  grand_total_value NUMERIC(18,2);
  validity_days INTEGER;
BEGIN
  IF NOT public.has_permission('quotations.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF subtotal_input < 0 OR lead_time_days_input <= 0
    OR supplier_id_input IS NULL
    OR supplier_cost_total_input IS NULL
    OR supplier_cost_total_input <= 0 THEN
    RAISE EXCEPTION 'invalid quotation values';
  END IF;

  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = custom_request_id_input
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'custom request not found'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.custom_quotations
    WHERE custom_request_id = custom_request_id_input AND status = 'ACCEPTED'
  ) THEN
    RAISE EXCEPTION 'accepted quotation cannot be revised';
  END IF;

  SELECT id INTO previous_quote_id
  FROM public.custom_quotations
  WHERE custom_request_id = custom_request_id_input
    AND status IN ('DRAFT', 'SENT', 'REJECTED', 'EXPIRED', 'CANCELLED')
  ORDER BY version DESC
  LIMIT 1
  FOR UPDATE;

  IF previous_quote_id IS NOT NULL THEN
    UPDATE public.custom_quotations
    SET status = 'SUPERSEDED'
    WHERE id = previous_quote_id;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.custom_quotations
  WHERE custom_request_id = custom_request_id_input;

  quote_number_value := public.next_document_number('QT');
  SELECT default_vat_rate,
         COALESCE(valid_days_input, default_quote_valid_days)
  INTO vat_rate_value, validity_days
  FROM public.company_settings
  WHERE singleton = TRUE;

  vat_amount_value := ROUND(ROUND(subtotal_input, 2) * vat_rate_value / 100, 2);
  grand_total_value := ROUND(ROUND(subtotal_input, 2) + vat_amount_value, 2);

  INSERT INTO public.custom_quotations (
    organization_id, custom_request_id, quotation_number, version,
    revision_of_id, subtotal, vat_rate, vat_amount, grand_total,
    lead_time_days, confirmed_specification, valid_until, created_by
  )
  VALUES (
    request_record.organization_id, request_record.id, quote_number_value,
    next_version, previous_quote_id, ROUND(subtotal_input, 2), vat_rate_value,
    vat_amount_value, grand_total_value, lead_time_days_input,
    request_record.specification, CURRENT_DATE + validity_days,
    (SELECT auth.uid())
  )
  RETURNING id INTO quote_id_value;

  INSERT INTO public.custom_quotation_items (
    quotation_id, line_number, item_name, specification_snapshot,
    quantity, unit, unit_price, line_subtotal
  )
  VALUES (
    quote_id_value, 1, request_record.item_name, request_record.specification,
    request_record.quantity, request_record.unit,
    ROUND(subtotal_input / request_record.quantity, 2), ROUND(subtotal_input, 2)
  );

  INSERT INTO public.custom_quotation_costs (
    quotation_id, supplier_id, supplier_cost_total, created_by
  )
  VALUES (
    quote_id_value, supplier_id_input, ROUND(supplier_cost_total_input, 2),
    (SELECT auth.uid())
  );

  UPDATE public.custom_requests
  SET status = 'READY_FOR_QUOTE', selected_supplier_id = supplier_id_input
  WHERE id = request_record.id
    AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEED_INFO', 'READY_FOR_QUOTE', 'QUOTED');

  PERFORM public.write_audit_event(
    request_record.organization_id, 'custom_quotation', quote_id_value,
    'DRAFT_CREATED', NULL,
    jsonb_build_object(
      'quotation_number', quote_number_value,
      'version', next_version,
      'vat_rate', vat_rate_value
    )
  );
  RETURN quote_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_custom_quotation(
  quotation_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quote_record public.custom_quotations%ROWTYPE;
BEGIN
  IF NOT public.has_permission('quotations.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  SELECT * INTO quote_record
  FROM public.custom_quotations
  WHERE id = quotation_id_input
  FOR UPDATE;
  IF NOT FOUND OR quote_record.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'quotation is not sendable';
  END IF;

  UPDATE public.custom_quotations
  SET status = 'SENT', sent_at = NOW()
  WHERE id = quotation_id_input;
  UPDATE public.custom_requests
  SET status = 'QUOTED'
  WHERE id = quote_record.custom_request_id;

  PERFORM public.write_audit_event(
    quote_record.organization_id, 'custom_quotation', quotation_id_input, 'SENT'
  );
  RETURN quotation_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_custom_quotation(
  quotation_id_input UUID,
  response_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quote_record public.custom_quotations%ROWTYPE;
  request_record public.custom_requests%ROWTYPE;
  item_record public.custom_quotation_items%ROWTYPE;
  project_item_id_value UUID;
BEGIN
  IF response_input NOT IN ('ACCEPTED', 'REJECTED') THEN
    RAISE EXCEPTION 'response must be ACCEPTED or REJECTED';
  END IF;

  SELECT * INTO quote_record
  FROM public.custom_quotations
  WHERE id = quotation_id_input
  FOR UPDATE;
  IF NOT FOUND
    OR quote_record.status <> 'SENT'
    OR NOT public.can_access_org(quote_record.organization_id) THEN
    RAISE EXCEPTION 'quotation is not available';
  END IF;
  IF quote_record.valid_until < CURRENT_DATE THEN
    UPDATE public.custom_quotations
    SET status = 'EXPIRED', responded_at = NOW()
    WHERE id = quotation_id_input;
    RAISE EXCEPTION 'quotation has expired';
  END IF;

  UPDATE public.custom_quotations
  SET status = response_input, responded_at = NOW()
  WHERE id = quotation_id_input;

  IF response_input = 'ACCEPTED' THEN
    SELECT * INTO request_record
    FROM public.custom_requests
    WHERE id = quote_record.custom_request_id;
    SELECT * INTO item_record
    FROM public.custom_quotation_items
    WHERE quotation_id = quotation_id_input
    ORDER BY line_number
    LIMIT 1;

    INSERT INTO public.project_items (
      project_id, organization_id, quotation_item_id, item_type, item_name,
      specification_snapshot, quantity, unit, current_unit_price,
      vat_rate_snapshot, status, created_by
    )
    VALUES (
      request_record.project_id, quote_record.organization_id, item_record.id,
      'CUSTOM', item_record.item_name, item_record.specification_snapshot,
      item_record.quantity, item_record.unit, item_record.unit_price,
      quote_record.vat_rate, 'READY_TO_ORDER', (SELECT auth.uid())
    )
    RETURNING id INTO project_item_id_value;

    UPDATE public.custom_requests
    SET status = 'CLOSED'
    WHERE id = quote_record.custom_request_id;
  END IF;

  PERFORM public.write_audit_event(
    quote_record.organization_id, 'custom_quotation', quotation_id_input,
    response_input
  );
  RETURN quotation_id_input;
END;
$$;

CREATE VIEW public.member_catalog AS
SELECT
  p.id,
  p.sku,
  p.product_type,
  p.name_th,
  p.name_en,
  p.description_th,
  p.specification_summary,
  p.default_lead_time_days,
  p.category_id,
  c.name_th AS category_name,
  pp.id AS price_id,
  pp.amount AS member_price_before_vat,
  pp.currency,
  p.published_at
FROM public.products p
LEFT JOIN public.categories c ON c.id = p.category_id
JOIN public.product_prices pp
  ON pp.product_id = p.id
 AND pp.variant_id IS NULL
 AND pp.status = 'ACTIVE'
 AND pp.valid_from <= NOW()
 AND (pp.valid_until IS NULL OR pp.valid_until > NOW())
WHERE p.status = 'PUBLISHED';

COMMENT ON VIEW public.member_catalog IS
  'Sanitized public projection. Never includes factory cost, margin, supplier contacts or internal notes.';

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.end_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_request_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_quotation_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_internal ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.has_permission('catalog.read'));
CREATE POLICY suppliers_manage ON public.suppliers
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY categories_internal ON public.categories
  FOR SELECT TO authenticated
  USING (public.has_permission('catalog.read'));
CREATE POLICY categories_manage ON public.categories
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY products_internal ON public.products
  FOR SELECT TO authenticated
  USING (public.has_permission('catalog.read'));
CREATE POLICY products_manage ON public.products
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY product_variants_internal ON public.product_variants
  FOR SELECT TO authenticated
  USING (public.has_permission('catalog.read'));
CREATE POLICY product_variants_manage ON public.product_variants
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY product_options_internal ON public.product_options
  FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));
CREATE POLICY product_options_manage ON public.product_options
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY product_option_values_internal ON public.product_option_values
  FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));
CREATE POLICY product_option_values_manage ON public.product_option_values
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY product_prices_internal ON public.product_prices
  FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));
CREATE POLICY product_prices_manage ON public.product_prices
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY product_media_internal ON public.product_media
  FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));
CREATE POLICY product_media_manage ON public.product_media
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY end_customers_org ON public.end_customers
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY end_customers_insert ON public.end_customers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_org(organization_id)
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY end_customers_update ON public.end_customers
  FOR UPDATE TO authenticated
  USING (public.can_access_org(organization_id))
  WITH CHECK (public.can_access_org(organization_id));

CREATE POLICY projects_org_select ON public.projects
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY projects_org_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_org(organization_id)
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY projects_org_update ON public.projects
  FOR UPDATE TO authenticated
  USING (public.can_access_org(organization_id))
  WITH CHECK (public.can_access_org(organization_id));

CREATE POLICY project_areas_org ON public.project_areas
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY project_areas_insert ON public.project_areas
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_org(organization_id));
CREATE POLICY project_areas_update ON public.project_areas
  FOR UPDATE TO authenticated
  USING (public.can_access_org(organization_id))
  WITH CHECK (public.can_access_org(organization_id));

CREATE POLICY project_items_org ON public.project_items
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));

CREATE POLICY custom_requests_org ON public.custom_requests
  FOR SELECT TO authenticated
  USING (
    public.can_access_org(organization_id)
    OR public.has_permission('rfq.manage', organization_id)
  );

CREATE POLICY custom_request_files_org ON public.custom_request_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_requests cr
      WHERE cr.id = custom_request_id
        AND (
          public.can_access_org(cr.organization_id)
          OR public.has_permission('rfq.manage', cr.organization_id)
        )
    )
  );

CREATE POLICY custom_quotations_org ON public.custom_quotations
  FOR SELECT TO authenticated
  USING (
    public.can_access_org(organization_id)
    OR public.has_permission('quotations.manage', organization_id)
  );

CREATE POLICY custom_quotation_items_org ON public.custom_quotation_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_quotations cq
      WHERE cq.id = quotation_id
        AND (
          public.can_access_org(cq.organization_id)
          OR public.has_permission('quotations.manage', cq.organization_id)
        )
    )
  );

CREATE POLICY custom_quotation_costs_internal ON public.custom_quotation_costs
  FOR SELECT TO authenticated
  USING (public.has_permission('quotations.manage'));

REVOKE ALL ON public.suppliers, public.categories, public.products,
  public.product_variants, public.product_options, public.product_option_values,
  public.product_prices, public.product_media, public.end_customers,
  public.projects, public.project_areas, public.project_items,
  public.custom_requests, public.custom_request_files,
  public.custom_quotations, public.custom_quotation_items,
  public.custom_quotation_costs
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers, public.categories,
  public.products, public.product_variants, public.product_options,
  public.product_option_values, public.product_prices, public.product_media
  TO authenticated;

GRANT SELECT, INSERT ON public.end_customers, public.projects,
  public.project_areas TO authenticated;
GRANT UPDATE (name, phone, email, note) ON public.end_customers TO authenticated;
GRANT UPDATE (name, site_address) ON public.projects TO authenticated;
GRANT UPDATE (name, sort_order) ON public.project_areas TO authenticated;

GRANT SELECT ON public.project_items, public.custom_requests,
  public.custom_request_files, public.custom_quotations,
  public.custom_quotation_items TO authenticated;

GRANT SELECT ON public.custom_quotation_costs TO authenticated;

GRANT SELECT ON public.member_catalog TO authenticated;

REVOKE ALL ON FUNCTION public.guard_custom_quotation_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_project(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_product_draft(TEXT, TEXT, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_product(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_standard_project_item(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_custom_request(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_custom_quotation(UUID, NUMERIC, INTEGER, INTEGER, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_custom_quotation(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.respond_custom_quotation(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_project(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_product_draft(TEXT, TEXT, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_product(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_standard_project_item(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_custom_request(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_quotation(UUID, NUMERIC, INTEGER, INTEGER, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_custom_quotation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_custom_quotation(UUID, TEXT) TO authenticated;
