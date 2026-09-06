-- Fix Slice 3 project creation by binding the authenticated member profile.
CREATE OR REPLACE FUNCTION public.create_project_v2(name_input TEXT, project_type_input TEXT,
  end_customer_name_input TEXT, end_customer_phone_input TEXT, end_customer_email_input TEXT,
  site_address_input TEXT, expected_need_date_input DATE, note_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE org_id_value UUID := public.current_user_org_id();
  profile_id_value UUID := public.current_member_profile_id();
  customer_id_value UUID; project_id_value UUID; project_number_value TEXT;
BEGIN
  IF org_id_value IS NULL OR profile_id_value IS NULL THEN RAISE EXCEPTION 'approved member required'; END IF;
  IF NULLIF(BTRIM(name_input),'') IS NULL OR NULLIF(BTRIM(end_customer_name_input),'') IS NULL OR NULLIF(BTRIM(site_address_input),'') IS NULL THEN RAISE EXCEPTION 'project fields are required'; END IF;
  IF project_type_input NOT IN ('RESIDENTIAL','CONDOMINIUM','HOSPITALITY','COMMERCIAL','OTHER') THEN RAISE EXCEPTION 'invalid project type'; END IF;
  project_number_value := 'PRJ-'||TO_CHAR(CURRENT_DATE,'YYYY')||'-'||UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT,'-','') FROM 1 FOR 8));
  INSERT INTO public.end_customers (organization_id,name,phone,email,address,created_by)
  VALUES (org_id_value,BTRIM(end_customer_name_input),NULLIF(BTRIM(end_customer_phone_input),''),NULLIF(BTRIM(end_customer_email_input),''),BTRIM(site_address_input),(SELECT auth.uid())) RETURNING id INTO customer_id_value;
  INSERT INTO public.projects (organization_id,member_profile_id,end_customer_id,project_number,name,project_type,site_address,expected_need_date,note,status,created_by)
  VALUES (org_id_value,profile_id_value,customer_id_value,project_number_value,BTRIM(name_input),project_type_input,BTRIM(site_address_input),expected_need_date_input,NULLIF(BTRIM(note_input),''),'ACTIVE',(SELECT auth.uid())) RETURNING id INTO project_id_value;
  PERFORM public.write_audit_event(org_id_value,'project',project_id_value,'CREATED',NULL,jsonb_build_object('project_number',project_number_value,'project_type',project_type_input));
  RETURN project_id_value;
END; $$;
REVOKE ALL ON FUNCTION public.create_project_v2(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_v2(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,TEXT) TO authenticated;