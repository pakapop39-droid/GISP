-- GISP Slice 2 — Product and Supplier Master foundation.
-- Additive migration for the isolated slice-2-catalog branch.

-- ---------------------------------------------------------------------------
-- 1. Fixed roles and catalog permissions (schema-only branches have no rows)
-- ---------------------------------------------------------------------------

INSERT INTO public.roles(code, name, description, is_system) VALUES
  ('MEMBER', 'Member', 'สมาชิกที่ได้รับอนุมัติ', TRUE),
  ('MEMBER_ADMIN', 'Member Admin', 'ดูแลการรับสมาชิกและบัญชีสมาชิก', TRUE),
  ('PRODUCT_ADMIN', 'Product Admin', 'ดูแลสินค้า ราคา และโรงงาน', TRUE),
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
  ('catalog.read', 'ดู Catalog ภายใน', 'ดูข้อมูล Catalog สำหรับทีมงาน'),
  ('catalog.manage', 'จัดการ Catalog', 'สร้างและแก้ Supplier/Product Master'),
  ('catalog.publish', 'Publish Catalog', 'Review และ Publish Product'),
  ('catalog.cost.read', 'ดูต้นทุนสินค้า', 'ดู Factory Cost และ Exchange Rate Snapshot'),
  ('catalog.formula.manage', 'จัดการสูตรราคา', 'Preview และ Activate Price Structure'),
  ('catalog.import', 'นำเข้า Catalog', 'Import Excel/CSV และดู Error Report'),
  ('catalog.sample.manage', 'จัดการตัวอย่างวัสดุ', 'จัดการ Material Sample และ Built-in Display'),
  ('catalog.warranty.manage', 'จัดการ Warranty', 'จัดการ Partner Warranty Version')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON
  (r.code = 'SUPER_ADMIN' AND p.code LIKE 'catalog.%') OR
  (r.code = 'PRODUCT_ADMIN' AND p.code IN (
    'catalog.read','catalog.manage','catalog.publish','catalog.cost.read',
    'catalog.import','catalog.sample.manage','catalog.warranty.manage'
  )) OR
  (r.code = 'PURCHASING' AND p.code IN (
    'catalog.read','catalog.cost.read','catalog.sample.manage'
  ))
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Supplier and taxonomy foundation
-- ---------------------------------------------------------------------------

CREATE TABLE public.countries (
  code CHAR(2) PRIMARY KEY,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER countries_updated_at
BEFORE UPDATE ON public.countries
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

INSERT INTO public.countries(code, name_th, name_en, sort_order) VALUES
  ('TH', 'ประเทศไทย', 'Thailand', 10),
  ('CN', 'ประเทศจีน', 'China', 20)
ON CONFLICT (code) DO UPDATE
SET name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en,
    sort_order = EXCLUDED.sort_order;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS default_lead_time_days INTEGER,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_default_lead_time_days_check;
ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_default_lead_time_days_check
  CHECK (default_lead_time_days IS NULL OR default_lead_time_days > 0);

CREATE TABLE public.supplier_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  country_code CHAR(2) NOT NULL REFERENCES public.countries(code),
  city TEXT NOT NULL,
  location_type TEXT NOT NULL
    CHECK (location_type IN ('FACTORY','SHOWROOM','WAREHOUSE')),
  public_label TEXT NOT NULL,
  address_line TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, public_label)
);

CREATE INDEX supplier_locations_supplier_idx
  ON public.supplier_locations(supplier_id, status);
CREATE TRIGGER supplier_locations_updated_at
BEFORE UPDATE ON public.supplier_locations
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_th TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER collections_updated_at
BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label_th TEXT NOT NULL,
  label_en TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tags_updated_at
