-- Slice 8: warehouse receipt, consolidation, shipment tracking, delivery/POD,
-- actual logistics cost and member freight invoice.
-- This migration is intentionally limited to the isolated Slice 8 backend branch.

-- ---------------------------------------------------------------------------
-- 1. Permissions and ownership helper
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions(code, name, description)
VALUES (
  'freight.manage',
  'Manage freight billing',
  'Finalize actual logistics charges and issue freight invoices'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'freight.manage'
WHERE r.code IN ('SUPER_ADMIN', 'FINANCE')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_member_owns_order(order_id_input UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_orders co
    WHERE co.id = order_id_input
      AND co.member_profile_id = public.current_member_profile_id()
  )
$$;

-- ---------------------------------------------------------------------------
-- 2. Warehouse receipt and release
-- ---------------------------------------------------------------------------

CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_code TEXT NOT NULL UNIQUE,
  warehouse_name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  address JSONB NOT NULL DEFAULT '{}'::JSONB,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.warehouse_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  supplier_order_id UUID NOT NULL REFERENCES public.supplier_orders(id) ON DELETE RESTRICT,
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  receipt_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'EXPECTED' CHECK (status IN (
    'EXPECTED', 'PARTIALLY_RECEIVED', 'RECEIVED_COMPLETE',
    'DISCREPANCY', 'DAMAGED', 'READY_FOR_CONSOLIDATION', 'CANCELLED'
  )),
  received_at TIMESTAMPTZ NOT NULL,
  package_count INTEGER NOT NULL DEFAULT 0 CHECK (package_count >= 0),
  actual_weight_kg NUMERIC(14,3) CHECK (actual_weight_kg IS NULL OR actual_weight_kg >= 0),
  actual_cbm NUMERIC(14,4) CHECK (actual_cbm IS NULL OR actual_cbm >= 0),
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.warehouse_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_receipt_id UUID NOT NULL REFERENCES public.warehouse_receipts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_order_item_id UUID NOT NULL REFERENCES public.supplier_order_items(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  expected_quantity NUMERIC(12,3) NOT NULL CHECK (expected_quantity > 0),
  received_quantity NUMERIC(12,3) NOT NULL CHECK (received_quantity > 0),
  released_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (released_quantity >= 0),
  blocked_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (blocked_quantity >= 0),
  condition TEXT NOT NULL DEFAULT 'GOOD'
    CHECK (condition IN ('GOOD', 'DAMAGED', 'MISSING', 'WRONG_ITEM', 'OTHER')),
  discrepancy_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_receipt_id, supplier_order_item_id),
  CHECK (received_quantity <= expected_quantity),
  CHECK (released_quantity + blocked_quantity <= received_quantity)
);

CREATE TABLE public.warehouse_receipt_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_receipt_id UUID NOT NULL REFERENCES public.warehouse_receipts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  file_purpose TEXT NOT NULL DEFAULT 'RECEIPT_EVIDENCE'
    CHECK (file_purpose IN ('RECEIPT_EVIDENCE', 'DAMAGE', 'DISCREPANCY', 'PACKING_LIST')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_receipt_id, file_id)
);

-- ---------------------------------------------------------------------------
-- 3. Consolidation and partial shipment approval
-- ---------------------------------------------------------------------------

CREATE TABLE public.consolidation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  consolidation_number TEXT NOT NULL UNIQUE,
  strategy TEXT NOT NULL DEFAULT 'CONSOLIDATE_ALL'
    CHECK (strategy IN ('CONSOLIDATE_ALL', 'PARTIAL', 'DIRECT')),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'SHIPMENT_CREATED', 'CANCELLED')),
  revision_of_id UUID REFERENCES public.consolidation_groups(id) ON DELETE RESTRICT,
  reason TEXT,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.consolidation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_group_id UUID NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  warehouse_receipt_item_id UUID NOT NULL REFERENCES public.warehouse_receipt_items(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (consolidation_group_id, warehouse_receipt_item_id)
);

CREATE TABLE public.consolidation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_group_id UUID NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'CREATED', 'ITEM_ADDED', 'CONFIRMED', 'SHIPMENT_CREATED', 'CANCELLED'
  )),
  detail JSONB NOT NULL DEFAULT '{}'::JSONB,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. Shipment extensions and append-only tracking
