-- GO-LIVE-MVP-INITIAL-OPERATIONS-01 Lean guard.
-- Forward-only and transaction-wrapper safe: no explicit BEGIN/COMMIT and no
-- apply-time business-row DML. Runtime DML is confined to preserved functions.

CREATE OR REPLACE FUNCTION public.create_supplier_payment(
  supplier_order_id_input UUID, payment_type_input TEXT,
  amount_input NUMERIC, note_input TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN RAISE EXCEPTION 'LEAN_SCOPE_DEFERRED'; END; $$;

CREATE OR REPLACE FUNCTION public.review_supplier_payment(
  supplier_payment_id_input UUID, approve_input BOOLEAN,
  decision_note_input TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN RAISE EXCEPTION 'LEAN_SCOPE_DEFERRED'; END; $$;

CREATE OR REPLACE FUNCTION public.mark_supplier_payment_paid(
  supplier_payment_id_input UUID, evidence_file_id_input UUID
) RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN RAISE EXCEPTION 'LEAN_SCOPE_DEFERRED'; END; $$;

DO $lean_acl$
DECLARE signature TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_supplier_payment(uuid,text,numeric,text)',
    'public.review_supplier_payment(uuid,boolean,text)',
    'public.mark_supplier_payment_paid(uuid,uuid)',
    'public.create_supplier_payment_rlc_impl(uuid,text,numeric,text)',
    'public.review_supplier_payment_rlc_impl(uuid,boolean,text)',
    'public.mark_supplier_payment_paid_rlc_impl(uuid,uuid)',
    'public.open_claim(uuid,text,text,uuid)',
    'public.resolve_claim(uuid,text,text)',
    'public.create_claim(uuid,text,text,text,numeric,text,timestamptz,text,text,uuid)',
    'public.member_claim_action(uuid,text,text,uuid)',
    'public.admin_claim_action(uuid,text,text,text,text,uuid,uuid,timestamptz)',
    'public.record_claim_internal_cost(uuid,text,numeric,text,text)',
    'public.append_claim_event(uuid,uuid,text,text,boolean)',
    'public.get_executive_dashboard(date,date)',
    'public.get_fixed_report(text,date,date,text,integer,integer)',
    'public.record_fixed_report_export(text,jsonb,integer)',
    'public.queue_current_user_notification(text,text,text,text,text)'
  ]
  LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, project_admin', signature);
    END IF;
  END LOOP;
END
$lean_acl$;

CREATE OR REPLACE FUNCTION public.get_dispatch_gate(order_item_id_input UUID)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'order_item_id', oi.id,
    'qc_passed', oi.qc_status IN ('PASSED','MEMBER_APPROVED'),
    'member_approval_required', oi.item_type='CUSTOM',
    'member_approved', oi.item_type='STANDARD' OR oi.custom_member_approved_at IS NOT NULL,
    'customer_balance_verified', COALESCE(balance_ps.status='VERIFIED', FALSE),
    'all_supplier_pos_issued',
      EXISTS (SELECT 1 FROM public.supplier_orders linked WHERE linked.customer_order_id=co.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.supplier_orders linked
        WHERE linked.customer_order_id=co.id
          AND (linked.po_issued_at IS NULL OR NULLIF(BTRIM(linked.po_number),'') IS NULL)
      ),
    'quantity_ready', EXISTS (
      SELECT 1 FROM public.consolidation_items ci
      JOIN public.consolidation_groups cg ON cg.id=ci.consolidation_group_id
      WHERE ci.order_item_id=oi.id AND ci.quantity > 0
        AND cg.customer_order_id=co.id
        AND cg.status IN ('CONFIRMED','SHIPMENT_CREATED')
    ),
    'can_dispatch',
      oi.qc_status IN ('PASSED','MEMBER_APPROVED')
      AND (oi.item_type='STANDARD' OR oi.custom_member_approved_at IS NOT NULL)
      AND COALESCE(balance_ps.status='VERIFIED', FALSE)
      AND EXISTS (SELECT 1 FROM public.supplier_orders linked WHERE linked.customer_order_id=co.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.supplier_orders linked
        WHERE linked.customer_order_id=co.id
          AND (linked.po_issued_at IS NULL OR NULLIF(BTRIM(linked.po_number),'') IS NULL)
      )
      AND EXISTS (
        SELECT 1 FROM public.consolidation_items ci
        JOIN public.consolidation_groups cg ON cg.id=ci.consolidation_group_id
        WHERE ci.order_item_id=oi.id AND ci.quantity > 0
          AND cg.customer_order_id=co.id
          AND cg.status IN ('CONFIRMED','SHIPMENT_CREATED')
      )
  )
  FROM public.order_items oi
  JOIN public.customer_orders co ON co.id=oi.order_id
  LEFT JOIN public.payment_schedules balance_ps
    ON balance_ps.order_id=co.id AND balance_ps.schedule_type='BALANCE'
  WHERE oi.id=order_item_id_input
    AND (public.current_user_is_internal() OR co.member_profile_id=public.current_member_profile_id())
$$;