BEFORE UPDATE ON public.tags
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS factory_sku TEXT,
  ADD COLUMN IF NOT EXISTS name_zh TEXT,
  ADD COLUMN IF NOT EXISTS country_code CHAR(2),
  ADD COLUMN IF NOT EXISTS width_mm NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS depth_mm NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS height_mm NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS cbm NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS material_summary TEXT,
  ADD COLUMN IF NOT EXISTS finish_summary TEXT,
  ADD COLUMN IF NOT EXISTS moq NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS source_catalog_page TEXT,
  ADD COLUMN IF NOT EXISTS ordering_note TEXT,
  ADD COLUMN IF NOT EXISTS qa_status TEXT NOT NULL DEFAULT 'NOT_REVIEWED',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE public.products SET country_code = COALESCE(country_code, 'CN');
ALTER TABLE public.products
  ALTER COLUMN country_code SET DEFAULT 'CN',
  ALTER COLUMN country_code SET NOT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_country_code_fkey;
ALTER TABLE public.products
  ADD CONSTRAINT products_country_code_fkey
  FOREIGN KEY (country_code) REFERENCES public.countries(code);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_type_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_product_type_check CHECK (product_type IN (
    'STANDARD','CUSTOM_TEMPLATE','READY_TO_ORDER','BUILT_IN',
    'MATERIAL','EQUIPMENT','DECORATIVE'
  ));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_qa_status_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_qa_status_check
  CHECK (qa_status IN ('NOT_REVIEWED','NEEDS_FIX','PASSED'));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_dimensions_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_dimensions_check CHECK (
    (width_mm IS NULL OR width_mm > 0) AND
    (depth_mm IS NULL OR depth_mm > 0) AND
    (height_mm IS NULL OR height_mm > 0) AND
    (weight_kg IS NULL OR weight_kg > 0) AND
    (cbm IS NULL OR cbm > 0) AND
    (moq IS NULL OR moq > 0)
  );

CREATE TABLE public.product_collections (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, collection_id)
);

CREATE INDEX product_collections_collection_idx
  ON public.product_collections(collection_id, product_id);

CREATE TABLE public.product_tags (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX product_tags_tag_idx ON public.product_tags(tag_id, product_id);

CREATE TABLE public.product_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('CATALOG','PRICE_LIST','SPECIFICATION','WARRANTY','OTHER')),
  source_page TEXT,
  is_member_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, file_id)
);

CREATE INDEX product_documents_product_idx
  ON public.product_documents(product_id, document_type);

-- ---------------------------------------------------------------------------
-- 3. Cost and versioned price structure
-- ---------------------------------------------------------------------------

CREATE TABLE public.product_cost_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  factory_cost NUMERIC(18,4) NOT NULL CHECK (factory_cost >= 0),
  currency CHAR(3) NOT NULL,
  exchange_rate_to_thb NUMERIC(18,8) NOT NULL CHECK (exchange_rate_to_thb > 0),
  factory_cost_thb NUMERIC(18,2) NOT NULL CHECK (factory_cost_thb >= 0),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE UNIQUE INDEX product_cost_active_base_unique
  ON public.product_cost_versions(product_id)
  WHERE variant_id IS NULL AND status = 'ACTIVE';
CREATE UNIQUE INDEX product_cost_active_variant_unique
  ON public.product_cost_versions(product_id, variant_id)
  WHERE variant_id IS NOT NULL AND status = 'ACTIVE';
CREATE INDEX product_cost_product_idx
  ON public.product_cost_versions(product_id, created_at DESC);

