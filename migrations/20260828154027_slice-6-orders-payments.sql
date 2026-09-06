-- Slice 6: customer orders, customer/supplier payments, PO gate and cancellation.
-- Member-facing records are intentionally separated from supplier cost/payment data.

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS shipping_address_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

UPDATE public.customer_orders co
SET member_profile_id = p.member_profile_id
FROM public.projects p
WHERE p.id = co.project_id
  AND co.member_profile_id IS NULL;

ALTER TABLE public.customer_orders
  DROP CONSTRAINT IF EXISTS customer_orders_status_check;
ALTER TABLE public.customer_orders
  ADD CONSTRAINT customer_orders_status_check CHECK (status IN (
    'DRAFT', 'PENDING_DEPOSIT', 'DEPOSIT_VERIFIED', 'CANCELLATION_REQUESTED',
    'PO_ISSUED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'PARTIALLY_SHIPPED',
    'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'
  ));

ALTER TABLE public.supplier_orders
  ADD COLUMN IF NOT EXISTS supplier_order_number TEXT,
  ALTER COLUMN po_number DROP NOT NULL;

UPDATE public.supplier_orders
SET supplier_order_number = public.next_document_number('SO')
WHERE supplier_order_number IS NULL;

UPDATE public.supplier_orders
SET po_number = NULL
WHERE status = 'DRAFT' AND po_issued_at IS NULL;

ALTER TABLE public.supplier_orders
  ALTER COLUMN supplier_order_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_orders_number_uidx
  ON public.supplier_orders(supplier_order_number);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_order_id UUID NOT NULL UNIQUE REFERENCES public.supplier_orders(id) ON DELETE RESTRICT,
  purchase_order_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  currency CHAR(3) NOT NULL,
  total_amount NUMERIC(18,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'CANCELLED')),
  issued_by UUID NOT NULL REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_order_id UUID NOT NULL REFERENCES public.supplier_orders(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('DEPOSIT', 'BALANCE')),
  due_amount NUMERIC(18,2) NOT NULL CHECK (due_amount >= 0),
  paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERPAYMENT_REVIEW', 'CANCELLED'
  )),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_order_id, schedule_type)
);

ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS payment_schedule_id UUID REFERENCES public.supplier_payment_schedules(id),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.supplier_payments
  DROP CONSTRAINT IF EXISTS supplier_payments_status_check;