-- ---------------------------------------------------------------------------

ALTER TABLE public.shipments
  ADD COLUMN customer_order_id UUID REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  ADD COLUMN consolidation_group_id UUID REFERENCES public.consolidation_groups(id) ON DELETE RESTRICT,
  ADD COLUMN shipment_type TEXT NOT NULL DEFAULT 'CONSOLIDATED'
    CHECK (shipment_type IN ('CONSOLIDATED', 'PARTIAL', 'DIRECT')),
  ADD COLUMN shipping_method TEXT
    CHECK (shipping_method IS NULL OR shipping_method IN ('LCL', 'FCL', 'TRUCK', 'AIR', 'COURIER')),
  ADD COLUMN origin_warehouse_id UUID REFERENCES public.warehouses(id),
  ADD COLUMN destination_country_code CHAR(2) NOT NULL DEFAULT 'TH',
  ADD COLUMN destination_address_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN package_count INTEGER CHECK (package_count IS NULL OR package_count >= 0),
  ADD COLUMN actual_weight_kg NUMERIC(14,3) CHECK (actual_weight_kg IS NULL OR actual_weight_kg >= 0),
  ADD COLUMN actual_cbm NUMERIC(14,4) CHECK (actual_cbm IS NULL OR actual_cbm >= 0),
  ADD COLUMN container_number TEXT,
  ADD COLUMN bill_of_lading_number TEXT,
  ADD COLUMN etd_at TIMESTAMPTZ,
  ADD COLUMN original_eta_at TIMESTAMPTZ,
  ADD COLUMN actual_departure_at TIMESTAMPTZ,
  ADD COLUMN actual_arrival_at TIMESTAMPTZ,
  ADD COLUMN delay_reason TEXT,
  ADD COLUMN cancellation_reason TEXT,
  ADD CONSTRAINT shipments_etd_eta_check
    CHECK (etd_at IS NULL OR estimated_arrival_at IS NULL OR etd_at <= estimated_arrival_at);

ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_status_check CHECK (status IN (
    'DRAFT', 'GATE_CHECKED', 'AWAITING_MEMBER_ACKNOWLEDGEMENT',
    'READY_TO_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
    'ARRIVED_THAILAND', 'IMPORT_CUSTOMS', 'THAILAND_WAREHOUSE',
    'READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED'
  ));

ALTER TABLE public.shipment_items
  ADD COLUMN supplier_order_item_id UUID REFERENCES public.supplier_order_items(id) ON DELETE RESTRICT,
  ADD COLUMN warehouse_receipt_item_id UUID REFERENCES public.warehouse_receipt_items(id) ON DELETE RESTRICT,
  ADD COLUMN package_count INTEGER CHECK (package_count IS NULL OR package_count >= 0),
  ADD COLUMN weight_kg NUMERIC(14,3) CHECK (weight_kg IS NULL OR weight_kg >= 0),
  ADD COLUMN cbm NUMERIC(14,4) CHECK (cbm IS NULL OR cbm >= 0);

CREATE TABLE public.partial_shipment_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL UNIQUE REFERENCES public.shipments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  remaining_plan TEXT NOT NULL,
  additional_member_charge NUMERIC(18,2) NOT NULL DEFAULT 0
    CHECK (additional_member_charge >= 0),
  charge_currency CHAR(3) NOT NULL DEFAULT 'THB',
  charge_bearer TEXT NOT NULL DEFAULT 'GISP'
    CHECK (charge_bearer IN ('GISP', 'MEMBER')),
  internal_approved_by UUID NOT NULL REFERENCES auth.users(id),
  internal_approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_acknowledgement_required BOOLEAN NOT NULL DEFAULT FALSE,
  member_acknowledged_at TIMESTAMPTZ,
  member_acknowledged_by UUID REFERENCES auth.users(id),
  member_response_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (additional_member_charge = 0)
    OR (charge_bearer = 'MEMBER' AND member_acknowledgement_required)
    OR (charge_bearer = 'GISP')
  )
);