CREATE TABLE public.price_formula_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('GLOBAL','SUPPLIER','PRODUCT')),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  suggested_resale_markup_percent NUMERIC(7,4) NOT NULL DEFAULT 25
    CHECK (suggested_resale_markup_percent >= 0),
  freight_estimate_min_percent NUMERIC(7,4) NOT NULL DEFAULT 15
    CHECK (freight_estimate_min_percent >= 0),
  freight_estimate_max_percent NUMERIC(7,4) NOT NULL DEFAULT 20
    CHECK (freight_estimate_max_percent >= freight_estimate_min_percent),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  activated_by UUID REFERENCES auth.users(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (
    (scope_type = 'GLOBAL' AND supplier_id IS NULL AND product_id IS NULL) OR
    (scope_type = 'SUPPLIER' AND supplier_id IS NOT NULL AND product_id IS NULL) OR
    (scope_type = 'PRODUCT' AND supplier_id IS NULL AND product_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX price_formula_version_scope_unique
  ON public.price_formula_versions(
    scope_type,
    COALESCE(supplier_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::UUID),
    version_number
  );
CREATE UNIQUE INDEX price_formula_active_scope_unique
  ON public.price_formula_versions(
    scope_type,
    COALESCE(supplier_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) WHERE status = 'ACTIVE';
CREATE INDEX price_formula_effective_idx
  ON public.price_formula_versions(status, effective_from DESC);

CREATE TRIGGER price_formula_versions_updated_at
BEFORE UPDATE ON public.price_formula_versions
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE public.price_formula_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id UUID NOT NULL
    REFERENCES public.price_formula_versions(id) ON DELETE CASCADE,
  component_code TEXT NOT NULL,
  component_name TEXT NOT NULL,
  calculation_type TEXT NOT NULL
    CHECK (calculation_type IN ('PERCENTAGE','FIXED_AMOUNT_THB')),
  component_value NUMERIC(18,4) NOT NULL CHECK (component_value >= 0),
  included_in_member_price BOOLEAN NOT NULL DEFAULT TRUE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(formula_version_id, component_code)
);

CREATE INDEX price_formula_components_version_idx
  ON public.price_formula_components(formula_version_id, sort_order);

ALTER TABLE public.product_prices
  ADD COLUMN IF NOT EXISTS suggested_resale_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS freight_estimate_min NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS freight_estimate_max NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS formula_version_id UUID,
  ADD COLUMN IF NOT EXISTS source_cost_version_id UUID,
  ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calculation_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.product_prices
  DROP CONSTRAINT IF EXISTS product_prices_formula_version_id_fkey;
ALTER TABLE public.product_prices
  ADD CONSTRAINT product_prices_formula_version_id_fkey
  FOREIGN KEY (formula_version_id) REFERENCES public.price_formula_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.product_prices
  DROP CONSTRAINT IF EXISTS product_prices_source_cost_version_id_fkey;
ALTER TABLE public.product_prices
  ADD CONSTRAINT product_prices_source_cost_version_id_fkey
  FOREIGN KEY (source_cost_version_id) REFERENCES public.product_cost_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.product_prices
  DROP CONSTRAINT IF EXISTS product_prices_safe_amounts_check;
ALTER TABLE public.product_prices
  ADD CONSTRAINT product_prices_safe_amounts_check CHECK (
    (suggested_resale_amount IS NULL OR suggested_resale_amount >= amount) AND
    (freight_estimate_min IS NULL OR freight_estimate_min >= 0) AND
    (freight_estimate_max IS NULL OR freight_estimate_max >= COALESCE(freight_estimate_min, 0))
  );

-- ---------------------------------------------------------------------------
-- 4. Material samples and partner warranty
-- ---------------------------------------------------------------------------

CREATE TABLE public.material_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_code TEXT NOT NULL UNIQUE,
  sample_type TEXT NOT NULL
    CHECK (sample_type IN ('MATERIAL_SWATCH','BUILT_IN_DISPLAY')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  option_value_id UUID REFERENCES public.product_option_values(id) ON DELETE SET NULL,
  supplier_location_id UUID NOT NULL
    REFERENCES public.supplier_locations(id) ON DELETE RESTRICT,
  shelf_location TEXT,
  availability_status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK (availability_status IN ('AVAILABLE','BORROWED','UNAVAILABLE')),
  image_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  internal_note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (product_id IS NOT NULL OR option_value_id IS NOT NULL)
);

CREATE INDEX material_samples_location_idx
  ON public.material_samples(supplier_location_id, availability_status);
CREATE INDEX material_samples_product_idx
  ON public.material_samples(product_id) WHERE product_id IS NOT NULL;
CREATE TRIGGER material_samples_updated_at
BEFORE UPDATE ON public.material_samples
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE public.partner_warranty_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  title TEXT NOT NULL,
  member_summary TEXT NOT NULL,
  terms_text TEXT NOT NULL,
  duration_months INTEGER CHECK (duration_months IS NULL OR duration_months > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  activated_by UUID REFERENCES auth.users(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE UNIQUE INDEX partner_warranty_version_unique
  ON public.partner_warranty_versions(
    supplier_id,
    COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::UUID),
    version_number
  );
CREATE UNIQUE INDEX partner_warranty_active_unique
  ON public.partner_warranty_versions(
    supplier_id,
    COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) WHERE status = 'ACTIVE';
CREATE INDEX partner_warranty_effective_idx
  ON public.partner_warranty_versions(status, effective_from DESC);
CREATE TRIGGER partner_warranty_versions_updated_at
BEFORE UPDATE ON public.partner_warranty_versions
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Excel/CSV import staging and validation errors
-- ---------------------------------------------------------------------------

CREATE TABLE public.catalog_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL CHECK (source_type IN ('CSV','XLSX')),
  status TEXT NOT NULL DEFAULT 'UPLOADED'
    CHECK (status IN ('UPLOADED','VALIDATING','READY_FOR_REVIEW','IMPORTING','COMPLETED','FAILED')),
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows INTEGER NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  invalid_rows INTEGER NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_rows + invalid_rows <= total_rows)
);

CREATE INDEX catalog_import_jobs_status_idx
  ON public.catalog_import_jobs(status, created_at DESC);
CREATE TRIGGER catalog_import_jobs_updated_at
BEFORE UPDATE ON public.catalog_import_jobs
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE public.catalog_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.catalog_import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL CHECK (row_number > 0),
  source_data JSONB NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (validation_status IN ('PENDING','VALID','INVALID','IMPORTED')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(import_job_id, row_number)
);

CREATE INDEX catalog_import_rows_job_idx
  ON public.catalog_import_rows(import_job_id, validation_status, row_number);

CREATE TABLE public.catalog_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_row_id UUID NOT NULL REFERENCES public.catalog_import_rows(id) ON DELETE CASCADE,
  field_name TEXT,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX catalog_import_errors_row_idx
  ON public.catalog_import_errors(import_row_id, created_at);

-- ---------------------------------------------------------------------------
-- 6. RLS, grants and the member-safe projection
-- ---------------------------------------------------------------------------

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_cost_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_formula_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_formula_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_warranty_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY countries_internal_read ON public.countries
  FOR SELECT TO authenticated USING (public.current_user_is_internal());
CREATE POLICY countries_manage ON public.countries
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY supplier_locations_internal_read ON public.supplier_locations
  FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));
