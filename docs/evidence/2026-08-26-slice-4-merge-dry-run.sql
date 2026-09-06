-- Generated 2026-08-26T08:30:59.748Z
BEGIN;

-- ===== MIGRATION =====
-- [MIGRATION] migration system.20260824134357 (add)
-- Migration 20260824134357: slice-4-custom-rfq
ALTER TABLE public.custom_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'OTHER'
    CHECK (request_type IN ('RESIZE','COLOR_MATERIAL','HARDWARE','MADE_TO_DRAWING','BUILT_IN','OTHER')),
  ADD COLUMN IF NOT EXISTS base_product_id UUID REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.project_areas(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS width_mm NUMERIC(12,2) CHECK (width_mm IS NULL OR width_mm > 0),
  ADD COLUMN IF NOT EXISTS depth_mm NUMERIC(12,2) CHECK (depth_mm IS NULL OR depth_mm > 0),
  ADD COLUMN IF NOT EXISTS height_mm NUMERIC(12,2) CHECK (height_mm IS NULL OR height_mm > 0),
  ADD COLUMN IF NOT EXISTS requested_material TEXT,
  ADD COLUMN IF NOT EXISTS requested_color TEXT,
  ADD COLUMN IF NOT EXISTS requested_function TEXT,
  ADD COLUMN IF NOT EXISTS member_note TEXT;
UPDATE public.custom_requests cr
SET member_profile_id = p.member_profile_id
FROM public.projects p
WHERE p.id = cr.project_id AND cr.member_profile_id IS NULL;
ALTER TABLE public.custom_requests ALTER COLUMN member_profile_id SET NOT NULL;
ALTER TABLE public.custom_requests DROP CONSTRAINT IF EXISTS custom_requests_status_check;
ALTER TABLE public.custom_requests ADD CONSTRAINT custom_requests_status_check CHECK (
  status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFO','READY_FOR_QUOTE','CONVERTED','QUOTED','CLOSED','CANCELLED')
);
ALTER TABLE public.custom_request_files
  ADD COLUMN IF NOT EXISTS file_role TEXT NOT NULL DEFAULT 'REFERENCE_IMAGE'
    CHECK (file_role IN ('REFERENCE_IMAGE','PDF','CAD','DIMENSION_DRAWING','MATERIAL_REFERENCE'));
CREATE TABLE public.custom_request_supplier_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_request_id UUID NOT NULL REFERENCES public.custom_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  added_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (custom_request_id, supplier_id)
);
CREATE TABLE public.custom_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_request_id UUID NOT NULL REFERENCES public.custom_requests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  message TEXT,
  visibility TEXT NOT NULL DEFAULT 'MEMBER' CHECK (visibility IN ('MEMBER','INTERNAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS custom_requests_profile_status_idx
  ON public.custom_requests(member_profile_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS custom_requests_admin_queue_idx
  ON public.custom_requests(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS custom_requests_area_idx ON public.custom_requests(area_id);
CREATE INDEX IF NOT EXISTS custom_requests_base_product_idx ON public.custom_requests(base_product_id);
CREATE INDEX IF NOT EXISTS custom_request_candidates_request_idx
  ON public.custom_request_supplier_candidates(custom_request_id, created_at);
CREATE INDEX IF NOT EXISTS custom_request_history_request_idx
  ON public.custom_request_history(custom_request_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS assignments_custom_request_open_unique
  ON public.assignments(entity_id)
  WHERE entity_type='CUSTOM_REQUEST' AND status IN ('OPEN','IN_PROGRESS');
CREATE OR REPLACE FUNCTION public.slice4_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS custom_requests_updated_at ON public.custom_requests;
CREATE TRIGGER custom_requests_updated_at BEFORE UPDATE ON public.custom_requests
  FOR EACH ROW EXECUTE FUNCTION public.slice4_set_updated_at();
CREATE OR REPLACE FUNCTION public.can_access_custom_request(request_id_input UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.custom_requests cr
    WHERE cr.id=request_id_input
      AND (cr.member_profile_id=public.current_member_profile_id()
        OR public.has_permission('rfq.manage',cr.organization_id))
  );
$$;
CREATE OR REPLACE FUNCTION public.record_custom_request_history(
  request_id_input UUID, action_input TEXT, from_status_input TEXT,
  to_status_input TEXT, message_input TEXT, visibility_input TEXT DEFAULT 'MEMBER'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; history_id_value UUID;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND'; END IF;
  INSERT INTO public.custom_request_history(
    custom_request_id,organization_id,actor_user_id,action,from_status,to_status,message,visibility
  ) VALUES (
    request_id_input,request_record.organization_id,(SELECT auth.uid()),action_input,
    from_status_input,to_status_input,NULLIF(BTRIM(message_input),''),visibility_input
  ) RETURNING id INTO history_id_value;
  RETURN history_id_value;
END;
$$;
CREATE OR REPLACE FUNCTION public.create_custom_request_draft(
  project_id_input UUID, area_id_input UUID, base_product_id_input UUID,
  request_type_input TEXT, item_name_input TEXT, description_input TEXT,
  width_mm_input NUMERIC, depth_mm_input NUMERIC, height_mm_input NUMERIC,
  quantity_input NUMERIC, unit_input TEXT, requested_material_input TEXT,
  requested_color_input TEXT, requested_function_input TEXT, member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE project_record public.projects%ROWTYPE; profile_id_value UUID := public.current_member_profile_id();
  request_id_value UUID; request_number_value TEXT;
BEGIN
  IF profile_id_value IS NULL THEN RAISE EXCEPTION 'APPROVED_MEMBER_REQUIRED'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=profile_id_value AND status NOT IN ('COMPLETED','CANCELLED');
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION 'AREA_NOT_FOUND'; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status='PUBLISHED'
  ) THEN RAISE EXCEPTION 'BASE_PRODUCT_NOT_FOUND'; END IF;
  IF request_type_input NOT IN ('RESIZE','COLOR_MATERIAL','HARDWARE','MADE_TO_DRAWING','BUILT_IN','OTHER')
    THEN RAISE EXCEPTION 'INVALID_REQUEST_TYPE'; END IF;
  IF quantity_input<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  request_number_value := 'RFQ-'||TO_CHAR(CURRENT_DATE,'YYYY')||'-'||
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT,'-','') FROM 1 FOR 8));
  INSERT INTO public.custom_requests(
    organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,
    request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,
    requested_material,requested_color,requested_function,member_note,status,submitted_by
  ) VALUES (
    project_record.organization_id,profile_id_value,project_id_input,area_id_input,base_product_id_input,
    request_number_value,request_type_input,COALESCE(NULLIF(BTRIM(item_name_input),''),'รายการ Custom (ร่าง)'),
    COALESCE(BTRIM(description_input),''),NULLIF(BTRIM(description_input),''),width_mm_input,depth_mm_input,
    height_mm_input,quantity_input,COALESCE(NULLIF(BTRIM(unit_input),''),'EA'),
    NULLIF(BTRIM(requested_material_input),''),NULLIF(BTRIM(requested_color_input),''),
    NULLIF(BTRIM(requested_function_input),''),NULLIF(BTRIM(member_note_input),''),'DRAFT',(SELECT auth.uid())
  ) RETURNING id INTO request_id_value;
  PERFORM public.record_custom_request_history(request_id_value,'DRAFT_CREATED',NULL,'DRAFT',NULL,'MEMBER');
  PERFORM public.write_audit_event(project_record.organization_id,'custom_request',request_id_value,'DRAFT_CREATED');
  RETURN request_id_value;
END;
$$;
CREATE OR REPLACE FUNCTION public.save_custom_request_details(
  request_id_input UUID, project_id_input UUID, area_id_input UUID, base_product_id_input UUID,
  request_type_input TEXT, item_name_input TEXT, description_input TEXT,
  width_mm_input NUMERIC, depth_mm_input NUMERIC, height_mm_input NUMERIC,
  quantity_input NUMERIC, unit_input TEXT, requested_material_input TEXT,
  requested_color_input TEXT, requested_function_input TEXT, member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; project_record public.projects%ROWTYPE;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN ('DRAFT','NEED_INFO') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_EDITABLE'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=request_record.member_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION 'AREA_NOT_FOUND'; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status='PUBLISHED'
  ) THEN RAISE EXCEPTION 'BASE_PRODUCT_NOT_FOUND'; END IF;
  IF request_type_input NOT IN ('RESIZE','COLOR_MATERIAL','HARDWARE','MADE_TO_DRAWING','BUILT_IN','OTHER')
    THEN RAISE EXCEPTION 'INVALID_REQUEST_TYPE'; END IF;
  IF quantity_input<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  UPDATE public.custom_requests SET
    organization_id=project_record.organization_id,project_id=project_id_input,area_id=area_id_input,
    base_product_id=base_product_id_input,request_type=request_type_input,item_name=BTRIM(item_name_input),
    specification=BTRIM(description_input),description=NULLIF(BTRIM(description_input),''),
    width_mm=width_mm_input,depth_mm=depth_mm_input,height_mm=height_mm_input,
    quantity=quantity_input,unit=COALESCE(NULLIF(BTRIM(unit_input),''),'EA'),
    requested_material=NULLIF(BTRIM(requested_material_input),''),
    requested_color=NULLIF(BTRIM(requested_color_input),''),
    requested_function=NULLIF(BTRIM(requested_function_input),''),
    member_note=NULLIF(BTRIM(member_note_input),'')
  WHERE id=request_id_input;
  PERFORM public.write_audit_event(project_record.organization_id,'custom_request',request_id_input,'DRAFT_SAVED');
  RETURN request_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.submit_custom_request_v2(request_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; previous_status TEXT;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN ('DRAFT','NEED_INFO') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_SUBMITTABLE'; END IF;
  IF NULLIF(BTRIM(request_record.item_name),'') IS NULL
    OR NULLIF(BTRIM(request_record.specification),'') IS NULL THEN RAISE EXCEPTION 'REQUEST_DETAILS_REQUIRED'; END IF;
  previous_status:=request_record.status;
  UPDATE public.custom_requests SET status='SUBMITTED',submitted_by=(SELECT auth.uid()),submitted_at=NOW()
  WHERE id=request_id_input;
  UPDATE public.assignments SET status='DONE',completed_at=NOW()
  WHERE entity_type='CUSTOM_REQUEST' AND entity_id=request_id_input
    AND assigned_to=(SELECT auth.uid()) AND status IN ('OPEN','IN_PROGRESS');
  PERFORM public.record_custom_request_history(request_id_input,
    CASE WHEN previous_status='NEED_INFO' THEN 'RESUBMITTED' ELSE 'SUBMITTED' END,
    previous_status,'SUBMITTED',NULL,'MEMBER');
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'SUBMITTED');
  RETURN request_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.cancel_custom_request(request_id_input UUID, reason_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFO','READY_FOR_QUOTE') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_CANCELLABLE'; END IF;
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED'; END IF;
  UPDATE public.custom_requests SET status='CANCELLED' WHERE id=request_id_input;
  UPDATE public.assignments SET status='CANCELLED',completed_at=NOW()
  WHERE entity_type='CUSTOM_REQUEST' AND entity_id=request_id_input AND status IN ('OPEN','IN_PROGRESS');
  PERFORM public.record_custom_request_history(request_id_input,'CANCELLED',request_record.status,'CANCELLED',reason_input,'MEMBER');
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'CANCELLED');
  RETURN request_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_set_custom_request_candidates(
  request_id_input UUID, supplier_ids_input UUID[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; supplier_id_value UUID;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND OR NOT public.has_permission('rfq.manage',request_record.organization_id)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF request_record.status IN ('CONVERTED','CANCELLED','CLOSED') THEN RAISE EXCEPTION 'CUSTOM_REQUEST_LOCKED'; END IF;
  DELETE FROM public.custom_request_supplier_candidates WHERE custom_request_id=request_id_input;
  FOREACH supplier_id_value IN ARRAY COALESCE(supplier_ids_input,ARRAY[]::UUID[]) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=supplier_id_value AND status IN ('PROSPECT','ACTIVE'))
      THEN RAISE EXCEPTION 'SUPPLIER_NOT_AVAILABLE'; END IF;
    INSERT INTO public.custom_request_supplier_candidates(custom_request_id,supplier_id,added_by)
    VALUES(request_id_input,supplier_id_value,(SELECT auth.uid())) ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM public.record_custom_request_history(request_id_input,'SUPPLIER_CANDIDATES_UPDATED',request_record.status,request_record.status,NULL,'INTERNAL');
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'SUPPLIER_CANDIDATES_UPDATED');
  RETURN request_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_review_custom_request(
  request_id_input UUID, action_input TEXT, message_input TEXT,
  assigned_to_input UUID, due_at_input TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; next_status TEXT; history_message TEXT;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('rfq.manage',request_record.organization_id)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF action_input='START_REVIEW' THEN
    IF request_record.status<>'SUBMITTED' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF assigned_to_input IS NULL OR due_at_input IS NULL OR due_at_input<=NOW()
      THEN RAISE EXCEPTION 'ASSIGNMENT_AND_DUE_DATE_REQUIRED'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id=assigned_to_input AND u.status='ACTIVE')
      THEN RAISE EXCEPTION 'ASSIGNEE_NOT_AVAILABLE'; END IF;
    next_status:='UNDER_REVIEW'; history_message:='GISP เริ่มตรวจสอบคำขอแล้ว';
  ELSIF action_input='REQUEST_INFO' THEN
    IF request_record.status<>'UNDER_REVIEW' OR NULLIF(BTRIM(message_input),'') IS NULL
      THEN RAISE EXCEPTION 'MESSAGE_REQUIRED_OR_INVALID_STATUS'; END IF;
    next_status:='NEED_INFO'; history_message:=message_input;
  ELSIF action_input='READY_FOR_QUOTE' THEN
    IF request_record.status<>'UNDER_REVIEW' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.custom_request_supplier_candidates WHERE custom_request_id=request_id_input)
      THEN RAISE EXCEPTION 'SUPPLIER_CANDIDATE_REQUIRED'; END IF;
    next_status:='READY_FOR_QUOTE'; history_message:=COALESCE(NULLIF(BTRIM(message_input),''),'ข้อมูลพร้อมจัดทำใบเสนอราคา');
  ELSIF action_input='CANCEL' THEN
    IF request_record.status NOT IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFO','READY_FOR_QUOTE')
      OR NULLIF(BTRIM(message_input),'') IS NULL THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED_OR_INVALID_STATUS'; END IF;
    next_status:='CANCELLED'; history_message:=message_input;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;

  UPDATE public.assignments SET status=CASE WHEN action_input='REQUEST_INFO' THEN 'DONE' ELSE 'CANCELLED' END,
    completed_at=NOW()
  WHERE entity_type='CUSTOM_REQUEST' AND entity_id=request_id_input AND status IN ('OPEN','IN_PROGRESS');

  IF action_input='START_REVIEW' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,due_at,action_required,status,created_by)
    VALUES(request_record.organization_id,'CUSTOM_REQUEST',request_id_input,assigned_to_input,due_at_input,
      'ตรวจสอบ Custom Request และเลือก Supplier Candidate','IN_PROGRESS',(SELECT auth.uid()));
  ELSIF action_input='REQUEST_INFO' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,action_required,status,created_by)
    VALUES(request_record.organization_id,'CUSTOM_REQUEST',request_id_input,request_record.submitted_by,
      BTRIM(message_input),'OPEN',(SELECT auth.uid()));
  END IF;

  UPDATE public.custom_requests SET status=next_status WHERE id=request_id_input;
  PERFORM public.record_custom_request_history(request_id_input,action_input,request_record.status,next_status,history_message,'MEMBER');
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,action_input);
  RETURN request_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.submit_custom_request(
  project_id_input UUID,item_name_input TEXT,specification_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_id_value UUID;
BEGIN
  request_id_value:=public.create_custom_request_draft(project_id_input,NULL,NULL,'OTHER',item_name_input,
    specification_input,NULL,NULL,NULL,1,'EA',NULL,NULL,NULL,NULL);
  RETURN public.submit_custom_request_v2(request_id_value);
END;
$$;
ALTER TABLE public.custom_request_supplier_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_request_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custom_requests_org ON public.custom_requests;
CREATE POLICY custom_requests_profile_select ON public.custom_requests FOR SELECT TO authenticated
USING (member_profile_id=public.current_member_profile_id() OR public.has_permission('rfq.manage',organization_id));
DROP POLICY IF EXISTS custom_request_files_org ON public.custom_request_files;
CREATE POLICY custom_request_files_access ON public.custom_request_files FOR SELECT TO authenticated
USING (public.can_access_custom_request(custom_request_id));
CREATE POLICY custom_request_candidates_staff ON public.custom_request_supplier_candidates FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.custom_requests cr WHERE cr.id=custom_request_id
    AND public.has_permission('rfq.manage',cr.organization_id)
));
CREATE POLICY custom_request_history_access ON public.custom_request_history FOR SELECT TO authenticated
USING (
  public.has_permission('rfq.manage',organization_id)
  OR (visibility='MEMBER' AND public.can_access_custom_request(custom_request_id))
);
DROP POLICY IF EXISTS assignments_select ON public.assignments;
CREATE POLICY assignments_select ON public.assignments FOR SELECT TO authenticated
USING (
  assigned_to=(SELECT auth.uid()) OR public.current_user_is_internal()
  OR (entity_type<>'CUSTOM_REQUEST' AND organization_id IS NOT NULL AND public.can_access_org(organization_id))
);
REVOKE ALL ON public.custom_request_supplier_candidates,public.custom_request_history FROM anon,authenticated;
GRANT SELECT ON public.custom_request_supplier_candidates,public.custom_request_history TO authenticated;
REVOKE SELECT ON public.custom_requests FROM authenticated;
GRANT SELECT (
  id,organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,
  request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,
  requested_material,requested_color,requested_function,member_note,status,submitted_by,
  submitted_at,created_at,updated_at
) ON public.custom_requests TO authenticated;
REVOKE ALL ON FUNCTION public.can_access_custom_request(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_custom_request_history(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_custom_request_v2(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_custom_request(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_set_custom_request_candidates(UUID,UUID[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_review_custom_request(UUID,TEXT,TEXT,UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_custom_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_custom_request_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_custom_request(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_custom_request_candidates(UUID,UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_custom_request(UUID,TEXT,TEXT,UUID,TIMESTAMPTZ) TO authenticated;
INSERT INTO "system"."custom_migrations" ("version", "name", "statements", "created_at") VALUES ('20260824134357', 'slice-4-custom-rfq', ARRAY['ALTER TABLE public.custom_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT ''OTHER''
    CHECK (request_type IN (''RESIZE'',''COLOR_MATERIAL'',''HARDWARE'',''MADE_TO_DRAWING'',''BUILT_IN'',''OTHER'')),
  ADD COLUMN IF NOT EXISTS base_product_id UUID REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.project_areas(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS width_mm NUMERIC(12,2) CHECK (width_mm IS NULL OR width_mm > 0),
  ADD COLUMN IF NOT EXISTS depth_mm NUMERIC(12,2) CHECK (depth_mm IS NULL OR depth_mm > 0),
  ADD COLUMN IF NOT EXISTS height_mm NUMERIC(12,2) CHECK (height_mm IS NULL OR height_mm > 0),
  ADD COLUMN IF NOT EXISTS requested_material TEXT,
  ADD COLUMN IF NOT EXISTS requested_color TEXT,
  ADD COLUMN IF NOT EXISTS requested_function TEXT,
  ADD COLUMN IF NOT EXISTS member_note TEXT', 'UPDATE public.custom_requests cr
SET member_profile_id = p.member_profile_id
FROM public.projects p
WHERE p.id = cr.project_id AND cr.member_profile_id IS NULL', 'ALTER TABLE public.custom_requests ALTER COLUMN member_profile_id SET NOT NULL', 'ALTER TABLE public.custom_requests DROP CONSTRAINT IF EXISTS custom_requests_status_check', 'ALTER TABLE public.custom_requests ADD CONSTRAINT custom_requests_status_check CHECK (
  status IN (''DRAFT'',''SUBMITTED'',''UNDER_REVIEW'',''NEED_INFO'',''READY_FOR_QUOTE'',''CONVERTED'',''QUOTED'',''CLOSED'',''CANCELLED'')
)', 'ALTER TABLE public.custom_request_files
  ADD COLUMN IF NOT EXISTS file_role TEXT NOT NULL DEFAULT ''REFERENCE_IMAGE''
    CHECK (file_role IN (''REFERENCE_IMAGE'',''PDF'',''CAD'',''DIMENSION_DRAWING'',''MATERIAL_REFERENCE''))', 'CREATE TABLE public.custom_request_supplier_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_request_id UUID NOT NULL REFERENCES public.custom_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  added_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (custom_request_id, supplier_id)
)', 'CREATE TABLE public.custom_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_request_id UUID NOT NULL REFERENCES public.custom_requests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  message TEXT,
  visibility TEXT NOT NULL DEFAULT ''MEMBER'' CHECK (visibility IN (''MEMBER'',''INTERNAL'')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)', 'CREATE INDEX IF NOT EXISTS custom_requests_profile_status_idx
  ON public.custom_requests(member_profile_id, status, updated_at DESC)', 'CREATE INDEX IF NOT EXISTS custom_requests_admin_queue_idx
  ON public.custom_requests(status, updated_at DESC)', 'CREATE INDEX IF NOT EXISTS custom_requests_area_idx ON public.custom_requests(area_id)', 'CREATE INDEX IF NOT EXISTS custom_requests_base_product_idx ON public.custom_requests(base_product_id)', 'CREATE INDEX IF NOT EXISTS custom_request_candidates_request_idx
  ON public.custom_request_supplier_candidates(custom_request_id, created_at)', 'CREATE INDEX IF NOT EXISTS custom_request_history_request_idx
  ON public.custom_request_history(custom_request_id, created_at)', 'CREATE UNIQUE INDEX IF NOT EXISTS assignments_custom_request_open_unique
  ON public.assignments(entity_id)
  WHERE entity_type=''CUSTOM_REQUEST'' AND status IN (''OPEN'',''IN_PROGRESS'')', 'CREATE OR REPLACE FUNCTION public.slice4_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$', 'DROP TRIGGER IF EXISTS custom_requests_updated_at ON public.custom_requests', 'CREATE TRIGGER custom_requests_updated_at BEFORE UPDATE ON public.custom_requests
  FOR EACH ROW EXECUTE FUNCTION public.slice4_set_updated_at()', 'CREATE OR REPLACE FUNCTION public.can_access_custom_request(request_id_input UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.custom_requests cr
    WHERE cr.id=request_id_input
      AND (cr.member_profile_id=public.current_member_profile_id()
        OR public.has_permission(''rfq.manage'',cr.organization_id))
  );
$$', 'CREATE OR REPLACE FUNCTION public.record_custom_request_history(
  request_id_input UUID, action_input TEXT, from_status_input TEXT,
  to_status_input TEXT, message_input TEXT, visibility_input TEXT DEFAULT ''MEMBER''
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; history_id_value UUID;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_FOUND''; END IF;
  INSERT INTO public.custom_request_history(
    custom_request_id,organization_id,actor_user_id,action,from_status,to_status,message,visibility
  ) VALUES (
    request_id_input,request_record.organization_id,(SELECT auth.uid()),action_input,
    from_status_input,to_status_input,NULLIF(BTRIM(message_input),''''),visibility_input
  ) RETURNING id INTO history_id_value;
  RETURN history_id_value;
END;
$$', 'CREATE OR REPLACE FUNCTION public.create_custom_request_draft(
  project_id_input UUID, area_id_input UUID, base_product_id_input UUID,
  request_type_input TEXT, item_name_input TEXT, description_input TEXT,
  width_mm_input NUMERIC, depth_mm_input NUMERIC, height_mm_input NUMERIC,
  quantity_input NUMERIC, unit_input TEXT, requested_material_input TEXT,
  requested_color_input TEXT, requested_function_input TEXT, member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE project_record public.projects%ROWTYPE; profile_id_value UUID := public.current_member_profile_id();
  request_id_value UUID; request_number_value TEXT;
BEGIN
  IF profile_id_value IS NULL THEN RAISE EXCEPTION ''APPROVED_MEMBER_REQUIRED''; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=profile_id_value AND status NOT IN (''COMPLETED'',''CANCELLED'');
  IF NOT FOUND THEN RAISE EXCEPTION ''PROJECT_NOT_FOUND''; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION ''AREA_NOT_FOUND''; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status=''PUBLISHED''
  ) THEN RAISE EXCEPTION ''BASE_PRODUCT_NOT_FOUND''; END IF;
  IF request_type_input NOT IN (''RESIZE'',''COLOR_MATERIAL'',''HARDWARE'',''MADE_TO_DRAWING'',''BUILT_IN'',''OTHER'')
    THEN RAISE EXCEPTION ''INVALID_REQUEST_TYPE''; END IF;
  IF quantity_input<=0 THEN RAISE EXCEPTION ''INVALID_QUANTITY''; END IF;
  request_number_value := ''RFQ-''||TO_CHAR(CURRENT_DATE,''YYYY'')||''-''||
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT,''-'','''') FROM 1 FOR 8));
  INSERT INTO public.custom_requests(
    organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,
    request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,
    requested_material,requested_color,requested_function,member_note,status,submitted_by
  ) VALUES (
    project_record.organization_id,profile_id_value,project_id_input,area_id_input,base_product_id_input,
    request_number_value,request_type_input,COALESCE(NULLIF(BTRIM(item_name_input),''''),''รายการ Custom (ร่าง)''),
    COALESCE(BTRIM(description_input),''''),NULLIF(BTRIM(description_input),''''),width_mm_input,depth_mm_input,
    height_mm_input,quantity_input,COALESCE(NULLIF(BTRIM(unit_input),''''),''EA''),
    NULLIF(BTRIM(requested_material_input),''''),NULLIF(BTRIM(requested_color_input),''''),
    NULLIF(BTRIM(requested_function_input),''''),NULLIF(BTRIM(member_note_input),''''),''DRAFT'',(SELECT auth.uid())
  ) RETURNING id INTO request_id_value;
  PERFORM public.record_custom_request_history(request_id_value,''DRAFT_CREATED'',NULL,''DRAFT'',NULL,''MEMBER'');
  PERFORM public.write_audit_event(project_record.organization_id,''custom_request'',request_id_value,''DRAFT_CREATED'');
  RETURN request_id_value;
END;
$$', 'CREATE OR REPLACE FUNCTION public.save_custom_request_details(
  request_id_input UUID, project_id_input UUID, area_id_input UUID, base_product_id_input UUID,
  request_type_input TEXT, item_name_input TEXT, description_input TEXT,
  width_mm_input NUMERIC, depth_mm_input NUMERIC, height_mm_input NUMERIC,
  quantity_input NUMERIC, unit_input TEXT, requested_material_input TEXT,
  requested_color_input TEXT, requested_function_input TEXT, member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; project_record public.projects%ROWTYPE;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN (''DRAFT'',''NEED_INFO'') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_EDITABLE''; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=request_record.member_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION ''PROJECT_NOT_FOUND''; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION ''AREA_NOT_FOUND''; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status=''PUBLISHED''
  ) THEN RAISE EXCEPTION ''BASE_PRODUCT_NOT_FOUND''; END IF;
  IF request_type_input NOT IN (''RESIZE'',''COLOR_MATERIAL'',''HARDWARE'',''MADE_TO_DRAWING'',''BUILT_IN'',''OTHER'')
    THEN RAISE EXCEPTION ''INVALID_REQUEST_TYPE''; END IF;
  IF quantity_input<=0 THEN RAISE EXCEPTION ''INVALID_QUANTITY''; END IF;
  UPDATE public.custom_requests SET
    organization_id=project_record.organization_id,project_id=project_id_input,area_id=area_id_input,
    base_product_id=base_product_id_input,request_type=request_type_input,item_name=BTRIM(item_name_input),
    specification=BTRIM(description_input),description=NULLIF(BTRIM(description_input),''''),
    width_mm=width_mm_input,depth_mm=depth_mm_input,height_mm=height_mm_input,
    quantity=quantity_input,unit=COALESCE(NULLIF(BTRIM(unit_input),''''),''EA''),
    requested_material=NULLIF(BTRIM(requested_material_input),''''),
    requested_color=NULLIF(BTRIM(requested_color_input),''''),
    requested_function=NULLIF(BTRIM(requested_function_input),''''),
    member_note=NULLIF(BTRIM(member_note_input),'''')
  WHERE id=request_id_input;
  PERFORM public.write_audit_event(project_record.organization_id,''custom_request'',request_id_input,''DRAFT_SAVED'');
  RETURN request_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.submit_custom_request_v2(request_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; previous_status TEXT;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN (''DRAFT'',''NEED_INFO'') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_SUBMITTABLE''; END IF;
  IF NULLIF(BTRIM(request_record.item_name),'''') IS NULL
    OR NULLIF(BTRIM(request_record.specification),'''') IS NULL THEN RAISE EXCEPTION ''REQUEST_DETAILS_REQUIRED''; END IF;
  previous_status:=request_record.status;
  UPDATE public.custom_requests SET status=''SUBMITTED'',submitted_by=(SELECT auth.uid()),submitted_at=NOW()
  WHERE id=request_id_input;
  UPDATE public.assignments SET status=''DONE'',completed_at=NOW()
  WHERE entity_type=''CUSTOM_REQUEST'' AND entity_id=request_id_input
    AND assigned_to=(SELECT auth.uid()) AND status IN (''OPEN'',''IN_PROGRESS'');
  PERFORM public.record_custom_request_history(request_id_input,
    CASE WHEN previous_status=''NEED_INFO'' THEN ''RESUBMITTED'' ELSE ''SUBMITTED'' END,
    previous_status,''SUBMITTED'',NULL,''MEMBER'');
  PERFORM public.write_audit_event(request_record.organization_id,''custom_request'',request_id_input,''SUBMITTED'');
  RETURN request_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.cancel_custom_request(request_id_input UUID, reason_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN (''DRAFT'',''SUBMITTED'',''UNDER_REVIEW'',''NEED_INFO'',''READY_FOR_QUOTE'') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_CANCELLABLE''; END IF;
  IF NULLIF(BTRIM(reason_input),'''') IS NULL THEN RAISE EXCEPTION ''CANCELLATION_REASON_REQUIRED''; END IF;
  UPDATE public.custom_requests SET status=''CANCELLED'' WHERE id=request_id_input;
  UPDATE public.assignments SET status=''CANCELLED'',completed_at=NOW()
  WHERE entity_type=''CUSTOM_REQUEST'' AND entity_id=request_id_input AND status IN (''OPEN'',''IN_PROGRESS'');
  PERFORM public.record_custom_request_history(request_id_input,''CANCELLED'',request_record.status,''CANCELLED'',reason_input,''MEMBER'');
  PERFORM public.write_audit_event(request_record.organization_id,''custom_request'',request_id_input,''CANCELLED'');
  RETURN request_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.admin_set_custom_request_candidates(
  request_id_input UUID, supplier_ids_input UUID[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; supplier_id_value UUID;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND OR NOT public.has_permission(''rfq.manage'',request_record.organization_id)
    THEN RAISE EXCEPTION ''PERMISSION_DENIED''; END IF;
  IF request_record.status IN (''CONVERTED'',''CANCELLED'',''CLOSED'') THEN RAISE EXCEPTION ''CUSTOM_REQUEST_LOCKED''; END IF;
  DELETE FROM public.custom_request_supplier_candidates WHERE custom_request_id=request_id_input;
  FOREACH supplier_id_value IN ARRAY COALESCE(supplier_ids_input,ARRAY[]::UUID[]) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=supplier_id_value AND status IN (''PROSPECT'',''ACTIVE''))
      THEN RAISE EXCEPTION ''SUPPLIER_NOT_AVAILABLE''; END IF;
    INSERT INTO public.custom_request_supplier_candidates(custom_request_id,supplier_id,added_by)
    VALUES(request_id_input,supplier_id_value,(SELECT auth.uid())) ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM public.record_custom_request_history(request_id_input,''SUPPLIER_CANDIDATES_UPDATED'',request_record.status,request_record.status,NULL,''INTERNAL'');
  PERFORM public.write_audit_event(request_record.organization_id,''custom_request'',request_id_input,''SUPPLIER_CANDIDATES_UPDATED'');
  RETURN request_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.admin_review_custom_request(
  request_id_input UUID, action_input TEXT, message_input TEXT,
  assigned_to_input UUID, due_at_input TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; next_status TEXT; history_message TEXT;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission(''rfq.manage'',request_record.organization_id)
    THEN RAISE EXCEPTION ''PERMISSION_DENIED''; END IF;
  IF action_input=''START_REVIEW'' THEN
    IF request_record.status<>''SUBMITTED'' THEN RAISE EXCEPTION ''INVALID_STATUS_TRANSITION''; END IF;
    IF assigned_to_input IS NULL OR due_at_input IS NULL OR due_at_input<=NOW()
      THEN RAISE EXCEPTION ''ASSIGNMENT_AND_DUE_DATE_REQUIRED''; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id=assigned_to_input AND u.status=''ACTIVE'')
      THEN RAISE EXCEPTION ''ASSIGNEE_NOT_AVAILABLE''; END IF;
    next_status:=''UNDER_REVIEW''; history_message:=''GISP เริ่มตรวจสอบคำขอแล้ว'';
  ELSIF action_input=''REQUEST_INFO'' THEN
    IF request_record.status<>''UNDER_REVIEW'' OR NULLIF(BTRIM(message_input),'''') IS NULL
      THEN RAISE EXCEPTION ''MESSAGE_REQUIRED_OR_INVALID_STATUS''; END IF;
    next_status:=''NEED_INFO''; history_message:=message_input;
  ELSIF action_input=''READY_FOR_QUOTE'' THEN
    IF request_record.status<>''UNDER_REVIEW'' THEN RAISE EXCEPTION ''INVALID_STATUS_TRANSITION''; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.custom_request_supplier_candidates WHERE custom_request_id=request_id_input)
      THEN RAISE EXCEPTION ''SUPPLIER_CANDIDATE_REQUIRED''; END IF;
    next_status:=''READY_FOR_QUOTE''; history_message:=COALESCE(NULLIF(BTRIM(message_input),''''),''ข้อมูลพร้อมจัดทำใบเสนอราคา'');
  ELSIF action_input=''CANCEL'' THEN
    IF request_record.status NOT IN (''DRAFT'',''SUBMITTED'',''UNDER_REVIEW'',''NEED_INFO'',''READY_FOR_QUOTE'')
      OR NULLIF(BTRIM(message_input),'''') IS NULL THEN RAISE EXCEPTION ''CANCELLATION_REASON_REQUIRED_OR_INVALID_STATUS''; END IF;
    next_status:=''CANCELLED''; history_message:=message_input;
  ELSE RAISE EXCEPTION ''INVALID_ACTION''; END IF;

  UPDATE public.assignments SET status=CASE WHEN action_input=''REQUEST_INFO'' THEN ''DONE'' ELSE ''CANCELLED'' END,
    completed_at=NOW()
  WHERE entity_type=''CUSTOM_REQUEST'' AND entity_id=request_id_input AND status IN (''OPEN'',''IN_PROGRESS'');

  IF action_input=''START_REVIEW'' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,due_at,action_required,status,created_by)
    VALUES(request_record.organization_id,''CUSTOM_REQUEST'',request_id_input,assigned_to_input,due_at_input,
      ''ตรวจสอบ Custom Request และเลือก Supplier Candidate'',''IN_PROGRESS'',(SELECT auth.uid()));
  ELSIF action_input=''REQUEST_INFO'' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,action_required,status,created_by)
    VALUES(request_record.organization_id,''CUSTOM_REQUEST'',request_id_input,request_record.submitted_by,
      BTRIM(message_input),''OPEN'',(SELECT auth.uid()));
  END IF;

  UPDATE public.custom_requests SET status=next_status WHERE id=request_id_input;
  PERFORM public.record_custom_request_history(request_id_input,action_input,request_record.status,next_status,history_message,''MEMBER'');
  PERFORM public.write_audit_event(request_record.organization_id,''custom_request'',request_id_input,action_input);
  RETURN request_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.submit_custom_request(
  project_id_input UUID,item_name_input TEXT,specification_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_id_value UUID;
BEGIN
  request_id_value:=public.create_custom_request_draft(project_id_input,NULL,NULL,''OTHER'',item_name_input,
    specification_input,NULL,NULL,NULL,1,''EA'',NULL,NULL,NULL,NULL);
  RETURN public.submit_custom_request_v2(request_id_value);
END;
$$', 'ALTER TABLE public.custom_request_supplier_candidates ENABLE ROW LEVEL SECURITY', 'ALTER TABLE public.custom_request_history ENABLE ROW LEVEL SECURITY', 'DROP POLICY IF EXISTS custom_requests_org ON public.custom_requests', 'CREATE POLICY custom_requests_profile_select ON public.custom_requests FOR SELECT TO authenticated
USING (member_profile_id=public.current_member_profile_id() OR public.has_permission(''rfq.manage'',organization_id))', 'DROP POLICY IF EXISTS custom_request_files_org ON public.custom_request_files', 'CREATE POLICY custom_request_files_access ON public.custom_request_files FOR SELECT TO authenticated
USING (public.can_access_custom_request(custom_request_id))', 'CREATE POLICY custom_request_candidates_staff ON public.custom_request_supplier_candidates FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.custom_requests cr WHERE cr.id=custom_request_id
    AND public.has_permission(''rfq.manage'',cr.organization_id)
))', 'CREATE POLICY custom_request_history_access ON public.custom_request_history FOR SELECT TO authenticated
USING (
  public.has_permission(''rfq.manage'',organization_id)
  OR (visibility=''MEMBER'' AND public.can_access_custom_request(custom_request_id))
)', 'DROP POLICY IF EXISTS assignments_select ON public.assignments', 'CREATE POLICY assignments_select ON public.assignments FOR SELECT TO authenticated
USING (
  assigned_to=(SELECT auth.uid()) OR public.current_user_is_internal()
  OR (entity_type<>''CUSTOM_REQUEST'' AND organization_id IS NOT NULL AND public.can_access_org(organization_id))
)', 'REVOKE ALL ON public.custom_request_supplier_candidates,public.custom_request_history FROM anon,authenticated', 'GRANT SELECT ON public.custom_request_supplier_candidates,public.custom_request_history TO authenticated', 'REVOKE SELECT ON public.custom_requests FROM authenticated', 'GRANT SELECT (
  id,organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,
  request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,
  requested_material,requested_color,requested_function,member_note,status,submitted_by,
  submitted_at,created_at,updated_at
) ON public.custom_requests TO authenticated', 'REVOKE ALL ON FUNCTION public.can_access_custom_request(UUID) FROM PUBLIC,anon,authenticated', 'REVOKE ALL ON FUNCTION public.record_custom_request_history(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated', 'REVOKE ALL ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated', 'REVOKE ALL ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated', 'REVOKE ALL ON FUNCTION public.submit_custom_request_v2(UUID) FROM PUBLIC,anon,authenticated', 'REVOKE ALL ON FUNCTION public.cancel_custom_request(UUID,TEXT) FROM PUBLIC,anon,authenticated', 'REVOKE ALL ON FUNCTION public.admin_set_custom_request_candidates(UUID,UUID[]) FROM PUBLIC,anon,authenticated', 'REVOKE ALL ON FUNCTION public.admin_review_custom_request(UUID,TEXT,TEXT,UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated', 'GRANT EXECUTE ON FUNCTION public.can_access_custom_request(UUID) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.submit_custom_request_v2(UUID) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.cancel_custom_request(UUID,TEXT) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.admin_set_custom_request_candidates(UUID,UUID[]) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.admin_review_custom_request(UUID,TEXT,TEXT,UUID,TIMESTAMPTZ) TO authenticated'], '2026-08-24T14:48:42.240374+00:00')
  ON CONFLICT ("version") DO UPDATE SET "name" = EXCLUDED."name", "statements" = EXCLUDED."statements", "created_at" = EXCLUDED."created_at";

-- [MIGRATION] migration system.20260824152626 (add)
-- Migration 20260824152626: optimize-custom-rfq-detail
CREATE OR REPLACE FUNCTION public.get_member_custom_request_detail(request_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = request_id_input;

  IF NOT FOUND OR request_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id() THEN
    RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND';
  END IF;

  SELECT jsonb_build_object(
    'request', to_jsonb(request_record),
    'project', (
      SELECT jsonb_build_object(
        'id', p.id,
        'project_number', p.project_number,
        'name', p.name,
        'site_address', p.site_address,
        'expected_need_date', p.expected_need_date
      )
      FROM public.projects p
      WHERE p.id = request_record.project_id
    ),
    'area', (
      SELECT jsonb_build_object('id', pa.id, 'name', pa.name)
      FROM public.project_areas pa
      WHERE pa.id = request_record.area_id
    ),
    'areas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pa.id, 'name', pa.name) ORDER BY pa.created_at)
      FROM public.project_areas pa
      WHERE pa.project_id = request_record.project_id
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id,
        'action', h.action,
        'from_status', h.from_status,
        'to_status', h.to_status,
        'message', h.message,
        'visibility', h.visibility,
        'created_at', h.created_at
      ) ORDER BY h.created_at)
      FROM public.custom_request_history h
      WHERE h.custom_request_id = request_id_input
        AND h.visibility = 'MEMBER'
    ), '[]'::jsonb),
    'files', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fm.id,
        'original_name', fm.original_name,
        'mime_type', fm.mime_type,
        'size_bytes', fm.size_bytes,
        'created_at', fm.created_at,
        'file_role', link.file_role
      ) ORDER BY link.created_at)
      FROM public.custom_request_files link
      JOIN public.file_metadata fm ON fm.id = link.file_id
      WHERE link.custom_request_id = request_id_input
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_admin_custom_request_detail(request_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = request_id_input;

  IF NOT FOUND OR NOT public.has_permission('rfq.manage', request_record.organization_id) THEN
    RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND_OR_PERMISSION_DENIED';
  END IF;

  SELECT jsonb_build_object(
    'request', to_jsonb(request_record),
    'project', (
      SELECT jsonb_build_object(
        'id', p.id,
        'project_number', p.project_number,
        'name', p.name,
        'site_address', p.site_address,
        'expected_need_date', p.expected_need_date
      )
      FROM public.projects p
      WHERE p.id = request_record.project_id
    ),
    'area', (
      SELECT jsonb_build_object('id', pa.id, 'name', pa.name)
      FROM public.project_areas pa
      WHERE pa.id = request_record.area_id
    ),
    'member', (
      SELECT jsonb_build_object(
        'id', mp.id,
        'company_name', mp.company_name,
        'contact_name', mp.contact_name,
        'contact_phone', mp.contact_phone
      )
      FROM public.member_profiles mp
      WHERE mp.id = request_record.member_profile_id
    ),
    'candidates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'supplier_id', c.supplier_id,
        'created_at', c.created_at,
        'supplier', jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'status', s.status
        )
      ) ORDER BY c.created_at)
      FROM public.custom_request_supplier_candidates c
      JOIN public.suppliers s ON s.id = c.supplier_id
      WHERE c.custom_request_id = request_id_input
    ), '[]'::jsonb),
    'assignments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'assigned_to', a.assigned_to,
        'assigned_name', u.full_name,
        'due_at', a.due_at,
        'action_required', a.action_required,
        'status', a.status,
        'created_at', a.created_at,
        'completed_at', a.completed_at
      ) ORDER BY a.created_at DESC)
      FROM public.assignments a
      LEFT JOIN public.users u ON u.id = a.assigned_to
      WHERE a.entity_type = 'CUSTOM_REQUEST'
        AND a.entity_id = request_id_input
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id,
        'actor_user_id', h.actor_user_id,
        'actor_name', u.full_name,
        'action', h.action,
        'from_status', h.from_status,
        'to_status', h.to_status,
        'message', h.message,
        'visibility', h.visibility,
        'created_at', h.created_at
      ) ORDER BY h.created_at)
      FROM public.custom_request_history h
      LEFT JOIN public.users u ON u.id = h.actor_user_id
      WHERE h.custom_request_id = request_id_input
    ), '[]'::jsonb),
    'files', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fm.id,
        'original_name', fm.original_name,
        'mime_type', fm.mime_type,
        'size_bytes', fm.size_bytes,
        'created_at', fm.created_at,
        'file_role', link.file_role
      ) ORDER BY link.created_at)
      FROM public.custom_request_files link
      JOIN public.file_metadata fm ON fm.id = link.file_id
      WHERE link.custom_request_id = request_id_input
    ), '[]'::jsonb),
    'options', jsonb_build_object(
      'suppliers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'status', s.status
        ) ORDER BY s.name)
        FROM public.suppliers s
        WHERE s.status IN ('PROSPECT', 'ACTIVE')
      ), '[]'::jsonb),
      'users', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', u.id, 'full_name', u.full_name) ORDER BY u.full_name)
        FROM public.users u
        WHERE u.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id
              AND ur.revoked_at IS NULL
              AND r.code <> 'MEMBER'
          )
      ), '[]'::jsonb)
    )
  ) INTO result;

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_member_custom_request_detail(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_admin_custom_request_detail(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_custom_request_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_custom_request_detail(UUID) TO authenticated;
INSERT INTO "system"."custom_migrations" ("version", "name", "statements", "created_at") VALUES ('20260824152626', 'optimize-custom-rfq-detail', ARRAY['CREATE OR REPLACE FUNCTION public.get_member_custom_request_detail(request_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = request_id_input;

  IF NOT FOUND OR request_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id() THEN
    RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_FOUND'';
  END IF;

  SELECT jsonb_build_object(
    ''request'', to_jsonb(request_record),
    ''project'', (
      SELECT jsonb_build_object(
        ''id'', p.id,
        ''project_number'', p.project_number,
        ''name'', p.name,
        ''site_address'', p.site_address,
        ''expected_need_date'', p.expected_need_date
      )
      FROM public.projects p
      WHERE p.id = request_record.project_id
    ),
    ''area'', (
      SELECT jsonb_build_object(''id'', pa.id, ''name'', pa.name)
      FROM public.project_areas pa
      WHERE pa.id = request_record.area_id
    ),
    ''areas'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(''id'', pa.id, ''name'', pa.name) ORDER BY pa.created_at)
      FROM public.project_areas pa
      WHERE pa.project_id = request_record.project_id
    ), ''[]''::jsonb),
    ''history'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        ''id'', h.id,
        ''action'', h.action,
        ''from_status'', h.from_status,
        ''to_status'', h.to_status,
        ''message'', h.message,
        ''visibility'', h.visibility,
        ''created_at'', h.created_at
      ) ORDER BY h.created_at)
      FROM public.custom_request_history h
      WHERE h.custom_request_id = request_id_input
        AND h.visibility = ''MEMBER''
    ), ''[]''::jsonb),
    ''files'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        ''id'', fm.id,
        ''original_name'', fm.original_name,
        ''mime_type'', fm.mime_type,
        ''size_bytes'', fm.size_bytes,
        ''created_at'', fm.created_at,
        ''file_role'', link.file_role
      ) ORDER BY link.created_at)
      FROM public.custom_request_files link
      JOIN public.file_metadata fm ON fm.id = link.file_id
      WHERE link.custom_request_id = request_id_input
    ), ''[]''::jsonb)
  ) INTO result;

  RETURN result;
