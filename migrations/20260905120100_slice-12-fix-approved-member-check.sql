CREATE OR REPLACE FUNCTION public.create_shared_catalog_draft(
  title_input TEXT, introduction_input TEXT, brand_name_input TEXT,
  contact_name_input TEXT, contact_phone_input TEXT, contact_email_input TEXT,
  line_url_input TEXT, price_mode_input TEXT, expires_at_input TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE profile_record public.member_profiles%ROWTYPE; catalog_id_value UUID;
BEGIN
  SELECT mp.* INTO profile_record
  FROM public.member_profiles mp
  JOIN public.member_applications ma ON ma.member_profile_id=mp.id
  WHERE mp.id=public.current_member_profile_id() AND ma.status='APPROVED';
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVED_MEMBER_REQUIRED'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(title_input,''))) < 2 THEN RAISE EXCEPTION 'TITLE_REQUIRED'; END IF;
  IF price_mode_input NOT IN ('HIDDEN','CUSTOM') THEN RAISE EXCEPTION 'INVALID_PRICE_MODE'; END IF;
  INSERT INTO public.shared_catalogs(
    organization_id,member_profile_id,title,introduction,brand_name,contact_name,
    contact_phone,contact_email,line_url,price_mode,expires_at,created_by
  ) VALUES (
    profile_record.organization_id,profile_record.id,BTRIM(title_input),NULLIF(BTRIM(introduction_input),''),
    COALESCE(NULLIF(BTRIM(brand_name_input),''),profile_record.company_name),NULLIF(BTRIM(contact_name_input),''),
    NULLIF(BTRIM(contact_phone_input),''),NULLIF(BTRIM(contact_email_input),''),NULLIF(BTRIM(line_url_input),''),
    price_mode_input,expires_at_input,(SELECT auth.uid())
  ) RETURNING id INTO catalog_id_value;
  PERFORM public.record_shared_catalog_event(catalog_id_value,'CREATED',NULL);
  PERFORM public.write_audit_event(profile_record.organization_id,'shared_catalog',catalog_id_value,'CREATED');
  RETURN catalog_id_value;
END;
$$;

REVOKE ALL ON FUNCTION public.create_shared_catalog_draft(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shared_catalog_draft(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO authenticated;