CREATE POLICY supplier_locations_manage ON public.supplier_locations
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY collections_internal_read ON public.collections
  FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));
CREATE POLICY collections_manage ON public.collections
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY tags_internal_read ON public.tags
  FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));
CREATE POLICY tags_manage ON public.tags
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY product_collections_internal ON public.product_collections
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.read'))
  WITH CHECK (public.has_permission('catalog.manage'));
CREATE POLICY product_tags_internal ON public.product_tags
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.read'))
  WITH CHECK (public.has_permission('catalog.manage'));
CREATE POLICY product_documents_internal ON public.product_documents
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.read'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY product_cost_versions_internal_read ON public.product_cost_versions
  FOR SELECT TO authenticated USING (public.has_permission('catalog.cost.read'));
CREATE POLICY product_cost_versions_manage ON public.product_cost_versions
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

CREATE POLICY price_formula_versions_super_admin ON public.price_formula_versions
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.formula.manage'))
  WITH CHECK (public.has_permission('catalog.formula.manage'));
CREATE POLICY price_formula_components_super_admin ON public.price_formula_components
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.formula.manage'))
  WITH CHECK (public.has_permission('catalog.formula.manage'));

CREATE POLICY material_samples_internal_read ON public.material_samples
  FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));
CREATE POLICY material_samples_manage ON public.material_samples
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.sample.manage'))
  WITH CHECK (public.has_permission('catalog.sample.manage'));