END;
$$', 'CREATE OR REPLACE FUNCTION public.get_admin_custom_request_detail(request_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = request_id_input;

  IF NOT FOUND OR NOT public.has_permission(''rfq.manage'', request_record.organization_id) THEN
    RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_FOUND_OR_PERMISSION_DENIED'';
  END IF;

  SELECT jsonb_build_object(
    ''request'', to_jsonb(request_record),
    ''project'', (
      SELECT jsonb_build_object(
        ''id'', p.id,
        ''project_number'', p.project_number,
        ''name'', p.name,
        ''site_address'', p.site_address,
        ''expected_need_date'', p.expected_need_date
      )
      FROM public.projects p
      WHERE p.id = request_record.project_id
    ),
    ''area'', (
      SELECT jsonb_build_object(''id'', pa.id, ''name'', pa.name)
      FROM public.project_areas pa
      WHERE pa.id = request_record.area_id
    ),
    ''member'', (
      SELECT jsonb_build_object(
        ''id'', mp.id,
        ''company_name'', mp.company_name,
        ''contact_name'', mp.contact_name,
        ''contact_phone'', mp.contact_phone
      )
      FROM public.member_profiles mp
      WHERE mp.id = request_record.member_profile_id
    ),
    ''candidates'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        ''id'', c.id,
        ''supplier_id'', c.supplier_id,
        ''created_at'', c.created_at,
        ''supplier'', jsonb_build_object(
          ''id'', s.id,
          ''code'', s.code,
          ''name'', s.name,
          ''status'', s.status
        )
      ) ORDER BY c.created_at)
      FROM public.custom_request_supplier_candidates c
      JOIN public.suppliers s ON s.id = c.supplier_id
      WHERE c.custom_request_id = request_id_input
    ), ''[]''::jsonb),
    ''assignments'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        ''id'', a.id,
        ''assigned_to'', a.assigned_to,
        ''assigned_name'', u.full_name,
        ''due_at'', a.due_at,
        ''action_required'', a.action_required,
        ''status'', a.status,
        ''created_at'', a.created_at,
        ''completed_at'', a.completed_at
      ) ORDER BY a.created_at DESC)
      FROM public.assignments a
      LEFT JOIN public.users u ON u.id = a.assigned_to
      WHERE a.entity_type = ''CUSTOM_REQUEST''
        AND a.entity_id = request_id_input
    ), ''[]''::jsonb),
    ''history'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        ''id'', h.id,
        ''actor_user_id'', h.actor_user_id,
        ''actor_name'', u.full_name,
        ''action'', h.action,
        ''from_status'', h.from_status,
        ''to_status'', h.to_status,
        ''message'', h.message,
        ''visibility'', h.visibility,
        ''created_at'', h.created_at
      ) ORDER BY h.created_at)
      FROM public.custom_request_history h
      LEFT JOIN public.users u ON u.id = h.actor_user_id
      WHERE h.custom_request_id = request_id_input
    ), ''[]''::jsonb),
    ''files'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        ''id'', fm.id,
        ''original_name'', fm.original_name,
        ''mime_type'', fm.mime_type,
        ''size_bytes'', fm.size_bytes,
        ''created_at'', fm.created_at,
        ''file_role'', link.file_role
      ) ORDER BY link.created_at)
      FROM public.custom_request_files link
      JOIN public.file_metadata fm ON fm.id = link.file_id
      WHERE link.custom_request_id = request_id_input
    ), ''[]''::jsonb),
    ''options'', jsonb_build_object(
      ''suppliers'', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          ''id'', s.id,
          ''code'', s.code,
          ''name'', s.name,
          ''status'', s.status
        ) ORDER BY s.name)
        FROM public.suppliers s
        WHERE s.status IN (''PROSPECT'', ''ACTIVE'')
      ), ''[]''::jsonb),
      ''users'', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(''id'', u.id, ''full_name'', u.full_name) ORDER BY u.full_name)
        FROM public.users u
        WHERE u.status = ''ACTIVE''
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id
              AND ur.revoked_at IS NULL
              AND r.code <> ''MEMBER''
          )
      ), ''[]''::jsonb)
    )
  ) INTO result;

  RETURN result;
