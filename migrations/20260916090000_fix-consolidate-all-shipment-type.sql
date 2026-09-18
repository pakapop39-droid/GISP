-- DR-019: preserve the approved CONSOLIDATE_ALL planning strategy while
-- storing the matching shipment type accepted by public.shipments.
-- No table, role, permission, or data changes are included in this migration.

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
    public.next_document_number('SHP'), BTRIM(shipment_name_input),
    CASE group_record.strategy
      WHEN 'CONSOLIDATE_ALL' THEN 'CONSOLIDATED'
      ELSE group_record.strategy
    END,
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