CREATE TABLE public.partial_shipment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partial_shipment_decision_id UUID NOT NULL REFERENCES public.partial_shipment_decisions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  response TEXT NOT NULL CHECK (response IN ('ACKNOWLEDGED', 'QUESTIONED')),
  note TEXT,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.shipment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  status TEXT NOT NULL CHECK (status IN (
    'FACTORY_PICKUP_SCHEDULED', 'PICKED_UP_FROM_FACTORY',
    'ARRIVED_CHINA_WAREHOUSE', 'CONSOLIDATED', 'BOOKED',
    'EXPORT_CUSTOMS', 'DEPARTED_CHINA', 'IN_TRANSIT',
    'ARRIVED_THAILAND', 'IMPORT_CUSTOMS', 'THAILAND_WAREHOUSE',
    'READY_FOR_DELIVERY', 'DELAY', 'NOTE'
  )),
  location_text TEXT,
  event_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  is_delay BOOLEAN NOT NULL DEFAULT FALSE,
  eta_at TIMESTAMPTZ,
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.shipment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'TRACKING_EVIDENCE', 'BILL_OF_LADING', 'CUSTOMS_ENTRY',
    'PACKING_LIST', 'CARRIER_DOCUMENT', 'OTHER'
  )),
  is_member_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shipment_id, file_id)
);

-- ---------------------------------------------------------------------------
-- 5. Delivery appointments, attempts and proof of delivery
-- ---------------------------------------------------------------------------

ALTER TABLE public.deliveries
  ADD COLUMN customer_order_id UUID REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  ADD COLUMN delivery_address_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN scheduled_window_end_at TIMESTAMPTZ,
  ADD COLUMN contact_name TEXT,
  ADD COLUMN contact_phone TEXT,
  ADD COLUMN site_note TEXT,
  ADD COLUMN driver_name TEXT,
  ADD COLUMN driver_phone TEXT,
  ADD COLUMN vehicle_registration TEXT,
  ADD COLUMN member_confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN member_confirmed_at TIMESTAMPTZ,
  ADD COLUMN failure_reason TEXT,
  ADD COLUMN next_delivery_plan TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT deliveries_schedule_window_check
    CHECK (scheduled_window_end_at IS NULL OR scheduled_at IS NULL OR scheduled_at <= scheduled_window_end_at);

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_status_check CHECK (status IN (
    'PROPOSED', 'MEMBER_CONFIRMED', 'RESCHEDULE_REQUESTED', 'UNDER_REVIEW',
    'CONFIRMED', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED',
    'PARTIALLY_DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED', 'RESCHEDULE_REQUIRED'
  ));

ALTER TABLE public.delivery_items
  DROP CONSTRAINT IF EXISTS delivery_items_quantity_delivered_check;
ALTER TABLE public.delivery_items
  ADD COLUMN shipment_item_id UUID REFERENCES public.shipment_items(id) ON DELETE RESTRICT,
  ADD COLUMN expected_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
  ADD COLUMN issue_type TEXT CHECK (issue_type IS NULL OR issue_type IN (
    'DAMAGED', 'MISSING', 'WRONG_ITEM', 'QUALITY', 'OTHER'
  )),
  ADD COLUMN issue_description TEXT,
  ADD COLUMN remaining_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (remaining_quantity >= 0),
  ADD CONSTRAINT delivery_items_quantity_delivered_check CHECK (quantity_delivered >= 0),
  ADD CONSTRAINT delivery_items_expected_check CHECK (quantity_delivered <= expected_quantity);

CREATE TABLE public.delivery_appointment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'PROPOSED', 'MEMBER_CONFIRMED', 'RESCHEDULE_REQUESTED',
    'RESCHEDULE_ACCEPTED', 'RESCHEDULE_REJECTED', 'CONFIRMED',
    'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERY_RECORDED', 'FAILED'
  )),
  scheduled_at_snapshot TIMESTAMPTZ,
  scheduled_window_end_snapshot TIMESTAMPTZ,
  note TEXT,
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.delivery_reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'ACCEPTED', 'REJECTED')),
  preferred_dates JSONB NOT NULL,
  reason TEXT NOT NULL,
  requested_contact_name TEXT,
  requested_contact_phone TEXT,
  requested_site_note TEXT,
  requested_address JSONB,
  address_change_requested BOOLEAN NOT NULL DEFAULT FALSE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  accepted_scheduled_at TIMESTAMPTZ,
  accepted_window_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(preferred_dates) = 'array' AND jsonb_array_length(preferred_dates) > 0)
);