END;
$$', 'REVOKE ALL ON FUNCTION public.get_member_custom_request_detail(UUID) FROM PUBLIC, anon, authenticated', 'REVOKE ALL ON FUNCTION public.get_admin_custom_request_detail(UUID) FROM PUBLIC, anon, authenticated', 'GRANT EXECUTE ON FUNCTION public.get_member_custom_request_detail(UUID) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.get_admin_custom_request_detail(UUID) TO authenticated'], '2026-08-24T15:31:19.750754+00:00')
  ON CONFLICT ("version") DO UPDATE SET "name" = EXCLUDED."name", "statements" = EXCLUDED."statements", "created_at" = EXCLUDED."created_at";

-- [MIGRATION] migration system.20260824153919 (add)
-- Migration 20260824153919: secure-member-rfq-detail-projection
CREATE OR REPLACE FUNCTION public.get_member_custom_request_detail(request_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = request_id_input;

  IF NOT FOUND OR request_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id() THEN
    RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND';
  END IF;

  SELECT jsonb_build_object(
    'request', jsonb_build_object(
      'id', request_record.id,
      'organization_id', request_record.organization_id,
      'member_profile_id', request_record.member_profile_id,
      'project_id', request_record.project_id,
      'area_id', request_record.area_id,
      'base_product_id', request_record.base_product_id,
      'request_number', request_record.request_number,
      'request_type', request_record.request_type,
      'item_name', request_record.item_name,
      'specification', request_record.specification,
      'description', request_record.description,
      'width_mm', request_record.width_mm,
      'depth_mm', request_record.depth_mm,
      'height_mm', request_record.height_mm,
      'quantity', request_record.quantity,
      'unit', request_record.unit,
      'requested_material', request_record.requested_material,
      'requested_color', request_record.requested_color,
      'requested_function', request_record.requested_function,
      'member_note', request_record.member_note,
      'status', request_record.status,
      'submitted_by', request_record.submitted_by,
      'submitted_at', request_record.submitted_at,
      'created_at', request_record.created_at,
      'updated_at', request_record.updated_at
    ),
    'project', (
      SELECT jsonb_build_object(
        'id', p.id,
        'project_number', p.project_number,
        'name', p.name,
        'site_address', p.site_address,
        'expected_need_date', p.expected_need_date
      )
      FROM public.projects p
      WHERE p.id = request_record.project_id
    ),
    'area', (
      SELECT jsonb_build_object('id', pa.id, 'name', pa.name)
      FROM public.project_areas pa
      WHERE pa.id = request_record.area_id
    ),
    'areas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pa.id, 'name', pa.name) ORDER BY pa.created_at)
      FROM public.project_areas pa
      WHERE pa.project_id = request_record.project_id
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id,
        'action', h.action,
        'from_status', h.from_status,
        'to_status', h.to_status,
        'message', h.message,
        'visibility', h.visibility,
        'created_at', h.created_at
      ) ORDER BY h.created_at)
      FROM public.custom_request_history h
      WHERE h.custom_request_id = request_id_input
        AND h.visibility = 'MEMBER'
    ), '[]'::jsonb),
    'files', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fm.id,
        'original_name', fm.original_name,
        'mime_type', fm.mime_type,
        'size_bytes', fm.size_bytes,
        'created_at', fm.created_at,
        'file_role', link.file_role
      ) ORDER BY link.created_at)
      FROM public.custom_request_files link
      JOIN public.file_metadata fm ON fm.id = link.file_id
      WHERE link.custom_request_id = request_id_input
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_member_custom_request_detail(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_custom_request_detail(UUID) TO authenticated;
INSERT INTO "system"."custom_migrations" ("version", "name", "statements", "created_at") VALUES ('20260824153919', 'secure-member-rfq-detail-projection', ARRAY['CREATE OR REPLACE FUNCTION public.get_member_custom_request_detail(request_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = request_id_input;

  IF NOT FOUND OR request_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id() THEN
    RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_FOUND'';
  END IF;

  SELECT jsonb_build_object(
    ''request'', jsonb_build_object(
      ''id'', request_record.id,
      ''organization_id'', request_record.organization_id,
      ''member_profile_id'', request_record.member_profile_id,
      ''project_id'', request_record.project_id,
      ''area_id'', request_record.area_id,
      ''base_product_id'', request_record.base_product_id,
      ''request_number'', request_record.request_number,
      ''request_type'', request_record.request_type,
      ''item_name'', request_record.item_name,
      ''specification'', request_record.specification,
      ''description'', request_record.description,
      ''width_mm'', request_record.width_mm,
      ''depth_mm'', request_record.depth_mm,
      ''height_mm'', request_record.height_mm,
      ''quantity'', request_record.quantity,
      ''unit'', request_record.unit,
      ''requested_material'', request_record.requested_material,
      ''requested_color'', request_record.requested_color,
      ''requested_function'', request_record.requested_function,
      ''member_note'', request_record.member_note,
      ''status'', request_record.status,
      ''submitted_by'', request_record.submitted_by,
      ''submitted_at'', request_record.submitted_at,
      ''created_at'', request_record.created_at,
      ''updated_at'', request_record.updated_at
    ),
    ''project'', (
      SELECT jsonb_build_object(
        ''id'', p.id,
        ''project_number'', p.project_number,
        ''name'', p.name,
        ''site_address'', p.site_address,
        ''expected_need_date'', p.expected_need_date
      )
      FROM public.projects p
      WHERE p.id = request_record.project_id
    ),
    ''area'', (
      SELECT jsonb_build_object(''id'', pa.id, ''name'', pa.name)
      FROM public.project_areas pa
      WHERE pa.id = request_record.area_id
    ),
    ''areas'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(''id'', pa.id, ''name'', pa.name) ORDER BY pa.created_at)
      FROM public.project_areas pa
      WHERE pa.project_id = request_record.project_id
    ), ''[]''::jsonb),
    ''history'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        ''id'', h.id,
        ''action'', h.action,
        ''from_status'', h.from_status,
        ''to_status'', h.to_status,
        ''message'', h.message,
        ''visibility'', h.visibility,
        ''created_at'', h.created_at
      ) ORDER BY h.created_at)
      FROM public.custom_request_history h
      WHERE h.custom_request_id = request_id_input
        AND h.visibility = ''MEMBER''
    ), ''[]''::jsonb),
    ''files'', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        ''id'', fm.id,
        ''original_name'', fm.original_name,
        ''mime_type'', fm.mime_type,
        ''size_bytes'', fm.size_bytes,
        ''created_at'', fm.created_at,
        ''file_role'', link.file_role
      ) ORDER BY link.created_at)
      FROM public.custom_request_files link
      JOIN public.file_metadata fm ON fm.id = link.file_id
      WHERE link.custom_request_id = request_id_input
    ), ''[]''::jsonb)
  ) INTO result;

  RETURN result;
