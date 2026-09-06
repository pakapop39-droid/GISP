-- Slice 7: append-only production timeline, QC evidence, member decisions,
-- and a backend-enforced four-condition dispatch gate.

ALTER TABLE public.production_updates
  ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2)
    CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delay_reason TEXT;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_qc_status_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_qc_status_check CHECK (qc_status IN (
    'PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'REWORK_REQUIRED',
    'WAITING_MEMBER_APPROVAL', 'MEMBER_APPROVED',
    'ADDITIONAL_REVIEW_REQUESTED'
  ));

ALTER TABLE public.qc_inspections
  ADD COLUMN IF NOT EXISTS inspection_type TEXT NOT NULL DEFAULT 'INITIAL'
    CHECK (inspection_type IN ('INITIAL', 'REINSPECTION')),
  ADD COLUMN IF NOT EXISTS parent_inspection_id UUID
    REFERENCES public.qc_inspections(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS defect_note TEXT,
  ADD COLUMN IF NOT EXISTS rework_note TEXT;

CREATE TABLE IF NOT EXISTS public.production_update_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_update_id UUID NOT NULL REFERENCES public.production_updates(id) ON DELETE RESTRICT,
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (production_update_id, file_id)
);

CREATE TABLE IF NOT EXISTS public.qc_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.qc_inspections(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  item_code TEXT NOT NULL,
  label TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('PASSED', 'FAILED', 'NOT_INSPECTED')),
  note TEXT,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inspection_id, item_code)
);

CREATE TABLE IF NOT EXISTS public.qc_inspection_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.qc_inspections(id) ON DELETE RESTRICT,
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inspection_id, file_id)
);

CREATE TABLE IF NOT EXISTS public.qc_member_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.qc_inspections(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  member_profile_id UUID NOT NULL REFERENCES public.member_profiles(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'ADDITIONAL_REVIEW_REQUESTED')),
  note TEXT,
  decided_by UUID NOT NULL REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS production_update_files_update_idx
  ON public.production_update_files(production_update_id, created_at);
CREATE INDEX IF NOT EXISTS qc_checklist_items_inspection_idx
  ON public.qc_checklist_items(inspection_id, display_order);
CREATE INDEX IF NOT EXISTS qc_inspection_files_inspection_idx
  ON public.qc_inspection_files(inspection_id, created_at);
CREATE INDEX IF NOT EXISTS qc_member_decisions_item_idx
  ON public.qc_member_decisions(order_item_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS qc_inspections_parent_idx
  ON public.qc_inspections(parent_inspection_id);

DROP TRIGGER IF EXISTS production_update_files_append_only ON public.production_update_files;
CREATE TRIGGER production_update_files_append_only
BEFORE UPDATE OR DELETE ON public.production_update_files
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

DROP TRIGGER IF EXISTS qc_checklist_items_append_only ON public.qc_checklist_items;
CREATE TRIGGER qc_checklist_items_append_only
BEFORE UPDATE OR DELETE ON public.qc_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

DROP TRIGGER IF EXISTS qc_inspection_files_append_only ON public.qc_inspection_files;
CREATE TRIGGER qc_inspection_files_append_only
BEFORE UPDATE OR DELETE ON public.qc_inspection_files
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

DROP TRIGGER IF EXISTS qc_member_decisions_append_only ON public.qc_member_decisions;
CREATE TRIGGER qc_member_decisions_append_only
BEFORE UPDATE OR DELETE ON public.qc_member_decisions
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

DROP FUNCTION IF EXISTS public.add_production_update(UUID, TEXT, TEXT, TIMESTAMPTZ);
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

  FOR file_id_value IN SELECT value::TEXT::UUID FROM jsonb_array_elements(file_ids_input)
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

DROP FUNCTION IF EXISTS public.record_qc_inspection(UUID, TEXT, TEXT, UUID);
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

  FOR file_id_value IN SELECT value::TEXT::UUID FROM jsonb_array_elements(file_ids_input)
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
BEGIN
  IF decision_input NOT IN ('APPROVED','ADDITIONAL_REVIEW_REQUESTED') THEN
    RAISE EXCEPTION 'invalid member QC decision';
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

  UPDATE public.order_items SET
    qc_status=CASE WHEN decision_input='APPROVED' THEN 'MEMBER_APPROVED' ELSE 'ADDITIONAL_REVIEW_REQUESTED' END,
    custom_member_approved_at=CASE WHEN decision_input='APPROVED' THEN NOW() ELSE NULL END,
    custom_member_approved_by=CASE WHEN decision_input='APPROVED' THEN (SELECT auth.uid()) ELSE NULL END
  WHERE id=item_record.id;
  PERFORM public.write_audit_event(
    item_record.organization_id,'qc_member_decision',decision_id_value,decision_input,
    NULL,jsonb_build_object('order_item_id',item_record.id,'inspection_id',inspection_record.id)
  );
  RETURN decision_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_custom_qc(order_item_id_input UUID)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.respond_custom_qc(order_item_id_input,'APPROVED',NULL)
$$;

CREATE OR REPLACE FUNCTION public.get_dispatch_gate(order_item_id_input UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'order_item_id',oi.id,
    'qc_passed',oi.qc_status IN ('PASSED','MEMBER_APPROVED'),
    'member_approval_required',oi.item_type='CUSTOM',
    'member_approved',oi.item_type='STANDARD' OR oi.custom_member_approved_at IS NOT NULL,
    'customer_balance_verified',COALESCE(balance_ps.status='VERIFIED',FALSE),
    'supplier_balance_paid',so.supplier_balance_paid_at IS NOT NULL,
    'can_dispatch',
      oi.qc_status IN ('PASSED','MEMBER_APPROVED')
      AND (oi.item_type='STANDARD' OR oi.custom_member_approved_at IS NOT NULL)
      AND COALESCE(balance_ps.status='VERIFIED',FALSE)
      AND so.supplier_balance_paid_at IS NOT NULL
  )
  FROM public.order_items oi
  JOIN public.customer_orders co ON co.id=oi.order_id
  LEFT JOIN public.payment_schedules balance_ps
    ON balance_ps.order_id=co.id AND balance_ps.schedule_type='BALANCE'
  JOIN public.supplier_order_items soi ON soi.order_item_id=oi.id
  JOIN public.supplier_orders so ON so.id=soi.supplier_order_id
  WHERE oi.id=order_item_id_input
    AND (
      public.current_user_is_internal()
      OR co.member_profile_id=public.current_member_profile_id()
    )
$$;

CREATE OR REPLACE FUNCTION public.can_dispatch_order_item(order_item_id_input UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE((public.get_dispatch_gate(order_item_id_input)->>'can_dispatch')::BOOLEAN,FALSE)
$$;

ALTER TABLE public.production_update_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_inspection_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_member_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_updates_visible ON public.production_updates;
CREATE POLICY production_updates_visible ON public.production_updates
FOR SELECT TO authenticated USING (
  public.has_permission('production.manage',organization_id)
  OR public.has_permission('qc.manage',organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.supplier_orders so
    JOIN public.customer_orders co ON co.id=so.customer_order_id
    WHERE so.id=supplier_order_id
      AND co.member_profile_id=public.current_member_profile_id()
  ))
);

DROP POLICY IF EXISTS qc_inspections_visible ON public.qc_inspections;
CREATE POLICY qc_inspections_visible ON public.qc_inspections
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.customer_orders co ON co.id=oi.order_id
    WHERE oi.id=order_item_id
      AND co.member_profile_id=public.current_member_profile_id()
  ))
);