CREATE UNIQUE INDEX delivery_reschedule_open_uidx
  ON public.delivery_reschedule_requests(delivery_id)
  WHERE status = 'SUBMITTED';

CREATE TABLE public.delivery_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN (
    'PHOTO', 'SIGNATURE', 'RECIPIENT_CONFIRMATION', 'ISSUE', 'OTHER'
  )),
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (delivery_id, file_id)
);

-- ---------------------------------------------------------------------------
-- 6. Actual logistics cost and freight invoice snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE public.logistics_cost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE RESTRICT,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN (
    'CHINA_DOMESTIC_TRANSPORT', 'WAREHOUSE', 'INSPECTION', 'CONSOLIDATION',
    'PACKING', 'INTERNATIONAL_FREIGHT', 'INSURANCE', 'CUSTOMS', 'TAX',
    'THAILAND_WAREHOUSE', 'THAILAND_DELIVERY', 'LIFTING', 'OTHER'
  )),
  description TEXT NOT NULL,
  supplier_cost NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (supplier_cost >= 0),
  supplier_currency CHAR(3) NOT NULL DEFAULT 'THB',
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
  member_charge NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (member_charge >= 0),
  member_currency CHAR(3) NOT NULL DEFAULT 'THB',
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'FINALIZED', 'INVOICED', 'CANCELLED')),
  adjustment_of_id UUID REFERENCES public.logistics_cost_items(id) ON DELETE RESTRICT,
  adjustment_reason TEXT,
  internal_note TEXT,
  member_visible_note TEXT,
  finalized_by UUID REFERENCES auth.users(id),
  finalized_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (adjustment_of_id IS NULL OR NULLIF(BTRIM(adjustment_reason), '') IS NOT NULL)
);

CREATE TABLE public.logistics_cost_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logistics_cost_item_id UUID NOT NULL REFERENCES public.logistics_cost_items(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (logistics_cost_item_id, file_id)
);