END;
$$', 'REVOKE ALL ON FUNCTION public.get_member_custom_request_detail(UUID) FROM PUBLIC, anon, authenticated', 'GRANT EXECUTE ON FUNCTION public.get_member_custom_request_detail(UUID) TO authenticated'], '2026-08-24T15:40:03.887983+00:00')
  ON CONFLICT ("version") DO UPDATE SET "name" = EXCLUDED."name", "statements" = EXCLUDED."statements", "created_at" = EXCLUDED."created_at";

-- [MIGRATION] migration system.20260826044926 (add)
-- Migration 20260826044926: finish-slice-4-custom-rfq
UPDATE public.custom_requests
SET status = CASE status
  WHEN 'QUOTED' THEN 'READY_FOR_QUOTE'
  WHEN 'CLOSED' THEN 'CANCELLED'
  ELSE status
END
WHERE status IN ('QUOTED', 'CLOSED');
ALTER TABLE public.custom_requests
  DROP CONSTRAINT IF EXISTS custom_requests_status_check;
ALTER TABLE public.custom_requests
  ADD CONSTRAINT custom_requests_status_check CHECK (
    status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFO','READY_FOR_QUOTE','CONVERTED','CANCELLED')
  );
ALTER TABLE public.custom_requests
  DROP CONSTRAINT IF EXISTS custom_requests_request_type_check;
ALTER TABLE public.custom_requests
  ADD CONSTRAINT custom_requests_request_type_check CHECK (
    request_type IN (
      'RESIZE','COLOR_MATERIAL','HARDWARE','MADE_TO_DRAWING',
      'PROJECT_SPECIFIC','BUILT_IN','CAD_PDF','OTHER'
    )
  );
ALTER TABLE public.custom_requests
  ADD COLUMN IF NOT EXISTS requested_options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;
UPDATE public.custom_requests
SET requested_options_json = jsonb_strip_nulls(jsonb_build_object(
  'material', requested_material,
  'color', requested_color,
  'function', requested_function
));
DO $$
DECLARE request_row RECORD;
BEGIN
  FOR request_row IN
    SELECT id FROM public.custom_requests WHERE request_number LIKE 'RFQ-%' ORDER BY created_at, id
  LOOP
    UPDATE public.custom_requests
    SET request_number = public.next_record_reference('CRQ')
    WHERE id = request_row.id;
  END LOOP;
END;
$$;
ALTER TABLE public.custom_request_files
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1
    CHECK (version_number > 0),
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);
UPDATE public.custom_request_files link
SET uploaded_by = metadata.uploaded_by
FROM public.file_metadata metadata
WHERE metadata.id = link.file_id AND link.uploaded_by IS NULL;
ALTER TABLE public.custom_request_files
  ALTER COLUMN uploaded_by SET NOT NULL;
ALTER TABLE public.custom_request_supplier_candidates
  ADD COLUMN IF NOT EXISTS candidate_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (candidate_status IN ('ACTIVE','REMOVED')),
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
UPDATE public.custom_request_supplier_candidates
SET created_by = added_by
WHERE created_by IS NULL;
ALTER TABLE public.custom_request_supplier_candidates
  ALTER COLUMN created_by SET NOT NULL;
DROP TRIGGER IF EXISTS custom_request_history_append_only ON public.custom_request_history;
CREATE TRIGGER custom_request_history_append_only
BEFORE UPDATE OR DELETE ON public.custom_request_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();
CREATE OR REPLACE FUNCTION public.create_custom_request_draft(
  project_id_input UUID, area_id_input UUID, base_product_id_input UUID,
  request_type_input TEXT, item_name_input TEXT, description_input TEXT,
  width_mm_input NUMERIC, depth_mm_input NUMERIC, height_mm_input NUMERIC,
  quantity_input NUMERIC, unit_input TEXT, requested_material_input TEXT,
  requested_color_input TEXT, requested_function_input TEXT, member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  profile_id_value UUID := public.current_member_profile_id();
  request_id_value UUID;
BEGIN
  IF profile_id_value IS NULL THEN RAISE EXCEPTION 'APPROVED_MEMBER_REQUIRED'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=profile_id_value
    AND status NOT IN ('COMPLETED','CANCELLED');
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION 'AREA_NOT_FOUND'; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status='PUBLISHED'
  ) THEN RAISE EXCEPTION 'BASE_PRODUCT_NOT_FOUND'; END IF;
  IF request_type_input NOT IN (
    'RESIZE','COLOR_MATERIAL','HARDWARE','MADE_TO_DRAWING',
    'PROJECT_SPECIFIC','BUILT_IN','CAD_PDF','OTHER'
  ) THEN RAISE EXCEPTION 'INVALID_REQUEST_TYPE'; END IF;
  IF NULLIF(BTRIM(item_name_input),'') IS NULL THEN RAISE EXCEPTION 'ITEM_NAME_REQUIRED'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(description_input,''))) < 10 THEN RAISE EXCEPTION 'DESCRIPTION_TOO_SHORT'; END IF;
  IF quantity_input IS NULL OR quantity_input<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;

  INSERT INTO public.custom_requests(
    organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,
    request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,
    requested_material,requested_color,requested_function,requested_options_json,member_note,status,submitted_by
  ) VALUES (
    project_record.organization_id,profile_id_value,project_id_input,area_id_input,base_product_id_input,
    public.next_record_reference('CRQ'),request_type_input,BTRIM(item_name_input),BTRIM(description_input),
    BTRIM(description_input),width_mm_input,depth_mm_input,height_mm_input,quantity_input,
    COALESCE(NULLIF(BTRIM(unit_input),''),'EA'),NULLIF(BTRIM(requested_material_input),''),
    NULLIF(BTRIM(requested_color_input),''),NULLIF(BTRIM(requested_function_input),''),
    jsonb_strip_nulls(jsonb_build_object(
      'material',NULLIF(BTRIM(requested_material_input),''),
      'color',NULLIF(BTRIM(requested_color_input),''),
      'function',NULLIF(BTRIM(requested_function_input),'')
    )),NULLIF(BTRIM(member_note_input),''),'DRAFT',(SELECT auth.uid())
  ) RETURNING id INTO request_id_value;
  PERFORM public.record_custom_request_history(request_id_value,'DRAFT_CREATED',NULL,'DRAFT',NULL,'MEMBER');
  PERFORM public.write_audit_event(project_record.organization_id,'custom_request',request_id_value,'DRAFT_CREATED');
  RETURN request_id_value;
