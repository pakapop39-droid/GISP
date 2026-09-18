-- Read-only snapshot of Development function definitions before QC Reopen migration.
-- Captured 2026-09-18 from gisp-mvp-development via pg_get_functiondef.
-- DO NOT APPLY without a separate rollback decision; no data migration is included.
-- Pre-apply MD5 record_qc_inspection: 63d3328580ce4fbd53bfce46163fff1d
-- Pre-apply MD5 dispatch_shipment: 200df746d03d32a2f9c33950d01cc1e5

CREATE OR REPLACE FUNCTION public.record_qc_inspection(order_item_id_input uuid, result_input text, checklist_input jsonb, note_input text DEFAULT NULL::text, defect_note_input text DEFAULT NULL::text, rework_note_input text DEFAULT NULL::text, inspection_type_input text DEFAULT 'INITIAL'::text, parent_inspection_id_input uuid DEFAULT NULL::uuid, file_ids_input jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  item_record public.order_items%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  inspection_id_value UUID;
  checklist_row RECORD;
  file_id_value UUID;
  member_user_id UUID;
BEGIN
  IF NOT public.has_permission('qc.manage') THEN RAISE EXCEPTION 'permission denied'; END IF;
  IF result_input NOT IN ('PASSED','FAILED','REWORK_REQUIRED') THEN RAISE EXCEPTION 'invalid QC result'; END IF;
  IF inspection_type_input NOT IN ('INITIAL','REINSPECTION') THEN RAISE EXCEPTION 'invalid inspection type'; END IF;
  IF jsonb_typeof(checklist_input) <> 'array' OR jsonb_array_length(checklist_input)=0 THEN
    RAISE EXCEPTION 'QC checklist is required';
  END IF;
  IF result_input='PASSED' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(checklist_input) c
    WHERE COALESCE(c->>'result','') <> 'PASSED'
  ) THEN RAISE EXCEPTION 'all checklist items must pass'; END IF;
  IF result_input<>'PASSED' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(checklist_input) c WHERE c->>'result'='FAILED'
  ) THEN RAISE EXCEPTION 'failed inspection needs a failed checklist item'; END IF;

  SELECT * INTO item_record FROM public.order_items WHERE id=order_item_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order item not found'; END IF;
  SELECT * INTO order_record FROM public.customer_orders WHERE id=item_record.order_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.supplier_order_items soi
    JOIN public.supplier_orders so ON so.id=soi.supplier_order_id
    WHERE soi.order_item_id=item_record.id
      AND so.status IN ('PRODUCTION_COMPLETED','READY_TO_DISPATCH','DISPATCHED','COMPLETED')
  ) THEN RAISE EXCEPTION 'production must be completed before QC'; END IF;
  IF inspection_type_input='REINSPECTION' AND NOT EXISTS (
    SELECT 1 FROM public.qc_inspections qi
    WHERE qi.id=parent_inspection_id_input AND qi.order_item_id=item_record.id
      AND qi.result IN ('FAILED','REWORK_REQUIRED')
  ) THEN RAISE EXCEPTION 'valid failed parent inspection is required'; END IF;

  INSERT INTO public.qc_inspections(
    order_item_id,organization_id,result,note,is_member_visible,inspected_by,
    inspection_type,parent_inspection_id,defect_note,rework_note
  ) VALUES(
    item_record.id,item_record.organization_id,result_input,NULLIF(BTRIM(note_input),''),TRUE,
    (SELECT auth.uid()),inspection_type_input,parent_inspection_id_input,
    NULLIF(BTRIM(defect_note_input),''),NULLIF(BTRIM(rework_note_input),'')
  ) RETURNING id INTO inspection_id_value;

  FOR checklist_row IN
    SELECT value, ordinality FROM jsonb_array_elements(checklist_input) WITH ORDINALITY
  LOOP
    IF COALESCE(checklist_row.value->>'result','') NOT IN ('PASSED','FAILED','NOT_INSPECTED')
       OR NULLIF(BTRIM(checklist_row.value->>'label'),'') IS NULL THEN
      RAISE EXCEPTION 'invalid checklist item';
    END IF;
    INSERT INTO public.qc_checklist_items(
      inspection_id,organization_id,item_code,label,result,note,display_order
    ) VALUES(
      inspection_id_value,item_record.organization_id,
      COALESCE(NULLIF(BTRIM(checklist_row.value->>'code'),''),'ITEM-'||checklist_row.ordinality),
      BTRIM(checklist_row.value->>'label'),checklist_row.value->>'result',
      NULLIF(BTRIM(checklist_row.value->>'note'),''),checklist_row.ordinality-1
    );
  END LOOP;

  FOR file_id_value IN SELECT value::UUID FROM jsonb_array_elements_text(file_ids_input)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.file_metadata fm WHERE fm.id=file_id_value
        AND fm.organization_id=item_record.organization_id
        AND fm.visibility='MEMBER_PRIVATE' AND fm.entity_type='QC_EVIDENCE'
        AND fm.entity_id=item_record.id
    ) THEN RAISE EXCEPTION 'invalid QC evidence file'; END IF;
    INSERT INTO public.qc_inspection_files(inspection_id,file_id,organization_id)
    VALUES(inspection_id_value,file_id_value,item_record.organization_id);
  END LOOP;

  UPDATE public.order_items SET
    qc_status=CASE
      WHEN result_input='PASSED' AND item_type='CUSTOM' THEN 'WAITING_MEMBER_APPROVAL'
      WHEN result_input='PASSED' THEN 'PASSED'
      ELSE result_input END,
    custom_member_approved_at=NULL,custom_member_approved_by=NULL
  WHERE id=item_record.id;

  PERFORM public.write_audit_event(
    item_record.organization_id,'qc_inspection',inspection_id_value,result_input,
    NULL,jsonb_build_object('order_item_id',item_record.id,'inspection_type',inspection_type_input)
  );
  IF result_input='PASSED' AND item_record.item_type='CUSTOM' THEN
    SELECT user_id INTO member_user_id FROM public.member_profiles WHERE id=order_record.member_profile_id;
    IF member_user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,organization_id,type,title,body,entity_type,entity_id,action_url)
      VALUES(member_user_id,item_record.organization_id,'QC_MEMBER_APPROVAL_REQUIRED',
        'กรุณาตรวจและอนุมัติผล QC','สินค้า Custom ผ่านการตรวจและรอการอนุมัติจากคุณ',
        'customer_order',order_record.id,'/member/orders/'||order_record.id::TEXT);
    END IF;
  END IF;
  RETURN inspection_id_value;
END;
$function$

CREATE OR REPLACE FUNCTION public.dispatch_shipment(shipment_id_input uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$

-- The new function is not part of the pre-apply baseline.
DROP FUNCTION IF EXISTS public.reopen_qc_inspection(UUID, TEXT);