CREATE TABLE public.freight_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL UNIQUE REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  payment_schedule_id UUID UNIQUE REFERENCES public.payment_schedules(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL UNIQUE,
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  subtotal NUMERIC(18,2) NOT NULL CHECK (subtotal >= 0),
  vat_rate_snapshot NUMERIC(5,2) NOT NULL DEFAULT 7.00
    CHECK (vat_rate_snapshot >= 0 AND vat_rate_snapshot <= 100),
  vat_amount NUMERIC(18,2) NOT NULL CHECK (vat_amount >= 0),
  grand_total NUMERIC(18,2) NOT NULL CHECK (grand_total >= 0),
  status TEXT NOT NULL DEFAULT 'ISSUED'
    CHECK (status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERPAYMENT_REVIEW', 'CANCELLED')),
  due_at TIMESTAMPTZ,
  issued_by UUID NOT NULL REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (grand_total = subtotal + vat_amount)
);

CREATE TABLE public.freight_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_invoice_id UUID NOT NULL REFERENCES public.freight_invoices(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  logistics_cost_item_id UUID NOT NULL UNIQUE REFERENCES public.logistics_cost_items(id) ON DELETE RESTRICT,
  category_snapshot TEXT NOT NULL,
  description_snapshot TEXT NOT NULL,
  amount_snapshot NUMERIC(18,2) NOT NULL CHECK (amount_snapshot >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. Indexes, update timestamps and append-only evidence/history
-- ---------------------------------------------------------------------------

CREATE INDEX warehouses_status_idx ON public.warehouses(status, country_code);
CREATE INDEX warehouse_receipts_order_idx ON public.warehouse_receipts(customer_order_id, received_at DESC);
CREATE INDEX warehouse_receipts_supplier_idx ON public.warehouse_receipts(supplier_order_id, received_at DESC);
CREATE INDEX warehouse_receipt_items_order_idx ON public.warehouse_receipt_items(order_item_id);
CREATE INDEX consolidation_groups_order_idx ON public.consolidation_groups(customer_order_id, status);
CREATE INDEX consolidation_items_receipt_idx ON public.consolidation_items(warehouse_receipt_item_id);
CREATE INDEX shipments_order_idx ON public.shipments(customer_order_id, status, created_at DESC);
CREATE INDEX shipment_history_idx ON public.shipment_status_history(shipment_id, event_at, created_at);
CREATE INDEX deliveries_order_idx ON public.deliveries(customer_order_id, status, created_at DESC);
CREATE INDEX delivery_appointment_events_idx ON public.delivery_appointment_events(delivery_id, created_at);
CREATE INDEX delivery_evidence_idx ON public.delivery_evidence(delivery_id, created_at);
CREATE INDEX logistics_cost_order_idx ON public.logistics_cost_items(customer_order_id, status, created_at);
CREATE INDEX freight_invoice_order_idx ON public.freight_invoices(customer_order_id, status);

CREATE TRIGGER warehouses_updated_at BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER warehouse_receipts_updated_at BEFORE UPDATE ON public.warehouse_receipts
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER warehouse_receipt_items_updated_at BEFORE UPDATE ON public.warehouse_receipt_items
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER consolidation_groups_updated_at BEFORE UPDATE ON public.consolidation_groups
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER deliveries_updated_at BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER delivery_reschedule_requests_updated_at BEFORE UPDATE ON public.delivery_reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER logistics_cost_items_updated_at BEFORE UPDATE ON public.logistics_cost_items
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER freight_invoices_updated_at BEFORE UPDATE ON public.freight_invoices
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER consolidation_events_append_only
  BEFORE UPDATE OR DELETE ON public.consolidation_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();
CREATE TRIGGER partial_shipment_responses_append_only
  BEFORE UPDATE OR DELETE ON public.partial_shipment_responses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();
CREATE TRIGGER shipment_status_history_append_only
  BEFORE UPDATE OR DELETE ON public.shipment_status_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();
CREATE TRIGGER delivery_appointment_events_append_only
  BEFORE UPDATE OR DELETE ON public.delivery_appointment_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

-- ---------------------------------------------------------------------------
-- 8. Row-level security. Internal cost never uses organization-only access.
-- ---------------------------------------------------------------------------

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_receipt_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partial_shipment_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partial_shipment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_appointment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_reschedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_cost_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipments_org ON public.shipments;
DROP POLICY IF EXISTS shipment_items_org ON public.shipment_items;
DROP POLICY IF EXISTS deliveries_org ON public.deliveries;
DROP POLICY IF EXISTS delivery_items_org ON public.delivery_items;

CREATE POLICY warehouses_internal_select ON public.warehouses
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage') OR public.has_permission('freight.manage')
);

CREATE POLICY warehouse_receipts_internal_select ON public.warehouse_receipts
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));
CREATE POLICY warehouse_receipt_items_internal_select ON public.warehouse_receipt_items
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));
CREATE POLICY warehouse_receipt_files_internal_select ON public.warehouse_receipt_files
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));

CREATE POLICY consolidation_groups_internal_select ON public.consolidation_groups
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));
CREATE POLICY consolidation_items_internal_select ON public.consolidation_items
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));
CREATE POLICY consolidation_events_internal_select ON public.consolidation_events
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));

CREATE POLICY shipments_visible ON public.shipments
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR public.has_permission('deliveries.manage', organization_id)
  OR (customer_order_id IS NOT NULL AND public.current_member_owns_order(customer_order_id))
);
CREATE POLICY shipment_items_visible ON public.shipment_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = shipment_id
      AND (
        public.has_permission('shipments.manage', s.organization_id)
        OR public.has_permission('deliveries.manage', s.organization_id)
        OR public.current_member_owns_order(s.customer_order_id)
      )
  )
);
CREATE POLICY partial_shipment_decisions_visible ON public.partial_shipment_decisions
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR public.current_member_owns_order(customer_order_id)
);
CREATE POLICY partial_shipment_responses_visible ON public.partial_shipment_responses
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR EXISTS (
    SELECT 1 FROM public.partial_shipment_decisions psd
    WHERE psd.id = partial_shipment_decision_id
      AND public.current_member_owns_order(psd.customer_order_id)
  )
);
CREATE POLICY shipment_history_visible ON public.shipment_status_history
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR public.has_permission('deliveries.manage', organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = shipment_id AND public.current_member_owns_order(s.customer_order_id)
  ))
);
CREATE POLICY shipment_documents_visible ON public.shipment_documents
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = shipment_id AND public.current_member_owns_order(s.customer_order_id)
  ))
);

