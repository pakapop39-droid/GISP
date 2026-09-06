-- Slice 13: visual sourcing for ready-made products. Custom manufacturing remains in Custom RFQ.

INSERT INTO public.permissions(code,name,description) VALUES
  ('sourcing.manage','จัดการคำขอจัดหาสินค้า','ตรวจคำขอจากภาพ เสนอตัวเลือก และนำสินค้าเข้า Catalog')
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description;

INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.roles r JOIN public.permissions p ON p.code='sourcing.manage'
WHERE r.code IN ('PRODUCT_ADMIN','PURCHASING','SUPER_ADMIN') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_record_reference(target_prefix TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE target_year INTEGER:=EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER; next_value BIGINT;
BEGIN
  IF target_prefix NOT IN ('PRJ','CRQ','QCI','WRC','CNS','PSR') THEN RAISE EXCEPTION 'INVALID_RECORD_PREFIX'; END IF;
  INSERT INTO public.document_sequences(document_type,sequence_year,current_value)
  VALUES('REF-'||target_prefix,target_year,1)
  ON CONFLICT(document_type,sequence_year) DO UPDATE SET current_value=public.document_sequences.current_value+1,updated_at=NOW()
  RETURNING current_value INTO next_value;
  RETURN target_prefix||'-'||target_year||'-'||LPAD(next_value::TEXT,6,'0');
END;
$$;

CREATE TABLE public.product_sourcing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  member_profile_id UUID NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  area_id UUID REFERENCES public.project_areas(id) ON DELETE SET NULL,
  request_number TEXT NOT NULL UNIQUE,
  item_name TEXT NOT NULL,
  description TEXT NOT NULL,
  match_preference TEXT NOT NULL DEFAULT 'SIMILAR_OK' CHECK(match_preference IN ('EXACT_ONLY','SIMILAR_OK')),
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK(quantity>0),
  unit TEXT NOT NULL DEFAULT 'EA',
  width_mm NUMERIC(12,2) CHECK(width_mm IS NULL OR width_mm>0),
  depth_mm NUMERIC(12,2) CHECK(depth_mm IS NULL OR depth_mm>0),
  height_mm NUMERIC(12,2) CHECK(height_mm IS NULL OR height_mm>0),
  requested_material TEXT,
  requested_color TEXT,
  budget_max NUMERIC(18,2) CHECK(budget_max IS NULL OR budget_max>=0),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  needed_at DATE,
  source_url TEXT,
  member_note TEXT,
  internal_note TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFO','OPTIONS_READY','MEMBER_SELECTED','CATALOG_PENDING','COMPLETED','UNAVAILABLE','CANCELLED')),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.product_sourcing_files (
  request_id UUID NOT NULL REFERENCES public.product_sourcing_requests(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(request_id,file_id)
);

CREATE TABLE public.product_sourcing_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.product_sourcing_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  category_id UUID REFERENCES public.categories(id),
  proposed_sku TEXT,
  factory_sku TEXT,
  product_type TEXT NOT NULL DEFAULT 'STANDARD' CHECK(product_type IN ('STANDARD','READY_TO_ORDER','BUILT_IN','MATERIAL','EQUIPMENT','DECORATIVE')),
  country_code CHAR(2) NOT NULL DEFAULT 'CN' REFERENCES public.countries(code),
  name_th TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  specification_summary TEXT,
  material_summary TEXT,
  finish_summary TEXT,
  member_price_before_vat NUMERIC(18,2) NOT NULL CHECK(member_price_before_vat>=0),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  lead_time_days INTEGER CHECK(lead_time_days IS NULL OR lead_time_days>0),
  factory_cost NUMERIC(18,2) CHECK(factory_cost IS NULL OR factory_cost>=0),
  factory_currency CHAR(3),
  internal_note TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PRESENTED','SELECTED','NOT_SELECTED','DECLINED')),
  presented_at TIMESTAMPTZ,
  selected_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.product_sourcing_candidate_files (
  candidate_id UUID NOT NULL REFERENCES public.product_sourcing_candidates(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(candidate_id,file_id)
);

CREATE TABLE public.product_sourcing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.product_sourcing_requests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  message TEXT,
  visibility TEXT NOT NULL DEFAULT 'MEMBER' CHECK(visibility IN ('MEMBER','INTERNAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sourcing_requests_member_idx ON public.product_sourcing_requests(member_profile_id,status,updated_at DESC);
CREATE INDEX sourcing_requests_queue_idx ON public.product_sourcing_requests(status,updated_at DESC);
CREATE INDEX sourcing_files_request_idx ON public.product_sourcing_files(request_id,sort_order);
CREATE INDEX sourcing_candidates_request_idx ON public.product_sourcing_candidates(request_id,status,created_at);
CREATE INDEX sourcing_candidate_files_idx ON public.product_sourcing_candidate_files(candidate_id,sort_order);
CREATE INDEX sourcing_history_request_idx ON public.product_sourcing_history(request_id,created_at);
CREATE TRIGGER sourcing_requests_updated_at BEFORE UPDATE ON public.product_sourcing_requests FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER sourcing_candidates_updated_at BEFORE UPDATE ON public.product_sourcing_candidates FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER sourcing_history_append_only BEFORE UPDATE OR DELETE ON public.product_sourcing_history FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

CREATE OR REPLACE FUNCTION public.enforce_sourcing_reference_file()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE request_record public.product_sourcing_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_record FROM public.product_sourcing_requests WHERE id=NEW.request_id FOR UPDATE;
  IF request_record.id IS NULL THEN RAISE EXCEPTION 'SOURCING_REQUEST_NOT_FOUND'; END IF;
  IF (SELECT COUNT(*) FROM public.product_sourcing_files WHERE request_id=NEW.request_id) >= 8 THEN
    RAISE EXCEPTION 'REFERENCE_IMAGE_LIMIT';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.file_metadata f WHERE f.id=NEW.file_id
    AND f.organization_id=request_record.organization_id AND f.member_profile_id=request_record.member_profile_id
    AND f.bucket='gisp-member-private' AND f.visibility='MEMBER_PRIVATE'
    AND f.entity_type='PRODUCT_SOURCING_REQUEST' AND f.entity_id=NEW.request_id
    AND f.mime_type IN ('image/jpeg','image/png','image/webp') AND f.size_bytes>0 AND f.size_bytes<=10485760)
  THEN RAISE EXCEPTION 'INVALID_REFERENCE_IMAGE'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sourcing_reference_file_guard BEFORE INSERT ON public.product_sourcing_files
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sourcing_reference_file();

CREATE OR REPLACE FUNCTION public.can_access_sourcing_request(request_id_input UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.product_sourcing_requests r WHERE r.id=request_id_input
    AND (r.member_profile_id=public.current_member_profile_id() OR public.has_permission('sourcing.manage',r.organization_id)));
$$;

CREATE OR REPLACE FUNCTION public.record_sourcing_history(request_id_input UUID,action_input TEXT,from_input TEXT,to_input TEXT,message_input TEXT,visibility_input TEXT DEFAULT 'MEMBER')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row_value public.product_sourcing_requests%ROWTYPE; history_id UUID;
BEGIN
  SELECT * INTO row_value FROM public.product_sourcing_requests WHERE id=request_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCING_REQUEST_NOT_FOUND'; END IF;
  INSERT INTO public.product_sourcing_history(request_id,organization_id,actor_user_id,action,from_status,to_status,message,visibility)
  VALUES(request_id_input,row_value.organization_id,(SELECT auth.uid()),action_input,from_input,to_input,NULLIF(BTRIM(message_input),''),visibility_input)
  RETURNING id INTO history_id; RETURN history_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_product_sourcing_draft(
  project_id_input UUID,area_id_input UUID,item_name_input TEXT,description_input TEXT,match_preference_input TEXT,
  quantity_input NUMERIC,unit_input TEXT,width_mm_input NUMERIC,depth_mm_input NUMERIC,height_mm_input NUMERIC,
  requested_material_input TEXT,requested_color_input TEXT,budget_max_input NUMERIC,needed_at_input DATE,
  source_url_input TEXT,member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE profile_record public.member_profiles%ROWTYPE; request_id_value UUID;
BEGIN
  SELECT mp.* INTO profile_record
  FROM public.member_profiles mp
  JOIN public.member_applications ma ON ma.member_profile_id=mp.id
  WHERE mp.id=public.current_member_profile_id() AND ma.status='APPROVED';
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVED_MEMBER_REQUIRED'; END IF;
  IF project_id_input IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id_input AND p.member_profile_id=profile_record.id) THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_areas a WHERE a.id=area_id_input AND a.project_id=project_id_input) THEN RAISE EXCEPTION 'AREA_NOT_FOUND'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(item_name_input,'')))<2 OR CHAR_LENGTH(BTRIM(COALESCE(description_input,'')))<10 THEN RAISE EXCEPTION 'REQUEST_DETAILS_REQUIRED'; END IF;
  IF match_preference_input NOT IN ('EXACT_ONLY','SIMILAR_OK') OR quantity_input<=0 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO public.product_sourcing_requests(organization_id,member_profile_id,project_id,area_id,request_number,item_name,description,
    match_preference,quantity,unit,width_mm,depth_mm,height_mm,requested_material,requested_color,budget_max,needed_at,source_url,member_note,submitted_by)
  VALUES(profile_record.organization_id,profile_record.id,project_id_input,area_id_input,public.next_record_reference('PSR'),BTRIM(item_name_input),BTRIM(description_input),
    match_preference_input,quantity_input,COALESCE(NULLIF(BTRIM(unit_input),''),'EA'),width_mm_input,depth_mm_input,height_mm_input,
    NULLIF(BTRIM(requested_material_input),''),NULLIF(BTRIM(requested_color_input),''),budget_max_input,needed_at_input,
    NULLIF(BTRIM(source_url_input),''),NULLIF(BTRIM(member_note_input),''),(SELECT auth.uid())) RETURNING id INTO request_id_value;
  PERFORM public.record_sourcing_history(request_id_value,'DRAFT_CREATED',NULL,'DRAFT',NULL,'MEMBER');
  PERFORM public.write_audit_event(profile_record.organization_id,'product_sourcing_request',request_id_value,'DRAFT_CREATED');
  RETURN request_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_product_sourcing_request(request_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row_value public.product_sourcing_requests%ROWTYPE; before_status TEXT;
BEGIN
  SELECT * INTO row_value FROM public.product_sourcing_requests WHERE id=request_id_input
    AND member_profile_id=public.current_member_profile_id() AND status IN ('DRAFT','NEED_INFO') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCING_REQUEST_NOT_SUBMITTABLE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.product_sourcing_files WHERE request_id=request_id_input) THEN RAISE EXCEPTION 'REFERENCE_IMAGE_REQUIRED'; END IF;
  before_status:=row_value.status;
  UPDATE public.product_sourcing_requests SET status='SUBMITTED',submitted_at=NOW(),submitted_by=(SELECT auth.uid()) WHERE id=request_id_input;
  PERFORM public.record_sourcing_history(request_id_input,CASE WHEN before_status='NEED_INFO' THEN 'RESUBMITTED' ELSE 'SUBMITTED' END,before_status,'SUBMITTED',NULL,'MEMBER');
  PERFORM public.write_audit_event(row_value.organization_id,'product_sourcing_request',request_id_input,'SUBMITTED'); RETURN request_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_product_sourcing_request(
  request_id_input UUID,project_id_input UUID,area_id_input UUID,item_name_input TEXT,description_input TEXT,match_preference_input TEXT,
  quantity_input NUMERIC,unit_input TEXT,width_mm_input NUMERIC,depth_mm_input NUMERIC,height_mm_input NUMERIC,
  requested_material_input TEXT,requested_color_input TEXT,budget_max_input NUMERIC,needed_at_input DATE,
  source_url_input TEXT,member_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row_value public.product_sourcing_requests%ROWTYPE;
BEGIN
  SELECT * INTO row_value FROM public.product_sourcing_requests WHERE id=request_id_input
    AND member_profile_id=public.current_member_profile_id() AND status IN ('DRAFT','NEED_INFO') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCING_REQUEST_NOT_EDITABLE'; END IF;
  IF project_id_input IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id_input AND p.member_profile_id=row_value.member_profile_id) THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_areas a WHERE a.id=area_id_input AND a.project_id=project_id_input) THEN RAISE EXCEPTION 'AREA_NOT_FOUND'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(item_name_input,'')))<2 OR CHAR_LENGTH(BTRIM(COALESCE(description_input,'')))<10 OR match_preference_input NOT IN ('EXACT_ONLY','SIMILAR_OK') OR quantity_input<=0 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  UPDATE public.product_sourcing_requests SET project_id=project_id_input,area_id=area_id_input,item_name=BTRIM(item_name_input),description=BTRIM(description_input),match_preference=match_preference_input,
    quantity=quantity_input,unit=COALESCE(NULLIF(BTRIM(unit_input),''),'EA'),width_mm=width_mm_input,depth_mm=depth_mm_input,height_mm=height_mm_input,
    requested_material=NULLIF(BTRIM(requested_material_input),''),requested_color=NULLIF(BTRIM(requested_color_input),''),budget_max=budget_max_input,needed_at=needed_at_input,
    source_url=NULLIF(BTRIM(source_url_input),''),member_note=NULLIF(BTRIM(member_note_input),'') WHERE id=request_id_input;
  PERFORM public.record_sourcing_history(request_id_input,'DRAFT_SAVED',row_value.status,row_value.status,NULL,'MEMBER'); RETURN request_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_product_sourcing_request(request_id_input UUID,reason_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row_value public.product_sourcing_requests%ROWTYPE;
BEGIN
  SELECT * INTO row_value FROM public.product_sourcing_requests WHERE id=request_id_input
    AND member_profile_id=public.current_member_profile_id() AND status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFO','OPTIONS_READY') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCING_REQUEST_NOT_CANCELLABLE'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(reason_input,'')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  UPDATE public.product_sourcing_requests SET status='CANCELLED' WHERE id=request_id_input;
  PERFORM public.record_sourcing_history(request_id_input,'CANCELLED',row_value.status,'CANCELLED',reason_input,'MEMBER'); RETURN request_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_sourcing_candidate(
  request_id_input UUID,candidate_id_input UUID,supplier_id_input UUID,category_id_input UUID,proposed_sku_input TEXT,
  factory_sku_input TEXT,product_type_input TEXT,country_code_input TEXT,name_th_input TEXT,name_en_input TEXT,
  description_input TEXT,specification_input TEXT,material_input TEXT,finish_input TEXT,member_price_input NUMERIC,
  lead_time_input INTEGER,factory_cost_input NUMERIC,factory_currency_input TEXT,internal_note_input TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE candidate_id_value UUID;
BEGIN
  IF NOT public.has_permission('sourcing.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.product_sourcing_requests WHERE id=request_id_input AND status IN ('SUBMITTED','UNDER_REVIEW','NEED_INFO')) THEN RAISE EXCEPTION 'SOURCING_REQUEST_NOT_EDITABLE'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(name_th_input,'')))<2 OR member_price_input<0 THEN RAISE EXCEPTION 'INVALID_CANDIDATE'; END IF;
  IF candidate_id_input IS NULL THEN
    INSERT INTO public.product_sourcing_candidates(request_id,supplier_id,category_id,proposed_sku,factory_sku,product_type,country_code,name_th,name_en,description,
      specification_summary,material_summary,finish_summary,member_price_before_vat,lead_time_days,factory_cost,factory_currency,internal_note,created_by)
    VALUES(request_id_input,supplier_id_input,category_id_input,NULLIF(BTRIM(proposed_sku_input),''),NULLIF(BTRIM(factory_sku_input),''),product_type_input,UPPER(country_code_input),BTRIM(name_th_input),
      NULLIF(BTRIM(name_en_input),''),NULLIF(BTRIM(description_input),''),NULLIF(BTRIM(specification_input),''),NULLIF(BTRIM(material_input),''),NULLIF(BTRIM(finish_input),''),
      member_price_input,lead_time_input,factory_cost_input,NULLIF(BTRIM(factory_currency_input),''),NULLIF(BTRIM(internal_note_input),''),(SELECT auth.uid())) RETURNING id INTO candidate_id_value;
  ELSE
    UPDATE public.product_sourcing_candidates SET supplier_id=supplier_id_input,category_id=category_id_input,proposed_sku=NULLIF(BTRIM(proposed_sku_input),''),factory_sku=NULLIF(BTRIM(factory_sku_input),''),
      product_type=product_type_input,country_code=UPPER(country_code_input),name_th=BTRIM(name_th_input),name_en=NULLIF(BTRIM(name_en_input),''),description=NULLIF(BTRIM(description_input),''),
      specification_summary=NULLIF(BTRIM(specification_input),''),material_summary=NULLIF(BTRIM(material_input),''),finish_summary=NULLIF(BTRIM(finish_input),''),member_price_before_vat=member_price_input,
      lead_time_days=lead_time_input,factory_cost=factory_cost_input,factory_currency=NULLIF(BTRIM(factory_currency_input),''),internal_note=NULLIF(BTRIM(internal_note_input),'')
    WHERE id=candidate_id_input AND request_id=request_id_input AND status='DRAFT' RETURNING id INTO candidate_id_value;
  END IF;
  IF candidate_id_value IS NULL THEN RAISE EXCEPTION 'CANDIDATE_NOT_EDITABLE'; END IF; RETURN candidate_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_product_sourcing_action(request_id_input UUID,action_input TEXT,message_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row_value public.product_sourcing_requests%ROWTYPE; next_status TEXT; visibility_value TEXT:='MEMBER';
BEGIN
  IF NOT public.has_permission('sourcing.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO row_value FROM public.product_sourcing_requests WHERE id=request_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCING_REQUEST_NOT_FOUND'; END IF;
  next_status:=CASE action_input WHEN 'START_REVIEW' THEN 'UNDER_REVIEW' WHEN 'REQUEST_INFO' THEN 'NEED_INFO'
    WHEN 'PUBLISH_OPTIONS' THEN 'OPTIONS_READY' WHEN 'MARK_UNAVAILABLE' THEN 'UNAVAILABLE'
    WHEN 'COMPLETE' THEN 'COMPLETED' WHEN 'CANCEL' THEN 'CANCELLED' ELSE NULL END;
  IF next_status IS NULL THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  IF action_input='START_REVIEW' AND row_value.status<>'SUBMITTED' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF action_input IN ('REQUEST_INFO','MARK_UNAVAILABLE') AND row_value.status<>'UNDER_REVIEW' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF action_input='CANCEL' AND row_value.status NOT IN ('SUBMITTED','UNDER_REVIEW','NEED_INFO','OPTIONS_READY') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF action_input='PUBLISH_OPTIONS' AND (row_value.status<>'UNDER_REVIEW' OR NOT EXISTS(SELECT 1 FROM public.product_sourcing_candidates WHERE request_id=request_id_input AND status='DRAFT')) THEN RAISE EXCEPTION 'CANDIDATES_REQUIRED'; END IF;
  IF action_input='COMPLETE' AND (row_value.status NOT IN ('MEMBER_SELECTED','CATALOG_PENDING') OR NOT EXISTS(SELECT 1 FROM public.product_sourcing_candidates c JOIN public.products p ON p.id=c.product_id WHERE c.request_id=request_id_input AND c.status='SELECTED' AND p.status='PUBLISHED' AND p.qa_status='PASSED')) THEN RAISE EXCEPTION 'PUBLISHED_PRODUCT_REQUIRED'; END IF;
  IF action_input IN ('REQUEST_INFO','MARK_UNAVAILABLE','CANCEL') AND CHAR_LENGTH(BTRIM(COALESCE(message_input,'')))<3 THEN RAISE EXCEPTION 'MESSAGE_REQUIRED'; END IF;
  IF action_input='PUBLISH_OPTIONS' THEN UPDATE public.product_sourcing_candidates SET status='PRESENTED',presented_at=NOW() WHERE request_id=request_id_input AND status='DRAFT'; END IF;
  UPDATE public.product_sourcing_requests SET status=next_status WHERE id=request_id_input;
  PERFORM public.record_sourcing_history(request_id_input,action_input,row_value.status,next_status,message_input,visibility_value);
  PERFORM public.write_audit_event(row_value.organization_id,'product_sourcing_request',request_id_input,action_input); RETURN request_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_sourcing_candidate(request_id_input UUID,candidate_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NOT public.has_permission('sourcing.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  DELETE FROM public.product_sourcing_candidates
  WHERE id=candidate_id_input AND request_id=request_id_input AND status='DRAFT'
    AND EXISTS(SELECT 1 FROM public.product_sourcing_requests r WHERE r.id=request_id_input AND r.status IN ('SUBMITTED','UNDER_REVIEW','NEED_INFO'));
  IF NOT FOUND THEN RAISE EXCEPTION 'CANDIDATE_NOT_EDITABLE'; END IF;
  RETURN candidate_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.select_sourcing_candidate(request_id_input UUID,candidate_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row_value public.product_sourcing_requests%ROWTYPE;
BEGIN
  SELECT * INTO row_value FROM public.product_sourcing_requests WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id() AND status='OPTIONS_READY' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.product_sourcing_candidates WHERE id=candidate_id_input AND request_id=request_id_input AND status='PRESENTED') THEN RAISE EXCEPTION 'CANDIDATE_NOT_SELECTABLE'; END IF;
  UPDATE public.product_sourcing_candidates SET status=CASE WHEN id=candidate_id_input THEN 'SELECTED' ELSE 'NOT_SELECTED' END,selected_at=CASE WHEN id=candidate_id_input THEN NOW() ELSE selected_at END WHERE request_id=request_id_input AND status='PRESENTED';
  UPDATE public.product_sourcing_requests SET status='MEMBER_SELECTED' WHERE id=request_id_input;
  PERFORM public.record_sourcing_history(request_id_input,'CANDIDATE_SELECTED','OPTIONS_READY','MEMBER_SELECTED',NULL,'MEMBER'); RETURN candidate_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_sourcing_options(request_id_input UUID,message_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF CHAR_LENGTH(BTRIM(COALESCE(message_input,'')))<3 THEN RAISE EXCEPTION 'MESSAGE_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.product_sourcing_requests WHERE id=request_id_input AND member_profile_id=public.current_member_profile_id() AND status='OPTIONS_READY') THEN RAISE EXCEPTION 'OPTIONS_NOT_REJECTABLE'; END IF;
  UPDATE public.product_sourcing_candidates SET status='DECLINED' WHERE request_id=request_id_input AND status='PRESENTED';
  UPDATE public.product_sourcing_requests SET status='UNDER_REVIEW' WHERE id=request_id_input;
  PERFORM public.record_sourcing_history(request_id_input,'OPTIONS_REJECTED','OPTIONS_READY','UNDER_REVIEW',message_input,'MEMBER'); RETURN request_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sourcing_product_draft(request_id_input UUID,candidate_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE candidate_record public.product_sourcing_candidates%ROWTYPE; request_record public.product_sourcing_requests%ROWTYPE; product_id_value UUID;
BEGIN
  IF NOT public.has_permission('sourcing.manage') OR NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO request_record FROM public.product_sourcing_requests WHERE id=request_id_input AND status='MEMBER_SELECTED' FOR UPDATE;
  SELECT * INTO candidate_record FROM public.product_sourcing_candidates WHERE id=candidate_id_input AND request_id=request_id_input AND status='SELECTED' FOR UPDATE;
  IF request_record.id IS NULL OR candidate_record.id IS NULL OR candidate_record.supplier_id IS NULL OR candidate_record.proposed_sku IS NULL THEN RAISE EXCEPTION 'PRODUCT_DRAFT_DATA_REQUIRED'; END IF;
  product_id_value:=public.create_catalog_product_draft(candidate_record.supplier_id,candidate_record.category_id,candidate_record.proposed_sku,
    COALESCE(candidate_record.factory_sku,''),candidate_record.name_th,COALESCE(candidate_record.name_en,''),candidate_record.product_type,candidate_record.country_code,candidate_record.lead_time_days);
  UPDATE public.products SET description_th=candidate_record.description,specification_summary=candidate_record.specification_summary,
    material_summary=candidate_record.material_summary,finish_summary=candidate_record.finish_summary WHERE id=product_id_value;
  UPDATE public.product_sourcing_candidates SET product_id=product_id_value WHERE id=candidate_id_input;
  UPDATE public.product_sourcing_requests SET status='CATALOG_PENDING' WHERE id=request_id_input;
  PERFORM public.record_sourcing_history(request_id_input,'PRODUCT_DRAFT_CREATED','MEMBER_SELECTED','CATALOG_PENDING',product_id_value::TEXT,'MEMBER'); RETURN product_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_sourcing_product(request_id_input UUID,candidate_id_input UUID,product_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE before_status TEXT;
BEGIN
  IF NOT public.has_permission('sourcing.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT status INTO before_status FROM public.product_sourcing_requests WHERE id=request_id_input AND status IN ('MEMBER_SELECTED','CATALOG_PENDING') FOR UPDATE;
  IF before_status IS NULL OR NOT EXISTS(SELECT 1 FROM public.products WHERE id=product_id_input AND status='PUBLISHED' AND qa_status='PASSED') THEN RAISE EXCEPTION 'PUBLISHED_PRODUCT_REQUIRED'; END IF;
  UPDATE public.product_sourcing_candidates SET product_id=product_id_input WHERE id=candidate_id_input AND request_id=request_id_input AND status='SELECTED';
  IF NOT FOUND THEN RAISE EXCEPTION 'SELECTED_CANDIDATE_REQUIRED'; END IF;
  UPDATE public.product_sourcing_requests SET status='COMPLETED' WHERE id=request_id_input;
  PERFORM public.record_sourcing_history(request_id_input,'PUBLISHED_PRODUCT_LINKED',before_status,'COMPLETED',product_id_input::TEXT,'MEMBER'); RETURN product_id_input;
END;
$$;

ALTER TABLE public.product_sourcing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sourcing_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sourcing_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sourcing_candidate_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sourcing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY sourcing_requests_select ON public.product_sourcing_requests FOR SELECT TO authenticated USING(member_profile_id=public.current_member_profile_id() OR public.has_permission('sourcing.manage',organization_id));
CREATE POLICY sourcing_files_select ON public.product_sourcing_files FOR SELECT TO authenticated USING(public.can_access_sourcing_request(request_id));
CREATE POLICY sourcing_candidates_select ON public.product_sourcing_candidates FOR SELECT TO authenticated USING(public.can_access_sourcing_request(request_id));
CREATE POLICY sourcing_candidate_files_select ON public.product_sourcing_candidate_files FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.product_sourcing_candidates c WHERE c.id=candidate_id AND public.can_access_sourcing_request(c.request_id)));
CREATE POLICY sourcing_history_select ON public.product_sourcing_history FOR SELECT TO authenticated USING(public.can_access_sourcing_request(request_id) AND (visibility='MEMBER' OR public.has_permission('sourcing.manage',organization_id)));
REVOKE ALL ON public.product_sourcing_requests,public.product_sourcing_files,public.product_sourcing_candidates,public.product_sourcing_candidate_files,public.product_sourcing_history FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enforce_sourcing_reference_file(),public.can_access_sourcing_request(UUID),public.record_sourcing_history(UUID,TEXT,TEXT,TEXT,TEXT,TEXT),public.create_product_sourcing_draft(UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT),public.save_product_sourcing_request(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT),public.submit_product_sourcing_request(UUID),public.cancel_product_sourcing_request(UUID,TEXT),public.save_sourcing_candidate(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,NUMERIC,TEXT,TEXT),public.admin_product_sourcing_action(UUID,TEXT,TEXT),public.delete_sourcing_candidate(UUID,UUID),public.select_sourcing_candidate(UUID,UUID),public.reject_sourcing_options(UUID,TEXT),public.create_sourcing_product_draft(UUID,UUID),public.link_sourcing_product(UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_sourcing_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_product_sourcing_draft(UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT),public.save_product_sourcing_request(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT),public.submit_product_sourcing_request(UUID),public.cancel_product_sourcing_request(UUID,TEXT),public.select_sourcing_candidate(UUID,UUID),public.reject_sourcing_options(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_sourcing_candidate(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,NUMERIC,TEXT,TEXT),public.admin_product_sourcing_action(UUID,TEXT,TEXT),public.delete_sourcing_candidate(UUID,UUID),public.create_sourcing_product_draft(UUID,UUID),public.link_sourcing_product(UUID,UUID,UUID) TO authenticated;

COMMENT ON TABLE public.product_sourcing_candidates IS 'Internal sourcing candidates; member APIs must use an explicit safe projection without supplier, cost or internal notes.';