ALTER TABLE public.supplier_payments
  ADD CONSTRAINT supplier_payments_status_check
  CHECK (status IN ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED'));

CREATE UNIQUE INDEX IF NOT EXISTS supplier_payments_reference_uidx
  ON public.supplier_payments(payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  payment_transfer_id UUID NOT NULL REFERENCES public.payment_transfers(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('VERIFIED', 'REJECTED')),
  amount_snapshot NUMERIC(18,2) NOT NULL CHECK (amount_snapshot > 0),
  schedule_verified_amount_snapshot NUMERIC(18,2) NOT NULL DEFAULT 0,
  schedule_status_snapshot TEXT NOT NULL,
  note TEXT,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_payment_id UUID NOT NULL REFERENCES public.supplier_payments(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('REQUESTED', 'APPROVED', 'REJECTED', 'PAID')),
  amount_snapshot NUMERIC(18,2) NOT NULL CHECK (amount_snapshot > 0),
  note TEXT,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  member_profile_id UUID NOT NULL REFERENCES public.member_profiles(id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED')),
  previous_order_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  supporting_file_id UUID REFERENCES public.file_metadata(id),
  deposit_verified_amount_snapshot NUMERIC(18,2) NOT NULL DEFAULT 0,
  approved_refund_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (approved_refund_amount >= 0),
  approved_deduction_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (approved_deduction_amount >= 0),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cancellation_requests_open_uidx
  ON public.cancellation_requests(order_id)
  WHERE status = 'SUBMITTED';
CREATE INDEX IF NOT EXISTS purchase_orders_org_idx
  ON public.purchase_orders(organization_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS supplier_payment_schedules_order_idx
  ON public.supplier_payment_schedules(supplier_order_id, schedule_type);
CREATE INDEX IF NOT EXISTS payment_verification_logs_transfer_idx
  ON public.payment_verification_logs(payment_transfer_id, created_at);
CREATE INDEX IF NOT EXISTS supplier_payment_history_payment_idx
  ON public.supplier_payment_history(supplier_payment_id, created_at);
CREATE INDEX IF NOT EXISTS cancellation_requests_order_idx
  ON public.cancellation_requests(order_id, created_at DESC);

DROP TRIGGER IF EXISTS supplier_payment_schedules_updated_at ON public.supplier_payment_schedules;
CREATE TRIGGER supplier_payment_schedules_updated_at
BEFORE UPDATE ON public.supplier_payment_schedules
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
DROP TRIGGER IF EXISTS supplier_payments_updated_at ON public.supplier_payments;
CREATE TRIGGER supplier_payments_updated_at
BEFORE UPDATE ON public.supplier_payments
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
DROP TRIGGER IF EXISTS cancellation_requests_updated_at ON public.cancellation_requests;
CREATE TRIGGER cancellation_requests_updated_at
BEFORE UPDATE ON public.cancellation_requests
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

DROP TRIGGER IF EXISTS payment_verification_logs_append_only ON public.payment_verification_logs;
CREATE TRIGGER payment_verification_logs_append_only
BEFORE UPDATE OR DELETE ON public.payment_verification_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();
DROP TRIGGER IF EXISTS supplier_payment_history_append_only ON public.supplier_payment_history;
CREATE TRIGGER supplier_payment_history_append_only
BEFORE UPDATE OR DELETE ON public.supplier_payment_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

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
    RAISE EXCEPTION 'AT_LEAST_ONE_ITEM_REQUIRED';
  END IF;

  SELECT * INTO project_record
  FROM public.projects
  WHERE id = project_id_input
    AND member_profile_id = public.current_member_profile_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;

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
    IF NOT FOUND OR project_item_record.status NOT IN ('READY_TO_ORDER', 'PARTIALLY_ORDERED') THEN
      RAISE EXCEPTION 'PROJECT_ITEM_NOT_READY';
    END IF;
    IF selection_record.quantity IS NULL OR selection_record.quantity <= 0
      OR selection_record.quantity > (project_item_record.quantity - project_item_record.ordered_quantity) THEN
      RAISE EXCEPTION 'INVALID_ORDER_QUANTITY';
    END IF;
    IF vat_rate_value IS NULL THEN
      vat_rate_value := project_item_record.vat_rate_snapshot;
    ELSIF vat_rate_value <> project_item_record.vat_rate_snapshot THEN
      RAISE EXCEPTION 'MIXED_VAT_SNAPSHOTS';
    END IF;
    line_subtotal_value := ROUND(selection_record.quantity * project_item_record.current_unit_price, 2);
    line_vat_value := ROUND(line_subtotal_value * project_item_record.vat_rate_snapshot / 100, 2);
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
    organization_id, member_profile_id, project_id, order_number, subtotal,
    vat_rate_snapshot, vat_amount, grand_total, deposit_amount, balance_amount,
    shipping_address_snapshot, created_by
  ) VALUES (
    project_record.organization_id, project_record.member_profile_id, project_id_input,
    order_number_value, subtotal_value, vat_rate_value, vat_amount_value,
    grand_total_value, deposit_value, balance_value,
    jsonb_build_object('site_address', project_record.site_address), (SELECT auth.uid())
  ) RETURNING id INTO order_id_value;

  FOR selection_record IN
    SELECT * FROM jsonb_to_recordset(selections_input)
      AS x(project_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT * INTO project_item_record
    FROM public.project_items WHERE id = selection_record.project_item_id FOR UPDATE;

    IF project_item_record.item_type = 'STANDARD' THEN
      SELECT p.supplier_id, p.factory_cost
      INTO supplier_id_value, factory_unit_cost_value
      FROM public.products p WHERE p.id = project_item_record.product_id;
    ELSE
      SELECT cqc.* INTO quotation_cost_record
      FROM public.custom_quotation_items cqi
      JOIN public.custom_quotation_costs cqc ON cqc.quotation_id = cqi.quotation_id
      WHERE cqi.id = project_item_record.quotation_item_id;
      supplier_id_value := quotation_cost_record.supplier_id;
      SELECT ROUND(quotation_cost_record.supplier_cost_total / cqi.quantity, 2)
      INTO factory_unit_cost_value
      FROM public.custom_quotation_items cqi
      WHERE cqi.id = project_item_record.quotation_item_id;
    END IF;
    IF supplier_id_value IS NULL OR factory_unit_cost_value IS NULL OR factory_unit_cost_value <= 0 THEN
      RAISE EXCEPTION 'SUPPLIER_COST_REQUIRED';
    END IF;

    line_subtotal_value := ROUND(selection_record.quantity * project_item_record.current_unit_price, 2);
    line_vat_value := ROUND(line_subtotal_value * project_item_record.vat_rate_snapshot / 100, 2);
    INSERT INTO public.order_items (
      order_id, organization_id, project_item_id, item_type, item_name_snapshot,
      specification_snapshot, options_snapshot, quantity, unit, unit_price_snapshot,
      line_subtotal, vat_rate_snapshot, vat_amount, line_total
    ) VALUES (
      order_id_value, project_record.organization_id, project_item_record.id,
      project_item_record.item_type, project_item_record.item_name,
      project_item_record.specification_snapshot, project_item_record.selected_options,
      selection_record.quantity, project_item_record.unit, project_item_record.current_unit_price,
      line_subtotal_value, project_item_record.vat_rate_snapshot, line_vat_value,
      ROUND(line_subtotal_value + line_vat_value, 2)
    ) RETURNING id INTO order_item_id_value;

    SELECT id INTO supplier_order_id_value
    FROM public.supplier_orders
    WHERE customer_order_id = order_id_value AND supplier_id = supplier_id_value;
    IF supplier_order_id_value IS NULL THEN
      INSERT INTO public.supplier_orders (
        customer_order_id, organization_id, supplier_id, supplier_order_number, po_number
      ) VALUES (
        order_id_value, project_record.organization_id, supplier_id_value,
        public.next_document_number('SO'), NULL
      ) RETURNING id INTO supplier_order_id_value;
    END IF;

    INSERT INTO public.supplier_order_items (
      supplier_order_id, order_item_id, quantity, factory_unit_cost_snapshot, factory_line_total
    ) VALUES (
      supplier_order_id_value, order_item_id_value, selection_record.quantity,
      factory_unit_cost_value, ROUND(factory_unit_cost_value * selection_record.quantity, 2)
    );
    UPDATE public.project_items
    SET ordered_quantity = ordered_quantity + selection_record.quantity,
        status = CASE WHEN ordered_quantity + selection_record.quantity = quantity
          THEN 'ORDERED' ELSE 'PARTIALLY_ORDERED' END
    WHERE id = project_item_record.id;
  END LOOP;

  UPDATE public.supplier_orders so
  SET total_factory_cost = totals.total_value
  FROM (
    SELECT soi.supplier_order_id, ROUND(SUM(soi.factory_line_total), 2) total_value
    FROM public.supplier_order_items soi
    JOIN public.supplier_orders grouped_so ON grouped_so.id = soi.supplier_order_id
    WHERE grouped_so.customer_order_id = order_id_value
    GROUP BY soi.supplier_order_id
  ) totals
  WHERE so.id = totals.supplier_order_id;

  INSERT INTO public.payment_schedules(order_id, organization_id, schedule_type, due_amount)
  VALUES
    (order_id_value, project_record.organization_id, 'DEPOSIT', deposit_value),
    (order_id_value, project_record.organization_id, 'BALANCE', balance_value);

  INSERT INTO public.supplier_payment_schedules(
    organization_id, supplier_order_id, schedule_type, due_amount
  )
  SELECT so.organization_id, so.id, schedule_type,
    CASE WHEN schedule_type = 'DEPOSIT' THEN ROUND(so.total_factory_cost * 0.50, 2)
      ELSE ROUND(so.total_factory_cost - ROUND(so.total_factory_cost * 0.50, 2), 2) END
  FROM public.supplier_orders so
  CROSS JOIN (VALUES ('DEPOSIT'), ('BALANCE')) schedule_types(schedule_type)
  WHERE so.customer_order_id = order_id_value;

  INSERT INTO public.status_events(
    organization_id, entity_type, entity_id, from_status, to_status,
    actor_user_id, reason, is_member_visible
  ) VALUES (
    project_record.organization_id, 'customer_order', order_id_value, NULL,
    'PENDING_DEPOSIT', (SELECT auth.uid()), 'ORDER_CREATED', TRUE
  );
  PERFORM public.write_audit_event(
    project_record.organization_id, 'customer_order', order_id_value, 'CREATED', NULL,
    jsonb_build_object('order_number', order_number_value, 'subtotal', subtotal_value,
      'vat_rate', vat_rate_value, 'vat_amount', vat_amount_value,
      'grand_total', grand_total_value, 'deposit', deposit_value, 'balance', balance_value)
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
  order_record public.customer_orders%ROWTYPE;
  transfer_id_value UUID;
BEGIN
  SELECT ps.* INTO schedule_record
  FROM public.payment_schedules ps
  JOIN public.customer_orders co ON co.id = ps.order_id
  WHERE ps.id = payment_schedule_id_input
    AND co.member_profile_id = public.current_member_profile_id()
  FOR UPDATE OF ps;
  IF NOT FOUND OR schedule_record.status NOT IN ('PENDING', 'PARTIALLY_VERIFIED') THEN
    RAISE EXCEPTION 'PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;
  SELECT * INTO order_record FROM public.customer_orders WHERE id = schedule_record.order_id;
  IF order_record.status IN ('CANCELLED', 'CANCELLATION_REQUESTED') THEN
    RAISE EXCEPTION 'ORDER_NOT_PAYABLE';
  END IF;
  IF amount_input IS NULL OR amount_input <= 0 THEN RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.file_metadata fm
    WHERE fm.id = evidence_file_id_input
      AND fm.organization_id = schedule_record.organization_id
      AND fm.member_profile_id = order_record.member_profile_id
      AND fm.visibility = 'MEMBER_PRIVATE'
  ) THEN RAISE EXCEPTION 'PAYMENT_EVIDENCE_REQUIRED'; END IF;

  INSERT INTO public.payment_transfers(
    payment_schedule_id, organization_id, transfer_number, amount,
    transferred_at, evidence_file_id, submitted_by
  ) VALUES (
    schedule_record.id, schedule_record.organization_id, public.next_document_number('PAY'),
    ROUND(amount_input, 2), transferred_at_input, evidence_file_id_input, (SELECT auth.uid())
  ) RETURNING id INTO transfer_id_value;
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
  order_record public.customer_orders%ROWTYPE;
  verified_total NUMERIC(18,2);
  new_schedule_status TEXT;
BEGIN
  IF NOT public.has_permission('payments.verify') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO transfer_record FROM public.payment_transfers
  WHERE id = transfer_id_input FOR UPDATE;
  IF NOT FOUND OR transfer_record.status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'TRANSFER_NOT_VERIFIABLE';
  END IF;
  SELECT * INTO schedule_record FROM public.payment_schedules
  WHERE id = transfer_record.payment_schedule_id FOR UPDATE;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = schedule_record.order_id FOR UPDATE;

  IF NOT approve_input THEN
    IF NULLIF(BTRIM(finance_note_input), '') IS NULL THEN
      RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
    END IF;
    UPDATE public.payment_transfers
    SET status = 'REJECTED', finance_verified_by = (SELECT auth.uid()),
        finance_verified_at = NOW(), finance_note = BTRIM(finance_note_input)
    WHERE id = transfer_id_input;
    INSERT INTO public.payment_verification_logs(
      organization_id, payment_transfer_id, action, amount_snapshot,
      schedule_verified_amount_snapshot, schedule_status_snapshot, note, actor_user_id
    ) VALUES (
      transfer_record.organization_id, transfer_id_input, 'REJECTED', transfer_record.amount,
      schedule_record.verified_amount, schedule_record.status, BTRIM(finance_note_input), (SELECT auth.uid())
    );
    PERFORM public.write_audit_event(
      transfer_record.organization_id, 'payment_transfer', transfer_id_input,
      'REJECTED', NULL, jsonb_build_object('note', BTRIM(finance_note_input))
    );
    RETURN transfer_id_input;
  END IF;

  UPDATE public.payment_transfers
  SET status = 'VERIFIED', finance_verified_by = (SELECT auth.uid()),
      finance_verified_at = NOW(), finance_note = NULLIF(BTRIM(finance_note_input), '')
  WHERE id = transfer_id_input;
  SELECT COALESCE(ROUND(SUM(amount), 2), 0) INTO verified_total
  FROM public.payment_transfers
  WHERE payment_schedule_id = schedule_record.id AND status = 'VERIFIED';
  new_schedule_status := CASE
    WHEN verified_total > schedule_record.due_amount THEN 'OVERPAYMENT_REVIEW'
    WHEN verified_total = schedule_record.due_amount THEN 'VERIFIED'
    WHEN verified_total > 0 THEN 'PARTIALLY_VERIFIED' ELSE 'PENDING' END;
  UPDATE public.payment_schedules
  SET verified_amount = verified_total, status = new_schedule_status,
      verified_at = CASE WHEN new_schedule_status = 'VERIFIED' THEN NOW() ELSE NULL END
  WHERE id = schedule_record.id;

  IF schedule_record.schedule_type = 'DEPOSIT' THEN
    UPDATE public.customer_orders
    SET deposit_verified_at = CASE WHEN new_schedule_status = 'VERIFIED' THEN NOW() ELSE NULL END,
        status = CASE
          WHEN new_schedule_status = 'VERIFIED' AND status = 'PENDING_DEPOSIT' THEN 'DEPOSIT_VERIFIED'
          WHEN new_schedule_status <> 'VERIFIED' AND status = 'DEPOSIT_VERIFIED' THEN 'PENDING_DEPOSIT'
          ELSE status END
    WHERE id = schedule_record.order_id;
  ELSIF schedule_record.schedule_type = 'BALANCE' THEN
    UPDATE public.customer_orders
    SET balance_verified_at = CASE WHEN new_schedule_status = 'VERIFIED' THEN NOW() ELSE NULL END
    WHERE id = schedule_record.order_id;
  END IF;

  INSERT INTO public.payment_verification_logs(
    organization_id, payment_transfer_id, action, amount_snapshot,
    schedule_verified_amount_snapshot, schedule_status_snapshot, note, actor_user_id
  ) VALUES (
    transfer_record.organization_id, transfer_id_input, 'VERIFIED', transfer_record.amount,
    verified_total, new_schedule_status, NULLIF(BTRIM(finance_note_input), ''), (SELECT auth.uid())
  );
  PERFORM public.write_audit_event(
    transfer_record.organization_id, 'payment_transfer', transfer_id_input, 'VERIFIED', NULL,
    jsonb_build_object('amount', transfer_record.amount,
      'schedule_verified_amount', verified_total, 'schedule_status', new_schedule_status)
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
  supplier_order_record RECORD;
  po_number_value TEXT;
BEGIN
  IF NOT public.has_permission('orders.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = order_id_input FOR UPDATE;
  IF NOT FOUND OR order_record.status <> 'DEPOSIT_VERIFIED' THEN
    RAISE EXCEPTION 'ORDER_NOT_READY_FOR_PO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.payment_schedules
    WHERE order_id = order_id_input AND schedule_type = 'DEPOSIT'
      AND status = 'VERIFIED' AND verified_amount = due_amount
  ) THEN RAISE EXCEPTION 'DEPOSIT_MUST_BE_FULLY_VERIFIED'; END IF;

  FOR supplier_order_record IN
    SELECT * FROM public.supplier_orders
    WHERE customer_order_id = order_id_input AND status = 'DRAFT'
    FOR UPDATE
  LOOP
    po_number_value := public.next_document_number('PO');
    UPDATE public.supplier_orders
    SET status = 'PO_ISSUED', po_number = po_number_value, po_issued_at = NOW()
    WHERE id = supplier_order_record.id;
    INSERT INTO public.purchase_orders(
      organization_id, supplier_order_id, purchase_order_number, supplier_id,
      currency, total_amount, issued_by
    ) VALUES (
      supplier_order_record.organization_id, supplier_order_record.id, po_number_value,
      supplier_order_record.supplier_id, supplier_order_record.supplier_currency,
      supplier_order_record.total_factory_cost, (SELECT auth.uid())
    );
  END LOOP;
  UPDATE public.customer_orders SET status = 'PO_ISSUED' WHERE id = order_id_input;
  INSERT INTO public.status_events(
    organization_id, entity_type, entity_id, from_status, to_status,
    actor_user_id, reason, is_member_visible
  ) VALUES (
    order_record.organization_id, 'customer_order', order_id_input,
    order_record.status, 'PO_ISSUED', (SELECT auth.uid()), 'PURCHASE_ORDERS_ISSUED', TRUE
  );
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
  supplier_order_record public.supplier_orders%ROWTYPE;
  schedule_record public.supplier_payment_schedules%ROWTYPE;
  reserved_amount NUMERIC(18,2);
  payment_id_value UUID;
  requested_type TEXT;
BEGIN
  IF NOT public.has_permission('supplier_payments.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF payment_type_input NOT IN ('DEPOSIT', 'BALANCE', 'PARTIAL')
    OR amount_input IS NULL OR amount_input <= 0 THEN
    RAISE EXCEPTION 'INVALID_SUPPLIER_PAYMENT';
  END IF;
  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = supplier_order_id_input FOR UPDATE;
  IF NOT FOUND OR supplier_order_record.status IN ('DRAFT', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUPPLIER_ORDER_NOT_PAYABLE';
  END IF;
  requested_type := CASE WHEN payment_type_input = 'PARTIAL' THEN
    CASE WHEN EXISTS (
      SELECT 1 FROM public.supplier_payment_schedules
      WHERE supplier_order_id = supplier_order_id_input AND schedule_type = 'DEPOSIT'
        AND status NOT IN ('PAID', 'CANCELLED')
    ) THEN 'DEPOSIT' ELSE 'BALANCE' END
    ELSE payment_type_input END;
  SELECT * INTO schedule_record FROM public.supplier_payment_schedules
  WHERE supplier_order_id = supplier_order_id_input AND schedule_type = requested_type
  FOR UPDATE;
  IF NOT FOUND OR schedule_record.status IN ('PAID', 'OVERPAYMENT_REVIEW', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO reserved_amount
  FROM public.supplier_payments
  WHERE payment_schedule_id = schedule_record.id AND status IN ('REQUESTED', 'APPROVED', 'PAID');
  IF ROUND(reserved_amount + amount_input, 2) > schedule_record.due_amount THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_EXCEEDS_OUTSTANDING';
  END IF;
  INSERT INTO public.supplier_payments(
    supplier_order_id, payment_schedule_id, payment_reference, payment_type,
    amount, currency, requested_by, note
  ) VALUES (
    supplier_order_id_input, schedule_record.id, public.next_document_number('PAY'),
    requested_type, ROUND(amount_input, 2), supplier_order_record.supplier_currency,
    (SELECT auth.uid()), NULLIF(BTRIM(note_input), '')
  ) RETURNING id INTO payment_id_value;
  INSERT INTO public.supplier_payment_history(
    organization_id, supplier_payment_id, action, amount_snapshot, note, actor_user_id
  ) VALUES (
    supplier_order_record.organization_id, payment_id_value, 'REQUESTED',
    ROUND(amount_input, 2), NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
  );
  RETURN payment_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_supplier_payment(
  supplier_payment_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  payment_record public.supplier_payments%ROWTYPE;
  supplier_order_record public.supplier_orders%ROWTYPE;
  target_status TEXT;
BEGIN
  IF NOT public.has_permission('supplier_payments.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO payment_record FROM public.supplier_payments
  WHERE id = supplier_payment_id_input FOR UPDATE;
  IF NOT FOUND OR payment_record.status <> 'REQUESTED' THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_NOT_REVIEWABLE';
  END IF;
  IF NOT approve_input AND NULLIF(BTRIM(decision_note_input), '') IS NULL THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;
  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = payment_record.supplier_order_id;
  target_status := CASE WHEN approve_input THEN 'APPROVED' ELSE 'REJECTED' END;
  UPDATE public.supplier_payments
  SET status = target_status, approved_by = (SELECT auth.uid()), reviewed_at = NOW(),
      rejection_reason = CASE WHEN approve_input THEN NULL ELSE BTRIM(decision_note_input) END,
      note = COALESCE(NULLIF(BTRIM(decision_note_input), ''), note)
  WHERE id = supplier_payment_id_input;
  INSERT INTO public.supplier_payment_history(
    organization_id, supplier_payment_id, action, amount_snapshot, note, actor_user_id
  ) VALUES (
    supplier_order_record.organization_id, supplier_payment_id_input, target_status,
    payment_record.amount, NULLIF(BTRIM(decision_note_input), ''), (SELECT auth.uid())
  );
  RETURN supplier_payment_id_input;
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
  schedule_record public.supplier_payment_schedules%ROWTYPE;
  schedule_paid_total NUMERIC(18,2);
  order_paid_total NUMERIC(18,2);
  schedule_status_value TEXT;
BEGIN
  IF NOT public.has_permission('supplier_payments.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO payment_record FROM public.supplier_payments
  WHERE id = supplier_payment_id_input FOR UPDATE;
  IF NOT FOUND OR payment_record.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_MUST_BE_APPROVED';
  END IF;
  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = payment_record.supplier_order_id FOR UPDATE;
  SELECT * INTO schedule_record FROM public.supplier_payment_schedules
  WHERE id = payment_record.payment_schedule_id FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.file_metadata fm
    WHERE fm.id = evidence_file_id_input
      AND fm.organization_id = supplier_order_record.organization_id
      AND fm.visibility = 'CONFIDENTIAL'
  ) THEN RAISE EXCEPTION 'CONFIDENTIAL_PAYMENT_EVIDENCE_REQUIRED'; END IF;

  UPDATE public.supplier_payments
  SET status = 'PAID', evidence_file_id = evidence_file_id_input,
      paid_by = (SELECT auth.uid()), paid_at = NOW()
  WHERE id = supplier_payment_id_input;
  SELECT COALESCE(ROUND(SUM(amount), 2), 0) INTO schedule_paid_total
  FROM public.supplier_payments
  WHERE payment_schedule_id = schedule_record.id AND status = 'PAID';
  schedule_status_value := CASE
    WHEN schedule_paid_total > schedule_record.due_amount THEN 'OVERPAYMENT_REVIEW'
    WHEN schedule_paid_total = schedule_record.due_amount THEN 'PAID'
    WHEN schedule_paid_total > 0 THEN 'PARTIALLY_PAID' ELSE 'PENDING' END;
  UPDATE public.supplier_payment_schedules
  SET paid_amount = schedule_paid_total, status = schedule_status_value,
      paid_at = CASE WHEN schedule_status_value = 'PAID' THEN NOW() ELSE NULL END
  WHERE id = schedule_record.id;
  SELECT COALESCE(ROUND(SUM(amount), 2), 0) INTO order_paid_total
  FROM public.supplier_payments
  WHERE supplier_order_id = supplier_order_record.id AND status = 'PAID';
  UPDATE public.supplier_orders
  SET paid_factory_amount = order_paid_total,
      supplier_balance_paid_at = CASE WHEN order_paid_total = total_factory_cost THEN NOW() ELSE NULL END
  WHERE id = supplier_order_record.id;
  INSERT INTO public.supplier_payment_history(
    organization_id, supplier_payment_id, action, amount_snapshot, note, actor_user_id
  ) VALUES (
    supplier_order_record.organization_id, supplier_payment_id_input, 'PAID',
    payment_record.amount, NULL, (SELECT auth.uid())
  );
  PERFORM public.write_audit_event(
    supplier_order_record.organization_id, 'supplier_payment', supplier_payment_id_input,
    'PAID', NULL, jsonb_build_object('schedule_paid_total', schedule_paid_total,
      'schedule_status', schedule_status_value, 'supplier_order_paid_total', order_paid_total)
  );
  RETURN supplier_payment_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_order_cancellation(
  order_id_input UUID,
  reason_input TEXT,
  supporting_file_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  order_record public.customer_orders%ROWTYPE;
  request_id_value UUID;
  deposit_verified_value NUMERIC(18,2);
  immediate_cancel BOOLEAN;
BEGIN
  IF NULLIF(BTRIM(reason_input), '') IS NULL THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED'; END IF;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = order_id_input AND member_profile_id = public.current_member_profile_id()
  FOR UPDATE;
  IF NOT FOUND OR order_record.status IN ('CANCELLED', 'COMPLETED') THEN
    RAISE EXCEPTION 'ORDER_NOT_CANCELLABLE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.cancellation_requests
    WHERE order_id = order_id_input AND status = 'SUBMITTED'
  ) THEN RAISE EXCEPTION 'CANCELLATION_ALREADY_SUBMITTED'; END IF;
  IF supporting_file_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.file_metadata
    WHERE id = supporting_file_id_input
      AND member_profile_id = order_record.member_profile_id
      AND visibility = 'MEMBER_PRIVATE'
  ) THEN RAISE EXCEPTION 'INVALID_SUPPORTING_FILE'; END IF;
  SELECT COALESCE(SUM(verified_amount), 0) INTO deposit_verified_value
  FROM public.payment_schedules
  WHERE order_id = order_id_input AND schedule_type = 'DEPOSIT';
  immediate_cancel := deposit_verified_value = 0
    AND NOT EXISTS (SELECT 1 FROM public.purchase_orders WHERE supplier_order_id IN (
      SELECT id FROM public.supplier_orders WHERE customer_order_id = order_id_input
    ) AND status = 'ISSUED');

  INSERT INTO public.cancellation_requests(
    organization_id, order_id, member_profile_id, status, previous_order_status,
    reason, supporting_file_id, deposit_verified_amount_snapshot, requested_by,
    decided_by, decided_at, decision_note
  ) VALUES (
    order_record.organization_id, order_id_input, order_record.member_profile_id,
    CASE WHEN immediate_cancel THEN 'APPROVED' ELSE 'SUBMITTED' END,
    order_record.status, BTRIM(reason_input), supporting_file_id_input,
    deposit_verified_value, (SELECT auth.uid()),
    CASE WHEN immediate_cancel THEN (SELECT auth.uid()) ELSE NULL END,
    CASE WHEN immediate_cancel THEN NOW() ELSE NULL END,
    CASE WHEN immediate_cancel THEN 'AUTO_APPROVED_BEFORE_DEPOSIT' ELSE NULL END
  ) RETURNING id INTO request_id_value;

  IF immediate_cancel THEN
    UPDATE public.project_items pi
    SET ordered_quantity = GREATEST(0, pi.ordered_quantity - oi.quantity),
        status = CASE
          WHEN GREATEST(0, pi.ordered_quantity - oi.quantity) = 0 THEN 'READY_TO_ORDER'
          ELSE 'PARTIALLY_ORDERED' END
    FROM public.order_items oi
    WHERE oi.order_id = order_id_input AND pi.id = oi.project_item_id;
    UPDATE public.payment_schedules SET status = 'CANCELLED' WHERE order_id = order_id_input;
    UPDATE public.supplier_payment_schedules SET status = 'CANCELLED'
    WHERE supplier_order_id IN (SELECT id FROM public.supplier_orders WHERE customer_order_id = order_id_input);
    UPDATE public.supplier_orders SET status = 'CANCELLED' WHERE customer_order_id = order_id_input;
    UPDATE public.customer_orders
    SET status = 'CANCELLED', cancelled_at = NOW(), cancellation_reason = BTRIM(reason_input)
    WHERE id = order_id_input;
  ELSE
    UPDATE public.customer_orders SET status = 'CANCELLATION_REQUESTED' WHERE id = order_id_input;
  END IF;
  INSERT INTO public.status_events(
    organization_id, entity_type, entity_id, from_status, to_status,
    actor_user_id, reason, is_member_visible
  ) VALUES (
    order_record.organization_id, 'customer_order', order_id_input, order_record.status,
    CASE WHEN immediate_cancel THEN 'CANCELLED' ELSE 'CANCELLATION_REQUESTED' END,
    (SELECT auth.uid()), BTRIM(reason_input), TRUE
  );
  PERFORM public.write_audit_event(
    order_record.organization_id, 'cancellation_request', request_id_value,
    CASE WHEN immediate_cancel THEN 'AUTO_APPROVED' ELSE 'SUBMITTED' END,
    NULL, jsonb_build_object('order_id', order_id_input,
      'deposit_verified_amount', deposit_verified_value, 'reason', BTRIM(reason_input))
  );
  RETURN request_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_order_cancellation(
  cancellation_request_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT,
  approved_refund_amount_input NUMERIC DEFAULT 0,
  approved_deduction_amount_input NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.cancellation_requests%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  target_status TEXT;
BEGIN
  IF NOT public.has_permission('orders.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(decision_note_input), '') IS NULL THEN RAISE EXCEPTION 'DECISION_NOTE_REQUIRED'; END IF;
  IF COALESCE(approved_refund_amount_input, 0) < 0 OR COALESCE(approved_deduction_amount_input, 0) < 0 THEN
    RAISE EXCEPTION 'INVALID_CANCELLATION_AMOUNT';
  END IF;
  SELECT * INTO request_record FROM public.cancellation_requests
  WHERE id = cancellation_request_id_input FOR UPDATE;
  IF NOT FOUND OR request_record.status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'CANCELLATION_NOT_REVIEWABLE';
  END IF;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = request_record.order_id FOR UPDATE;
  target_status := CASE WHEN approve_input THEN 'APPROVED' ELSE 'REJECTED' END;
  UPDATE public.cancellation_requests
  SET status = target_status, decided_by = (SELECT auth.uid()), decided_at = NOW(),
      decision_note = BTRIM(decision_note_input),
      approved_refund_amount = ROUND(COALESCE(approved_refund_amount_input, 0), 2),
      approved_deduction_amount = ROUND(COALESCE(approved_deduction_amount_input, 0), 2)
  WHERE id = cancellation_request_id_input;

  IF approve_input THEN
    UPDATE public.project_items pi
    SET ordered_quantity = GREATEST(0, pi.ordered_quantity - oi.quantity),
        status = CASE
          WHEN GREATEST(0, pi.ordered_quantity - oi.quantity) = 0 THEN 'READY_TO_ORDER'
          ELSE 'PARTIALLY_ORDERED' END
    FROM public.order_items oi
    WHERE oi.order_id = order_record.id AND pi.id = oi.project_item_id;
    UPDATE public.payment_schedules SET status = 'CANCELLED' WHERE order_id = order_record.id;
    UPDATE public.supplier_payment_schedules SET status = 'CANCELLED'
    WHERE supplier_order_id IN (SELECT id FROM public.supplier_orders WHERE customer_order_id = order_record.id);
    UPDATE public.purchase_orders SET status = 'CANCELLED', cancelled_at = NOW()
    WHERE supplier_order_id IN (SELECT id FROM public.supplier_orders WHERE customer_order_id = order_record.id)
      AND status = 'ISSUED';
    UPDATE public.supplier_orders SET status = 'CANCELLED' WHERE customer_order_id = order_record.id;
    UPDATE public.customer_orders
    SET status = 'CANCELLED', cancelled_at = NOW(), cancellation_reason = request_record.reason
    WHERE id = order_record.id;
  ELSE
    UPDATE public.customer_orders SET status = request_record.previous_order_status WHERE id = order_record.id;
  END IF;
  INSERT INTO public.status_events(
    organization_id, entity_type, entity_id, from_status, to_status,
    actor_user_id, reason, is_member_visible
  ) VALUES (
    order_record.organization_id, 'customer_order', order_record.id,
    'CANCELLATION_REQUESTED', CASE WHEN approve_input THEN 'CANCELLED' ELSE request_record.previous_order_status END,
    (SELECT auth.uid()), BTRIM(decision_note_input), TRUE
  );
  PERFORM public.write_audit_event(
    request_record.organization_id, 'cancellation_request', request_record.id, target_status,
    NULL, jsonb_build_object('decision_note', BTRIM(decision_note_input),
      'approved_refund_amount', ROUND(COALESCE(approved_refund_amount_input, 0), 2),
      'approved_deduction_amount', ROUND(COALESCE(approved_deduction_amount_input, 0), 2),
      'refund_is_automatic', FALSE)
  );
  RETURN request_record.id;
END;
$$;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_orders_profile ON public.customer_orders;
DROP POLICY IF EXISTS customer_orders_internal ON public.customer_orders;
DROP POLICY IF EXISTS customer_orders_org ON public.customer_orders;
CREATE POLICY customer_orders_slice6_select ON public.customer_orders
FOR SELECT TO authenticated USING (
  member_profile_id = public.current_member_profile_id()
  OR public.has_permission('orders.manage', organization_id)
  OR public.has_permission('payments.verify', organization_id)
);

DROP POLICY IF EXISTS order_items_org ON public.order_items;
CREATE POLICY order_items_slice6_select ON public.order_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.customer_orders co
    WHERE co.id = order_id AND (
      co.member_profile_id = public.current_member_profile_id()
      OR public.has_permission('orders.manage', co.organization_id)
      OR public.has_permission('payments.verify', co.organization_id)
    )
  )
);

DROP POLICY IF EXISTS payment_schedules_org ON public.payment_schedules;
DROP POLICY IF EXISTS payment_schedules_finance ON public.payment_schedules;
CREATE POLICY payment_schedules_slice6_select ON public.payment_schedules
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.customer_orders co
    WHERE co.id = order_id AND (
      co.member_profile_id = public.current_member_profile_id()
      OR public.has_permission('orders.manage', co.organization_id)
      OR public.has_permission('payments.verify', co.organization_id)
    )
  )
);

DROP POLICY IF EXISTS payment_transfers_org ON public.payment_transfers;
DROP POLICY IF EXISTS payment_transfers_finance ON public.payment_transfers;
CREATE POLICY payment_transfers_slice6_select ON public.payment_transfers
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM public.payment_schedules ps
    JOIN public.customer_orders co ON co.id = ps.order_id
    WHERE ps.id = payment_schedule_id AND (
      co.member_profile_id = public.current_member_profile_id()
      OR public.has_permission('orders.manage', co.organization_id)
      OR public.has_permission('payments.verify', co.organization_id)
    )
  )
);

DROP POLICY IF EXISTS supplier_payments_internal ON public.supplier_payments;
CREATE POLICY supplier_payments_slice6_internal ON public.supplier_payments
FOR SELECT TO authenticated USING (public.has_permission('supplier_payments.manage'));
CREATE POLICY purchase_orders_slice6_internal ON public.purchase_orders
FOR SELECT TO authenticated USING (
  public.has_permission('orders.manage', organization_id)
  OR public.has_permission('supplier_payments.manage', organization_id)
);
CREATE POLICY supplier_payment_schedules_slice6_internal ON public.supplier_payment_schedules
FOR SELECT TO authenticated USING (public.has_permission('supplier_payments.manage', organization_id));
CREATE POLICY payment_verification_logs_slice6_internal ON public.payment_verification_logs
FOR SELECT TO authenticated USING (
  public.has_permission('payments.verify', organization_id)
  OR public.has_permission('orders.manage', organization_id)
);
CREATE POLICY supplier_payment_history_slice6_internal ON public.supplier_payment_history
FOR SELECT TO authenticated USING (public.has_permission('supplier_payments.manage', organization_id));
CREATE POLICY cancellation_requests_slice6_select ON public.cancellation_requests
FOR SELECT TO authenticated USING (
  member_profile_id = public.current_member_profile_id()
  OR public.has_permission('orders.manage', organization_id)
);

REVOKE ALL ON public.purchase_orders, public.supplier_payment_schedules,
  public.payment_verification_logs, public.supplier_payment_history,
  public.cancellation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.purchase_orders, public.supplier_payment_schedules,
  public.payment_verification_logs, public.supplier_payment_history,
  public.cancellation_requests TO authenticated;

REVOKE ALL ON FUNCTION public.review_supplier_payment(UUID, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_order_cancellation(UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_order_cancellation(UUID, BOOLEAN, TEXT, NUMERIC, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_supplier_payment(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_order_cancellation(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_order_cancellation(UUID, BOOLEAN, TEXT, NUMERIC, NUMERIC) TO authenticated;
