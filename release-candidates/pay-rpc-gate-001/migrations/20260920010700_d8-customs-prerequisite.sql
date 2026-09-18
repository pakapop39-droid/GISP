-- ISS-02 Option A: keep IMPORT_CUSTOMS as in-progress and require confidential
-- customs evidence before confirming arrival at the Thailand warehouse.
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
  evidence_record public.file_metadata%ROWTYPE;
  order_member_profile_id UUID;
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
  IF new_rank > 0 AND new_rank = last_rank THEN RAISE EXCEPTION 'DUPLICATE_SHIPMENT_MILESTONE'; END IF;
  IF new_rank > 0 AND new_rank < last_rank THEN RAISE EXCEPTION 'SHIPMENT_STATUS_CANNOT_MOVE_BACKWARD'; END IF;

  IF eta_at_input IS NOT NULL AND shipment_record.estimated_arrival_at IS NOT NULL
    AND eta_at_input > shipment_record.estimated_arrival_at
    AND NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'ETA_DELAY_REASON_REQUIRED'; END IF;

  IF evidence_file_id_input IS NOT NULL THEN
    SELECT * INTO evidence_record FROM public.file_metadata WHERE id = evidence_file_id_input;
  END IF;
  IF status_input IN ('THAILAND_WAREHOUSE', 'READY_FOR_DELIVERY') THEN
    SELECT member_profile_id INTO order_member_profile_id
    FROM public.customer_orders WHERE id = shipment_record.customer_order_id;
  END IF;
  IF status_input = 'THAILAND_WAREHOUSE' THEN
    IF evidence_file_id_input IS NULL THEN RAISE EXCEPTION 'CUSTOMS_EVIDENCE_REQUIRED'; END IF;
    IF order_member_profile_id IS NULL
      OR evidence_record.id IS NULL
      OR evidence_record.organization_id IS DISTINCT FROM shipment_record.organization_id
      OR evidence_record.member_profile_id IS NOT NULL
      OR evidence_record.entity_type IS DISTINCT FROM 'CUSTOMS_ENTRY'
      OR evidence_record.entity_id IS DISTINCT FROM shipment_record.id
      OR evidence_record.bucket IS DISTINCT FROM 'gisp-confidential'
      OR evidence_record.visibility IS DISTINCT FROM 'CONFIDENTIAL'
    THEN RAISE EXCEPTION 'INVALID_CUSTOMS_EVIDENCE'; END IF;
  ELSIF evidence_file_id_input IS NOT NULL AND (
    evidence_record.id IS NULL
    OR evidence_record.organization_id IS DISTINCT FROM shipment_record.organization_id
    OR NOT (is_member_visible_input = FALSE OR evidence_record.visibility IS NOT DISTINCT FROM 'MEMBER_PRIVATE')
  ) THEN
    RAISE EXCEPTION 'INVALID_TRACKING_EVIDENCE';
  END IF;

  IF status_input = 'READY_FOR_DELIVERY' THEN
    IF last_rank <> 110 OR shipment_record.status IS DISTINCT FROM 'THAILAND_WAREHOUSE' THEN
      RAISE EXCEPTION 'THAILAND_WAREHOUSE_REQUIRED';
    END IF;
    IF order_member_profile_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.shipment_documents sd
      JOIN public.file_metadata fm ON fm.id = sd.file_id
      WHERE sd.shipment_id = shipment_record.id
        AND sd.organization_id = shipment_record.organization_id
        AND sd.document_type = 'CUSTOMS_ENTRY'
        AND sd.is_member_visible = FALSE
        AND fm.organization_id = shipment_record.organization_id
        AND fm.member_profile_id IS NULL
        AND fm.entity_type = 'CUSTOMS_ENTRY'
        AND fm.entity_id = shipment_record.id
        AND fm.bucket = 'gisp-confidential'
        AND fm.visibility = 'CONFIDENTIAL'
    ) THEN RAISE EXCEPTION 'CUSTOMS_EVIDENCE_REQUIRED'; END IF;
  END IF;

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
      CASE WHEN status_input = 'THAILAND_WAREHOUSE' THEN 'CUSTOMS_ENTRY' ELSE 'TRACKING_EVIDENCE' END,
      CASE WHEN status_input = 'THAILAND_WAREHOUSE' THEN FALSE ELSE is_member_visible_input END,
      (SELECT auth.uid()));
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

  IF status_input = 'THAILAND_WAREHOUSE' THEN
    PERFORM public.write_audit_event(
      shipment_record.organization_id,
      'shipment',
      shipment_record.id,
      'CUSTOMS_CLEARED_AND_ARRIVED_WAREHOUSE',
      jsonb_build_object('status', shipment_record.status),
      jsonb_build_object(
        'status', 'THAILAND_WAREHOUSE',
        'shipmentEventId', event_id_value,
        'evidenceFileId', evidence_file_id_input
      )
    );
  END IF;
  RETURN event_id_value;
END;
$$;
