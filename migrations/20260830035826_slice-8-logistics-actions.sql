-- Slice 8 business actions. All writes pass through SECURITY DEFINER functions;
-- direct table writes stay revoked from app users.

-- ---------------------------------------------------------------------------
-- 1. Warehouse receipt and release
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_warehouse_receipt(
  supplier_order_id_input UUID,
  warehouse_id_input UUID,
  received_at_input TIMESTAMPTZ,
  package_count_input INTEGER,
  actual_weight_kg_input NUMERIC,
  actual_cbm_input NUMERIC,
  note_input TEXT,
  items_input JSONB,
  evidence_file_ids_input UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  so_record public.supplier_orders%ROWTYPE;
  item_input RECORD;
  soi_record public.supplier_order_items%ROWTYPE;
  receipt_id_value UUID;
  receipt_status_value TEXT := 'PARTIALLY_RECEIVED';
  previously_received NUMERIC(12,3);
  has_discrepancy BOOLEAN := FALSE;
  has_damage BOOLEAN := FALSE;
BEGIN
  SELECT * INTO so_record FROM public.supplier_orders
  WHERE id = supplier_order_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', so_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF received_at_input IS NULL OR package_count_input IS NULL OR package_count_input < 0
    OR jsonb_typeof(items_input) <> 'array' OR jsonb_array_length(items_input) = 0 THEN
    RAISE EXCEPTION 'INVALID_WAREHOUSE_RECEIPT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = warehouse_id_input AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'WAREHOUSE_NOT_ACTIVE';
  END IF;

  FOR item_input IN SELECT * FROM jsonb_to_recordset(items_input)
    AS x(supplier_order_item_id UUID, received_quantity NUMERIC, condition TEXT,
         blocked_quantity NUMERIC, discrepancy_note TEXT)
  LOOP
    SELECT * INTO soi_record FROM public.supplier_order_items
    WHERE id = item_input.supplier_order_item_id
      AND supplier_order_id = supplier_order_id_input FOR UPDATE;
    IF NOT FOUND OR item_input.received_quantity IS NULL OR item_input.received_quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_WAREHOUSE_RECEIPT_ITEM';
    END IF;
    SELECT COALESCE(SUM(wri.received_quantity), 0) INTO previously_received
    FROM public.warehouse_receipt_items wri
    JOIN public.warehouse_receipts wr ON wr.id = wri.warehouse_receipt_id
    WHERE wri.supplier_order_item_id = soi_record.id AND wr.status <> 'CANCELLED';
    IF previously_received + item_input.received_quantity > soi_record.quantity THEN
      RAISE EXCEPTION 'WAREHOUSE_RECEIPT_EXCEEDS_EXPECTED';
    END IF;
    IF COALESCE(item_input.blocked_quantity, 0) < 0
      OR COALESCE(item_input.blocked_quantity, 0) > item_input.received_quantity THEN
      RAISE EXCEPTION 'INVALID_BLOCKED_QUANTITY';
    END IF;
    IF COALESCE(item_input.condition, 'GOOD') <> 'GOOD' THEN has_damage := TRUE; END IF;
    IF previously_received + item_input.received_quantity <> soi_record.quantity
      OR COALESCE(item_input.blocked_quantity, 0) > 0 THEN has_discrepancy := TRUE; END IF;
    IF (COALESCE(item_input.condition, 'GOOD') <> 'GOOD'
        OR COALESCE(item_input.blocked_quantity, 0) > 0)
      AND (NULLIF(BTRIM(COALESCE(item_input.discrepancy_note, note_input)), '') IS NULL
        OR COALESCE(array_length(evidence_file_ids_input, 1), 0) = 0) THEN
      RAISE EXCEPTION 'DISCREPANCY_NOTE_AND_EVIDENCE_REQUIRED';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(evidence_file_ids_input, ARRAY[]::UUID[])) f(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.file_metadata fm
      WHERE fm.id = f.id AND fm.organization_id = so_record.organization_id
        AND fm.visibility = 'CONFIDENTIAL'
    )
  ) THEN RAISE EXCEPTION 'INVALID_WAREHOUSE_EVIDENCE'; END IF;

  IF has_damage THEN receipt_status_value := 'DAMAGED';
  ELSIF has_discrepancy THEN receipt_status_value := 'DISCREPANCY'; END IF;

  INSERT INTO public.warehouse_receipts(
    organization_id, warehouse_id, supplier_order_id, customer_order_id,
    receipt_number, status, received_at, package_count, actual_weight_kg,
    actual_cbm, note, created_by
  ) VALUES (
    so_record.organization_id, warehouse_id_input, so_record.id, so_record.customer_order_id,
    public.next_record_reference('WRC'), receipt_status_value, received_at_input,
    package_count_input, actual_weight_kg_input, actual_cbm_input,
    NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO receipt_id_value;

  INSERT INTO public.warehouse_receipt_items(
    warehouse_receipt_id, organization_id, supplier_order_item_id, order_item_id,
    expected_quantity, received_quantity, blocked_quantity, condition, discrepancy_note
  )
  SELECT receipt_id_value, so_record.organization_id, soi.id, soi.order_item_id,
    soi.quantity, x.received_quantity, COALESCE(x.blocked_quantity, 0),
    COALESCE(x.condition, 'GOOD'), NULLIF(BTRIM(x.discrepancy_note), '')
  FROM jsonb_to_recordset(items_input)
    AS x(supplier_order_item_id UUID, received_quantity NUMERIC, condition TEXT,
         blocked_quantity NUMERIC, discrepancy_note TEXT)
  JOIN public.supplier_order_items soi ON soi.id = x.supplier_order_item_id;

  INSERT INTO public.warehouse_receipt_files(
    warehouse_receipt_id, organization_id, file_id, file_purpose, created_by
  )
  SELECT receipt_id_value, so_record.organization_id, f.id,
    CASE WHEN has_damage THEN 'DAMAGE' ELSE 'RECEIPT_EVIDENCE' END, (SELECT auth.uid())
  FROM unnest(COALESCE(evidence_file_ids_input, ARRAY[]::UUID[])) f(id);

  PERFORM public.write_audit_event(so_record.organization_id, 'warehouse_receipt',
    receipt_id_value, 'RECEIVED', NULL, jsonb_build_object('status', receipt_status_value));
  RETURN receipt_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_warehouse_receipt_item(
  warehouse_receipt_item_id_input UUID,
  release_quantity_input NUMERIC
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE item_record public.warehouse_receipt_items%ROWTYPE;
BEGIN
  SELECT * INTO item_record FROM public.warehouse_receipt_items
  WHERE id = warehouse_receipt_item_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', item_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF release_quantity_input IS NULL OR release_quantity_input <= 0
    OR item_record.released_quantity + release_quantity_input
      > item_record.received_quantity - item_record.blocked_quantity THEN
    RAISE EXCEPTION 'RELEASE_EXCEEDS_AVAILABLE_QUANTITY';
  END IF;
  UPDATE public.warehouse_receipt_items
  SET released_quantity = released_quantity + release_quantity_input
  WHERE id = item_record.id;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_receipt_items
    WHERE warehouse_receipt_id = item_record.warehouse_receipt_id
      AND released_quantity < received_quantity - blocked_quantity
  ) THEN
    UPDATE public.warehouse_receipts SET status = 'READY_FOR_CONSOLIDATION'
    WHERE id = item_record.warehouse_receipt_id;
  END IF;
  PERFORM public.write_audit_event(item_record.organization_id, 'warehouse_receipt_item',
    item_record.id, 'RELEASED', NULL, jsonb_build_object('quantity', release_quantity_input));
  RETURN item_record.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Consolidation and shipment creation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_consolidation(
  customer_order_id_input UUID,
  warehouse_id_input UUID,
  strategy_input TEXT,
  reason_input TEXT,
  items_input JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  order_record public.customer_orders%ROWTYPE;
  item_input RECORD;
  receipt_item_record public.warehouse_receipt_items%ROWTYPE;
  already_allocated NUMERIC(12,3);
  consolidation_id_value UUID;
BEGIN
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = customer_order_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', order_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF strategy_input NOT IN ('CONSOLIDATE_ALL', 'PARTIAL', 'DIRECT')
    OR jsonb_typeof(items_input) <> 'array' OR jsonb_array_length(items_input) = 0 THEN
    RAISE EXCEPTION 'INVALID_CONSOLIDATION';
  END IF;
  IF strategy_input IN ('PARTIAL', 'DIRECT') AND NULLIF(BTRIM(reason_input), '') IS NULL THEN
    RAISE EXCEPTION 'CONSOLIDATION_REASON_REQUIRED';
  END IF;
  FOR item_input IN SELECT * FROM jsonb_to_recordset(items_input)
    AS x(warehouse_receipt_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT wri.* INTO receipt_item_record
    FROM public.warehouse_receipt_items wri
    JOIN public.warehouse_receipts wr ON wr.id = wri.warehouse_receipt_id
    WHERE wri.id = item_input.warehouse_receipt_item_id
      AND wr.customer_order_id = customer_order_id_input
      AND wr.warehouse_id = warehouse_id_input
      AND wr.status <> 'CANCELLED' FOR UPDATE OF wri;
    IF NOT FOUND OR item_input.quantity IS NULL OR item_input.quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_CONSOLIDATION_ITEM';
    END IF;
    SELECT COALESCE(SUM(ci.quantity), 0) INTO already_allocated
    FROM public.consolidation_items ci
    JOIN public.consolidation_groups cg ON cg.id = ci.consolidation_group_id
    WHERE ci.warehouse_receipt_item_id = receipt_item_record.id
      AND cg.status <> 'CANCELLED';
    IF already_allocated + item_input.quantity > receipt_item_record.released_quantity THEN
      RAISE EXCEPTION 'CONSOLIDATION_EXCEEDS_RELEASED_QUANTITY';
    END IF;
  END LOOP;

  INSERT INTO public.consolidation_groups(
    organization_id, customer_order_id, warehouse_id, consolidation_number,
    strategy, reason, created_by
  ) VALUES (
    order_record.organization_id, order_record.id, warehouse_id_input,
    public.next_record_reference('CNS'), strategy_input,
    NULLIF(BTRIM(reason_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO consolidation_id_value;
  INSERT INTO public.consolidation_items(
    consolidation_group_id, organization_id, warehouse_receipt_item_id, order_item_id, quantity
  )
  SELECT consolidation_id_value, order_record.organization_id, wri.id, wri.order_item_id, x.quantity
  FROM jsonb_to_recordset(items_input) AS x(warehouse_receipt_item_id UUID, quantity NUMERIC)
  JOIN public.warehouse_receipt_items wri ON wri.id = x.warehouse_receipt_item_id;
  INSERT INTO public.consolidation_events(
    consolidation_group_id, organization_id, event_type, detail, actor_user_id
  ) VALUES (
    consolidation_id_value, order_record.organization_id, 'CREATED',
    jsonb_build_object('strategy', strategy_input), (SELECT auth.uid())
  );
  RETURN consolidation_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_consolidation(consolidation_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE group_record public.consolidation_groups%ROWTYPE;
BEGIN
  SELECT * INTO group_record FROM public.consolidation_groups
  WHERE id = consolidation_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', group_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF group_record.status <> 'DRAFT' OR NOT EXISTS (
    SELECT 1 FROM public.consolidation_items WHERE consolidation_group_id = group_record.id
  ) THEN RAISE EXCEPTION 'CONSOLIDATION_NOT_CONFIRMABLE'; END IF;
  UPDATE public.consolidation_groups SET status = 'CONFIRMED',
    confirmed_by = (SELECT auth.uid()), confirmed_at = NOW() WHERE id = group_record.id;
  INSERT INTO public.consolidation_events(
    consolidation_group_id, organization_id, event_type, actor_user_id
  ) VALUES (group_record.id, group_record.organization_id, 'CONFIRMED', (SELECT auth.uid()));
  RETURN group_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_shipment_v2(
  consolidation_id_input UUID,
  shipment_name_input TEXT,
  shipping_method_input TEXT,
  tracking_number_input TEXT DEFAULT NULL,
  etd_at_input TIMESTAMPTZ DEFAULT NULL,
  eta_at_input TIMESTAMPTZ DEFAULT NULL,
  remaining_plan_input TEXT DEFAULT NULL,
  additional_member_charge_input NUMERIC DEFAULT 0,
  charge_bearer_input TEXT DEFAULT 'GISP'
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  group_record public.consolidation_groups%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  item_record RECORD;
  already_shipped NUMERIC(12,3);
  shipment_id_value UUID;
  shipment_status_value TEXT := 'GATE_CHECKED';
BEGIN
  SELECT * INTO group_record FROM public.consolidation_groups
  WHERE id = consolidation_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', group_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF group_record.status <> 'CONFIRMED' THEN RAISE EXCEPTION 'CONSOLIDATION_NOT_CONFIRMED'; END IF;
  IF NULLIF(BTRIM(shipment_name_input), '') IS NULL
    OR shipping_method_input NOT IN ('LCL', 'FCL', 'TRUCK', 'AIR', 'COURIER')
    OR (etd_at_input IS NOT NULL AND eta_at_input IS NOT NULL AND etd_at_input > eta_at_input) THEN
    RAISE EXCEPTION 'INVALID_SHIPMENT';
  END IF;
  IF group_record.strategy IN ('PARTIAL', 'DIRECT')
    AND NULLIF(BTRIM(COALESCE(remaining_plan_input, group_record.reason)), '') IS NULL THEN
    RAISE EXCEPTION 'PARTIAL_REMAINING_PLAN_REQUIRED';
  END IF;
  IF COALESCE(additional_member_charge_input, 0) < 0
    OR charge_bearer_input NOT IN ('GISP', 'MEMBER') THEN RAISE EXCEPTION 'INVALID_ADDITIONAL_CHARGE'; END IF;
  IF COALESCE(additional_member_charge_input, 0) > 0 AND charge_bearer_input = 'MEMBER' THEN
    shipment_status_value := 'AWAITING_MEMBER_ACKNOWLEDGEMENT';
  END IF;
  SELECT * INTO order_record FROM public.customer_orders WHERE id = group_record.customer_order_id FOR UPDATE;

  FOR item_record IN
    SELECT ci.*, wri.supplier_order_item_id, oi.quantity AS order_quantity
    FROM public.consolidation_items ci
    JOIN public.warehouse_receipt_items wri ON wri.id = ci.warehouse_receipt_item_id
    JOIN public.order_items oi ON oi.id = ci.order_item_id
    WHERE ci.consolidation_group_id = group_record.id
  LOOP
    IF NOT public.can_dispatch_order_item(item_record.order_item_id) THEN
      RAISE EXCEPTION 'DISPATCH_GATE_FAILED';
    END IF;
    SELECT COALESCE(SUM(si.quantity), 0) INTO already_shipped
    FROM public.shipment_items si JOIN public.shipments s ON s.id = si.shipment_id
    WHERE si.order_item_id = item_record.order_item_id AND s.status <> 'CANCELLED';
    IF already_shipped + item_record.quantity > item_record.order_quantity THEN
      RAISE EXCEPTION 'SHIPMENT_EXCEEDS_ORDER_QUANTITY';
    END IF;
  END LOOP;

  INSERT INTO public.shipments(
    organization_id, customer_order_id, consolidation_group_id, shipment_number,
    shipment_name, shipment_type, shipping_method, origin_warehouse_id,
    destination_address_snapshot, status, tracking_number, etd_at,
    estimated_arrival_at, original_eta_at, created_by
  ) VALUES (
    group_record.organization_id, order_record.id, group_record.id,
    public.next_document_number('SHP'), BTRIM(shipment_name_input), group_record.strategy,
    shipping_method_input, group_record.warehouse_id, order_record.shipping_address_snapshot,
    shipment_status_value, NULLIF(BTRIM(tracking_number_input), ''), etd_at_input,
    eta_at_input, eta_at_input, (SELECT auth.uid())
  ) RETURNING id INTO shipment_id_value;
  INSERT INTO public.shipment_items(
    shipment_id, organization_id, order_item_id, supplier_order_item_id,
    warehouse_receipt_item_id, quantity
  )
  SELECT shipment_id_value, group_record.organization_id, ci.order_item_id,
    wri.supplier_order_item_id, ci.warehouse_receipt_item_id, ci.quantity
  FROM public.consolidation_items ci
  JOIN public.warehouse_receipt_items wri ON wri.id = ci.warehouse_receipt_item_id
  WHERE ci.consolidation_group_id = group_record.id;

  IF group_record.strategy IN ('PARTIAL', 'DIRECT') THEN
    INSERT INTO public.partial_shipment_decisions(
      shipment_id, organization_id, customer_order_id, reason, remaining_plan,
      additional_member_charge, charge_bearer, internal_approved_by,
      member_acknowledgement_required
    ) VALUES (
      shipment_id_value, group_record.organization_id, order_record.id,
      COALESCE(NULLIF(BTRIM(group_record.reason), ''), 'DIRECT_SHIPMENT'),
      COALESCE(NULLIF(BTRIM(remaining_plan_input), ''), group_record.reason),
      COALESCE(additional_member_charge_input, 0), charge_bearer_input,
      (SELECT auth.uid()), shipment_status_value = 'AWAITING_MEMBER_ACKNOWLEDGEMENT'
    );
  END IF;
  UPDATE public.consolidation_groups SET status = 'SHIPMENT_CREATED' WHERE id = group_record.id;
  INSERT INTO public.consolidation_events(
    consolidation_group_id, organization_id, event_type, detail, actor_user_id
  ) VALUES (group_record.id, group_record.organization_id, 'SHIPMENT_CREATED',
    jsonb_build_object('shipment_id', shipment_id_value), (SELECT auth.uid()));
  PERFORM public.write_audit_event(group_record.organization_id, 'shipment', shipment_id_value,
    shipment_status_value, NULL, jsonb_build_object('consolidation_id', group_record.id));
  RETURN shipment_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_partial_shipment(
  shipment_id_input UUID,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE decision_record public.partial_shipment_decisions%ROWTYPE;
BEGIN
  SELECT * INTO decision_record FROM public.partial_shipment_decisions
  WHERE shipment_id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.current_member_owns_order(decision_record.customer_order_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT decision_record.member_acknowledgement_required
    OR decision_record.member_acknowledged_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACKNOWLEDGEMENT_NOT_REQUIRED';
  END IF;
  UPDATE public.partial_shipment_decisions SET member_acknowledged_at = NOW(),
    member_acknowledged_by = (SELECT auth.uid()), member_response_note = NULLIF(BTRIM(note_input), '')
  WHERE id = decision_record.id;
  INSERT INTO public.partial_shipment_responses(
    partial_shipment_decision_id, organization_id, response, note, actor_user_id
  ) VALUES (decision_record.id, decision_record.organization_id, 'ACKNOWLEDGED',
    NULLIF(BTRIM(note_input), ''), (SELECT auth.uid()));
  UPDATE public.shipments SET status = 'GATE_CHECKED'
  WHERE id = shipment_id_input AND status = 'AWAITING_MEMBER_ACKNOWLEDGEMENT';
  RETURN shipment_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_shipment(shipment_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE shipment_record public.shipments%ROWTYPE;
BEGIN
  SELECT * INTO shipment_record FROM public.shipments
  WHERE id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', shipment_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF shipment_record.status NOT IN ('GATE_CHECKED', 'READY_TO_DISPATCH') THEN
    RAISE EXCEPTION 'SHIPMENT_NOT_DISPATCHABLE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shipment_items si
    WHERE si.shipment_id = shipment_record.id
      AND NOT public.can_dispatch_order_item(si.order_item_id)
  ) THEN RAISE EXCEPTION 'DISPATCH_GATE_CHANGED'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.partial_shipment_decisions psd
    WHERE psd.shipment_id = shipment_record.id
      AND psd.member_acknowledgement_required AND psd.member_acknowledged_at IS NULL
  ) THEN RAISE EXCEPTION 'MEMBER_ACKNOWLEDGEMENT_REQUIRED'; END IF;

  UPDATE public.shipments SET status = 'DISPATCHED', dispatched_at = NOW(),
    actual_departure_at = COALESCE(actual_departure_at, NOW()) WHERE id = shipment_record.id;
  UPDATE public.customer_orders co SET status = CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.order_items oi WHERE oi.order_id = co.id
        AND COALESCE((SELECT SUM(si.quantity) FROM public.shipment_items si
          JOIN public.shipments s ON s.id = si.shipment_id
          WHERE si.order_item_id = oi.id AND s.status NOT IN ('DRAFT','GATE_CHECKED',
            'AWAITING_MEMBER_ACKNOWLEDGEMENT','READY_TO_DISPATCH','CANCELLED')), 0) < oi.quantity
    ) THEN 'SHIPPED' ELSE 'PARTIALLY_SHIPPED' END
  WHERE co.id = shipment_record.customer_order_id;
  PERFORM public.write_audit_event(shipment_record.organization_id, 'shipment', shipment_record.id, 'DISPATCHED');
  RETURN shipment_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_shipment_event(
  shipment_id_input UUID,
  status_input TEXT,
  event_at_input TIMESTAMPTZ,
  location_input TEXT DEFAULT NULL,
  note_input TEXT DEFAULT NULL,
  eta_at_input TIMESTAMPTZ DEFAULT NULL,
  is_member_visible_input BOOLEAN DEFAULT TRUE,
  evidence_file_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  shipment_record public.shipments%ROWTYPE;
  event_id_value UUID;
  new_rank INTEGER;
  last_rank INTEGER;
BEGIN
  SELECT * INTO shipment_record FROM public.shipments WHERE id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', shipment_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF shipment_record.status IN ('DRAFT','GATE_CHECKED','AWAITING_MEMBER_ACKNOWLEDGEMENT','CANCELLED')
    OR event_at_input IS NULL THEN RAISE EXCEPTION 'SHIPMENT_NOT_TRACKABLE'; END IF;
  new_rank := CASE status_input
    WHEN 'FACTORY_PICKUP_SCHEDULED' THEN 10 WHEN 'PICKED_UP_FROM_FACTORY' THEN 20
    WHEN 'ARRIVED_CHINA_WAREHOUSE' THEN 30 WHEN 'CONSOLIDATED' THEN 40
    WHEN 'BOOKED' THEN 50 WHEN 'EXPORT_CUSTOMS' THEN 60 WHEN 'DEPARTED_CHINA' THEN 70
    WHEN 'IN_TRANSIT' THEN 80 WHEN 'ARRIVED_THAILAND' THEN 90
    WHEN 'IMPORT_CUSTOMS' THEN 100 WHEN 'THAILAND_WAREHOUSE' THEN 110
    WHEN 'READY_FOR_DELIVERY' THEN 120 WHEN 'DELAY' THEN 0 WHEN 'NOTE' THEN 0 ELSE NULL END;
  IF new_rank IS NULL THEN RAISE EXCEPTION 'INVALID_SHIPMENT_EVENT'; END IF;
  SELECT COALESCE(MAX(CASE status
    WHEN 'FACTORY_PICKUP_SCHEDULED' THEN 10 WHEN 'PICKED_UP_FROM_FACTORY' THEN 20
    WHEN 'ARRIVED_CHINA_WAREHOUSE' THEN 30 WHEN 'CONSOLIDATED' THEN 40
    WHEN 'BOOKED' THEN 50 WHEN 'EXPORT_CUSTOMS' THEN 60 WHEN 'DEPARTED_CHINA' THEN 70
    WHEN 'IN_TRANSIT' THEN 80 WHEN 'ARRIVED_THAILAND' THEN 90
    WHEN 'IMPORT_CUSTOMS' THEN 100 WHEN 'THAILAND_WAREHOUSE' THEN 110
    WHEN 'READY_FOR_DELIVERY' THEN 120 ELSE 0 END), 0) INTO last_rank
  FROM public.shipment_status_history WHERE shipment_id = shipment_record.id;
  IF new_rank > 0 AND new_rank < last_rank THEN RAISE EXCEPTION 'SHIPMENT_STATUS_CANNOT_MOVE_BACKWARD'; END IF;
  IF eta_at_input IS NOT NULL AND shipment_record.estimated_arrival_at IS NOT NULL
    AND eta_at_input > shipment_record.estimated_arrival_at
    AND NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'ETA_DELAY_REASON_REQUIRED'; END IF;
  IF evidence_file_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.file_metadata fm WHERE fm.id = evidence_file_id_input
      AND fm.organization_id = shipment_record.organization_id
      AND (is_member_visible_input = FALSE OR fm.visibility = 'MEMBER_PRIVATE')
  ) THEN RAISE EXCEPTION 'INVALID_TRACKING_EVIDENCE'; END IF;

  INSERT INTO public.shipment_status_history(
    shipment_id, organization_id, status, location_text, event_at, note,
    is_delay, eta_at, is_member_visible, created_by
  ) VALUES (shipment_record.id, shipment_record.organization_id, status_input,
    NULLIF(BTRIM(location_input), ''), event_at_input, NULLIF(BTRIM(note_input), ''),
    status_input = 'DELAY', eta_at_input, is_member_visible_input, (SELECT auth.uid()))
  RETURNING id INTO event_id_value;
  IF evidence_file_id_input IS NOT NULL THEN
    INSERT INTO public.shipment_documents(
      shipment_id, organization_id, file_id, document_type, is_member_visible, created_by
    ) VALUES (shipment_record.id, shipment_record.organization_id, evidence_file_id_input,
      'TRACKING_EVIDENCE', is_member_visible_input, (SELECT auth.uid()));
  END IF;
  UPDATE public.shipments SET
    status = CASE status_input
      WHEN 'DEPARTED_CHINA' THEN 'IN_TRANSIT' WHEN 'IN_TRANSIT' THEN 'IN_TRANSIT'
      WHEN 'ARRIVED_THAILAND' THEN 'ARRIVED_THAILAND' WHEN 'IMPORT_CUSTOMS' THEN 'IMPORT_CUSTOMS'
      WHEN 'THAILAND_WAREHOUSE' THEN 'THAILAND_WAREHOUSE'
      WHEN 'READY_FOR_DELIVERY' THEN 'READY_FOR_DELIVERY' ELSE status END,
    estimated_arrival_at = COALESCE(eta_at_input, estimated_arrival_at),
    delay_reason = CASE WHEN eta_at_input IS NOT NULL AND eta_at_input > COALESCE(estimated_arrival_at, eta_at_input)
      THEN BTRIM(note_input) ELSE delay_reason END,
    actual_departure_at = CASE WHEN status_input = 'DEPARTED_CHINA' THEN event_at_input ELSE actual_departure_at END,
    actual_arrival_at = CASE WHEN status_input = 'ARRIVED_THAILAND' THEN event_at_input ELSE actual_arrival_at END,
    arrived_at = CASE WHEN status_input = 'THAILAND_WAREHOUSE' THEN event_at_input ELSE arrived_at END
  WHERE id = shipment_record.id;
  RETURN event_id_value;
END;
$$;

-- Retire ambiguous legacy entry points now that order/warehouse context is mandatory.
CREATE OR REPLACE FUNCTION public.create_shipment(
  shipment_name_input TEXT,
  items_input JSONB
)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN RAISE EXCEPTION 'USE_CREATE_SHIPMENT_V2'; END; $$;

CREATE OR REPLACE FUNCTION public.record_delivery(
  shipment_id_input UUID,
  recipient_name_input TEXT,
  proof_file_id_input UUID,
  delivered_with_issue_input BOOLEAN DEFAULT FALSE
)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN RAISE EXCEPTION 'USE_RECORD_DELIVERY_V2'; END; $$;

-- ---------------------------------------------------------------------------
-- 3. Grants for this migration
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.create_warehouse_receipt(UUID,UUID,TIMESTAMPTZ,INTEGER,NUMERIC,NUMERIC,TEXT,JSONB,UUID[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_warehouse_receipt_item(UUID,NUMERIC) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_consolidation(UUID,UUID,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.confirm_consolidation(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_shipment_v2(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,NUMERIC,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.acknowledge_partial_shipment(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.dispatch_shipment(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.add_shipment_event(UUID,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,BOOLEAN,UUID) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.create_warehouse_receipt(UUID,UUID,TIMESTAMPTZ,INTEGER,NUMERIC,NUMERIC,TEXT,JSONB,UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_warehouse_receipt_item(UUID,NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_consolidation(UUID,UUID,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_consolidation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shipment_v2(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_partial_shipment(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_shipment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_shipment_event(UUID,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,BOOLEAN,UUID) TO authenticated;
