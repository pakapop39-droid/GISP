-- Finish Slice 4: canonical lifecycle, complete request metadata, and harden RFQ workflow.

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
