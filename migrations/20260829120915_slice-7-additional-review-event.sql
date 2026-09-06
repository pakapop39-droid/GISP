-- Preserve a separate immutable rework event when a member requests
-- additional review, so the next QC can be recorded as a reinspection.
CREATE OR REPLACE FUNCTION public.respond_custom_qc(
  order_item_id_input UUID,
  decision_input TEXT,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  item_record public.order_items%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  inspection_record public.qc_inspections%ROWTYPE;
  decision_id_value UUID;
  review_event_id UUID;
BEGIN
  IF decision_input NOT IN ('APPROVED','ADDITIONAL_REVIEW_REQUESTED') THEN
    RAISE EXCEPTION 'invalid member QC decision';
  END IF;
  IF decision_input='ADDITIONAL_REVIEW_REQUESTED'
     AND NULLIF(BTRIM(note_input),'') IS NULL THEN
    RAISE EXCEPTION 'additional review note is required';
  END IF;
  SELECT oi.* INTO item_record FROM public.order_items oi
  JOIN public.customer_orders co ON co.id=oi.order_id
  WHERE oi.id=order_item_id_input
    AND co.member_profile_id=public.current_member_profile_id()
  FOR UPDATE OF oi;
  IF NOT FOUND OR item_record.item_type<>'CUSTOM'
    OR item_record.qc_status<>'WAITING_MEMBER_APPROVAL' THEN
    RAISE EXCEPTION 'custom item is not awaiting member approval';
  END IF;
  SELECT * INTO order_record FROM public.customer_orders WHERE id=item_record.order_id;
  SELECT * INTO inspection_record FROM public.qc_inspections
  WHERE order_item_id=item_record.id AND result='PASSED'
  ORDER BY inspected_at DESC,id DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'passed inspection not found'; END IF;

  INSERT INTO public.qc_member_decisions(
    inspection_id,order_item_id,organization_id,member_profile_id,decision,note,decided_by
  ) VALUES(
    inspection_record.id,item_record.id,item_record.organization_id,order_record.member_profile_id,
    decision_input,NULLIF(BTRIM(note_input),''),(SELECT auth.uid())
  ) RETURNING id INTO decision_id_value;

  IF decision_input='ADDITIONAL_REVIEW_REQUESTED' THEN
    INSERT INTO public.qc_inspections(
      order_item_id,organization_id,result,checklist_version,note,is_member_visible,
      inspected_by,inspection_type,parent_inspection_id,rework_note
    ) VALUES(
      item_record.id,item_record.organization_id,'REWORK_REQUIRED','MEMBER-REVIEW',
      'Member requested additional review',TRUE,(SELECT auth.uid()),'INITIAL',
      inspection_record.id,NULLIF(BTRIM(note_input),'')
    ) RETURNING id INTO review_event_id;
  END IF;

  UPDATE public.order_items SET
    qc_status=CASE WHEN decision_input='APPROVED' THEN 'MEMBER_APPROVED' ELSE 'ADDITIONAL_REVIEW_REQUESTED' END,
    custom_member_approved_at=CASE WHEN decision_input='APPROVED' THEN NOW() ELSE NULL END,
    custom_member_approved_by=CASE WHEN decision_input='APPROVED' THEN (SELECT auth.uid()) ELSE NULL END
  WHERE id=item_record.id;
  PERFORM public.write_audit_event(
    item_record.organization_id,'qc_member_decision',decision_id_value,decision_input,
    NULL,jsonb_build_object('order_item_id',item_record.id,'inspection_id',inspection_record.id,
      'review_event_id',review_event_id)
  );
  RETURN decision_id_value;
END;
$$;
