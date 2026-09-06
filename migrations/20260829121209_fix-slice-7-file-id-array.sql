-- Fix JSON text UUID extraction for production and QC evidence arrays.
CREATE OR REPLACE FUNCTION public.add_production_update(
  supplier_order_id_input UUID,
  status_input TEXT,
  note_input TEXT DEFAULT NULL,
  estimated_completion_at_input TIMESTAMPTZ DEFAULT NULL,
  progress_percent_input NUMERIC DEFAULT NULL,
  started_at_input TIMESTAMPTZ DEFAULT NULL,
  actual_completed_at_input TIMESTAMPTZ DEFAULT NULL,
  delay_reason_input TEXT DEFAULT NULL,
  file_ids_input JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  supplier_order_record public.supplier_orders%ROWTYPE;
  latest_status_value TEXT;
  latest_rank INTEGER := 0;
  target_rank INTEGER;
  update_id_value UUID;
  file_id_value UUID;
  member_user_id UUID;
BEGIN
  IF NOT public.has_permission('production.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  target_rank := CASE status_input
    WHEN 'ACKNOWLEDGED' THEN 1 WHEN 'MATERIAL_PREPARATION' THEN 2
    WHEN 'IN_PRODUCTION' THEN 3 WHEN 'ASSEMBLY' THEN 4
    WHEN 'FINISHING' THEN 5 WHEN 'PRODUCTION_COMPLETED' THEN 6
    WHEN 'DELAYED' THEN 99 ELSE NULL END;
  IF target_rank IS NULL THEN RAISE EXCEPTION 'unsupported production status'; END IF;
  IF progress_percent_input IS NOT NULL
     AND (progress_percent_input < 0 OR progress_percent_input > 100) THEN
    RAISE EXCEPTION 'progress percent must be between 0 and 100';
  END IF;
  IF status_input = 'DELAYED' AND NULLIF(BTRIM(delay_reason_input), '') IS NULL THEN
    RAISE EXCEPTION 'delay reason is required';
  END IF;

  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = supplier_order_id_input FOR UPDATE;
  IF NOT FOUND OR supplier_order_record.status IN ('DRAFT', 'CANCELLED') THEN
    RAISE EXCEPTION 'supplier order cannot receive production updates';
  END IF;

  SELECT status INTO latest_status_value FROM public.production_updates
  WHERE supplier_order_id = supplier_order_id_input AND status <> 'DELAYED'
  ORDER BY created_at DESC, id DESC LIMIT 1;
  latest_rank := CASE latest_status_value
    WHEN 'ACKNOWLEDGED' THEN 1 WHEN 'MATERIAL_PREPARATION' THEN 2
    WHEN 'IN_PRODUCTION' THEN 3 WHEN 'ASSEMBLY' THEN 4
    WHEN 'FINISHING' THEN 5 WHEN 'PRODUCTION_COMPLETED' THEN 6 ELSE 0 END;
  IF status_input <> 'DELAYED' AND target_rank < latest_rank THEN
    RAISE EXCEPTION 'production status cannot move backwards';
  END IF;

  INSERT INTO public.production_updates (
    supplier_order_id, organization_id, status, note,
    estimated_completion_at, progress_percent, started_at,
    actual_completed_at, delay_reason, created_by
  ) VALUES (
    supplier_order_id_input, supplier_order_record.organization_id, status_input,
    NULLIF(BTRIM(note_input), ''), estimated_completion_at_input,
    progress_percent_input, started_at_input,
    CASE WHEN status_input='PRODUCTION_COMPLETED'
      THEN COALESCE(actual_completed_at_input, NOW()) ELSE actual_completed_at_input END,
    NULLIF(BTRIM(delay_reason_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO update_id_value;

  FOR file_id_value IN SELECT value::UUID FROM jsonb_array_elements_text(file_ids_input)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.file_metadata fm
      WHERE fm.id=file_id_value
        AND fm.organization_id=supplier_order_record.organization_id
        AND fm.visibility='MEMBER_PRIVATE'
        AND fm.entity_type='PRODUCTION_MEDIA'
        AND fm.entity_id=supplier_order_id_input
    ) THEN RAISE EXCEPTION 'invalid production media file'; END IF;
    INSERT INTO public.production_update_files(production_update_id,file_id,organization_id)
    VALUES(update_id_value,file_id_value,supplier_order_record.organization_id);
  END LOOP;

  UPDATE public.supplier_orders SET status = CASE
    WHEN status_input='ACKNOWLEDGED' THEN 'ACKNOWLEDGED'
    WHEN status_input='PRODUCTION_COMPLETED' THEN 'PRODUCTION_COMPLETED'
    ELSE 'IN_PRODUCTION' END
  WHERE id=supplier_order_id_input;
  UPDATE public.customer_orders SET status = CASE
    WHEN status_input='PRODUCTION_COMPLETED' AND NOT EXISTS (
      SELECT 1 FROM public.supplier_orders so
      WHERE so.customer_order_id=supplier_order_record.customer_order_id
        AND so.id<>supplier_order_id_input
        AND so.status NOT IN ('PRODUCTION_COMPLETED','READY_TO_DISPATCH','DISPATCHED','COMPLETED')
    ) THEN 'IN_PRODUCTION' ELSE 'IN_PRODUCTION' END
  WHERE id=supplier_order_record.customer_order_id
    AND status NOT IN ('CANCELLED','COMPLETED');

  PERFORM public.write_audit_event(
    supplier_order_record.organization_id,'production_update',update_id_value,status_input,
    NULL,jsonb_build_object('supplier_order_id',supplier_order_id_input,'progress_percent',progress_percent_input)
  );
  IF status_input IN ('PRODUCTION_COMPLETED','DELAYED') THEN
    SELECT mp.user_id INTO member_user_id
    FROM public.customer_orders co JOIN public.member_profiles mp ON mp.id=co.member_profile_id
    WHERE co.id=supplier_order_record.customer_order_id;
    IF member_user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,organization_id,type,title,body,entity_type,entity_id,action_url)
      VALUES(member_user_id,supplier_order_record.organization_id,
        CASE WHEN status_input='DELAYED' THEN 'PRODUCTION_DELAYED' ELSE 'PRODUCTION_COMPLETED' END,
        CASE WHEN status_input='DELAYED' THEN 'อัปเดตความล่าช้าของการผลิต' ELSE 'การผลิตเสร็จแล้ว' END,
        COALESCE(NULLIF(BTRIM(delay_reason_input),''),NULLIF(BTRIM(note_input),''),'มีอัปเดตสถานะการผลิต'),
        'customer_order',supplier_order_record.customer_order_id,
        '/member/orders/'||supplier_order_record.customer_order_id::TEXT);
    END IF;
  END IF;
  RETURN update_id_value;
END;
$$;


CREATE OR REPLACE FUNCTION public.record_qc_inspection(
  order_item_id_input UUID,
  result_input TEXT,
  checklist_input JSONB,
  note_input TEXT DEFAULT NULL,
  defect_note_input TEXT DEFAULT NULL,
  rework_note_input TEXT DEFAULT NULL,
  inspection_type_input TEXT DEFAULT 'INITIAL',
  parent_inspection_id_input UUID DEFAULT NULL,
  file_ids_input JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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
$$;