END;
$$;
CREATE OR REPLACE FUNCTION public.save_custom_request_details(
  request_id_input UUID, project_id_input UUID, area_id_input UUID, base_product_id_input UUID,
  request_type_input TEXT, item_name_input TEXT, description_input TEXT,
  width_mm_input NUMERIC, depth_mm_input NUMERIC, height_mm_input NUMERIC,
  quantity_input NUMERIC, unit_input TEXT, requested_material_input TEXT,
  requested_color_input TEXT, requested_function_input TEXT, member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; project_record public.projects%ROWTYPE;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN ('DRAFT','NEED_INFO') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_EDITABLE'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=request_record.member_profile_id
    AND status NOT IN ('COMPLETED','CANCELLED');
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION 'AREA_NOT_FOUND'; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status='PUBLISHED'
  ) THEN RAISE EXCEPTION 'BASE_PRODUCT_NOT_FOUND'; END IF;
  IF request_type_input NOT IN (
    'RESIZE','COLOR_MATERIAL','HARDWARE','MADE_TO_DRAWING',
    'PROJECT_SPECIFIC','BUILT_IN','CAD_PDF','OTHER'
  ) THEN RAISE EXCEPTION 'INVALID_REQUEST_TYPE'; END IF;
  IF NULLIF(BTRIM(item_name_input),'') IS NULL THEN RAISE EXCEPTION 'ITEM_NAME_REQUIRED'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(description_input,''))) < 10 THEN RAISE EXCEPTION 'DESCRIPTION_TOO_SHORT'; END IF;
  IF quantity_input IS NULL OR quantity_input<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;

  UPDATE public.custom_requests SET
    organization_id=project_record.organization_id,project_id=project_id_input,area_id=area_id_input,
    base_product_id=base_product_id_input,request_type=request_type_input,item_name=BTRIM(item_name_input),
    specification=BTRIM(description_input),description=BTRIM(description_input),
    width_mm=width_mm_input,depth_mm=depth_mm_input,height_mm=height_mm_input,
    quantity=quantity_input,unit=COALESCE(NULLIF(BTRIM(unit_input),''),'EA'),
    requested_material=NULLIF(BTRIM(requested_material_input),''),
    requested_color=NULLIF(BTRIM(requested_color_input),''),
    requested_function=NULLIF(BTRIM(requested_function_input),''),
    requested_options_json=jsonb_strip_nulls(jsonb_build_object(
      'material',NULLIF(BTRIM(requested_material_input),''),
      'color',NULLIF(BTRIM(requested_color_input),''),
      'function',NULLIF(BTRIM(requested_function_input),'')
    )),member_note=NULLIF(BTRIM(member_note_input),'')
  WHERE id=request_id_input;
  PERFORM public.write_audit_event(project_record.organization_id,'custom_request',request_id_input,'DRAFT_SAVED');
  RETURN request_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.submit_custom_request_v2(request_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; previous_status TEXT;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN ('DRAFT','NEED_INFO') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_SUBMITTABLE'; END IF;
  IF NULLIF(BTRIM(request_record.item_name),'') IS NULL
    OR CHAR_LENGTH(BTRIM(COALESCE(request_record.specification,''))) < 10
    THEN RAISE EXCEPTION 'REQUEST_DETAILS_REQUIRED'; END IF;
  previous_status:=request_record.status;
  UPDATE public.custom_requests SET status='SUBMITTED',submitted_by=(SELECT auth.uid()),submitted_at=NOW()
  WHERE id=request_id_input;
  UPDATE public.assignments SET status='DONE',completed_at=NOW()
  WHERE entity_type='CUSTOM_REQUEST' AND entity_id=request_id_input
    AND status IN ('OPEN','IN_PROGRESS');
  PERFORM public.record_custom_request_history(request_id_input,
    CASE WHEN previous_status='NEED_INFO' THEN 'RESUBMITTED' ELSE 'SUBMITTED' END,
    previous_status,'SUBMITTED',NULL,'MEMBER');
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'SUBMITTED');
  RETURN request_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_set_custom_request_candidates(
  request_id_input UUID, supplier_ids_input UUID[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; supplier_id_value UUID;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('rfq.manage',request_record.organization_id)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF request_record.status <> 'UNDER_REVIEW' THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_UNDER_REVIEW'; END IF;
  DELETE FROM public.custom_request_supplier_candidates WHERE custom_request_id=request_id_input;
  FOREACH supplier_id_value IN ARRAY COALESCE(supplier_ids_input,ARRAY[]::UUID[]) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=supplier_id_value AND status IN ('PROSPECT','ACTIVE'))
      THEN RAISE EXCEPTION 'SUPPLIER_NOT_AVAILABLE'; END IF;
    INSERT INTO public.custom_request_supplier_candidates(
      custom_request_id,supplier_id,added_by,created_by,candidate_status
    ) VALUES(request_id_input,supplier_id_value,(SELECT auth.uid()),(SELECT auth.uid()),'ACTIVE')
    ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM public.record_custom_request_history(request_id_input,'SUPPLIER_CANDIDATES_UPDATED',request_record.status,request_record.status,NULL,'INTERNAL');
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'SUPPLIER_CANDIDATES_UPDATED');
  RETURN request_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_review_custom_request(
  request_id_input UUID, action_input TEXT, message_input TEXT,
  assigned_to_input UUID, due_at_input TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; next_status TEXT; history_message TEXT; history_visibility TEXT := 'MEMBER';
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('rfq.manage',request_record.organization_id)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;

  IF action_input='SAVE_NOTE' THEN
    UPDATE public.custom_requests SET admin_note=NULLIF(BTRIM(message_input),'') WHERE id=request_id_input;
    PERFORM public.record_custom_request_history(request_id_input,'ADMIN_NOTE_UPDATED',request_record.status,request_record.status,
      CASE WHEN NULLIF(BTRIM(message_input),'') IS NULL THEN 'ล้างหมายเหตุภายใน' ELSE 'อัปเดตหมายเหตุภายใน' END,'INTERNAL');
    PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'ADMIN_NOTE_UPDATED');
    RETURN request_id_input;
  ELSIF action_input='START_REVIEW' THEN
    IF request_record.status<>'SUBMITTED' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF assigned_to_input IS NULL OR due_at_input IS NULL OR due_at_input<=NOW()
      THEN RAISE EXCEPTION 'ASSIGNMENT_AND_DUE_DATE_REQUIRED'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles ur ON ur.user_id=u.id AND ur.revoked_at IS NULL
      JOIN public.role_permissions rp ON rp.role_id=ur.role_id
      JOIN public.permissions p ON p.id=rp.permission_id AND p.code='rfq.manage'
      WHERE u.id=assigned_to_input AND u.status='ACTIVE'
        AND (ur.organization_id IS NULL OR ur.organization_id=request_record.organization_id)
    ) THEN RAISE EXCEPTION 'ASSIGNEE_NOT_AVAILABLE'; END IF;
    next_status:='UNDER_REVIEW'; history_message:='GISP เริ่มตรวจสอบคำขอแล้ว';
  ELSIF action_input='REQUEST_INFO' THEN
    IF request_record.status<>'UNDER_REVIEW' OR NULLIF(BTRIM(message_input),'') IS NULL
      THEN RAISE EXCEPTION 'MESSAGE_REQUIRED_OR_INVALID_STATUS'; END IF;
    next_status:='NEED_INFO'; history_message:=BTRIM(message_input);
  ELSIF action_input='READY_FOR_QUOTE' THEN
    IF request_record.status<>'UNDER_REVIEW' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.custom_request_supplier_candidates
      WHERE custom_request_id=request_id_input AND candidate_status='ACTIVE'
    ) THEN RAISE EXCEPTION 'SUPPLIER_CANDIDATE_REQUIRED'; END IF;
    next_status:='READY_FOR_QUOTE';
    history_message:=COALESCE(NULLIF(BTRIM(message_input),''),'ข้อมูลพร้อมจัดทำใบเสนอราคา');
  ELSIF action_input='CANCEL' THEN
    IF request_record.status NOT IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFO','READY_FOR_QUOTE')
      OR NULLIF(BTRIM(message_input),'') IS NULL THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED_OR_INVALID_STATUS'; END IF;
    next_status:='CANCELLED'; history_message:=BTRIM(message_input);
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;

  UPDATE public.assignments SET
    status=CASE WHEN action_input IN ('REQUEST_INFO','READY_FOR_QUOTE') THEN 'DONE' ELSE 'CANCELLED' END,
    completed_at=NOW()
  WHERE entity_type='CUSTOM_REQUEST' AND entity_id=request_id_input AND status IN ('OPEN','IN_PROGRESS');

  IF action_input='START_REVIEW' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,due_at,action_required,status,created_by)
    VALUES(request_record.organization_id,'CUSTOM_REQUEST',request_id_input,assigned_to_input,due_at_input,
      'ตรวจสอบ Custom Request และเลือก Supplier Candidate','IN_PROGRESS',(SELECT auth.uid()));
  ELSIF action_input='REQUEST_INFO' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,action_required,status,created_by)
    VALUES(request_record.organization_id,'CUSTOM_REQUEST',request_id_input,request_record.submitted_by,
      BTRIM(message_input),'OPEN',(SELECT auth.uid()));
  END IF;

  UPDATE public.custom_requests SET status=next_status WHERE id=request_id_input;
  PERFORM public.record_custom_request_history(request_id_input,action_input,request_record.status,next_status,history_message,history_visibility);
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,action_input);
  RETURN request_id_input;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_member_custom_request_detail(request_id_input UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; result JSONB;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND OR request_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id()
    THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND'; END IF;
  SELECT jsonb_build_object(
    'request',jsonb_build_object(
      'id',request_record.id,'organization_id',request_record.organization_id,
      'member_profile_id',request_record.member_profile_id,'project_id',request_record.project_id,
      'area_id',request_record.area_id,'base_product_id',request_record.base_product_id,
      'request_number',request_record.request_number,'request_type',request_record.request_type,
      'item_name',request_record.item_name,'specification',request_record.specification,
      'description',request_record.description,'width_mm',request_record.width_mm,
      'depth_mm',request_record.depth_mm,'height_mm',request_record.height_mm,
      'quantity',request_record.quantity,'unit',request_record.unit,
      'requested_material',request_record.requested_material,'requested_color',request_record.requested_color,
      'requested_function',request_record.requested_function,'requested_options_json',request_record.requested_options_json,
      'member_note',request_record.member_note,'status',request_record.status,
      'submitted_by',request_record.submitted_by,'submitted_at',request_record.submitted_at,
      'created_at',request_record.created_at,'updated_at',request_record.updated_at
    ),
    'project',(SELECT jsonb_build_object('id',p.id,'project_number',p.project_number,'name',p.name,
      'site_address',p.site_address,'expected_need_date',p.expected_need_date)
      FROM public.projects p WHERE p.id=request_record.project_id),
    'area',(SELECT jsonb_build_object('id',pa.id,'name',pa.name) FROM public.project_areas pa WHERE pa.id=request_record.area_id),
    'areas',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',pa.id,'name',pa.name) ORDER BY pa.created_at)
      FROM public.project_areas pa WHERE pa.project_id=request_record.project_id),'[]'::jsonb),
    'history',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',h.id,'action',h.action,
      'from_status',h.from_status,'to_status',h.to_status,'message',h.message,
      'visibility',h.visibility,'created_at',h.created_at) ORDER BY h.created_at)
      FROM public.custom_request_history h WHERE h.custom_request_id=request_id_input AND h.visibility='MEMBER'),'[]'::jsonb),
    'files',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',fm.id,'original_name',fm.original_name,
      'mime_type',fm.mime_type,'size_bytes',fm.size_bytes,'created_at',fm.created_at,
      'file_role',link.file_role,'version_number',link.version_number) ORDER BY link.created_at)
      FROM public.custom_request_files link JOIN public.file_metadata fm ON fm.id=link.file_id
      WHERE link.custom_request_id=request_id_input),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_admin_custom_request_detail(request_id_input UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; result JSONB;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND OR NOT public.has_permission('rfq.manage',request_record.organization_id)
    THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND_OR_PERMISSION_DENIED'; END IF;
  SELECT jsonb_build_object(
    'request',to_jsonb(request_record),
    'project',(SELECT jsonb_build_object('id',p.id,'project_number',p.project_number,'name',p.name,
      'site_address',p.site_address,'expected_need_date',p.expected_need_date) FROM public.projects p WHERE p.id=request_record.project_id),
    'area',(SELECT jsonb_build_object('id',pa.id,'name',pa.name) FROM public.project_areas pa WHERE pa.id=request_record.area_id),
    'member',(SELECT jsonb_build_object('id',mp.id,'company_name',mp.company_name,
      'contact_name',mp.contact_name,'contact_phone',mp.contact_phone) FROM public.member_profiles mp WHERE mp.id=request_record.member_profile_id),
    'candidates',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'supplier_id',c.supplier_id,
      'candidate_status',c.candidate_status,'note',c.note,'created_at',c.created_at,
      'supplier',jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'status',s.status)) ORDER BY c.created_at)
      FROM public.custom_request_supplier_candidates c JOIN public.suppliers s ON s.id=c.supplier_id
      WHERE c.custom_request_id=request_id_input),'[]'::jsonb),
    'assignments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'assigned_to',a.assigned_to,
      'assigned_name',u.full_name,'due_at',a.due_at,'action_required',a.action_required,'status',a.status,
      'created_at',a.created_at,'completed_at',a.completed_at) ORDER BY a.created_at DESC)
      FROM public.assignments a LEFT JOIN public.users u ON u.id=a.assigned_to
      WHERE a.entity_type='CUSTOM_REQUEST' AND a.entity_id=request_id_input),'[]'::jsonb),
    'history',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',h.id,'actor_user_id',h.actor_user_id,
      'actor_name',u.full_name,'action',h.action,'from_status',h.from_status,'to_status',h.to_status,
      'message',h.message,'visibility',h.visibility,'created_at',h.created_at) ORDER BY h.created_at)
      FROM public.custom_request_history h LEFT JOIN public.users u ON u.id=h.actor_user_id
      WHERE h.custom_request_id=request_id_input),'[]'::jsonb),
    'files',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',fm.id,'original_name',fm.original_name,
      'mime_type',fm.mime_type,'size_bytes',fm.size_bytes,'created_at',fm.created_at,
      'file_role',link.file_role,'version_number',link.version_number) ORDER BY link.created_at)
      FROM public.custom_request_files link JOIN public.file_metadata fm ON fm.id=link.file_id
      WHERE link.custom_request_id=request_id_input),'[]'::jsonb),
    'options',jsonb_build_object(
      'suppliers',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'status',s.status) ORDER BY s.name)
        FROM public.suppliers s WHERE s.status IN ('PROSPECT','ACTIVE')),'[]'::jsonb),
      'users',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.id,'full_name',u.full_name) ORDER BY u.full_name)
        FROM public.users u WHERE u.status='ACTIVE' AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.role_permissions rp ON rp.role_id=ur.role_id
          JOIN public.permissions p ON p.id=rp.permission_id
          WHERE ur.user_id=u.id AND ur.revoked_at IS NULL AND p.code='rfq.manage'
            AND (ur.organization_id IS NULL OR ur.organization_id=request_record.organization_id)
        )),'[]'::jsonb)
    )
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON public.custom_request_files FROM anon,authenticated;
GRANT SELECT (custom_request_id,file_id,created_at,file_role,version_number,uploaded_by)
  ON public.custom_request_files TO authenticated;