CREATE POLICY deliveries_visible ON public.deliveries
FOR SELECT TO authenticated USING (
  public.has_permission('deliveries.manage', organization_id)
  OR public.has_permission('shipments.manage', organization_id)
  OR (customer_order_id IS NOT NULL AND public.current_member_owns_order(customer_order_id))
);
CREATE POLICY delivery_items_visible ON public.delivery_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_id
      AND (
        public.has_permission('deliveries.manage', d.organization_id)
        OR public.has_permission('shipments.manage', d.organization_id)
        OR public.current_member_owns_order(d.customer_order_id)
      )
  )
);
CREATE POLICY delivery_appointment_events_visible ON public.delivery_appointment_events
FOR SELECT TO authenticated USING (
  public.has_permission('deliveries.manage', organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_id AND public.current_member_owns_order(d.customer_order_id)
  ))
);
CREATE POLICY delivery_reschedule_requests_visible ON public.delivery_reschedule_requests
FOR SELECT TO authenticated USING (
  public.has_permission('deliveries.manage', organization_id)
  OR public.current_member_owns_order(customer_order_id)
);
CREATE POLICY delivery_evidence_visible ON public.delivery_evidence
FOR SELECT TO authenticated USING (
  public.has_permission('deliveries.manage', organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_id AND public.current_member_owns_order(d.customer_order_id)
  ))
);

CREATE POLICY logistics_cost_items_internal_select ON public.logistics_cost_items
FOR SELECT TO authenticated USING (
  public.has_permission('freight.manage', organization_id)
  OR public.has_permission('shipments.manage', organization_id)
);
CREATE POLICY logistics_cost_evidence_internal_select ON public.logistics_cost_evidence
FOR SELECT TO authenticated USING (
  public.has_permission('freight.manage', organization_id)
  OR public.has_permission('shipments.manage', organization_id)
);
CREATE POLICY freight_invoices_visible ON public.freight_invoices
FOR SELECT TO authenticated USING (
  public.has_permission('freight.manage', organization_id)
  OR public.has_permission('payments.verify', organization_id)
  OR public.current_member_owns_order(customer_order_id)
);
CREATE POLICY freight_invoice_items_visible ON public.freight_invoice_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.freight_invoices fi
    WHERE fi.id = freight_invoice_id
      AND (
        public.has_permission('freight.manage', fi.organization_id)
        OR public.has_permission('payments.verify', fi.organization_id)
        OR public.current_member_owns_order(fi.customer_order_id)
      )
  )
);

REVOKE ALL ON public.warehouses, public.warehouse_receipts,
  public.warehouse_receipt_items, public.warehouse_receipt_files,
  public.consolidation_groups, public.consolidation_items, public.consolidation_events,
  public.partial_shipment_decisions, public.partial_shipment_responses,
  public.shipment_status_history, public.shipment_documents,
  public.delivery_appointment_events, public.delivery_reschedule_requests,
  public.delivery_evidence, public.logistics_cost_items, public.logistics_cost_evidence,
  public.freight_invoices, public.freight_invoice_items FROM anon, authenticated;

GRANT SELECT ON public.warehouses, public.warehouse_receipts,
  public.warehouse_receipt_items, public.warehouse_receipt_files,
  public.consolidation_groups, public.consolidation_items, public.consolidation_events,
  public.partial_shipment_decisions, public.partial_shipment_responses,
  public.shipment_status_history, public.shipment_documents,
  public.delivery_appointment_events, public.delivery_reschedule_requests,
  public.delivery_evidence, public.logistics_cost_items, public.logistics_cost_evidence,
  public.freight_invoices, public.freight_invoice_items TO authenticated;

REVOKE ALL ON FUNCTION public.current_member_owns_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_member_owns_order(UUID) TO authenticated;
