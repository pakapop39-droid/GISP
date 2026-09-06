-- Slice 8 delivery appointments, proof of delivery and freight settlement.

CREATE OR REPLACE FUNCTION public.schedule_delivery(
  shipment_id_input UUID,
  scheduled_at_input TIMESTAMPTZ,
  scheduled_window_end_input TIMESTAMPTZ,
  contact_name_input TEXT,
  contact_phone_input TEXT,
  site_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE shipment_record public.shipments%ROWTYPE; delivery_id_value UUID;
BEGIN
  SELECT * INTO shipment_record FROM public.shipments WHERE id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('deliveries.manage', shipment_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF shipment_record.status NOT IN ('READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED')
    OR scheduled_at_input IS NULL OR scheduled_window_end_input IS NULL
    OR scheduled_at_input > scheduled_window_end_input
    OR NULLIF(BTRIM(contact_name_input), '') IS NULL
    OR NULLIF(BTRIM(contact_phone_input), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_APPOINTMENT';
  END IF;
  IF EXISTS (SELECT 1 FROM public.deliveries WHERE shipment_id = shipment_record.id
    AND status IN ('PROPOSED','MEMBER_CONFIRMED','RESCHEDULE_REQUESTED','UNDER_REVIEW',
      'CONFIRMED','OUT_FOR_DELIVERY','ARRIVED')) THEN
    RAISE EXCEPTION 'OPEN_DELIVERY_ALREADY_EXISTS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shipment_items si WHERE si.shipment_id = shipment_record.id
      AND si.quantity > COALESCE((
        SELECT SUM(di.quantity_delivered) FROM public.delivery_items di
        JOIN public.deliveries d ON d.id = di.delivery_id
        WHERE d.shipment_id = shipment_record.id AND di.order_item_id = si.order_item_id
          AND d.status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')
      ), 0)
  ) THEN RAISE EXCEPTION 'SHIPMENT_ALREADY_DELIVERED'; END IF;

  INSERT INTO public.deliveries(
    shipment_id, customer_order_id, organization_id, delivery_number, status,
    scheduled_at, scheduled_window_end_at, delivery_address_snapshot,
    contact_name, contact_phone, site_note, created_by
  ) VALUES (
    shipment_record.id, shipment_record.customer_order_id, shipment_record.organization_id,
    public.next_document_number('DLV'), 'PROPOSED', scheduled_at_input,
    scheduled_window_end_input, shipment_record.destination_address_snapshot,
    BTRIM(contact_name_input), BTRIM(contact_phone_input), NULLIF(BTRIM(site_note_input), ''),
    (SELECT auth.uid())
  ) RETURNING id INTO delivery_id_value;

  INSERT INTO public.delivery_items(
    delivery_id, organization_id, order_item_id, shipment_item_id,
    expected_quantity, quantity_delivered, remaining_quantity
  )
  SELECT delivery_id_value, shipment_record.organization_id, si.order_item_id, si.id,
    si.quantity - COALESCE(delivered.qty, 0), 0, si.quantity - COALESCE(delivered.qty, 0)
  FROM public.shipment_items si
  LEFT JOIN LATERAL (
    SELECT SUM(di.quantity_delivered) qty FROM public.delivery_items di
    JOIN public.deliveries d ON d.id = di.delivery_id
    WHERE d.shipment_id = shipment_record.id AND di.order_item_id = si.order_item_id
      AND d.status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')
  ) delivered ON TRUE
  WHERE si.shipment_id = shipment_record.id AND si.quantity - COALESCE(delivered.qty, 0) > 0;

  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, scheduled_at_snapshot,
    scheduled_window_end_snapshot, actor_user_id
  ) VALUES (delivery_id_value, shipment_record.organization_id, 'PROPOSED',
    scheduled_at_input, scheduled_window_end_input, (SELECT auth.uid()));
  RETURN delivery_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_delivery_appointment(delivery_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE d public.deliveries%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = delivery_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.current_member_owns_order(d.customer_order_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF d.status <> 'PROPOSED' THEN RAISE EXCEPTION 'DELIVERY_NOT_CONFIRMABLE'; END IF;
  UPDATE public.deliveries SET status = 'MEMBER_CONFIRMED',
    member_confirmed_by = (SELECT auth.uid()), member_confirmed_at = NOW() WHERE id = d.id;
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, scheduled_at_snapshot,
    scheduled_window_end_snapshot, actor_user_id
  ) VALUES (d.id, d.organization_id, 'MEMBER_CONFIRMED', d.scheduled_at,
    d.scheduled_window_end_at, (SELECT auth.uid()));
  RETURN d.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_delivery_reschedule(
  delivery_id_input UUID,
  preferred_dates_input JSONB,
  reason_input TEXT,
  contact_name_input TEXT DEFAULT NULL,
  contact_phone_input TEXT DEFAULT NULL,
  site_note_input TEXT DEFAULT NULL,
  requested_address_input JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE d public.deliveries%ROWTYPE; request_id_value UUID;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = delivery_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.current_member_owns_order(d.customer_order_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF d.status NOT IN ('PROPOSED','MEMBER_CONFIRMED','CONFIRMED')
    OR jsonb_typeof(preferred_dates_input) <> 'array'
    OR jsonb_array_length(preferred_dates_input) = 0
    OR NULLIF(BTRIM(reason_input), '') IS NULL THEN RAISE EXCEPTION 'INVALID_RESCHEDULE_REQUEST'; END IF;
  INSERT INTO public.delivery_reschedule_requests(
    delivery_id, organization_id, customer_order_id, preferred_dates, reason,
    requested_contact_name, requested_contact_phone, requested_site_note,
    requested_address, address_change_requested, requested_by
  ) VALUES (d.id, d.organization_id, d.customer_order_id, preferred_dates_input,
    BTRIM(reason_input), NULLIF(BTRIM(contact_name_input), ''),
    NULLIF(BTRIM(contact_phone_input), ''), NULLIF(BTRIM(site_note_input), ''),
    requested_address_input, requested_address_input IS NOT NULL, (SELECT auth.uid()))
  RETURNING id INTO request_id_value;
  UPDATE public.deliveries SET status = 'RESCHEDULE_REQUESTED' WHERE id = d.id;
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, note, actor_user_id
  ) VALUES (d.id, d.organization_id, 'RESCHEDULE_REQUESTED', BTRIM(reason_input), (SELECT auth.uid()));
  RETURN request_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_delivery_reschedule(
  request_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT,
  accepted_scheduled_at_input TIMESTAMPTZ DEFAULT NULL,
  accepted_window_end_input TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE r public.delivery_reschedule_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.delivery_reschedule_requests WHERE id = request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('deliveries.manage', r.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF r.status <> 'SUBMITTED' OR NULLIF(BTRIM(decision_note_input), '') IS NULL THEN
    RAISE EXCEPTION 'RESCHEDULE_NOT_REVIEWABLE';
  END IF;
  IF approve_input AND (accepted_scheduled_at_input IS NULL OR accepted_window_end_input IS NULL
    OR accepted_scheduled_at_input > accepted_window_end_input) THEN
    RAISE EXCEPTION 'ACCEPTED_DELIVERY_WINDOW_REQUIRED';
  END IF;
  UPDATE public.delivery_reschedule_requests SET status = CASE WHEN approve_input THEN 'ACCEPTED' ELSE 'REJECTED' END,
    decided_by = (SELECT auth.uid()), decided_at = NOW(), decision_note = BTRIM(decision_note_input),
    accepted_scheduled_at = CASE WHEN approve_input THEN accepted_scheduled_at_input END,
    accepted_window_end_at = CASE WHEN approve_input THEN accepted_window_end_input END
  WHERE id = r.id;
  UPDATE public.deliveries SET status = 'CONFIRMED',
    scheduled_at = CASE WHEN approve_input THEN accepted_scheduled_at_input ELSE scheduled_at END,
    scheduled_window_end_at = CASE WHEN approve_input THEN accepted_window_end_input ELSE scheduled_window_end_at END,
    contact_name = COALESCE(r.requested_contact_name, contact_name),
    contact_phone = COALESCE(r.requested_contact_phone, contact_phone),
    site_note = COALESCE(r.requested_site_note, site_note),
    delivery_address_snapshot = CASE WHEN approve_input AND r.address_change_requested
      THEN r.requested_address ELSE delivery_address_snapshot END
  WHERE id = r.delivery_id;
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, scheduled_at_snapshot,
    scheduled_window_end_snapshot, note, actor_user_id
  ) VALUES (r.delivery_id, r.organization_id,
    CASE WHEN approve_input THEN 'RESCHEDULE_ACCEPTED' ELSE 'RESCHEDULE_REJECTED' END,
    accepted_scheduled_at_input, accepted_window_end_input, BTRIM(decision_note_input), (SELECT auth.uid()));
  RETURN r.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_delivery_status(
  delivery_id_input UUID,
  target_status_input TEXT,
  reason_input TEXT DEFAULT NULL,
  driver_name_input TEXT DEFAULT NULL,
  driver_phone_input TEXT DEFAULT NULL,
  vehicle_registration_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE d public.deliveries%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = delivery_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('deliveries.manage', d.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT ((d.status IN ('MEMBER_CONFIRMED','CONFIRMED') AND target_status_input = 'OUT_FOR_DELIVERY')
    OR (d.status = 'OUT_FOR_DELIVERY' AND target_status_input = 'ARRIVED')
    OR (d.status IN ('CONFIRMED','OUT_FOR_DELIVERY','ARRIVED')
      AND target_status_input IN ('FAILED','RESCHEDULE_REQUIRED'))) THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_STATUS_TRANSITION';
  END IF;
  IF target_status_input IN ('FAILED','RESCHEDULE_REQUIRED')
    AND NULLIF(BTRIM(reason_input), '') IS NULL THEN RAISE EXCEPTION 'DELIVERY_FAILURE_REASON_REQUIRED'; END IF;
  UPDATE public.deliveries SET status = target_status_input,
    failure_reason = CASE WHEN target_status_input IN ('FAILED','RESCHEDULE_REQUIRED') THEN BTRIM(reason_input) END,
    driver_name = COALESCE(NULLIF(BTRIM(driver_name_input), ''), driver_name),
    driver_phone = COALESCE(NULLIF(BTRIM(driver_phone_input), ''), driver_phone),
    vehicle_registration = COALESCE(NULLIF(BTRIM(vehicle_registration_input), ''), vehicle_registration)
  WHERE id = d.id;
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, note, actor_user_id
  ) VALUES (d.id, d.organization_id,
    CASE target_status_input WHEN 'OUT_FOR_DELIVERY' THEN 'OUT_FOR_DELIVERY'
      WHEN 'ARRIVED' THEN 'ARRIVED' ELSE 'FAILED' END,
    NULLIF(BTRIM(reason_input), ''), (SELECT auth.uid()));
  RETURN d.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_complete_order(order_id_input UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE all_delivered BOOLEAN; freight_verified BOOLEAN; current_status TEXT;
BEGIN
  SELECT status INTO current_status FROM public.customer_orders WHERE id = order_id_input FOR UPDATE;
  IF NOT FOUND OR current_status IN ('CANCELLED','CANCELLATION_REQUESTED') THEN RETURN FALSE; END IF;
  SELECT NOT EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id = order_id_input
      AND COALESCE((SELECT SUM(di.quantity_delivered) FROM public.delivery_items di
        JOIN public.deliveries d ON d.id = di.delivery_id
        WHERE di.order_item_id = oi.id
          AND d.status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')), 0) < oi.quantity
  ) INTO all_delivered;
  SELECT EXISTS (
    SELECT 1 FROM public.freight_invoices fi
    JOIN public.payment_schedules ps ON ps.id = fi.payment_schedule_id
    WHERE fi.customer_order_id = order_id_input AND fi.status = 'PAID'
      AND ps.status = 'VERIFIED' AND ps.verified_amount = ps.due_amount
  ) INTO freight_verified;
  IF all_delivered AND freight_verified THEN
    UPDATE public.customer_orders SET status = 'COMPLETED' WHERE id = order_id_input;
    RETURN TRUE;
  ELSIF all_delivered THEN
    UPDATE public.customer_orders SET status = 'DELIVERED'
    WHERE id = order_id_input AND status NOT IN ('COMPLETED','CANCELLED','CANCELLATION_REQUESTED');
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_delivery_v2(
  delivery_id_input UUID,
  delivered_at_input TIMESTAMPTZ,
  recipient_name_input TEXT,
  recipient_phone_input TEXT,
  items_input JSONB,
  evidence_file_ids_input UUID[],
  next_delivery_plan_input TEXT DEFAULT NULL,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  d public.deliveries%ROWTYPE; item_input RECORD; di public.delivery_items%ROWTYPE;
  result_status TEXT; has_issue BOOLEAN := FALSE; has_remaining BOOLEAN; shipment_complete BOOLEAN;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = delivery_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('deliveries.manage', d.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF d.status NOT IN ('OUT_FOR_DELIVERY','ARRIVED') OR delivered_at_input IS NULL
    OR NULLIF(BTRIM(recipient_name_input), '') IS NULL
    OR jsonb_typeof(items_input) <> 'array' OR jsonb_array_length(items_input) = 0
    OR COALESCE(array_length(evidence_file_ids_input, 1), 0) = 0 THEN
    RAISE EXCEPTION 'INVALID_PROOF_OF_DELIVERY';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(evidence_file_ids_input) f(id) WHERE NOT EXISTS (
      SELECT 1 FROM public.file_metadata fm WHERE fm.id = f.id
        AND fm.organization_id = d.organization_id AND fm.visibility = 'MEMBER_PRIVATE'
    )
  ) THEN RAISE EXCEPTION 'INVALID_DELIVERY_EVIDENCE'; END IF;

  FOR item_input IN SELECT * FROM jsonb_to_recordset(items_input)
    AS x(shipment_item_id UUID, quantity_delivered NUMERIC, condition TEXT,
         issue_type TEXT, issue_description TEXT)
  LOOP
    SELECT * INTO di FROM public.delivery_items
    WHERE delivery_id = d.id AND shipment_item_id = item_input.shipment_item_id FOR UPDATE;
    IF NOT FOUND OR item_input.quantity_delivered IS NULL OR item_input.quantity_delivered < 0
      OR item_input.quantity_delivered > di.expected_quantity
      OR COALESCE(item_input.condition, 'GOOD') NOT IN ('GOOD','DAMAGED','MISSING','WRONG_ITEM','OTHER') THEN
      RAISE EXCEPTION 'INVALID_DELIVERY_ITEM';
    END IF;
    IF COALESCE(item_input.condition, 'GOOD') <> 'GOOD' THEN
      has_issue := TRUE;
      IF item_input.issue_type IS NULL OR NULLIF(BTRIM(item_input.issue_description), '') IS NULL THEN
        RAISE EXCEPTION 'DELIVERY_ISSUE_DETAIL_REQUIRED';
      END IF;
    END IF;
    UPDATE public.delivery_items SET quantity_delivered = item_input.quantity_delivered,
      remaining_quantity = expected_quantity - item_input.quantity_delivered,
      condition = COALESCE(item_input.condition, 'GOOD'), issue_type = item_input.issue_type,
      issue_description = NULLIF(BTRIM(item_input.issue_description), '')
    WHERE id = di.id;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_items WHERE delivery_id = d.id AND quantity_delivered > 0) THEN
    RAISE EXCEPTION 'DELIVERED_QUANTITY_REQUIRED';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.delivery_items WHERE delivery_id = d.id
    AND remaining_quantity > 0) INTO has_remaining;
  IF has_remaining AND NULLIF(BTRIM(next_delivery_plan_input), '') IS NULL THEN
    RAISE EXCEPTION 'NEXT_DELIVERY_PLAN_REQUIRED';
  END IF;
  result_status := CASE WHEN has_issue THEN 'DELIVERED_WITH_ISSUE'
    WHEN has_remaining THEN 'PARTIALLY_DELIVERED' ELSE 'DELIVERED' END;
  UPDATE public.deliveries SET status = result_status, delivered_at = delivered_at_input,
    recipient_name = BTRIM(recipient_name_input), recipient_phone = NULLIF(BTRIM(recipient_phone_input), ''),
    proof_file_id = evidence_file_ids_input[1], next_delivery_plan = NULLIF(BTRIM(next_delivery_plan_input), ''),
    note = NULLIF(BTRIM(note_input), '') WHERE id = d.id;
  INSERT INTO public.delivery_evidence(delivery_id, organization_id, file_id, evidence_type, created_by)
  SELECT d.id, d.organization_id, f.id, CASE WHEN has_issue THEN 'ISSUE' ELSE 'PHOTO' END, (SELECT auth.uid())
  FROM unnest(evidence_file_ids_input) f(id);
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, note, actor_user_id
  ) VALUES (d.id, d.organization_id, 'DELIVERY_RECORDED', result_status, (SELECT auth.uid()));

  SELECT NOT EXISTS (
    SELECT 1 FROM public.shipment_items si WHERE si.shipment_id = d.shipment_id
      AND COALESCE((SELECT SUM(di2.quantity_delivered) FROM public.delivery_items di2
        JOIN public.deliveries d2 ON d2.id = di2.delivery_id
        WHERE d2.shipment_id = d.shipment_id AND di2.order_item_id = si.order_item_id
          AND d2.status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')), 0) < si.quantity
  ) INTO shipment_complete;
  UPDATE public.shipments SET status = CASE WHEN shipment_complete THEN 'DELIVERED' ELSE 'PARTIALLY_DELIVERED' END
  WHERE id = d.shipment_id;
  PERFORM public.maybe_complete_order(d.customer_order_id);
  PERFORM public.write_audit_event(d.organization_id, 'delivery', d.id, result_status);
  RETURN d.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_logistics_cost(
  customer_order_id_input UUID,
  shipment_id_input UUID,
  delivery_id_input UUID,
  category_input TEXT,
  description_input TEXT,
  supplier_cost_input NUMERIC,
  supplier_currency_input TEXT,
  exchange_rate_input NUMERIC,
  member_charge_input NUMERIC,
  is_billable_input BOOLEAN,
  internal_note_input TEXT DEFAULT NULL,
  member_visible_note_input TEXT DEFAULT NULL,
  evidence_file_ids_input UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE o public.customer_orders%ROWTYPE; cost_id_value UUID;
BEGIN
  SELECT * INTO o FROM public.customer_orders WHERE id = customer_order_id_input;
  IF NOT FOUND OR NOT (public.has_permission('shipments.manage', o.organization_id)
    OR public.has_permission('freight.manage', o.organization_id)) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF category_input NOT IN ('CHINA_DOMESTIC_TRANSPORT','WAREHOUSE','INSPECTION','CONSOLIDATION',
    'PACKING','INTERNATIONAL_FREIGHT','INSURANCE','CUSTOMS','TAX','THAILAND_WAREHOUSE',
    'THAILAND_DELIVERY','LIFTING','OTHER') OR NULLIF(BTRIM(description_input), '') IS NULL
    OR supplier_cost_input < 0 OR exchange_rate_input <= 0 OR member_charge_input < 0 THEN
    RAISE EXCEPTION 'INVALID_LOGISTICS_COST';
  END IF;
  IF shipment_id_input IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shipments
    WHERE id = shipment_id_input AND customer_order_id = o.id) THEN RAISE EXCEPTION 'SHIPMENT_ORDER_MISMATCH'; END IF;
  IF delivery_id_input IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.deliveries
    WHERE id = delivery_id_input AND customer_order_id = o.id) THEN RAISE EXCEPTION 'DELIVERY_ORDER_MISMATCH'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(evidence_file_ids_input, ARRAY[]::UUID[])) f(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.file_metadata fm WHERE fm.id = f.id
      AND fm.organization_id = o.organization_id AND fm.visibility = 'CONFIDENTIAL')) THEN
    RAISE EXCEPTION 'INVALID_COST_EVIDENCE'; END IF;
  INSERT INTO public.logistics_cost_items(
    organization_id, customer_order_id, shipment_id, delivery_id, category, description,
    supplier_cost, supplier_currency, exchange_rate, member_charge, is_billable,
    internal_note, member_visible_note, created_by
  ) VALUES (o.organization_id, o.id, shipment_id_input, delivery_id_input, category_input,
    BTRIM(description_input), ROUND(supplier_cost_input,2), UPPER(supplier_currency_input),
    exchange_rate_input, ROUND(member_charge_input,2), is_billable_input,
    NULLIF(BTRIM(internal_note_input), ''), NULLIF(BTRIM(member_visible_note_input), ''), (SELECT auth.uid()))
  RETURNING id INTO cost_id_value;
  INSERT INTO public.logistics_cost_evidence(logistics_cost_item_id, organization_id, file_id, created_by)
  SELECT cost_id_value, o.organization_id, f.id, (SELECT auth.uid())
  FROM unnest(COALESCE(evidence_file_ids_input, ARRAY[]::UUID[])) f(id);
  RETURN cost_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_logistics_costs(customer_order_id_input UUID)
RETURNS INTEGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE o public.customer_orders%ROWTYPE; changed_count INTEGER;
BEGIN
  SELECT * INTO o FROM public.customer_orders WHERE id = customer_order_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('freight.manage', o.organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE customer_order_id = o.id
    AND status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')) THEN
    RAISE EXCEPTION 'DELIVERY_REQUIRED_BEFORE_COST_FINALIZATION';
  END IF;
  UPDATE public.logistics_cost_items SET status = 'FINALIZED', finalized_by = (SELECT auth.uid()), finalized_at = NOW()
  WHERE customer_order_id = o.id AND status = 'DRAFT';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count = 0 THEN RAISE EXCEPTION 'NO_DRAFT_LOGISTICS_COST'; END IF;
  RETURN changed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_freight_invoice(
  customer_order_id_input UUID,
  vat_rate_input NUMERIC DEFAULT 7.00,
  due_at_input TIMESTAMPTZ DEFAULT NULL,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE o public.customer_orders%ROWTYPE; invoice_id_value UUID; schedule_id_value UUID;
  subtotal_value NUMERIC(18,2); vat_value NUMERIC(18,2); total_value NUMERIC(18,2);
BEGIN
  SELECT * INTO o FROM public.customer_orders WHERE id = customer_order_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('freight.manage', o.organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF vat_rate_input < 0 OR vat_rate_input > 100 OR EXISTS (
    SELECT 1 FROM public.logistics_cost_items WHERE customer_order_id = o.id AND status = 'DRAFT'
  ) THEN RAISE EXCEPTION 'LOGISTICS_COSTS_NOT_FINALIZED'; END IF;
  IF EXISTS (SELECT 1 FROM public.freight_invoices WHERE customer_order_id = o.id) THEN
    RAISE EXCEPTION 'FREIGHT_INVOICE_ALREADY_EXISTS';
  END IF;
  SELECT ROUND(COALESCE(SUM(member_charge),0),2) INTO subtotal_value
  FROM public.logistics_cost_items WHERE customer_order_id = o.id AND status = 'FINALIZED' AND is_billable;
  IF subtotal_value <= 0 THEN RAISE EXCEPTION 'BILLABLE_FREIGHT_AMOUNT_REQUIRED'; END IF;
  vat_value := ROUND(subtotal_value * vat_rate_input / 100, 2); total_value := subtotal_value + vat_value;
  INSERT INTO public.payment_schedules(order_id, organization_id, schedule_type, due_amount, due_at)
  VALUES (o.id, o.organization_id, 'FREIGHT', total_value, due_at_input) RETURNING id INTO schedule_id_value;
  INSERT INTO public.freight_invoices(
    organization_id, customer_order_id, payment_schedule_id, invoice_number, currency,
    subtotal, vat_rate_snapshot, vat_amount, grand_total, due_at, issued_by, note
  ) VALUES (o.organization_id, o.id, schedule_id_value, public.next_document_number('INV-FRT'),
    o.currency, subtotal_value, vat_rate_input, vat_value, total_value, due_at_input,
    (SELECT auth.uid()), NULLIF(BTRIM(note_input), '')) RETURNING id INTO invoice_id_value;
  INSERT INTO public.freight_invoice_items(
    freight_invoice_id, organization_id, logistics_cost_item_id, category_snapshot,
    description_snapshot, amount_snapshot
  ) SELECT invoice_id_value, o.organization_id, id, category, description, member_charge
    FROM public.logistics_cost_items WHERE customer_order_id = o.id AND status = 'FINALIZED' AND is_billable;
  UPDATE public.logistics_cost_items SET status = 'INVOICED'
  WHERE customer_order_id = o.id AND status = 'FINALIZED' AND is_billable;
  PERFORM public.write_audit_event(o.organization_id, 'freight_invoice', invoice_id_value,
    'ISSUED', NULL, jsonb_build_object('grand_total', total_value));
  RETURN invoice_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_payment_transfer(
  transfer_id_input UUID,
  approve_input BOOLEAN,
  finance_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE t public.payment_transfers%ROWTYPE; ps public.payment_schedules%ROWTYPE;
  verified_total NUMERIC(18,2); new_status TEXT;
BEGIN
  IF NOT public.has_permission('payments.verify') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO t FROM public.payment_transfers WHERE id = transfer_id_input FOR UPDATE;
  IF NOT FOUND OR t.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'TRANSFER_NOT_VERIFIABLE'; END IF;
  SELECT * INTO ps FROM public.payment_schedules WHERE id = t.payment_schedule_id FOR UPDATE;
  PERFORM 1 FROM public.customer_orders WHERE id = ps.order_id FOR UPDATE;
  IF NOT approve_input THEN
    IF NULLIF(BTRIM(finance_note_input), '') IS NULL THEN RAISE EXCEPTION 'REJECTION_REASON_REQUIRED'; END IF;
    UPDATE public.payment_transfers SET status='REJECTED', finance_verified_by=(SELECT auth.uid()),
      finance_verified_at=NOW(), finance_note=BTRIM(finance_note_input) WHERE id=t.id;
    INSERT INTO public.payment_verification_logs(organization_id,payment_transfer_id,action,
      amount_snapshot,schedule_verified_amount_snapshot,schedule_status_snapshot,note,actor_user_id)
    VALUES(t.organization_id,t.id,'REJECTED',t.amount,ps.verified_amount,ps.status,
      BTRIM(finance_note_input),(SELECT auth.uid()));
    RETURN t.id;
  END IF;
  UPDATE public.payment_transfers SET status='VERIFIED', finance_verified_by=(SELECT auth.uid()),
    finance_verified_at=NOW(), finance_note=NULLIF(BTRIM(finance_note_input),'') WHERE id=t.id;
  SELECT COALESCE(ROUND(SUM(amount),2),0) INTO verified_total FROM public.payment_transfers
  WHERE payment_schedule_id=ps.id AND status='VERIFIED';
  new_status := CASE WHEN verified_total>ps.due_amount THEN 'OVERPAYMENT_REVIEW'
    WHEN verified_total=ps.due_amount THEN 'VERIFIED'
    WHEN verified_total>0 THEN 'PARTIALLY_VERIFIED' ELSE 'PENDING' END;
  UPDATE public.payment_schedules SET verified_amount=verified_total,status=new_status,
    verified_at=CASE WHEN new_status='VERIFIED' THEN NOW() END WHERE id=ps.id;
  IF ps.schedule_type='DEPOSIT' THEN
    UPDATE public.customer_orders SET deposit_verified_at=CASE WHEN new_status='VERIFIED' THEN NOW() END,
      status=CASE WHEN new_status='VERIFIED' AND status='PENDING_DEPOSIT' THEN 'DEPOSIT_VERIFIED'
        WHEN new_status<>'VERIFIED' AND status='DEPOSIT_VERIFIED' THEN 'PENDING_DEPOSIT' ELSE status END
    WHERE id=ps.order_id;
  ELSIF ps.schedule_type='BALANCE' THEN
    UPDATE public.customer_orders SET balance_verified_at=CASE WHEN new_status='VERIFIED' THEN NOW() END
    WHERE id=ps.order_id;
  ELSIF ps.schedule_type='FREIGHT' THEN
    UPDATE public.freight_invoices SET status=CASE
      WHEN new_status='VERIFIED' THEN 'PAID' WHEN new_status='PARTIALLY_VERIFIED' THEN 'PARTIALLY_PAID'
      WHEN new_status='OVERPAYMENT_REVIEW' THEN 'OVERPAYMENT_REVIEW' ELSE 'ISSUED' END,
      paid_at=CASE WHEN new_status='VERIFIED' THEN NOW() END WHERE payment_schedule_id=ps.id;
    PERFORM public.maybe_complete_order(ps.order_id);
  END IF;
  INSERT INTO public.payment_verification_logs(organization_id,payment_transfer_id,action,
    amount_snapshot,schedule_verified_amount_snapshot,schedule_status_snapshot,note,actor_user_id)
  VALUES(t.organization_id,t.id,'VERIFIED',t.amount,verified_total,new_status,
    NULLIF(BTRIM(finance_note_input),''),(SELECT auth.uid()));
  PERFORM public.write_audit_event(t.organization_id,'payment_transfer',t.id,'VERIFIED',NULL,
    jsonb_build_object('amount',t.amount,'schedule_verified_amount',verified_total,'schedule_status',new_status));
  RETURN t.id;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_delivery(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.confirm_delivery_appointment(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_delivery_reschedule(UUID,JSONB,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_delivery_reschedule(UUID,BOOLEAN,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.advance_delivery_status(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.maybe_complete_order(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_delivery_v2(UUID,TIMESTAMPTZ,TEXT,TEXT,JSONB,UUID[],TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.add_logistics_cost(UUID,UUID,UUID,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,BOOLEAN,TEXT,TEXT,UUID[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_logistics_costs(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.issue_freight_invoice(UUID,NUMERIC,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.schedule_delivery(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_appointment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_delivery_reschedule(UUID,JSONB,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_delivery_reschedule(UUID,BOOLEAN,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_delivery_status(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_delivery_v2(UUID,TIMESTAMPTZ,TEXT,TEXT,JSONB,UUID[],TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_logistics_cost(UUID,UUID,UUID,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,BOOLEAN,TEXT,TEXT,UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_logistics_costs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_freight_invoice(UUID,NUMERIC,TIMESTAMPTZ,TEXT) TO authenticated;