CREATE POLICY production_update_files_visible ON public.production_update_files
FOR SELECT TO authenticated USING (
  public.has_permission('production.manage',organization_id)
  OR public.has_permission('qc.manage',organization_id)
  OR EXISTS (
    SELECT 1 FROM public.production_updates pu
    JOIN public.supplier_orders so ON so.id=pu.supplier_order_id
    JOIN public.customer_orders co ON co.id=so.customer_order_id
    WHERE pu.id=production_update_id AND pu.is_member_visible
      AND co.member_profile_id=public.current_member_profile_id()
  )
);
CREATE POLICY qc_checklist_items_visible ON public.qc_checklist_items
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR EXISTS (
    SELECT 1 FROM public.qc_inspections qi
    JOIN public.order_items oi ON oi.id=qi.order_item_id
    JOIN public.customer_orders co ON co.id=oi.order_id
    WHERE qi.id=inspection_id AND qi.is_member_visible
      AND co.member_profile_id=public.current_member_profile_id()
  )
);
CREATE POLICY qc_inspection_files_visible ON public.qc_inspection_files
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR EXISTS (
    SELECT 1 FROM public.qc_inspections qi
    JOIN public.order_items oi ON oi.id=qi.order_item_id
    JOIN public.customer_orders co ON co.id=oi.order_id
    WHERE qi.id=inspection_id AND qi.is_member_visible
      AND co.member_profile_id=public.current_member_profile_id()
  )
);
CREATE POLICY qc_member_decisions_visible ON public.qc_member_decisions
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR member_profile_id=public.current_member_profile_id()
);

REVOKE ALL ON public.production_update_files,public.qc_checklist_items,
  public.qc_inspection_files,public.qc_member_decisions FROM anon,authenticated;
GRANT SELECT ON public.production_update_files,public.qc_checklist_items,
  public.qc_inspection_files,public.qc_member_decisions TO authenticated;
REVOKE UPDATE,DELETE ON public.production_updates,public.qc_inspections,
  public.production_update_files,public.qc_checklist_items,
  public.qc_inspection_files,public.qc_member_decisions FROM authenticated;

REVOKE ALL ON FUNCTION public.add_production_update(UUID,TEXT,TEXT,TIMESTAMPTZ,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_qc_inspection(UUID,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.approve_custom_qc(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_dispatch_gate(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.can_dispatch_order_item(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.add_production_update(UUID,TEXT,TEXT,TIMESTAMPTZ,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_qc_inspection(UUID,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_custom_qc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dispatch_gate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_dispatch_order_item(UUID) TO authenticated;