CREATE OR REPLACE FUNCTION public.can_dispatch_order_item(order_item_id_input UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE((public.get_dispatch_gate(order_item_id_input)->>'can_dispatch')::BOOLEAN,FALSE)
$$;

CREATE OR REPLACE FUNCTION public.maybe_complete_order(order_id_input UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  all_delivered BOOLEAN;
  delivery_has_issue BOOLEAN;
  freight_verified BOOLEAN;
  current_status TEXT;
BEGIN
  SELECT status INTO current_status FROM public.customer_orders
  WHERE id=order_id_input FOR UPDATE;
  IF NOT FOUND OR current_status IN ('CANCELLED','CANCELLATION_REQUESTED') THEN RETURN FALSE; END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id=order_id_input
      AND COALESCE((SELECT SUM(di.quantity_delivered) FROM public.delivery_items di
        JOIN public.deliveries d ON d.id=di.delivery_id
        WHERE di.order_item_id=oi.id
          AND d.status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')),0) < oi.quantity
  ) INTO all_delivered;

  SELECT EXISTS (
    SELECT 1 FROM public.delivery_items di
    JOIN public.deliveries d ON d.id=di.delivery_id
    JOIN public.shipments s ON s.id=d.shipment_id
    WHERE s.customer_order_id=order_id_input
      AND (d.status='DELIVERED_WITH_ISSUE' OR di.condition <> 'GOOD' OR di.issue_type IS NOT NULL)
  ) INTO delivery_has_issue;

  SELECT EXISTS (
    SELECT 1 FROM public.freight_invoices fi
    JOIN public.payment_schedules ps ON ps.id=fi.payment_schedule_id
    WHERE fi.customer_order_id=order_id_input AND fi.status='PAID'
      AND ps.status='VERIFIED' AND ps.verified_amount=ps.due_amount
  ) INTO freight_verified;

  IF all_delivered AND NOT delivery_has_issue AND freight_verified THEN
    UPDATE public.customer_orders SET status='COMPLETED' WHERE id=order_id_input;
    RETURN TRUE;
  ELSIF all_delivered THEN
    UPDATE public.customer_orders SET status='DELIVERED'
    WHERE id=order_id_input AND status NOT IN ('COMPLETED','CANCELLED','CANCELLATION_REQUESTED');
  END IF;
  RETURN FALSE;
END;
$$;

-- Keep the established QC validations, item transitions, evidence checks, and
-- audit event while preventing this initial-operations path from writing a
-- notification job indirectly through a direct notifications insert.
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
  latest_inspection_record RECORD;
BEGIN
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
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND: order item'; END IF;
  IF NOT public.has_permission('qc.manage', item_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shipment_items si
    JOIN public.shipments s ON s.id = si.shipment_id
    WHERE si.order_item_id = item_record.id
      AND (s.dispatched_at IS NOT NULL OR s.status NOT IN (
        'DRAFT', 'GATE_CHECKED', 'AWAITING_MEMBER_ACKNOWLEDGEMENT',
        'READY_TO_DISPATCH', 'CANCELLED'
      ))
  ) THEN RAISE EXCEPTION 'INVALID_TRANSITION: QC cannot be recorded after dispatch'; END IF;

  SELECT * INTO order_record FROM public.customer_orders WHERE id=item_record.order_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.supplier_order_items soi
    JOIN public.supplier_orders so ON so.id=soi.supplier_order_id
    WHERE soi.order_item_id=item_record.id
      AND so.status IN ('PRODUCTION_COMPLETED','READY_TO_DISPATCH','DISPATCHED','COMPLETED')
  ) THEN RAISE EXCEPTION 'production must be completed before QC'; END IF;

  SELECT qi.id, qi.result INTO latest_inspection_record
  FROM public.qc_inspections qi
  WHERE qi.order_item_id = item_record.id
  ORDER BY qi.inspected_at DESC, qi.id DESC LIMIT 1;
  IF item_record.qc_status IN (
    'PASSED', 'WAITING_MEMBER_APPROVAL', 'MEMBER_APPROVED',
    'ADDITIONAL_REVIEW_REQUESTED'
  ) AND latest_inspection_record.result = 'PASSED' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: reopen passed QC before recording another result';
  END IF;
  IF item_record.qc_status = 'IN_PROGRESS'
     AND latest_inspection_record.result = 'PASSED' THEN
    IF inspection_type_input <> 'REINSPECTION'
       OR parent_inspection_id_input IS DISTINCT FROM latest_inspection_record.id
       OR latest_inspection_record.result <> 'PASSED'
       OR NOT EXISTS (
         SELECT 1 FROM public.audit_events ae
         WHERE ae.entity_type = 'order_item' AND ae.entity_id = item_record.id
           AND ae.organization_id = item_record.organization_id
           AND ae.action = 'QC_REOPENED'
           AND ae.after_data->>'parent_inspection_id' = latest_inspection_record.id::TEXT
       ) THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: QC reopen is required for passed parent';
    END IF;
  ELSIF inspection_type_input = 'REINSPECTION' AND NOT EXISTS (
    SELECT 1 FROM public.qc_inspections qi
    WHERE qi.id = parent_inspection_id_input AND qi.order_item_id = item_record.id
      AND qi.result IN ('FAILED','REWORK_REQUIRED')
  ) THEN
    RAISE EXCEPTION 'valid failed parent inspection is required';
  END IF;

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
  RETURN inspection_id_value;
END;
$$;
