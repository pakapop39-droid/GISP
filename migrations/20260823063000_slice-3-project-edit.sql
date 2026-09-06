-- Slice 3: edit an existing member project without crossing tenant boundaries.
CREATE OR REPLACE FUNCTION public.update_project_v2(project_id_input UUID, name_input TEXT, project_type_input TEXT, end_customer_name_input TEXT, end_customer_phone_input TEXT, end_customer_email_input TEXT, site_address_input TEXT, expected_need_date_input DATE, note_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE project_record public.projects%ROWTYPE;
BEGIN
 SELECT * INTO project_record FROM public.projects WHERE id=project_id_input AND public.can_access_org(organization_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
 IF project_record.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'project is locked'; END IF;
 IF NULLIF(BTRIM(name_input),'') IS NULL OR NULLIF(BTRIM(end_customer_name_input),'') IS NULL OR NULLIF(BTRIM(site_address_input),'') IS NULL THEN RAISE EXCEPTION 'project fields are required'; END IF;
 IF project_type_input NOT IN ('RESIDENTIAL','CONDOMINIUM','HOSPITALITY','COMMERCIAL','OTHER') THEN RAISE EXCEPTION 'invalid project type'; END IF;
 UPDATE public.end_customers SET name=BTRIM(end_customer_name_input),phone=NULLIF(BTRIM(end_customer_phone_input),''),email=NULLIF(BTRIM(end_customer_email_input),''),address=BTRIM(site_address_input),updated_at=NOW() WHERE id=project_record.end_customer_id AND organization_id=project_record.organization_id;
 UPDATE public.projects SET name=BTRIM(name_input),project_type=project_type_input,site_address=BTRIM(site_address_input),expected_need_date=expected_need_date_input,note=NULLIF(BTRIM(note_input),''),updated_at=NOW() WHERE id=project_id_input;
 PERFORM public.write_audit_event(project_record.organization_id,'project',project_id_input,'UPDATED');
 RETURN project_id_input;
END; $$;
REVOKE ALL ON FUNCTION public.update_project_v2(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_project_v2(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,TEXT) TO authenticated;