CREATE POLICY partner_warranty_internal_read ON public.partner_warranty_versions
  FOR SELECT TO authenticated USING (public.has_permission('catalog.read'));
CREATE POLICY partner_warranty_manage ON public.partner_warranty_versions
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.warranty.manage'))
  WITH CHECK (public.has_permission('catalog.warranty.manage'));

CREATE POLICY catalog_import_jobs_internal ON public.catalog_import_jobs
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.import'))
  WITH CHECK (public.has_permission('catalog.import'));
CREATE POLICY catalog_import_rows_internal ON public.catalog_import_rows
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.import'))
  WITH CHECK (public.has_permission('catalog.import'));
CREATE POLICY catalog_import_errors_internal ON public.catalog_import_errors
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.import'))
  WITH CHECK (public.has_permission('catalog.import'));

REVOKE ALL ON public.countries, public.supplier_locations, public.collections, public.tags,
  public.product_collections, public.product_tags, public.product_documents,
  public.product_cost_versions, public.price_formula_versions, public.price_formula_components,
  public.material_samples, public.partner_warranty_versions, public.catalog_import_jobs,
  public.catalog_import_rows, public.catalog_import_errors
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.countries, public.supplier_locations,
  public.collections, public.tags, public.product_collections, public.product_tags,
  public.product_documents, public.product_cost_versions, public.price_formula_versions,
  public.price_formula_components, public.material_samples, public.partner_warranty_versions,
  public.catalog_import_jobs, public.catalog_import_rows, public.catalog_import_errors
TO authenticated;

DROP VIEW IF EXISTS public.member_catalog;

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
  p.country_code,
  p.width_mm,
  p.depth_mm,
  p.height_mm,
  p.weight_kg,
  p.cbm,
  p.material_summary,
  p.finish_summary,
  p.moq,
  p.category_id,
  c.name_th AS category_name,
  pp.id AS price_id,
  pp.amount AS member_price_before_vat,
  pp.suggested_resale_amount,
  pp.freight_estimate_min,
  pp.freight_estimate_max,
  pp.currency,
  p.published_at,
  COALESCE((
    SELECT COUNT(*)::INTEGER
    FROM public.material_samples ms
    WHERE ms.product_id = p.id AND ms.availability_status = 'AVAILABLE'
  ), 0) AS available_sample_count,
  COALESCE((
    SELECT pw.member_summary
    FROM public.partner_warranty_versions pw
    WHERE pw.product_id = p.id AND pw.status = 'ACTIVE'
      AND pw.effective_from <= NOW()
      AND (pw.effective_until IS NULL OR pw.effective_until > NOW())
    ORDER BY pw.version_number DESC
    LIMIT 1
  ), 'Partner Warranty') AS warranty_summary
FROM public.products p
LEFT JOIN public.categories c ON c.id = p.category_id
JOIN public.product_prices pp
  ON pp.product_id = p.id
  AND pp.variant_id IS NULL
  AND pp.status = 'ACTIVE'
  AND pp.valid_from <= NOW()
  AND (pp.valid_until IS NULL OR pp.valid_until > NOW())
WHERE p.status = 'PUBLISHED'
  AND p.qa_status = 'PASSED'
  AND public.current_member_profile_id() IS NOT NULL;

REVOKE ALL ON public.member_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_catalog TO authenticated;

-- Direct updates to sensitive pricing outputs and status are not part of the
-- member/client CRUD surface. Trusted functions will own these transitions.
REVOKE UPDATE ON public.product_prices FROM authenticated;
GRANT SELECT ON public.product_prices TO authenticated;
