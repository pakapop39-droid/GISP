-- Slice 4: Custom Request for Quotation workspace.

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
