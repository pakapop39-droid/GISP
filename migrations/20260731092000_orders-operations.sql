-- GISP MVP — Slices 6-10: orders, payments, production, QC, logistics,
-- delivery, claims and fixed-report source data.

CREATE TABLE public.customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING_DEPOSIT'
    CHECK (status IN (
      'DRAFT', 'PENDING_DEPOSIT', 'DEPOSIT_VERIFIED', 'PO_ISSUED',
      'IN_PRODUCTION', 'READY_TO_SHIP', 'PARTIALLY_SHIPPED', 'SHIPPED',
      'DELIVERED', 'COMPLETED', 'CANCELLED'
    )),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  subtotal NUMERIC(18,2) NOT NULL CHECK (subtotal >= 0),
  vat_rate_snapshot NUMERIC(5,2) NOT NULL CHECK (vat_rate_snapshot >= 0),
  vat_amount NUMERIC(18,2) NOT NULL CHECK (vat_amount >= 0),
  grand_total NUMERIC(18,2) NOT NULL CHECK (grand_total >= 0),
  deposit_amount NUMERIC(18,2) NOT NULL CHECK (deposit_amount >= 0),
  balance_amount NUMERIC(18,2) NOT NULL CHECK (balance_amount >= 0),
  deposit_verified_at TIMESTAMPTZ,
  balance_verified_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (deposit_amount + balance_amount = grand_total)
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  project_item_id UUID NOT NULL REFERENCES public.project_items(id),
  item_type TEXT NOT NULL CHECK (item_type IN ('STANDARD', 'CUSTOM')),
  item_name_snapshot TEXT NOT NULL,
  specification_snapshot TEXT,
  options_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  unit_price_snapshot NUMERIC(18,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  line_subtotal NUMERIC(18,2) NOT NULL CHECK (line_subtotal >= 0),
  vat_rate_snapshot NUMERIC(5,2) NOT NULL CHECK (vat_rate_snapshot >= 0),
  vat_amount NUMERIC(18,2) NOT NULL CHECK (vat_amount >= 0),
  line_total NUMERIC(18,2) NOT NULL CHECK (line_total >= 0),
  qc_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (qc_status IN ('PENDING', 'PASSED', 'FAILED', 'REWORK_REQUIRED')),
  custom_member_approved_at TIMESTAMPTZ,
  custom_member_approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, project_item_id)
);

CREATE TABLE public.supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  po_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'PO_ISSUED', 'ACKNOWLEDGED', 'IN_PRODUCTION',
      'PRODUCTION_COMPLETED', 'READY_TO_DISPATCH', 'DISPATCHED',
      'COMPLETED', 'CANCELLED'
    )),
  supplier_currency CHAR(3) NOT NULL DEFAULT 'CNY',
  total_factory_cost NUMERIC(18,2) NOT NULL DEFAULT 0
    CHECK (total_factory_cost >= 0),
  paid_factory_amount NUMERIC(18,2) NOT NULL DEFAULT 0
    CHECK (paid_factory_amount >= 0),
  supplier_balance_paid_at TIMESTAMPTZ,
  po_issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_order_id, supplier_id)
);

CREATE TABLE public.supplier_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id UUID NOT NULL REFERENCES public.supplier_orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  factory_unit_cost_snapshot NUMERIC(18,2) NOT NULL
    CHECK (factory_unit_cost_snapshot > 0),
  factory_line_total NUMERIC(18,2) NOT NULL
    CHECK (factory_line_total > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('DEPOSIT', 'BALANCE', 'FREIGHT')),
  due_amount NUMERIC(18,2) NOT NULL CHECK (due_amount >= 0),
  verified_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (verified_amount >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING', 'PARTIALLY_VERIFIED', 'VERIFIED',
      'OVERPAYMENT_REVIEW', 'CANCELLED'
    )),
  due_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, schedule_type)
);

CREATE TABLE public.payment_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_schedule_id UUID NOT NULL REFERENCES public.payment_schedules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  transfer_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  transferred_at TIMESTAMPTZ NOT NULL,
  evidence_file_id UUID NOT NULL REFERENCES public.file_metadata(id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'VERIFIED', 'REJECTED')),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  finance_verified_by UUID REFERENCES auth.users(id),
  finance_verified_at TIMESTAMPTZ,
  finance_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id UUID NOT NULL REFERENCES public.supplier_orders(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('DEPOSIT', 'BALANCE', 'PARTIAL')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'CNY',
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED')),
  evidence_file_id UUID REFERENCES public.file_metadata(id),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  paid_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.production_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id UUID NOT NULL REFERENCES public.supplier_orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  status TEXT NOT NULL CHECK (status IN (
    'ACKNOWLEDGED', 'MATERIAL_PREPARATION', 'IN_PRODUCTION',
    'ASSEMBLY', 'FINISHING', 'PRODUCTION_COMPLETED', 'DELAYED'
  )),
  note TEXT,
  estimated_completion_at TIMESTAMPTZ,
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  result TEXT NOT NULL CHECK (result IN ('PASSED', 'FAILED', 'REWORK_REQUIRED')),
  checklist_version TEXT NOT NULL DEFAULT 'MVP-1',
  note TEXT,
  report_file_id UUID REFERENCES public.file_metadata(id),
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  inspected_by UUID NOT NULL REFERENCES auth.users(id),
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  shipment_number TEXT NOT NULL UNIQUE,
  shipment_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'GATE_CHECKED'
    CHECK (status IN (
      'DRAFT', 'GATE_CHECKED', 'DISPATCHED', 'IN_TRANSIT',
      'ARRIVED', 'DELIVERED', 'CANCELLED'
    )),
  tracking_number TEXT,
  carrier_name TEXT,
  estimated_arrival_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shipment_id, order_item_id)
);

CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  delivery_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'DELIVERED', 'DELIVERED_WITH_ISSUE')),
  scheduled_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  recipient_name TEXT,
  recipient_phone TEXT,
  proof_file_id UUID REFERENCES public.file_metadata(id),
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id),
  quantity_delivered NUMERIC(12,3) NOT NULL CHECK (quantity_delivered > 0),
  condition TEXT NOT NULL DEFAULT 'GOOD'
    CHECK (condition IN ('GOOD', 'DAMAGED', 'MISSING', 'WRONG_ITEM', 'OTHER')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (delivery_id, order_item_id)
);

CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  delivery_item_id UUID NOT NULL REFERENCES public.delivery_items(id),
  claim_number TEXT NOT NULL UNIQUE,
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'DAMAGED', 'MISSING', 'WRONG_ITEM', 'QUALITY', 'OTHER'
  )),
  description TEXT NOT NULL,
  evidence_file_id UUID NOT NULL REFERENCES public.file_metadata(id),
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN (
      'OPEN', 'UNDER_REVIEW', 'RESOLUTION_PROPOSED',
      'RESOLVED', 'REJECTED', 'CLOSED'
    )),
  resolution TEXT,
  rejection_reason TEXT,
  member_confirmed_at TIMESTAMPTZ,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.claim_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  action TEXT NOT NULL,
  note TEXT,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id),
  reason TEXT,
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX customer_orders_org_idx ON public.customer_orders(organization_id, status, created_at DESC);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
CREATE INDEX order_items_org_idx ON public.order_items(organization_id);
CREATE INDEX supplier_orders_order_idx ON public.supplier_orders(customer_order_id, status);
CREATE INDEX supplier_orders_supplier_idx ON public.supplier_orders(supplier_id, status);
CREATE INDEX payment_schedules_order_idx ON public.payment_schedules(order_id, schedule_type);
CREATE INDEX payment_transfers_schedule_idx ON public.payment_transfers(payment_schedule_id, status);
CREATE INDEX supplier_payments_order_idx ON public.supplier_payments(supplier_order_id, status);
CREATE INDEX production_updates_order_idx ON public.production_updates(supplier_order_id, created_at DESC);
CREATE INDEX qc_inspections_item_idx ON public.qc_inspections(order_item_id, inspected_at DESC);
CREATE INDEX shipments_org_idx ON public.shipments(organization_id, status, created_at DESC);
CREATE INDEX shipment_items_order_item_idx ON public.shipment_items(order_item_id);
CREATE INDEX deliveries_org_idx ON public.deliveries(organization_id, status, created_at DESC);
CREATE INDEX delivery_items_order_item_idx ON public.delivery_items(order_item_id);
CREATE INDEX claims_org_idx ON public.claims(organization_id, status, created_at DESC);
CREATE INDEX claim_events_claim_idx ON public.claim_events(claim_id, created_at);
CREATE INDEX status_events_entity_idx ON public.status_events(entity_type, entity_id, created_at);