REVOKE SELECT ON public.custom_requests FROM authenticated;
GRANT SELECT (
  id,organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,
  request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,
  requested_material,requested_color,requested_function,requested_options_json,member_note,status,
  submitted_by,submitted_at,created_at,updated_at
) ON public.custom_requests TO authenticated;
REVOKE ALL ON FUNCTION public.get_member_custom_request_detail(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_admin_custom_request_detail(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_custom_request_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_custom_request_detail(UUID) TO authenticated;
INSERT INTO "system"."custom_migrations" ("version", "name", "statements", "created_at") VALUES ('20260826044926', 'finish-slice-4-custom-rfq', ARRAY['UPDATE public.custom_requests
SET status = CASE status
  WHEN ''QUOTED'' THEN ''READY_FOR_QUOTE''
  WHEN ''CLOSED'' THEN ''CANCELLED''
  ELSE status
END
WHERE status IN (''QUOTED'', ''CLOSED'')', 'ALTER TABLE public.custom_requests
  DROP CONSTRAINT IF EXISTS custom_requests_status_check', 'ALTER TABLE public.custom_requests
  ADD CONSTRAINT custom_requests_status_check CHECK (
    status IN (''DRAFT'',''SUBMITTED'',''UNDER_REVIEW'',''NEED_INFO'',''READY_FOR_QUOTE'',''CONVERTED'',''CANCELLED'')
  )', 'ALTER TABLE public.custom_requests
  DROP CONSTRAINT IF EXISTS custom_requests_request_type_check', 'ALTER TABLE public.custom_requests
  ADD CONSTRAINT custom_requests_request_type_check CHECK (
    request_type IN (
      ''RESIZE'',''COLOR_MATERIAL'',''HARDWARE'',''MADE_TO_DRAWING'',
      ''PROJECT_SPECIFIC'',''BUILT_IN'',''CAD_PDF'',''OTHER''
    )
  )', 'ALTER TABLE public.custom_requests
  ADD COLUMN IF NOT EXISTS requested_options_json JSONB NOT NULL DEFAULT ''{}''::jsonb,
  ADD COLUMN IF NOT EXISTS admin_note TEXT', 'UPDATE public.custom_requests
SET requested_options_json = jsonb_strip_nulls(jsonb_build_object(
  ''material'', requested_material,
  ''color'', requested_color,
  ''function'', requested_function
))', 'DO $$
DECLARE request_row RECORD;
BEGIN
  FOR request_row IN
    SELECT id FROM public.custom_requests WHERE request_number LIKE ''RFQ-%'' ORDER BY created_at, id
  LOOP
    UPDATE public.custom_requests
    SET request_number = public.next_record_reference(''CRQ'')
    WHERE id = request_row.id;
  END LOOP;
END;
$$', 'ALTER TABLE public.custom_request_files
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1
    CHECK (version_number > 0),
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id)', 'UPDATE public.custom_request_files link
SET uploaded_by = metadata.uploaded_by
FROM public.file_metadata metadata
WHERE metadata.id = link.file_id AND link.uploaded_by IS NULL', 'ALTER TABLE public.custom_request_files
  ALTER COLUMN uploaded_by SET NOT NULL', 'ALTER TABLE public.custom_request_supplier_candidates
  ADD COLUMN IF NOT EXISTS candidate_status TEXT NOT NULL DEFAULT ''ACTIVE''
    CHECK (candidate_status IN (''ACTIVE'',''REMOVED'')),
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id)', 'UPDATE public.custom_request_supplier_candidates
SET created_by = added_by
WHERE created_by IS NULL', 'ALTER TABLE public.custom_request_supplier_candidates
  ALTER COLUMN created_by SET NOT NULL', 'DROP TRIGGER IF EXISTS custom_request_history_append_only ON public.custom_request_history', 'CREATE TRIGGER custom_request_history_append_only
BEFORE UPDATE OR DELETE ON public.custom_request_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change()', 'CREATE OR REPLACE FUNCTION public.create_custom_request_draft(
  project_id_input UUID, area_id_input UUID, base_product_id_input UUID,
  request_type_input TEXT, item_name_input TEXT, description_input TEXT,
  width_mm_input NUMERIC, depth_mm_input NUMERIC, height_mm_input NUMERIC,
  quantity_input NUMERIC, unit_input TEXT, requested_material_input TEXT,
  requested_color_input TEXT, requested_function_input TEXT, member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  profile_id_value UUID := public.current_member_profile_id();
  request_id_value UUID;
BEGIN
  IF profile_id_value IS NULL THEN RAISE EXCEPTION ''APPROVED_MEMBER_REQUIRED''; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=profile_id_value
    AND status NOT IN (''COMPLETED'',''CANCELLED'');
  IF NOT FOUND THEN RAISE EXCEPTION ''PROJECT_NOT_FOUND''; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION ''AREA_NOT_FOUND''; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status=''PUBLISHED''
  ) THEN RAISE EXCEPTION ''BASE_PRODUCT_NOT_FOUND''; END IF;
  IF request_type_input NOT IN (
    ''RESIZE'',''COLOR_MATERIAL'',''HARDWARE'',''MADE_TO_DRAWING'',
    ''PROJECT_SPECIFIC'',''BUILT_IN'',''CAD_PDF'',''OTHER''
  ) THEN RAISE EXCEPTION ''INVALID_REQUEST_TYPE''; END IF;
  IF NULLIF(BTRIM(item_name_input),'''') IS NULL THEN RAISE EXCEPTION ''ITEM_NAME_REQUIRED''; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(description_input,''''))) < 10 THEN RAISE EXCEPTION ''DESCRIPTION_TOO_SHORT''; END IF;
  IF quantity_input IS NULL OR quantity_input<=0 THEN RAISE EXCEPTION ''INVALID_QUANTITY''; END IF;

  INSERT INTO public.custom_requests(
    organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,
    request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,
    requested_material,requested_color,requested_function,requested_options_json,member_note,status,submitted_by
  ) VALUES (
    project_record.organization_id,profile_id_value,project_id_input,area_id_input,base_product_id_input,
    public.next_record_reference(''CRQ''),request_type_input,BTRIM(item_name_input),BTRIM(description_input),
    BTRIM(description_input),width_mm_input,depth_mm_input,height_mm_input,quantity_input,
    COALESCE(NULLIF(BTRIM(unit_input),''''),''EA''),NULLIF(BTRIM(requested_material_input),''''),
    NULLIF(BTRIM(requested_color_input),''''),NULLIF(BTRIM(requested_function_input),''''),
    jsonb_strip_nulls(jsonb_build_object(
      ''material'',NULLIF(BTRIM(requested_material_input),''''),
      ''color'',NULLIF(BTRIM(requested_color_input),''''),
      ''function'',NULLIF(BTRIM(requested_function_input),'''')
    )),NULLIF(BTRIM(member_note_input),''''),''DRAFT'',(SELECT auth.uid())
  ) RETURNING id INTO request_id_value;
  PERFORM public.record_custom_request_history(request_id_value,''DRAFT_CREATED'',NULL,''DRAFT'',NULL,''MEMBER'');
  PERFORM public.write_audit_event(project_record.organization_id,''custom_request'',request_id_value,''DRAFT_CREATED'');
  RETURN request_id_value;
END;
$$', 'CREATE OR REPLACE FUNCTION public.save_custom_request_details(
  request_id_input UUID, project_id_input UUID, area_id_input UUID, base_product_id_input UUID,
  request_type_input TEXT, item_name_input TEXT, description_input TEXT,
  width_mm_input NUMERIC, depth_mm_input NUMERIC, height_mm_input NUMERIC,
  quantity_input NUMERIC, unit_input TEXT, requested_material_input TEXT,
  requested_color_input TEXT, requested_function_input TEXT, member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; project_record public.projects%ROWTYPE;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN (''DRAFT'',''NEED_INFO'') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_EDITABLE''; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=request_record.member_profile_id
    AND status NOT IN (''COMPLETED'',''CANCELLED'');
  IF NOT FOUND THEN RAISE EXCEPTION ''PROJECT_NOT_FOUND''; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION ''AREA_NOT_FOUND''; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status=''PUBLISHED''
  ) THEN RAISE EXCEPTION ''BASE_PRODUCT_NOT_FOUND''; END IF;
  IF request_type_input NOT IN (
    ''RESIZE'',''COLOR_MATERIAL'',''HARDWARE'',''MADE_TO_DRAWING'',
    ''PROJECT_SPECIFIC'',''BUILT_IN'',''CAD_PDF'',''OTHER''
  ) THEN RAISE EXCEPTION ''INVALID_REQUEST_TYPE''; END IF;
  IF NULLIF(BTRIM(item_name_input),'''') IS NULL THEN RAISE EXCEPTION ''ITEM_NAME_REQUIRED''; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(description_input,''''))) < 10 THEN RAISE EXCEPTION ''DESCRIPTION_TOO_SHORT''; END IF;
  IF quantity_input IS NULL OR quantity_input<=0 THEN RAISE EXCEPTION ''INVALID_QUANTITY''; END IF;

  UPDATE public.custom_requests SET
    organization_id=project_record.organization_id,project_id=project_id_input,area_id=area_id_input,
    base_product_id=base_product_id_input,request_type=request_type_input,item_name=BTRIM(item_name_input),
    specification=BTRIM(description_input),description=BTRIM(description_input),
    width_mm=width_mm_input,depth_mm=depth_mm_input,height_mm=height_mm_input,
    quantity=quantity_input,unit=COALESCE(NULLIF(BTRIM(unit_input),''''),''EA''),
    requested_material=NULLIF(BTRIM(requested_material_input),''''),
    requested_color=NULLIF(BTRIM(requested_color_input),''''),
    requested_function=NULLIF(BTRIM(requested_function_input),''''),
    requested_options_json=jsonb_strip_nulls(jsonb_build_object(
      ''material'',NULLIF(BTRIM(requested_material_input),''''),
      ''color'',NULLIF(BTRIM(requested_color_input),''''),
      ''function'',NULLIF(BTRIM(requested_function_input),'''')
    )),member_note=NULLIF(BTRIM(member_note_input),'''')
  WHERE id=request_id_input;
  PERFORM public.write_audit_event(project_record.organization_id,''custom_request'',request_id_input,''DRAFT_SAVED'');
  RETURN request_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.submit_custom_request_v2(request_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; previous_status TEXT;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN (''DRAFT'',''NEED_INFO'') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_SUBMITTABLE''; END IF;
  IF NULLIF(BTRIM(request_record.item_name),'''') IS NULL
    OR CHAR_LENGTH(BTRIM(COALESCE(request_record.specification,''''))) < 10
    THEN RAISE EXCEPTION ''REQUEST_DETAILS_REQUIRED''; END IF;
  previous_status:=request_record.status;
  UPDATE public.custom_requests SET status=''SUBMITTED'',submitted_by=(SELECT auth.uid()),submitted_at=NOW()
  WHERE id=request_id_input;
  UPDATE public.assignments SET status=''DONE'',completed_at=NOW()
  WHERE entity_type=''CUSTOM_REQUEST'' AND entity_id=request_id_input
    AND status IN (''OPEN'',''IN_PROGRESS'');
  PERFORM public.record_custom_request_history(request_id_input,
    CASE WHEN previous_status=''NEED_INFO'' THEN ''RESUBMITTED'' ELSE ''SUBMITTED'' END,
    previous_status,''SUBMITTED'',NULL,''MEMBER'');
  PERFORM public.write_audit_event(request_record.organization_id,''custom_request'',request_id_input,''SUBMITTED'');
  RETURN request_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.admin_set_custom_request_candidates(
  request_id_input UUID, supplier_ids_input UUID[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; supplier_id_value UUID;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission(''rfq.manage'',request_record.organization_id)
    THEN RAISE EXCEPTION ''PERMISSION_DENIED''; END IF;
  IF request_record.status <> ''UNDER_REVIEW'' THEN RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_UNDER_REVIEW''; END IF;
  DELETE FROM public.custom_request_supplier_candidates WHERE custom_request_id=request_id_input;
  FOREACH supplier_id_value IN ARRAY COALESCE(supplier_ids_input,ARRAY[]::UUID[]) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=supplier_id_value AND status IN (''PROSPECT'',''ACTIVE''))
      THEN RAISE EXCEPTION ''SUPPLIER_NOT_AVAILABLE''; END IF;
    INSERT INTO public.custom_request_supplier_candidates(
      custom_request_id,supplier_id,added_by,created_by,candidate_status
    ) VALUES(request_id_input,supplier_id_value,(SELECT auth.uid()),(SELECT auth.uid()),''ACTIVE'')
    ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM public.record_custom_request_history(request_id_input,''SUPPLIER_CANDIDATES_UPDATED'',request_record.status,request_record.status,NULL,''INTERNAL'');
  PERFORM public.write_audit_event(request_record.organization_id,''custom_request'',request_id_input,''SUPPLIER_CANDIDATES_UPDATED'');
  RETURN request_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.admin_review_custom_request(
  request_id_input UUID, action_input TEXT, message_input TEXT,
  assigned_to_input UUID, due_at_input TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; next_status TEXT; history_message TEXT; history_visibility TEXT := ''MEMBER'';
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission(''rfq.manage'',request_record.organization_id)
    THEN RAISE EXCEPTION ''PERMISSION_DENIED''; END IF;

  IF action_input=''SAVE_NOTE'' THEN
    UPDATE public.custom_requests SET admin_note=NULLIF(BTRIM(message_input),'''') WHERE id=request_id_input;
    PERFORM public.record_custom_request_history(request_id_input,''ADMIN_NOTE_UPDATED'',request_record.status,request_record.status,
      CASE WHEN NULLIF(BTRIM(message_input),'''') IS NULL THEN ''ล้างหมายเหตุภายใน'' ELSE ''อัปเดตหมายเหตุภายใน'' END,''INTERNAL'');
    PERFORM public.write_audit_event(request_record.organization_id,''custom_request'',request_id_input,''ADMIN_NOTE_UPDATED'');
    RETURN request_id_input;
  ELSIF action_input=''START_REVIEW'' THEN
    IF request_record.status<>''SUBMITTED'' THEN RAISE EXCEPTION ''INVALID_STATUS_TRANSITION''; END IF;
    IF assigned_to_input IS NULL OR due_at_input IS NULL OR due_at_input<=NOW()
      THEN RAISE EXCEPTION ''ASSIGNMENT_AND_DUE_DATE_REQUIRED''; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles ur ON ur.user_id=u.id AND ur.revoked_at IS NULL
      JOIN public.role_permissions rp ON rp.role_id=ur.role_id
      JOIN public.permissions p ON p.id=rp.permission_id AND p.code=''rfq.manage''
      WHERE u.id=assigned_to_input AND u.status=''ACTIVE''
        AND (ur.organization_id IS NULL OR ur.organization_id=request_record.organization_id)
    ) THEN RAISE EXCEPTION ''ASSIGNEE_NOT_AVAILABLE''; END IF;
    next_status:=''UNDER_REVIEW''; history_message:=''GISP เริ่มตรวจสอบคำขอแล้ว'';
  ELSIF action_input=''REQUEST_INFO'' THEN
    IF request_record.status<>''UNDER_REVIEW'' OR NULLIF(BTRIM(message_input),'''') IS NULL
      THEN RAISE EXCEPTION ''MESSAGE_REQUIRED_OR_INVALID_STATUS''; END IF;
    next_status:=''NEED_INFO''; history_message:=BTRIM(message_input);
  ELSIF action_input=''READY_FOR_QUOTE'' THEN
    IF request_record.status<>''UNDER_REVIEW'' THEN RAISE EXCEPTION ''INVALID_STATUS_TRANSITION''; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.custom_request_supplier_candidates
      WHERE custom_request_id=request_id_input AND candidate_status=''ACTIVE''
    ) THEN RAISE EXCEPTION ''SUPPLIER_CANDIDATE_REQUIRED''; END IF;
    next_status:=''READY_FOR_QUOTE'';
    history_message:=COALESCE(NULLIF(BTRIM(message_input),''''),''ข้อมูลพร้อมจัดทำใบเสนอราคา'');
  ELSIF action_input=''CANCEL'' THEN
    IF request_record.status NOT IN (''DRAFT'',''SUBMITTED'',''UNDER_REVIEW'',''NEED_INFO'',''READY_FOR_QUOTE'')
      OR NULLIF(BTRIM(message_input),'''') IS NULL THEN RAISE EXCEPTION ''CANCELLATION_REASON_REQUIRED_OR_INVALID_STATUS''; END IF;
    next_status:=''CANCELLED''; history_message:=BTRIM(message_input);
  ELSE RAISE EXCEPTION ''INVALID_ACTION''; END IF;

  UPDATE public.assignments SET
    status=CASE WHEN action_input IN (''REQUEST_INFO'',''READY_FOR_QUOTE'') THEN ''DONE'' ELSE ''CANCELLED'' END,
    completed_at=NOW()
  WHERE entity_type=''CUSTOM_REQUEST'' AND entity_id=request_id_input AND status IN (''OPEN'',''IN_PROGRESS'');

  IF action_input=''START_REVIEW'' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,due_at,action_required,status,created_by)
    VALUES(request_record.organization_id,''CUSTOM_REQUEST'',request_id_input,assigned_to_input,due_at_input,
      ''ตรวจสอบ Custom Request และเลือก Supplier Candidate'',''IN_PROGRESS'',(SELECT auth.uid()));
  ELSIF action_input=''REQUEST_INFO'' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,action_required,status,created_by)
    VALUES(request_record.organization_id,''CUSTOM_REQUEST'',request_id_input,request_record.submitted_by,
      BTRIM(message_input),''OPEN'',(SELECT auth.uid()));
  END IF;

  UPDATE public.custom_requests SET status=next_status WHERE id=request_id_input;
  PERFORM public.record_custom_request_history(request_id_input,action_input,request_record.status,next_status,history_message,history_visibility);
  PERFORM public.write_audit_event(request_record.organization_id,''custom_request'',request_id_input,action_input);
  RETURN request_id_input;
END;
$$', 'CREATE OR REPLACE FUNCTION public.get_member_custom_request_detail(request_id_input UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; result JSONB;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND OR request_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id()
    THEN RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_FOUND''; END IF;
  SELECT jsonb_build_object(
    ''request'',jsonb_build_object(
      ''id'',request_record.id,''organization_id'',request_record.organization_id,
      ''member_profile_id'',request_record.member_profile_id,''project_id'',request_record.project_id,
      ''area_id'',request_record.area_id,''base_product_id'',request_record.base_product_id,
      ''request_number'',request_record.request_number,''request_type'',request_record.request_type,
      ''item_name'',request_record.item_name,''specification'',request_record.specification,
      ''description'',request_record.description,''width_mm'',request_record.width_mm,
      ''depth_mm'',request_record.depth_mm,''height_mm'',request_record.height_mm,
      ''quantity'',request_record.quantity,''unit'',request_record.unit,
      ''requested_material'',request_record.requested_material,''requested_color'',request_record.requested_color,
      ''requested_function'',request_record.requested_function,''requested_options_json'',request_record.requested_options_json,
      ''member_note'',request_record.member_note,''status'',request_record.status,
      ''submitted_by'',request_record.submitted_by,''submitted_at'',request_record.submitted_at,
      ''created_at'',request_record.created_at,''updated_at'',request_record.updated_at
    ),
    ''project'',(SELECT jsonb_build_object(''id'',p.id,''project_number'',p.project_number,''name'',p.name,
      ''site_address'',p.site_address,''expected_need_date'',p.expected_need_date)
      FROM public.projects p WHERE p.id=request_record.project_id),
    ''area'',(SELECT jsonb_build_object(''id'',pa.id,''name'',pa.name) FROM public.project_areas pa WHERE pa.id=request_record.area_id),
    ''areas'',COALESCE((SELECT jsonb_agg(jsonb_build_object(''id'',pa.id,''name'',pa.name) ORDER BY pa.created_at)
      FROM public.project_areas pa WHERE pa.project_id=request_record.project_id),''[]''::jsonb),
    ''history'',COALESCE((SELECT jsonb_agg(jsonb_build_object(''id'',h.id,''action'',h.action,
      ''from_status'',h.from_status,''to_status'',h.to_status,''message'',h.message,
      ''visibility'',h.visibility,''created_at'',h.created_at) ORDER BY h.created_at)
      FROM public.custom_request_history h WHERE h.custom_request_id=request_id_input AND h.visibility=''MEMBER''),''[]''::jsonb),
    ''files'',COALESCE((SELECT jsonb_agg(jsonb_build_object(''id'',fm.id,''original_name'',fm.original_name,
      ''mime_type'',fm.mime_type,''size_bytes'',fm.size_bytes,''created_at'',fm.created_at,
      ''file_role'',link.file_role,''version_number'',link.version_number) ORDER BY link.created_at)
      FROM public.custom_request_files link JOIN public.file_metadata fm ON fm.id=link.file_id
      WHERE link.custom_request_id=request_id_input),''[]''::jsonb)
  ) INTO result;
  RETURN result;
END;
$$', 'CREATE OR REPLACE FUNCTION public.get_admin_custom_request_detail(request_id_input UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE request_record public.custom_requests%ROWTYPE; result JSONB;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND OR NOT public.has_permission(''rfq.manage'',request_record.organization_id)
    THEN RAISE EXCEPTION ''CUSTOM_REQUEST_NOT_FOUND_OR_PERMISSION_DENIED''; END IF;
  SELECT jsonb_build_object(
    ''request'',to_jsonb(request_record),
    ''project'',(SELECT jsonb_build_object(''id'',p.id,''project_number'',p.project_number,''name'',p.name,
      ''site_address'',p.site_address,''expected_need_date'',p.expected_need_date) FROM public.projects p WHERE p.id=request_record.project_id),
    ''area'',(SELECT jsonb_build_object(''id'',pa.id,''name'',pa.name) FROM public.project_areas pa WHERE pa.id=request_record.area_id),
    ''member'',(SELECT jsonb_build_object(''id'',mp.id,''company_name'',mp.company_name,
      ''contact_name'',mp.contact_name,''contact_phone'',mp.contact_phone) FROM public.member_profiles mp WHERE mp.id=request_record.member_profile_id),
    ''candidates'',COALESCE((SELECT jsonb_agg(jsonb_build_object(''id'',c.id,''supplier_id'',c.supplier_id,
      ''candidate_status'',c.candidate_status,''note'',c.note,''created_at'',c.created_at,
      ''supplier'',jsonb_build_object(''id'',s.id,''code'',s.code,''name'',s.name,''status'',s.status)) ORDER BY c.created_at)
      FROM public.custom_request_supplier_candidates c JOIN public.suppliers s ON s.id=c.supplier_id
      WHERE c.custom_request_id=request_id_input),''[]''::jsonb),
    ''assignments'',COALESCE((SELECT jsonb_agg(jsonb_build_object(''id'',a.id,''assigned_to'',a.assigned_to,
      ''assigned_name'',u.full_name,''due_at'',a.due_at,''action_required'',a.action_required,''status'',a.status,
      ''created_at'',a.created_at,''completed_at'',a.completed_at) ORDER BY a.created_at DESC)
      FROM public.assignments a LEFT JOIN public.users u ON u.id=a.assigned_to
      WHERE a.entity_type=''CUSTOM_REQUEST'' AND a.entity_id=request_id_input),''[]''::jsonb),
    ''history'',COALESCE((SELECT jsonb_agg(jsonb_build_object(''id'',h.id,''actor_user_id'',h.actor_user_id,
      ''actor_name'',u.full_name,''action'',h.action,''from_status'',h.from_status,''to_status'',h.to_status,
      ''message'',h.message,''visibility'',h.visibility,''created_at'',h.created_at) ORDER BY h.created_at)
      FROM public.custom_request_history h LEFT JOIN public.users u ON u.id=h.actor_user_id
      WHERE h.custom_request_id=request_id_input),''[]''::jsonb),
    ''files'',COALESCE((SELECT jsonb_agg(jsonb_build_object(''id'',fm.id,''original_name'',fm.original_name,
      ''mime_type'',fm.mime_type,''size_bytes'',fm.size_bytes,''created_at'',fm.created_at,
      ''file_role'',link.file_role,''version_number'',link.version_number) ORDER BY link.created_at)
      FROM public.custom_request_files link JOIN public.file_metadata fm ON fm.id=link.file_id
      WHERE link.custom_request_id=request_id_input),''[]''::jsonb),
    ''options'',jsonb_build_object(
      ''suppliers'',COALESCE((SELECT jsonb_agg(jsonb_build_object(''id'',s.id,''code'',s.code,''name'',s.name,''status'',s.status) ORDER BY s.name)
        FROM public.suppliers s WHERE s.status IN (''PROSPECT'',''ACTIVE'')),''[]''::jsonb),
      ''users'',COALESCE((SELECT jsonb_agg(jsonb_build_object(''id'',u.id,''full_name'',u.full_name) ORDER BY u.full_name)
        FROM public.users u WHERE u.status=''ACTIVE'' AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.role_permissions rp ON rp.role_id=ur.role_id
          JOIN public.permissions p ON p.id=rp.permission_id
          WHERE ur.user_id=u.id AND ur.revoked_at IS NULL AND p.code=''rfq.manage''
            AND (ur.organization_id IS NULL OR ur.organization_id=request_record.organization_id)
        )),''[]''::jsonb)
    )
  ) INTO result;
  RETURN result;
END;
$$', 'REVOKE ALL ON public.custom_request_files FROM anon,authenticated', 'GRANT SELECT (custom_request_id,file_id,created_at,file_role,version_number,uploaded_by)
  ON public.custom_request_files TO authenticated', 'REVOKE SELECT ON public.custom_requests FROM authenticated', 'GRANT SELECT (
  id,organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,
  request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,
  requested_material,requested_color,requested_function,requested_options_json,member_note,status,
  submitted_by,submitted_at,created_at,updated_at
) ON public.custom_requests TO authenticated', 'REVOKE ALL ON FUNCTION public.get_member_custom_request_detail(UUID) FROM PUBLIC,anon,authenticated', 'REVOKE ALL ON FUNCTION public.get_admin_custom_request_detail(UUID) FROM PUBLIC,anon,authenticated', 'GRANT EXECUTE ON FUNCTION public.get_member_custom_request_detail(UUID) TO authenticated', 'GRANT EXECUTE ON FUNCTION public.get_admin_custom_request_detail(UUID) TO authenticated'], '2026-08-26T04:58:12.865508+00:00')
  ON CONFLICT ("version") DO UPDATE SET "name" = EXCLUDED."name", "statements" = EXCLUDED."statements", "created_at" = EXCLUDED."created_at";

-- ===== DDL =====
-- [DDL] table public.custom_requests (modify)
-- not auto-applied: table modify diffs are not auto-applied — capture the change in a migration on branch.

-- [DDL] table public.custom_request_files (modify)
-- not auto-applied: table modify diffs are not auto-applied — capture the change in a migration on branch.

-- [DDL] table public.custom_request_history (add)
CREATE TABLE IF NOT EXISTS public.custom_request_history (id uuid NOT NULL DEFAULT gen_random_uuid(), custom_request_id uuid NOT NULL, organization_id uuid NOT NULL, actor_user_id uuid NOT NULL, action text NOT NULL, from_status text, to_status text, message text, visibility text NOT NULL DEFAULT 'MEMBER'::text, created_at timestamp with time zone NOT NULL DEFAULT now(), CHECK (visibility = ANY (ARRAY['MEMBER'::text, 'INTERNAL'::text])), PRIMARY KEY (id), FOREIGN KEY (custom_request_id) REFERENCES custom_requests(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id), FOREIGN KEY (actor_user_id) REFERENCES auth.users(id));
CREATE INDEX IF NOT EXISTS custom_request_history_request_idx ON public.custom_request_history USING btree (custom_request_id, created_at);

-- [DDL] table public.custom_request_supplier_candidates (add)
CREATE TABLE IF NOT EXISTS public.custom_request_supplier_candidates (id uuid NOT NULL DEFAULT gen_random_uuid(), custom_request_id uuid NOT NULL, supplier_id uuid NOT NULL, added_by uuid NOT NULL, created_at timestamp with time zone NOT NULL DEFAULT now(), candidate_status text NOT NULL DEFAULT 'ACTIVE'::text, note text, created_by uuid NOT NULL, PRIMARY KEY (id), UNIQUE (custom_request_id, supplier_id), FOREIGN KEY (custom_request_id) REFERENCES custom_requests(id) ON DELETE CASCADE, FOREIGN KEY (supplier_id) REFERENCES suppliers(id), FOREIGN KEY (added_by) REFERENCES auth.users(id), CHECK (candidate_status = ANY (ARRAY['ACTIVE'::text, 'REMOVED'::text])), FOREIGN KEY (created_by) REFERENCES auth.users(id));
CREATE INDEX IF NOT EXISTS custom_request_candidates_request_idx ON public.custom_request_supplier_candidates USING btree (custom_request_id, created_at);

-- [DDL] policy public.assignments.assignments_select (modify)
DROP POLICY IF EXISTS "assignments_select" ON "public"."assignments";
CREATE POLICY "assignments_select" ON "public"."assignments"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING (((assigned_to = ( SELECT auth.uid() AS uid)) OR current_user_is_internal() OR ((entity_type <> 'CUSTOM_REQUEST'::text) AND (organization_id IS NOT NULL) AND can_access_org(organization_id))));

-- [DDL] policy public.custom_requests.custom_requests_org (drop)
DROP POLICY IF EXISTS "custom_requests_org" ON "public"."custom_requests";

-- [DDL] policy public.custom_request_files.custom_request_files_org (drop)
DROP POLICY IF EXISTS "custom_request_files_org" ON "public"."custom_request_files";

-- [DDL] policy public.custom_requests.custom_requests_profile_select (add)
DROP POLICY IF EXISTS "custom_requests_profile_select" ON "public"."custom_requests";
CREATE POLICY "custom_requests_profile_select" ON "public"."custom_requests"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING (((member_profile_id = current_member_profile_id()) OR has_permission('rfq.manage'::text, organization_id)));

-- [DDL] policy public.custom_request_files.custom_request_files_access (add)
DROP POLICY IF EXISTS "custom_request_files_access" ON "public"."custom_request_files";
CREATE POLICY "custom_request_files_access" ON "public"."custom_request_files"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING (can_access_custom_request(custom_request_id));

-- [DDL] policy public.custom_request_history.custom_request_history_access (add)
DROP POLICY IF EXISTS "custom_request_history_access" ON "public"."custom_request_history";
CREATE POLICY "custom_request_history_access" ON "public"."custom_request_history"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING ((has_permission('rfq.manage'::text, organization_id) OR ((visibility = 'MEMBER'::text) AND can_access_custom_request(custom_request_id))));

-- [DDL] policy public.custom_request_supplier_candidates.custom_request_candidates_staff (add)
DROP POLICY IF EXISTS "custom_request_candidates_staff" ON "public"."custom_request_supplier_candidates";
CREATE POLICY "custom_request_candidates_staff" ON "public"."custom_request_supplier_candidates"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM custom_requests cr
  WHERE ((cr.id = custom_request_supplier_candidates.custom_request_id) AND has_permission('rfq.manage'::text, cr.organization_id)))));

-- [DDL] function public.submit_custom_request(project_id_input uuid, item_name_input text, specification_input text) (modify)
CREATE OR REPLACE FUNCTION public.submit_custom_request(project_id_input uuid, item_name_input text, specification_input text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE request_id_value UUID;
BEGIN
  request_id_value:=public.create_custom_request_draft(project_id_input,NULL,NULL,'OTHER',item_name_input,
    specification_input,NULL,NULL,NULL,1,'EA',NULL,NULL,NULL,NULL);
  RETURN public.submit_custom_request_v2(request_id_value);
END;
$function$;

-- [DDL] function public.slice4_set_updated_at() (add)
CREATE OR REPLACE FUNCTION public.slice4_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- [DDL] function public.submit_custom_request_v2(request_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.submit_custom_request_v2(request_id_input uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE request_record public.custom_requests%ROWTYPE; previous_status TEXT;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN ('DRAFT','NEED_INFO') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_SUBMITTABLE'; END IF;
  IF NULLIF(BTRIM(request_record.item_name),'') IS NULL
    OR CHAR_LENGTH(BTRIM(COALESCE(request_record.specification,''))) < 10
    THEN RAISE EXCEPTION 'REQUEST_DETAILS_REQUIRED'; END IF;
  previous_status:=request_record.status;
  UPDATE public.custom_requests SET status='SUBMITTED',submitted_by=(SELECT auth.uid()),submitted_at=NOW()
  WHERE id=request_id_input;
  UPDATE public.assignments SET status='DONE',completed_at=NOW()
  WHERE entity_type='CUSTOM_REQUEST' AND entity_id=request_id_input
    AND status IN ('OPEN','IN_PROGRESS');
  PERFORM public.record_custom_request_history(request_id_input,
    CASE WHEN previous_status='NEED_INFO' THEN 'RESUBMITTED' ELSE 'SUBMITTED' END,
    previous_status,'SUBMITTED',NULL,'MEMBER');
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'SUBMITTED');
  RETURN request_id_input;
END;
$function$;

-- [DDL] function public.can_access_custom_request(request_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.can_access_custom_request(request_id_input uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.custom_requests cr
    WHERE cr.id=request_id_input
      AND (cr.member_profile_id=public.current_member_profile_id()
        OR public.has_permission('rfq.manage',cr.organization_id))
  );
$function$;

-- [DDL] function public.get_admin_custom_request_detail(request_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.get_admin_custom_request_detail(request_id_input uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE request_record public.custom_requests%ROWTYPE; result JSONB;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND OR NOT public.has_permission('rfq.manage',request_record.organization_id)
    THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND_OR_PERMISSION_DENIED'; END IF;
  SELECT jsonb_build_object(
    'request',to_jsonb(request_record),
    'project',(SELECT jsonb_build_object('id',p.id,'project_number',p.project_number,'name',p.name,
      'site_address',p.site_address,'expected_need_date',p.expected_need_date) FROM public.projects p WHERE p.id=request_record.project_id),
    'area',(SELECT jsonb_build_object('id',pa.id,'name',pa.name) FROM public.project_areas pa WHERE pa.id=request_record.area_id),
    'member',(SELECT jsonb_build_object('id',mp.id,'company_name',mp.company_name,
      'contact_name',mp.contact_name,'contact_phone',mp.contact_phone) FROM public.member_profiles mp WHERE mp.id=request_record.member_profile_id),
    'candidates',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'supplier_id',c.supplier_id,
      'candidate_status',c.candidate_status,'note',c.note,'created_at',c.created_at,
      'supplier',jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'status',s.status)) ORDER BY c.created_at)
      FROM public.custom_request_supplier_candidates c JOIN public.suppliers s ON s.id=c.supplier_id
      WHERE c.custom_request_id=request_id_input),'[]'::jsonb),
    'assignments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'assigned_to',a.assigned_to,
      'assigned_name',u.full_name,'due_at',a.due_at,'action_required',a.action_required,'status',a.status,
      'created_at',a.created_at,'completed_at',a.completed_at) ORDER BY a.created_at DESC)
      FROM public.assignments a LEFT JOIN public.users u ON u.id=a.assigned_to
      WHERE a.entity_type='CUSTOM_REQUEST' AND a.entity_id=request_id_input),'[]'::jsonb),
    'history',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',h.id,'actor_user_id',h.actor_user_id,
      'actor_name',u.full_name,'action',h.action,'from_status',h.from_status,'to_status',h.to_status,
      'message',h.message,'visibility',h.visibility,'created_at',h.created_at) ORDER BY h.created_at)
      FROM public.custom_request_history h LEFT JOIN public.users u ON u.id=h.actor_user_id
      WHERE h.custom_request_id=request_id_input),'[]'::jsonb),
    'files',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',fm.id,'original_name',fm.original_name,
      'mime_type',fm.mime_type,'size_bytes',fm.size_bytes,'created_at',fm.created_at,
      'file_role',link.file_role,'version_number',link.version_number) ORDER BY link.created_at)
      FROM public.custom_request_files link JOIN public.file_metadata fm ON fm.id=link.file_id
      WHERE link.custom_request_id=request_id_input),'[]'::jsonb),
    'options',jsonb_build_object(
      'suppliers',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'status',s.status) ORDER BY s.name)
        FROM public.suppliers s WHERE s.status IN ('PROSPECT','ACTIVE')),'[]'::jsonb),
      'users',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.id,'full_name',u.full_name) ORDER BY u.full_name)
        FROM public.users u WHERE u.status='ACTIVE' AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.role_permissions rp ON rp.role_id=ur.role_id
          JOIN public.permissions p ON p.id=rp.permission_id
          WHERE ur.user_id=u.id AND ur.revoked_at IS NULL AND p.code='rfq.manage'
            AND (ur.organization_id IS NULL OR ur.organization_id=request_record.organization_id)
        )),'[]'::jsonb)
    )
  ) INTO result;
  RETURN result;
END;
$function$;

-- [DDL] function public.get_member_custom_request_detail(request_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.get_member_custom_request_detail(request_id_input uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE request_record public.custom_requests%ROWTYPE; result JSONB;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND OR request_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id()
    THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND'; END IF;
  SELECT jsonb_build_object(
    'request',jsonb_build_object(
      'id',request_record.id,'organization_id',request_record.organization_id,
      'member_profile_id',request_record.member_profile_id,'project_id',request_record.project_id,
      'area_id',request_record.area_id,'base_product_id',request_record.base_product_id,
      'request_number',request_record.request_number,'request_type',request_record.request_type,
      'item_name',request_record.item_name,'specification',request_record.specification,
      'description',request_record.description,'width_mm',request_record.width_mm,
      'depth_mm',request_record.depth_mm,'height_mm',request_record.height_mm,
      'quantity',request_record.quantity,'unit',request_record.unit,
      'requested_material',request_record.requested_material,'requested_color',request_record.requested_color,
      'requested_function',request_record.requested_function,'requested_options_json',request_record.requested_options_json,
      'member_note',request_record.member_note,'status',request_record.status,
      'submitted_by',request_record.submitted_by,'submitted_at',request_record.submitted_at,
      'created_at',request_record.created_at,'updated_at',request_record.updated_at
    ),
    'project',(SELECT jsonb_build_object('id',p.id,'project_number',p.project_number,'name',p.name,
      'site_address',p.site_address,'expected_need_date',p.expected_need_date)
      FROM public.projects p WHERE p.id=request_record.project_id),
    'area',(SELECT jsonb_build_object('id',pa.id,'name',pa.name) FROM public.project_areas pa WHERE pa.id=request_record.area_id),
    'areas',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',pa.id,'name',pa.name) ORDER BY pa.created_at)
      FROM public.project_areas pa WHERE pa.project_id=request_record.project_id),'[]'::jsonb),
    'history',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',h.id,'action',h.action,
      'from_status',h.from_status,'to_status',h.to_status,'message',h.message,
      'visibility',h.visibility,'created_at',h.created_at) ORDER BY h.created_at)
      FROM public.custom_request_history h WHERE h.custom_request_id=request_id_input AND h.visibility='MEMBER'),'[]'::jsonb),
    'files',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',fm.id,'original_name',fm.original_name,
      'mime_type',fm.mime_type,'size_bytes',fm.size_bytes,'created_at',fm.created_at,
      'file_role',link.file_role,'version_number',link.version_number) ORDER BY link.created_at)
      FROM public.custom_request_files link JOIN public.file_metadata fm ON fm.id=link.file_id
      WHERE link.custom_request_id=request_id_input),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$function$;

-- [DDL] function public.cancel_custom_request(request_id_input uuid, reason_input text) (add)
CREATE OR REPLACE FUNCTION public.cancel_custom_request(request_id_input uuid, reason_input text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE request_record public.custom_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFO','READY_FOR_QUOTE') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_CANCELLABLE'; END IF;
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED'; END IF;
  UPDATE public.custom_requests SET status='CANCELLED' WHERE id=request_id_input;
  UPDATE public.assignments SET status='CANCELLED',completed_at=NOW()
  WHERE entity_type='CUSTOM_REQUEST' AND entity_id=request_id_input AND status IN ('OPEN','IN_PROGRESS');
  PERFORM public.record_custom_request_history(request_id_input,'CANCELLED',request_record.status,'CANCELLED',reason_input,'MEMBER');
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'CANCELLED');
  RETURN request_id_input;
END;
$function$;

-- [DDL] function public.admin_set_custom_request_candidates(request_id_input uuid, supplier_ids_input uuid[]) (add)
CREATE OR REPLACE FUNCTION public.admin_set_custom_request_candidates(request_id_input uuid, supplier_ids_input uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE request_record public.custom_requests%ROWTYPE; supplier_id_value UUID;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('rfq.manage',request_record.organization_id)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF request_record.status <> 'UNDER_REVIEW' THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_UNDER_REVIEW'; END IF;
  DELETE FROM public.custom_request_supplier_candidates WHERE custom_request_id=request_id_input;
  FOREACH supplier_id_value IN ARRAY COALESCE(supplier_ids_input,ARRAY[]::UUID[]) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=supplier_id_value AND status IN ('PROSPECT','ACTIVE'))
      THEN RAISE EXCEPTION 'SUPPLIER_NOT_AVAILABLE'; END IF;
    INSERT INTO public.custom_request_supplier_candidates(
      custom_request_id,supplier_id,added_by,created_by,candidate_status
    ) VALUES(request_id_input,supplier_id_value,(SELECT auth.uid()),(SELECT auth.uid()),'ACTIVE')
    ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM public.record_custom_request_history(request_id_input,'SUPPLIER_CANDIDATES_UPDATED',request_record.status,request_record.status,NULL,'INTERNAL');
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'SUPPLIER_CANDIDATES_UPDATED');
  RETURN request_id_input;
END;
$function$;

-- [DDL] function public.admin_review_custom_request(request_id_input uuid, action_input text, message_input text, assigned_to_input uuid, due_at_input timestamp with time zone) (add)
CREATE OR REPLACE FUNCTION public.admin_review_custom_request(request_id_input uuid, action_input text, message_input text, assigned_to_input uuid, due_at_input timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE request_record public.custom_requests%ROWTYPE; next_status TEXT; history_message TEXT; history_visibility TEXT := 'MEMBER';
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('rfq.manage',request_record.organization_id)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;

  IF action_input='SAVE_NOTE' THEN
    UPDATE public.custom_requests SET admin_note=NULLIF(BTRIM(message_input),'') WHERE id=request_id_input;
    PERFORM public.record_custom_request_history(request_id_input,'ADMIN_NOTE_UPDATED',request_record.status,request_record.status,
      CASE WHEN NULLIF(BTRIM(message_input),'') IS NULL THEN 'ล้างหมายเหตุภายใน' ELSE 'อัปเดตหมายเหตุภายใน' END,'INTERNAL');
    PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,'ADMIN_NOTE_UPDATED');
    RETURN request_id_input;
  ELSIF action_input='START_REVIEW' THEN
    IF request_record.status<>'SUBMITTED' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF assigned_to_input IS NULL OR due_at_input IS NULL OR due_at_input<=NOW()
      THEN RAISE EXCEPTION 'ASSIGNMENT_AND_DUE_DATE_REQUIRED'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles ur ON ur.user_id=u.id AND ur.revoked_at IS NULL
      JOIN public.role_permissions rp ON rp.role_id=ur.role_id
      JOIN public.permissions p ON p.id=rp.permission_id AND p.code='rfq.manage'
      WHERE u.id=assigned_to_input AND u.status='ACTIVE'
        AND (ur.organization_id IS NULL OR ur.organization_id=request_record.organization_id)
    ) THEN RAISE EXCEPTION 'ASSIGNEE_NOT_AVAILABLE'; END IF;
    next_status:='UNDER_REVIEW'; history_message:='GISP เริ่มตรวจสอบคำขอแล้ว';
  ELSIF action_input='REQUEST_INFO' THEN
    IF request_record.status<>'UNDER_REVIEW' OR NULLIF(BTRIM(message_input),'') IS NULL
      THEN RAISE EXCEPTION 'MESSAGE_REQUIRED_OR_INVALID_STATUS'; END IF;
    next_status:='NEED_INFO'; history_message:=BTRIM(message_input);
  ELSIF action_input='READY_FOR_QUOTE' THEN
    IF request_record.status<>'UNDER_REVIEW' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.custom_request_supplier_candidates
      WHERE custom_request_id=request_id_input AND candidate_status='ACTIVE'
    ) THEN RAISE EXCEPTION 'SUPPLIER_CANDIDATE_REQUIRED'; END IF;
    next_status:='READY_FOR_QUOTE';
    history_message:=COALESCE(NULLIF(BTRIM(message_input),''),'ข้อมูลพร้อมจัดทำใบเสนอราคา');
  ELSIF action_input='CANCEL' THEN
    IF request_record.status NOT IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFO','READY_FOR_QUOTE')
      OR NULLIF(BTRIM(message_input),'') IS NULL THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED_OR_INVALID_STATUS'; END IF;
    next_status:='CANCELLED'; history_message:=BTRIM(message_input);
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;

  UPDATE public.assignments SET
    status=CASE WHEN action_input IN ('REQUEST_INFO','READY_FOR_QUOTE') THEN 'DONE' ELSE 'CANCELLED' END,
    completed_at=NOW()
  WHERE entity_type='CUSTOM_REQUEST' AND entity_id=request_id_input AND status IN ('OPEN','IN_PROGRESS');

  IF action_input='START_REVIEW' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,due_at,action_required,status,created_by)
    VALUES(request_record.organization_id,'CUSTOM_REQUEST',request_id_input,assigned_to_input,due_at_input,
      'ตรวจสอบ Custom Request และเลือก Supplier Candidate','IN_PROGRESS',(SELECT auth.uid()));
  ELSIF action_input='REQUEST_INFO' THEN
    INSERT INTO public.assignments(organization_id,entity_type,entity_id,assigned_to,action_required,status,created_by)
    VALUES(request_record.organization_id,'CUSTOM_REQUEST',request_id_input,request_record.submitted_by,
      BTRIM(message_input),'OPEN',(SELECT auth.uid()));
  END IF;

  UPDATE public.custom_requests SET status=next_status WHERE id=request_id_input;
  PERFORM public.record_custom_request_history(request_id_input,action_input,request_record.status,next_status,history_message,history_visibility);
  PERFORM public.write_audit_event(request_record.organization_id,'custom_request',request_id_input,action_input);
  RETURN request_id_input;
END;
$function$;

-- [DDL] function public.record_custom_request_history(request_id_input uuid, action_input text, from_status_input text, to_status_input text, message_input text, visibility_input text) (add)
CREATE OR REPLACE FUNCTION public.record_custom_request_history(request_id_input uuid, action_input text, from_status_input text, to_status_input text, message_input text, visibility_input text DEFAULT 'MEMBER'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE request_record public.custom_requests%ROWTYPE; history_id_value UUID;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests WHERE id=request_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND'; END IF;
  INSERT INTO public.custom_request_history(
    custom_request_id,organization_id,actor_user_id,action,from_status,to_status,message,visibility
  ) VALUES (
    request_id_input,request_record.organization_id,(SELECT auth.uid()),action_input,
    from_status_input,to_status_input,NULLIF(BTRIM(message_input),''),visibility_input
  ) RETURNING id INTO history_id_value;
  RETURN history_id_value;
END;
$function$;

-- [DDL] function public.create_custom_request_draft(project_id_input uuid, area_id_input uuid, base_product_id_input uuid, request_type_input text, item_name_input text, description_input text, width_mm_input numeric, depth_mm_input numeric, height_mm_input numeric, quantity_input numeric, unit_input text, requested_material_input text, requested_color_input text, requested_function_input text, member_note_input text) (add)
CREATE OR REPLACE FUNCTION public.create_custom_request_draft(project_id_input uuid, area_id_input uuid, base_product_id_input uuid, request_type_input text, item_name_input text, description_input text, width_mm_input numeric, depth_mm_input numeric, height_mm_input numeric, quantity_input numeric, unit_input text, requested_material_input text, requested_color_input text, requested_function_input text, member_note_input text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  project_record public.projects%ROWTYPE;
  profile_id_value UUID := public.current_member_profile_id();
  request_id_value UUID;
BEGIN
  IF profile_id_value IS NULL THEN RAISE EXCEPTION 'APPROVED_MEMBER_REQUIRED'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=profile_id_value
    AND status NOT IN ('COMPLETED','CANCELLED');
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION 'AREA_NOT_FOUND'; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status='PUBLISHED'
  ) THEN RAISE EXCEPTION 'BASE_PRODUCT_NOT_FOUND'; END IF;
  IF request_type_input NOT IN (
    'RESIZE','COLOR_MATERIAL','HARDWARE','MADE_TO_DRAWING',
    'PROJECT_SPECIFIC','BUILT_IN','CAD_PDF','OTHER'
  ) THEN RAISE EXCEPTION 'INVALID_REQUEST_TYPE'; END IF;
  IF NULLIF(BTRIM(item_name_input),'') IS NULL THEN RAISE EXCEPTION 'ITEM_NAME_REQUIRED'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(description_input,''))) < 10 THEN RAISE EXCEPTION 'DESCRIPTION_TOO_SHORT'; END IF;
  IF quantity_input IS NULL OR quantity_input<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;

  INSERT INTO public.custom_requests(
    organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,
    request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,
    requested_material,requested_color,requested_function,requested_options_json,member_note,status,submitted_by
  ) VALUES (
    project_record.organization_id,profile_id_value,project_id_input,area_id_input,base_product_id_input,
    public.next_record_reference('CRQ'),request_type_input,BTRIM(item_name_input),BTRIM(description_input),
    BTRIM(description_input),width_mm_input,depth_mm_input,height_mm_input,quantity_input,
    COALESCE(NULLIF(BTRIM(unit_input),''),'EA'),NULLIF(BTRIM(requested_material_input),''),
    NULLIF(BTRIM(requested_color_input),''),NULLIF(BTRIM(requested_function_input),''),
    jsonb_strip_nulls(jsonb_build_object(
      'material',NULLIF(BTRIM(requested_material_input),''),
      'color',NULLIF(BTRIM(requested_color_input),''),
      'function',NULLIF(BTRIM(requested_function_input),'')
    )),NULLIF(BTRIM(member_note_input),''),'DRAFT',(SELECT auth.uid())
  ) RETURNING id INTO request_id_value;
  PERFORM public.record_custom_request_history(request_id_value,'DRAFT_CREATED',NULL,'DRAFT',NULL,'MEMBER');
  PERFORM public.write_audit_event(project_record.organization_id,'custom_request',request_id_value,'DRAFT_CREATED');
  RETURN request_id_value;
END;
$function$;

-- [DDL] function public.save_custom_request_details(request_id_input uuid, project_id_input uuid, area_id_input uuid, base_product_id_input uuid, request_type_input text, item_name_input text, description_input text, width_mm_input numeric, depth_mm_input numeric, height_mm_input numeric, quantity_input numeric, unit_input text, requested_material_input text, requested_color_input text, requested_function_input text, member_note_input text) (add)
CREATE OR REPLACE FUNCTION public.save_custom_request_details(request_id_input uuid, project_id_input uuid, area_id_input uuid, base_product_id_input uuid, request_type_input text, item_name_input text, description_input text, width_mm_input numeric, depth_mm_input numeric, height_mm_input numeric, quantity_input numeric, unit_input text, requested_material_input text, requested_color_input text, requested_function_input text, member_note_input text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE request_record public.custom_requests%ROWTYPE; project_record public.projects%ROWTYPE;
BEGIN
  SELECT * INTO request_record FROM public.custom_requests
  WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id()
    AND status IN ('DRAFT','NEED_INFO') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_EDITABLE'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id=project_id_input AND member_profile_id=request_record.member_profile_id
    AND status NOT IN ('COMPLETED','CANCELLED');
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input
  ) THEN RAISE EXCEPTION 'AREA_NOT_FOUND'; END IF;
  IF base_product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id=base_product_id_input AND status='PUBLISHED'
  ) THEN RAISE EXCEPTION 'BASE_PRODUCT_NOT_FOUND'; END IF;
  IF request_type_input NOT IN (
    'RESIZE','COLOR_MATERIAL','HARDWARE','MADE_TO_DRAWING',
    'PROJECT_SPECIFIC','BUILT_IN','CAD_PDF','OTHER'
  ) THEN RAISE EXCEPTION 'INVALID_REQUEST_TYPE'; END IF;
  IF NULLIF(BTRIM(item_name_input),'') IS NULL THEN RAISE EXCEPTION 'ITEM_NAME_REQUIRED'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(description_input,''))) < 10 THEN RAISE EXCEPTION 'DESCRIPTION_TOO_SHORT'; END IF;
  IF quantity_input IS NULL OR quantity_input<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;

  UPDATE public.custom_requests SET
    organization_id=project_record.organization_id,project_id=project_id_input,area_id=area_id_input,
    base_product_id=base_product_id_input,request_type=request_type_input,item_name=BTRIM(item_name_input),
    specification=BTRIM(description_input),description=BTRIM(description_input),
    width_mm=width_mm_input,depth_mm=depth_mm_input,height_mm=height_mm_input,
    quantity=quantity_input,unit=COALESCE(NULLIF(BTRIM(unit_input),''),'EA'),
    requested_material=NULLIF(BTRIM(requested_material_input),''),
    requested_color=NULLIF(BTRIM(requested_color_input),''),
    requested_function=NULLIF(BTRIM(requested_function_input),''),
    requested_options_json=jsonb_strip_nulls(jsonb_build_object(
      'material',NULLIF(BTRIM(requested_material_input),''),
      'color',NULLIF(BTRIM(requested_color_input),''),
      'function',NULLIF(BTRIM(requested_function_input),'')
    )),member_note=NULLIF(BTRIM(member_note_input),'')
  WHERE id=request_id_input;
  PERFORM public.write_audit_event(project_record.organization_id,'custom_request',request_id_input,'DRAFT_SAVED');
  RETURN request_id_input;
END;
$function$;

COMMIT;