CREATE TRIGGER customer_orders_updated_at BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER supplier_orders_updated_at BEFORE UPDATE ON public.supplier_orders
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER payment_schedules_updated_at BEFORE UPDATE ON public.payment_schedules
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER claims_updated_at BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE OR REPLACE FUNCTION public.create_customer_order(
  project_id_input UUID,
  selections_input JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  selection_record RECORD;
  project_item_record public.project_items%ROWTYPE;
  quotation_cost_record public.custom_quotation_costs%ROWTYPE;
  supplier_id_value UUID;
  factory_unit_cost_value NUMERIC(18,2);
  order_id_value UUID;
  order_item_id_value UUID;
  supplier_order_id_value UUID;
  order_number_value TEXT;
  po_number_value TEXT;
  vat_rate_value NUMERIC(5,2);
  subtotal_value NUMERIC(18,2) := 0;
  vat_amount_value NUMERIC(18,2) := 0;
  grand_total_value NUMERIC(18,2);
  deposit_value NUMERIC(18,2);
  balance_value NUMERIC(18,2);
  line_subtotal_value NUMERIC(18,2);
  line_vat_value NUMERIC(18,2);
BEGIN
  IF jsonb_typeof(selections_input) <> 'array'
    OR jsonb_array_length(selections_input) = 0 THEN
    RAISE EXCEPTION 'at least one item selection is required';
  END IF;

  SELECT * INTO project_record
  FROM public.projects
  WHERE id = project_id_input
    AND public.can_access_org(organization_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;

  FOR selection_record IN
    SELECT * FROM jsonb_to_recordset(selections_input)
      AS x(project_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT * INTO project_item_record
    FROM public.project_items
    WHERE id = selection_record.project_item_id
      AND project_id = project_id_input
      AND organization_id = project_record.organization_id
    FOR UPDATE;

    IF NOT FOUND OR project_item_record.status NOT IN (
      'READY_TO_ORDER', 'PARTIALLY_ORDERED'
    ) THEN
      RAISE EXCEPTION 'project item is not ready to order';
    END IF;
    IF selection_record.quantity IS NULL OR selection_record.quantity <= 0
      OR selection_record.quantity >
        (project_item_record.quantity - project_item_record.ordered_quantity) THEN
      RAISE EXCEPTION 'invalid order quantity';
    END IF;

    IF vat_rate_value IS NULL THEN
      vat_rate_value := project_item_record.vat_rate_snapshot;
    ELSIF vat_rate_value <> project_item_record.vat_rate_snapshot THEN
      RAISE EXCEPTION 'mixed VAT snapshots must be ordered separately';
    END IF;

    line_subtotal_value := ROUND(
      selection_record.quantity * project_item_record.current_unit_price, 2
    );
    line_vat_value := ROUND(
      line_subtotal_value * project_item_record.vat_rate_snapshot / 100, 2
    );
    subtotal_value := subtotal_value + line_subtotal_value;
    vat_amount_value := vat_amount_value + line_vat_value;
  END LOOP;

  subtotal_value := ROUND(subtotal_value, 2);
  vat_amount_value := ROUND(vat_amount_value, 2);
  grand_total_value := ROUND(subtotal_value + vat_amount_value, 2);
  deposit_value := ROUND(grand_total_value * 0.50, 2);
  balance_value := ROUND(grand_total_value - deposit_value, 2);
  order_number_value := public.next_document_number('ORD');

  INSERT INTO public.customer_orders (
    organization_id, project_id, order_number, subtotal, vat_rate_snapshot,
    vat_amount, grand_total, deposit_amount, balance_amount, created_by
  )
  VALUES (
    project_record.organization_id, project_id_input, order_number_value,
    subtotal_value, vat_rate_value, vat_amount_value, grand_total_value,
    deposit_value, balance_value, (SELECT auth.uid())
  )
  RETURNING id INTO order_id_value;

  FOR selection_record IN
    SELECT * FROM jsonb_to_recordset(selections_input)
      AS x(project_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT * INTO project_item_record
    FROM public.project_items
    WHERE id = selection_record.project_item_id
    FOR UPDATE;

    IF project_item_record.item_type = 'STANDARD' THEN
      SELECT p.supplier_id, p.factory_cost
      INTO supplier_id_value, factory_unit_cost_value
      FROM public.products p
      WHERE p.id = project_item_record.product_id;
    ELSE
      SELECT cqc.* INTO quotation_cost_record
      FROM public.custom_quotation_items cqi
      JOIN public.custom_quotation_costs cqc
        ON cqc.quotation_id = cqi.quotation_id
      WHERE cqi.id = project_item_record.quotation_item_id;
      supplier_id_value := quotation_cost_record.supplier_id;
      SELECT ROUND(
        quotation_cost_record.supplier_cost_total / cqi.quantity, 2
      )
      INTO factory_unit_cost_value
      FROM public.custom_quotation_items cqi
      WHERE cqi.id = project_item_record.quotation_item_id;
    END IF;

    IF supplier_id_value IS NULL
      OR factory_unit_cost_value IS NULL
      OR factory_unit_cost_value <= 0 THEN
      RAISE EXCEPTION 'supplier and positive factory cost are required';
    END IF;

    line_subtotal_value := ROUND(
      selection_record.quantity * project_item_record.current_unit_price, 2
    );
    line_vat_value := ROUND(
      line_subtotal_value * project_item_record.vat_rate_snapshot / 100, 2
    );

    INSERT INTO public.order_items (
      order_id, organization_id, project_item_id, item_type,
      item_name_snapshot, specification_snapshot, options_snapshot,
      quantity, unit, unit_price_snapshot, line_subtotal, vat_rate_snapshot,
      vat_amount, line_total
    )
    VALUES (
      order_id_value, project_record.organization_id, project_item_record.id,
      project_item_record.item_type, project_item_record.item_name,
      project_item_record.specification_snapshot,
      project_item_record.selected_options, selection_record.quantity,
      project_item_record.unit, project_item_record.current_unit_price,
      line_subtotal_value, project_item_record.vat_rate_snapshot,
      line_vat_value, ROUND(line_subtotal_value + line_vat_value, 2)
    )
    RETURNING id INTO order_item_id_value;

    SELECT id INTO supplier_order_id_value
    FROM public.supplier_orders
    WHERE customer_order_id = order_id_value AND supplier_id = supplier_id_value;

    IF supplier_order_id_value IS NULL THEN
      po_number_value := public.next_document_number('PO');
      INSERT INTO public.supplier_orders (
        customer_order_id, organization_id, supplier_id, po_number
      )
      VALUES (
        order_id_value, project_record.organization_id,
        supplier_id_value, po_number_value
      )
      RETURNING id INTO supplier_order_id_value;
    END IF;

    INSERT INTO public.supplier_order_items (
      supplier_order_id, order_item_id, quantity,
      factory_unit_cost_snapshot, factory_line_total
    )
    VALUES (
      supplier_order_id_value, order_item_id_value, selection_record.quantity,
      factory_unit_cost_value,
      ROUND(factory_unit_cost_value * selection_record.quantity, 2)
    );

    UPDATE public.project_items
    SET ordered_quantity = ordered_quantity + selection_record.quantity,
        status = CASE
          WHEN ordered_quantity + selection_record.quantity = quantity
            THEN 'ORDERED'
          ELSE 'PARTIALLY_ORDERED'
        END
    WHERE id = project_item_record.id;
  END LOOP;

  UPDATE public.supplier_orders so
  SET total_factory_cost = totals.total_value
  FROM (
    SELECT soi.supplier_order_id, ROUND(SUM(soi.factory_line_total), 2) AS total_value
    FROM public.supplier_order_items soi
    JOIN public.supplier_orders grouped_so ON grouped_so.id = soi.supplier_order_id
    WHERE grouped_so.customer_order_id = order_id_value
    GROUP BY soi.supplier_order_id
  ) totals
  WHERE so.id = totals.supplier_order_id;

  INSERT INTO public.payment_schedules (
    order_id, organization_id, schedule_type, due_amount
  )
  VALUES
    (order_id_value, project_record.organization_id, 'DEPOSIT', deposit_value),
    (order_id_value, project_record.organization_id, 'BALANCE', balance_value);

  PERFORM public.write_audit_event(
    project_record.organization_id, 'customer_order', order_id_value,
    'CREATED', NULL,
    jsonb_build_object(
      'order_number', order_number_value,
      'subtotal', subtotal_value,
      'vat_rate', vat_rate_value,
      'vat_amount', vat_amount_value,
      'grand_total', grand_total_value,
      'deposit', deposit_value,
      'balance', balance_value
    )
  );
  RETURN order_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_payment_transfer(
  payment_schedule_id_input UUID,
  amount_input NUMERIC,
  transferred_at_input TIMESTAMPTZ,
  evidence_file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  schedule_record public.payment_schedules%ROWTYPE;
  transfer_id_value UUID;
BEGIN
  SELECT * INTO schedule_record
  FROM public.payment_schedules
  WHERE id = payment_schedule_id_input
    AND public.can_access_org(organization_id);
  IF NOT FOUND OR schedule_record.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'payment schedule not available';
  END IF;
  IF amount_input <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.file_metadata fm
    WHERE fm.id = evidence_file_id_input
      AND fm.organization_id = schedule_record.organization_id
      AND fm.visibility IN ('MEMBER_PRIVATE', 'CONFIDENTIAL')
  ) THEN
    RAISE EXCEPTION 'payment evidence is required';
  END IF;

  INSERT INTO public.payment_transfers (
    payment_schedule_id, organization_id, transfer_number, amount,
    transferred_at, evidence_file_id, submitted_by
  )
  VALUES (
    schedule_record.id, schedule_record.organization_id,
    public.next_document_number('PAY'), ROUND(amount_input, 2),
    transferred_at_input, evidence_file_id_input, (SELECT auth.uid())
  )
  RETURNING id INTO transfer_id_value;

  PERFORM public.write_audit_event(
    schedule_record.organization_id, 'payment_transfer', transfer_id_value,
    'SUBMITTED', NULL, jsonb_build_object('amount', ROUND(amount_input, 2))
  );
  RETURN transfer_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_payment_transfer(
  transfer_id_input UUID,
  approve_input BOOLEAN,
  finance_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  transfer_record public.payment_transfers%ROWTYPE;
  schedule_record public.payment_schedules%ROWTYPE;
  verified_total NUMERIC(18,2);
  new_schedule_status TEXT;
BEGIN
  IF NOT public.has_permission('payments.verify') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT * INTO transfer_record
  FROM public.payment_transfers
  WHERE id = transfer_id_input
  FOR UPDATE;
  IF NOT FOUND OR transfer_record.status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'transfer is not verifiable';
  END IF;

  IF NOT approve_input THEN
    UPDATE public.payment_transfers
    SET status = 'REJECTED',
        finance_verified_by = (SELECT auth.uid()),
        finance_verified_at = NOW(),
        finance_note = finance_note_input
    WHERE id = transfer_id_input;
    PERFORM public.write_audit_event(
      transfer_record.organization_id, 'payment_transfer', transfer_id_input,
      'REJECTED', NULL, jsonb_build_object('note', finance_note_input)
    );
    RETURN transfer_id_input;
  END IF;

  UPDATE public.payment_transfers
  SET status = 'VERIFIED',
      finance_verified_by = (SELECT auth.uid()),
      finance_verified_at = NOW(),
      finance_note = finance_note_input
  WHERE id = transfer_id_input;

  SELECT * INTO schedule_record
  FROM public.payment_schedules
  WHERE id = transfer_record.payment_schedule_id
  FOR UPDATE;

  SELECT COALESCE(ROUND(SUM(amount), 2), 0)
  INTO verified_total
  FROM public.payment_transfers
  WHERE payment_schedule_id = schedule_record.id
    AND status = 'VERIFIED';

  new_schedule_status := CASE
    WHEN verified_total > schedule_record.due_amount THEN 'OVERPAYMENT_REVIEW'
    WHEN verified_total = schedule_record.due_amount THEN 'VERIFIED'
    WHEN verified_total > 0 THEN 'PARTIALLY_VERIFIED'
    ELSE 'PENDING'
  END;

  UPDATE public.payment_schedules
  SET verified_amount = verified_total,
      status = new_schedule_status,
      verified_at = CASE WHEN new_schedule_status = 'VERIFIED' THEN NOW() ELSE NULL END
  WHERE id = schedule_record.id;

  IF new_schedule_status = 'VERIFIED' AND schedule_record.schedule_type = 'DEPOSIT' THEN
    UPDATE public.customer_orders
    SET deposit_verified_at = NOW(),
        status = CASE WHEN status = 'PENDING_DEPOSIT' THEN 'DEPOSIT_VERIFIED' ELSE status END
    WHERE id = schedule_record.order_id;
  ELSIF new_schedule_status = 'VERIFIED' AND schedule_record.schedule_type = 'BALANCE' THEN
    UPDATE public.customer_orders
    SET balance_verified_at = NOW()
    WHERE id = schedule_record.order_id;
  END IF;

  PERFORM public.write_audit_event(
    transfer_record.organization_id, 'payment_transfer', transfer_id_input,
    'VERIFIED', NULL,
    jsonb_build_object(
      'amount', transfer_record.amount,
      'schedule_verified_amount', verified_total,
      'schedule_status', new_schedule_status
    )
  );
  RETURN transfer_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_supplier_orders(order_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  order_record public.customer_orders%ROWTYPE;
BEGIN
  IF NOT public.has_permission('orders.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  SELECT * INTO order_record
  FROM public.customer_orders
  WHERE id = order_id_input
  FOR UPDATE;
  IF NOT FOUND OR order_record.deposit_verified_at IS NULL THEN
    RAISE EXCEPTION 'deposit must be fully verified before PO issue';
  END IF;

  UPDATE public.supplier_orders
  SET status = 'PO_ISSUED', po_issued_at = NOW()
  WHERE customer_order_id = order_id_input AND status = 'DRAFT';

  UPDATE public.customer_orders
  SET status = 'PO_ISSUED'
  WHERE id = order_id_input AND status IN ('DEPOSIT_VERIFIED', 'PENDING_DEPOSIT');

  PERFORM public.write_audit_event(
    order_record.organization_id, 'customer_order', order_id_input, 'PO_ISSUED'
  );
  RETURN order_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_supplier_payment(
  supplier_order_id_input UUID,
  payment_type_input TEXT,
  amount_input NUMERIC,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  payment_id_value UUID;
BEGIN
  IF NOT public.has_permission('supplier_payments.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF payment_type_input NOT IN ('DEPOSIT', 'BALANCE', 'PARTIAL')
    OR amount_input <= 0 THEN
    RAISE EXCEPTION 'invalid supplier payment';
  END IF;

  INSERT INTO public.supplier_payments (
    supplier_order_id, payment_type, amount, requested_by, note
  )
  VALUES (
    supplier_order_id_input, payment_type_input, ROUND(amount_input, 2),
    (SELECT auth.uid()), note_input
  )
  RETURNING id INTO payment_id_value;
  RETURN payment_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_supplier_payment_paid(
  supplier_payment_id_input UUID,
  evidence_file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  payment_record public.supplier_payments%ROWTYPE;
  supplier_order_record public.supplier_orders%ROWTYPE;
  paid_total NUMERIC(18,2);
BEGIN
  IF NOT public.has_permission('supplier_payments.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT * INTO payment_record
  FROM public.supplier_payments
  WHERE id = supplier_payment_id_input
  FOR UPDATE;
  IF NOT FOUND OR payment_record.status NOT IN ('REQUESTED', 'APPROVED') THEN
    RAISE EXCEPTION 'supplier payment is not payable';
  END IF;

  UPDATE public.supplier_payments
  SET status = 'PAID',
      evidence_file_id = evidence_file_id_input,
      paid_by = (SELECT auth.uid()),
      paid_at = NOW()
  WHERE id = supplier_payment_id_input;

  SELECT * INTO supplier_order_record
  FROM public.supplier_orders
  WHERE id = payment_record.supplier_order_id
  FOR UPDATE;

  SELECT COALESCE(ROUND(SUM(amount), 2), 0)
  INTO paid_total
  FROM public.supplier_payments
  WHERE supplier_order_id = supplier_order_record.id
    AND status = 'PAID';

  UPDATE public.supplier_orders
  SET paid_factory_amount = paid_total,
      supplier_balance_paid_at = CASE
        WHEN paid_total >= total_factory_cost THEN NOW()
        ELSE NULL
      END
  WHERE id = supplier_order_record.id;

  PERFORM public.write_audit_event(
    supplier_order_record.organization_id, 'supplier_payment',
    supplier_payment_id_input, 'PAID', NULL,
    jsonb_build_object('paid_total', paid_total)
  );
  RETURN supplier_payment_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_production_update(
  supplier_order_id_input UUID,
  status_input TEXT,
  note_input TEXT DEFAULT NULL,
  estimated_completion_at_input TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  supplier_order_record public.supplier_orders%ROWTYPE;
  update_id_value UUID;
BEGIN
  IF NOT public.has_permission('production.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF status_input NOT IN (
    'ACKNOWLEDGED', 'MATERIAL_PREPARATION', 'IN_PRODUCTION', 'ASSEMBLY',
    'FINISHING', 'PRODUCTION_COMPLETED', 'DELAYED'
  ) THEN
    RAISE EXCEPTION 'unsupported production status';
  END IF;

  SELECT * INTO supplier_order_record
  FROM public.supplier_orders
  WHERE id = supplier_order_id_input
  FOR UPDATE;
  IF NOT FOUND OR supplier_order_record.status IN ('DRAFT', 'CANCELLED') THEN
    RAISE EXCEPTION 'supplier order cannot receive production updates';
  END IF;

  INSERT INTO public.production_updates (
    supplier_order_id, organization_id, status, note,
    estimated_completion_at, created_by
  )
  VALUES (
    supplier_order_id_input, supplier_order_record.organization_id,
    status_input, note_input, estimated_completion_at_input, (SELECT auth.uid())
  )
  RETURNING id INTO update_id_value;

  UPDATE public.supplier_orders
  SET status = CASE
    WHEN status_input = 'PRODUCTION_COMPLETED' THEN 'PRODUCTION_COMPLETED'
    WHEN status_input IN (
      'MATERIAL_PREPARATION', 'IN_PRODUCTION', 'ASSEMBLY', 'FINISHING', 'DELAYED'
    ) THEN 'IN_PRODUCTION'
    ELSE status
  END
  WHERE id = supplier_order_id_input;

  RETURN update_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_qc_inspection(
  order_item_id_input UUID,
  result_input TEXT,
  note_input TEXT DEFAULT NULL,
  report_file_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  item_record public.order_items%ROWTYPE;
  inspection_id_value UUID;
BEGIN
  IF NOT public.has_permission('qc.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF result_input NOT IN ('PASSED', 'FAILED', 'REWORK_REQUIRED') THEN
    RAISE EXCEPTION 'invalid QC result';
  END IF;

  SELECT * INTO item_record FROM public.order_items
  WHERE id = order_item_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order item not found'; END IF;

  INSERT INTO public.qc_inspections (
    order_item_id, organization_id, result, note, report_file_id, inspected_by
  )
  VALUES (
    item_record.id, item_record.organization_id, result_input, note_input,
    report_file_id_input, (SELECT auth.uid())
  )
  RETURNING id INTO inspection_id_value;

  UPDATE public.order_items
  SET qc_status = result_input,
      custom_member_approved_at = CASE
        WHEN result_input <> 'PASSED' THEN NULL
        ELSE custom_member_approved_at
      END,
      custom_member_approved_by = CASE
        WHEN result_input <> 'PASSED' THEN NULL
        ELSE custom_member_approved_by
      END
  WHERE id = item_record.id;

  PERFORM public.write_audit_event(
    item_record.organization_id, 'qc_inspection', inspection_id_value,
    result_input
  );
  RETURN inspection_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_custom_qc(order_item_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  item_record public.order_items%ROWTYPE;
BEGIN
  SELECT * INTO item_record
  FROM public.order_items
  WHERE id = order_item_id_input
    AND public.can_access_org(organization_id)
  FOR UPDATE;
  IF NOT FOUND OR item_record.item_type <> 'CUSTOM'
    OR item_record.qc_status <> 'PASSED' THEN
    RAISE EXCEPTION 'custom item is not approvable';
  END IF;

  UPDATE public.order_items
  SET custom_member_approved_at = NOW(),
      custom_member_approved_by = (SELECT auth.uid())
  WHERE id = order_item_id_input;

  PERFORM public.write_audit_event(
    item_record.organization_id, 'order_item', order_item_id_input,
    'CUSTOM_QC_MEMBER_APPROVED'
  );
  RETURN order_item_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_dispatch_order_item(order_item_id_input UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.customer_orders co ON co.id = oi.order_id
    JOIN public.payment_schedules balance_ps
      ON balance_ps.order_id = co.id
     AND balance_ps.schedule_type = 'BALANCE'
    JOIN public.supplier_order_items soi ON soi.order_item_id = oi.id
    JOIN public.supplier_orders so ON so.id = soi.supplier_order_id
    WHERE oi.id = order_item_id_input
      AND oi.qc_status = 'PASSED'
      AND (oi.item_type = 'STANDARD' OR oi.custom_member_approved_at IS NOT NULL)
      AND balance_ps.status = 'VERIFIED'
      AND so.supplier_balance_paid_at IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.create_shipment(
  shipment_name_input TEXT,
  items_input JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  shipment_id_value UUID;
  shipment_number_value TEXT;
  organization_id_value UUID;
  item_input RECORD;
  order_item_record public.order_items%ROWTYPE;
  already_shipped NUMERIC(12,3);
BEGIN
  IF NOT public.has_permission('shipments.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF jsonb_typeof(items_input) <> 'array' OR jsonb_array_length(items_input) = 0 THEN
    RAISE EXCEPTION 'shipment items are required';
  END IF;

  FOR item_input IN
    SELECT * FROM jsonb_to_recordset(items_input)
      AS x(order_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT * INTO order_item_record
    FROM public.order_items
    WHERE id = item_input.order_item_id
    FOR UPDATE;
    IF NOT FOUND OR NOT public.can_dispatch_order_item(order_item_record.id) THEN
      RAISE EXCEPTION 'dispatch gate failed for order item %', item_input.order_item_id;
    END IF;
    IF organization_id_value IS NULL THEN
      organization_id_value := order_item_record.organization_id;
    ELSIF organization_id_value <> order_item_record.organization_id THEN
      RAISE EXCEPTION 'one shipment cannot mix member organizations';
    END IF;

    SELECT COALESCE(SUM(si.quantity), 0)
    INTO already_shipped
    FROM public.shipment_items si
    JOIN public.shipments s ON s.id = si.shipment_id
    WHERE si.order_item_id = order_item_record.id
      AND s.status <> 'CANCELLED';

    IF item_input.quantity IS NULL OR item_input.quantity <= 0
      OR already_shipped + item_input.quantity > order_item_record.quantity THEN
      RAISE EXCEPTION 'shipment quantity exceeds dispatch-ready quantity';
    END IF;
  END LOOP;

  shipment_number_value := public.next_document_number('SHP');
  INSERT INTO public.shipments (
    organization_id, shipment_number, shipment_name, created_by
  )
  VALUES (
    organization_id_value, shipment_number_value,
    BTRIM(shipment_name_input), (SELECT auth.uid())
  )
  RETURNING id INTO shipment_id_value;

  INSERT INTO public.shipment_items (
    shipment_id, organization_id, order_item_id, quantity
  )
  SELECT
    shipment_id_value, organization_id_value, x.order_item_id, x.quantity
  FROM jsonb_to_recordset(items_input)
    AS x(order_item_id UUID, quantity NUMERIC);

  PERFORM public.write_audit_event(
    organization_id_value, 'shipment', shipment_id_value, 'GATE_CHECKED',
    NULL, jsonb_build_object('shipment_number', shipment_number_value)
  );
  RETURN shipment_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_shipment(shipment_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  shipment_record public.shipments%ROWTYPE;
BEGIN
  IF NOT public.has_permission('shipments.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  SELECT * INTO shipment_record
  FROM public.shipments WHERE id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR shipment_record.status <> 'GATE_CHECKED' THEN
    RAISE EXCEPTION 'shipment is not dispatchable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shipment_items si
    WHERE si.shipment_id = shipment_id_input
      AND NOT public.can_dispatch_order_item(si.order_item_id)
  ) THEN
    RAISE EXCEPTION 'dispatch gate changed; recheck required';
  END IF;

  UPDATE public.shipments
  SET status = 'DISPATCHED', dispatched_at = NOW()
  WHERE id = shipment_id_input;

  PERFORM public.write_audit_event(
    shipment_record.organization_id, 'shipment', shipment_id_input, 'DISPATCHED'
  );
  RETURN shipment_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_delivery(
  shipment_id_input UUID,
  recipient_name_input TEXT,
  proof_file_id_input UUID,
  delivered_with_issue_input BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  shipment_record public.shipments%ROWTYPE;
  delivery_id_value UUID;
  delivery_number_value TEXT;
BEGIN
  IF NOT public.has_permission('deliveries.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  SELECT * INTO shipment_record
  FROM public.shipments WHERE id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR shipment_record.status NOT IN ('DISPATCHED', 'IN_TRANSIT', 'ARRIVED') THEN
    RAISE EXCEPTION 'shipment is not deliverable';
  END IF;
  IF NULLIF(BTRIM(recipient_name_input), '') IS NULL OR proof_file_id_input IS NULL THEN
    RAISE EXCEPTION 'recipient and proof are required';
  END IF;

  delivery_number_value :=
    'DLV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));

  INSERT INTO public.deliveries (
    shipment_id, organization_id, delivery_number, status,
    delivered_at, recipient_name, proof_file_id, created_by
  )
  VALUES (
    shipment_record.id, shipment_record.organization_id, delivery_number_value,
    CASE WHEN delivered_with_issue_input THEN 'DELIVERED_WITH_ISSUE' ELSE 'DELIVERED' END,
    NOW(), BTRIM(recipient_name_input), proof_file_id_input, (SELECT auth.uid())
  )
  RETURNING id INTO delivery_id_value;

  INSERT INTO public.delivery_items (
    delivery_id, organization_id, order_item_id, quantity_delivered,
    condition
  )
  SELECT
    delivery_id_value, shipment_record.organization_id, si.order_item_id,
    si.quantity,
    CASE WHEN delivered_with_issue_input THEN 'OTHER' ELSE 'GOOD' END
  FROM public.shipment_items si
  WHERE si.shipment_id = shipment_record.id;

  UPDATE public.shipments
  SET status = 'DELIVERED'
  WHERE id = shipment_record.id;

  PERFORM public.write_audit_event(
    shipment_record.organization_id, 'delivery', delivery_id_value,
    CASE WHEN delivered_with_issue_input THEN 'DELIVERED_WITH_ISSUE' ELSE 'DELIVERED' END
  );
  RETURN delivery_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_claim(
  delivery_item_id_input UUID,
  issue_type_input TEXT,
  description_input TEXT,
  evidence_file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  delivery_item_record public.delivery_items%ROWTYPE;
  claim_id_value UUID;
  claim_number_value TEXT;
BEGIN
  SELECT * INTO delivery_item_record
  FROM public.delivery_items
  WHERE id = delivery_item_id_input
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'delivered item not found'; END IF;
  IF issue_type_input NOT IN ('DAMAGED', 'MISSING', 'WRONG_ITEM', 'QUALITY', 'OTHER') THEN
    RAISE EXCEPTION 'invalid claim type';
  END IF;
  IF evidence_file_id_input IS NULL THEN RAISE EXCEPTION 'claim evidence required'; END IF;

  claim_number_value := public.next_document_number('CLM');
  INSERT INTO public.claims (
    organization_id, delivery_item_id, claim_number, issue_type,
    description, evidence_file_id, opened_by
  )
  VALUES (
    delivery_item_record.organization_id, delivery_item_record.id,
    claim_number_value, issue_type_input, BTRIM(description_input),
    evidence_file_id_input, (SELECT auth.uid())
  )
  RETURNING id INTO claim_id_value;

  INSERT INTO public.claim_events (
    claim_id, organization_id, action, note, actor_user_id
  )
  VALUES (
    claim_id_value, delivery_item_record.organization_id, 'OPENED',
    description_input, (SELECT auth.uid())
  );

  PERFORM public.write_audit_event(
    delivery_item_record.organization_id, 'claim', claim_id_value, 'OPENED',
    NULL, jsonb_build_object('claim_number', claim_number_value)
  );
  RETURN claim_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_claim(
  claim_id_input UUID,
  resolution_input TEXT DEFAULT NULL,
  rejection_reason_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  claim_record public.claims%ROWTYPE;
  target_status TEXT;
BEGIN
  IF NOT public.has_permission('claims.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF NULLIF(BTRIM(resolution_input), '') IS NULL
    AND NULLIF(BTRIM(rejection_reason_input), '') IS NULL THEN
    RAISE EXCEPTION 'resolution or rejection reason is required';
  END IF;

  SELECT * INTO claim_record
  FROM public.claims WHERE id = claim_id_input FOR UPDATE;
  IF NOT FOUND OR claim_record.status IN ('RESOLVED', 'REJECTED', 'CLOSED') THEN
    RAISE EXCEPTION 'claim is not resolvable';
  END IF;

  target_status := CASE
    WHEN NULLIF(BTRIM(rejection_reason_input), '') IS NOT NULL THEN 'REJECTED'
    ELSE 'RESOLVED'
  END;

  UPDATE public.claims
  SET status = target_status,
      resolution = NULLIF(BTRIM(resolution_input), ''),
      rejection_reason = NULLIF(BTRIM(rejection_reason_input), ''),
      resolved_by = (SELECT auth.uid()),
      resolved_at = NOW()
  WHERE id = claim_id_input;

  INSERT INTO public.claim_events (
    claim_id, organization_id, action, note, actor_user_id
  )
  VALUES (
    claim_id_input, claim_record.organization_id, target_status,
    COALESCE(resolution_input, rejection_reason_input), (SELECT auth.uid())
  );
  RETURN claim_id_input;
END;
$$;

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_orders_org ON public.customer_orders
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY customer_orders_internal ON public.customer_orders
  FOR SELECT TO authenticated USING (public.has_permission('orders.manage', organization_id));

CREATE POLICY order_items_org ON public.order_items
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));

CREATE POLICY supplier_orders_internal ON public.supplier_orders
  FOR SELECT TO authenticated
  USING (
    public.has_permission('orders.manage', organization_id)
    OR public.has_permission('supplier_payments.manage', organization_id)
    OR public.has_permission('production.manage', organization_id)
    OR public.has_permission('qc.manage', organization_id)
    OR public.has_permission('shipments.manage', organization_id)
  );

CREATE POLICY supplier_order_items_internal ON public.supplier_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.supplier_orders so
      WHERE so.id = supplier_order_id
        AND (
          public.has_permission('orders.manage', so.organization_id)
          OR public.has_permission('supplier_payments.manage', so.organization_id)
          OR public.has_permission('production.manage', so.organization_id)
          OR public.has_permission('qc.manage', so.organization_id)
          OR public.has_permission('shipments.manage', so.organization_id)
        )
    )
  );

CREATE POLICY payment_schedules_org ON public.payment_schedules
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY payment_schedules_finance ON public.payment_schedules
  FOR SELECT TO authenticated USING (public.has_permission('payments.verify', organization_id));

CREATE POLICY payment_transfers_org ON public.payment_transfers
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY payment_transfers_finance ON public.payment_transfers
  FOR SELECT TO authenticated USING (public.has_permission('payments.verify', organization_id));

CREATE POLICY supplier_payments_internal ON public.supplier_payments
  FOR SELECT TO authenticated
  USING (public.has_permission('supplier_payments.manage'));

CREATE POLICY production_updates_visible ON public.production_updates
  FOR SELECT TO authenticated
  USING (
    public.has_permission('production.manage', organization_id)
    OR public.has_permission('qc.manage', organization_id)
    OR (is_member_visible AND public.can_access_org(organization_id))
  );

CREATE POLICY qc_inspections_visible ON public.qc_inspections
  FOR SELECT TO authenticated
  USING (
    public.has_permission('qc.manage', organization_id)
    OR (is_member_visible AND public.can_access_org(organization_id))
  );

CREATE POLICY shipments_org ON public.shipments
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY shipment_items_org ON public.shipment_items
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY deliveries_org ON public.deliveries
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY delivery_items_org ON public.delivery_items
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY claims_org ON public.claims
  FOR SELECT TO authenticated USING (public.can_access_org(organization_id));
CREATE POLICY claim_events_visible ON public.claim_events
  FOR SELECT TO authenticated
  USING (
    public.has_permission('claims.manage', organization_id)
    OR (is_member_visible AND public.can_access_org(organization_id))
  );
CREATE POLICY status_events_visible ON public.status_events
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_internal()
    OR (is_member_visible AND organization_id IS NOT NULL
      AND public.can_access_org(organization_id))
  );

REVOKE ALL ON public.customer_orders, public.order_items,
  public.supplier_orders, public.supplier_order_items,
  public.payment_schedules, public.payment_transfers,
  public.supplier_payments, public.production_updates,
  public.qc_inspections, public.shipments, public.shipment_items,
  public.deliveries, public.delivery_items, public.claims,
  public.claim_events, public.status_events
  FROM anon, authenticated;

GRANT SELECT ON public.customer_orders, public.order_items,
  public.supplier_orders, public.supplier_order_items,
  public.payment_schedules, public.payment_transfers,
  public.supplier_payments, public.production_updates,
  public.qc_inspections, public.shipments, public.shipment_items,
  public.deliveries, public.delivery_items, public.claims,
  public.claim_events, public.status_events
  TO authenticated;

REVOKE UPDATE, DELETE ON public.production_updates, public.qc_inspections,
  public.claim_events, public.status_events FROM authenticated;

REVOKE ALL ON FUNCTION public.create_customer_order(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_payment_transfer(UUID, NUMERIC, TIMESTAMPTZ, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_payment_transfer(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_supplier_orders(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_supplier_payment(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_supplier_payment_paid(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_production_update(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_qc_inspection(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_custom_qc(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_dispatch_order_item(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_shipment(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dispatch_shipment(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_delivery(UUID, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_claim(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_claim(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_customer_order(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_transfer(UUID, NUMERIC, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment_transfer(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_supplier_orders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_payment(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_supplier_payment_paid(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_production_update(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_qc_inspection(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_custom_qc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_dispatch_order_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shipment(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_shipment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_delivery(UUID, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_claim(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_claim(UUID, TEXT, TEXT) TO authenticated;

