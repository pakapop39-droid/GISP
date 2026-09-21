ALTER TABLE public.end_customers ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'RESIDENTIAL'
    CHECK (project_type IN ('RESIDENTIAL','CONDOMINIUM','HOSPITALITY','COMMERCIAL','OTHER')),
  ADD COLUMN IF NOT EXISTS expected_need_date DATE,
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE public.project_areas ADD COLUMN IF NOT EXISTS note TEXT;

CREATE TABLE public.showroom_visit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  preferred_at TIMESTAMPTZ NOT NULL,
  attendee_count INTEGER NOT NULL DEFAULT 1 CHECK (attendee_count BETWEEN 1 AND 50),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','CONFIRMED','COMPLETED','CANCELLED')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.supplier_disclosure_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','REJECTED','REVOKED')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, project_id, supplier_id)
);

CREATE INDEX showroom_visit_requests_org_idx ON public.showroom_visit_requests (organization_id, preferred_at DESC);

CREATE INDEX showroom_visit_requests_project_idx ON public.showroom_visit_requests (project_id);

CREATE INDEX supplier_disclosure_grants_org_idx ON public.supplier_disclosure_grants (organization_id, created_at DESC);

CREATE INDEX supplier_disclosure_grants_project_idx ON public.supplier_disclosure_grants (project_id);

CREATE INDEX IF NOT EXISTS project_items_project_area_idx ON public.project_items (project_id, area_id, created_at);

CREATE OR REPLACE FUNCTION public.slice3_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER showroom_visit_requests_updated_at BEFORE UPDATE ON public.showroom_visit_requests
  FOR EACH ROW EXECUTE FUNCTION public.slice3_set_updated_at();

CREATE OR REPLACE FUNCTION public.create_project_v2(name_input TEXT, project_type_input TEXT,
  end_customer_name_input TEXT, end_customer_phone_input TEXT, end_customer_email_input TEXT,
  site_address_input TEXT, expected_need_date_input DATE, note_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE org_id_value UUID := public.current_user_org_id(); customer_id_value UUID;
  project_id_value UUID; project_number_value TEXT;
BEGIN
  IF org_id_value IS NULL THEN RAISE EXCEPTION 'approved member required'; END IF;
  IF NULLIF(BTRIM(name_input),'') IS NULL OR NULLIF(BTRIM(end_customer_name_input),'') IS NULL
    OR NULLIF(BTRIM(site_address_input),'') IS NULL THEN RAISE EXCEPTION 'project fields are required'; END IF;
  IF project_type_input NOT IN ('RESIDENTIAL','CONDOMINIUM','HOSPITALITY','COMMERCIAL','OTHER')
    THEN RAISE EXCEPTION 'invalid project type'; END IF;
  project_number_value := 'PRJ-'||TO_CHAR(CURRENT_DATE,'YYYY')||'-'||UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT,'-','') FROM 1 FOR 8));
  INSERT INTO public.end_customers (organization_id,name,phone,email,address,created_by)
  VALUES (org_id_value,BTRIM(end_customer_name_input),NULLIF(BTRIM(end_customer_phone_input),''),
    NULLIF(BTRIM(end_customer_email_input),''),BTRIM(site_address_input),(SELECT auth.uid())) RETURNING id INTO customer_id_value;
  INSERT INTO public.projects (organization_id,end_customer_id,project_number,name,project_type,site_address,
    expected_need_date,note,status,created_by)
  VALUES (org_id_value,customer_id_value,project_number_value,BTRIM(name_input),project_type_input,
    BTRIM(site_address_input),expected_need_date_input,NULLIF(BTRIM(note_input),''),'ACTIVE',(SELECT auth.uid()))
  RETURNING id INTO project_id_value;
  PERFORM public.write_audit_event(org_id_value,'project',project_id_value,'CREATED',NULL,
    jsonb_build_object('project_number',project_number_value,'project_type',project_type_input));
  RETURN project_id_value;
END; $$;

CREATE OR REPLACE FUNCTION public.create_project_area(project_id_input UUID, name_input TEXT, note_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE project_record public.projects%ROWTYPE; area_id_value UUID; next_sort INTEGER;
BEGIN
  SELECT * INTO project_record FROM public.projects WHERE id=project_id_input AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF project_record.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'project is locked'; END IF;
  IF NULLIF(BTRIM(name_input),'') IS NULL THEN RAISE EXCEPTION 'area name required'; END IF;
  SELECT COALESCE(MAX(sort_order),-1)+1 INTO next_sort FROM public.project_areas WHERE project_id=project_id_input;
  INSERT INTO public.project_areas (project_id,organization_id,name,note,sort_order)
  VALUES (project_id_input,project_record.organization_id,BTRIM(name_input),NULLIF(BTRIM(note_input),''),next_sort)
  RETURNING id INTO area_id_value;
  PERFORM public.write_audit_event(project_record.organization_id,'project_area',area_id_value,'CREATED');
  RETURN area_id_value;
END; $$;

CREATE OR REPLACE FUNCTION public.add_standard_project_item_v2(project_id_input UUID, area_id_input UUID,
  product_id_input UUID, variant_id_input UUID, selected_options_input JSONB, quantity_input NUMERIC)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE project_record public.projects%ROWTYPE; product_record public.products%ROWTYPE;
  variant_record public.product_variants%ROWTYPE; price_record public.product_prices%ROWTYPE;
  item_id_value UUID; vat_rate_value NUMERIC(5,2); ready_value BOOLEAN := TRUE;
BEGIN
  SELECT * INTO project_record FROM public.projects WHERE id=project_id_input AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF project_record.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'project is locked'; END IF;
  IF quantity_input<=0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input)
    THEN RAISE EXCEPTION 'area not found'; END IF;
  SELECT * INTO product_record FROM public.products WHERE id=product_id_input AND product_type='STANDARD' AND status='PUBLISHED';
  IF NOT FOUND THEN RAISE EXCEPTION 'published standard product not found'; END IF;
  IF variant_id_input IS NOT NULL THEN
    SELECT * INTO variant_record FROM public.product_variants WHERE id=variant_id_input AND product_id=product_id_input AND status='ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'active variant not found'; END IF;
  ELSIF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=product_id_input AND status='ACTIVE') THEN ready_value:=FALSE; END IF;
  SELECT * INTO price_record FROM public.product_prices WHERE product_id=product_id_input
    AND (variant_id=variant_id_input OR (variant_id IS NULL AND variant_id_input IS NULL))
    AND status='ACTIVE' AND valid_from<=NOW() AND (valid_until IS NULL OR valid_until>NOW())
    ORDER BY valid_from DESC LIMIT 1;
  IF NOT FOUND AND variant_id_input IS NOT NULL THEN
    SELECT * INTO price_record FROM public.product_prices WHERE product_id=product_id_input AND variant_id IS NULL
      AND status='ACTIVE' AND valid_from<=NOW() AND (valid_until IS NULL OR valid_until>NOW()) ORDER BY valid_from DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'active member price not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.product_options WHERE product_id=product_id_input AND is_required)
    AND COALESCE(jsonb_array_length(selected_options_input),0)=0 THEN ready_value:=FALSE; END IF;
  SELECT default_vat_rate INTO vat_rate_value FROM public.company_settings WHERE singleton=TRUE;
  INSERT INTO public.project_items (project_id,organization_id,area_id,product_id,variant_id,item_type,item_name,
    specification_snapshot,selected_options,quantity,current_price_id,current_unit_price,vat_rate_snapshot,status,created_by)
  VALUES (project_id_input,project_record.organization_id,area_id_input,product_id_input,variant_id_input,'STANDARD',
    product_record.name_th,COALESCE(variant_record.name,product_record.specification_summary),COALESCE(selected_options_input,'[]'::jsonb),
    quantity_input,price_record.id,price_record.amount,vat_rate_value,CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT' END,(SELECT auth.uid()))
  RETURNING id INTO item_id_value;
  PERFORM public.write_audit_event(project_record.organization_id,'project_item',item_id_value,
    CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT_CREATED' END);
  RETURN item_id_value;
END; $$;

CREATE OR REPLACE FUNCTION public.set_project_item_ready(project_item_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE item_record public.project_items%ROWTYPE;
BEGIN
  SELECT * INTO item_record FROM public.project_items WHERE id=project_item_id_input AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project item not found'; END IF;
  IF item_record.item_type='STANDARD' AND item_record.variant_id IS NULL
    AND EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=item_record.product_id AND status='ACTIVE')
    THEN RAISE EXCEPTION 'variant required'; END IF;
  IF item_record.item_type='STANDARD' AND EXISTS (SELECT 1 FROM public.product_options WHERE product_id=item_record.product_id AND is_required)
    AND jsonb_array_length(item_record.selected_options)=0 THEN RAISE EXCEPTION 'required options missing'; END IF;
  UPDATE public.project_items SET status='READY_TO_ORDER',updated_at=NOW() WHERE id=project_item_id_input AND status='DRAFT';
  IF NOT FOUND THEN RAISE EXCEPTION 'item is not draft'; END IF;
  PERFORM public.write_audit_event(item_record.organization_id,'project_item',item_record.id,'READY_TO_ORDER');
  RETURN item_record.id;
END; $$;

CREATE OR REPLACE FUNCTION public.request_showroom_visit(project_id_input UUID, preferred_at_input TIMESTAMPTZ,
  attendee_count_input INTEGER, note_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE project_record public.projects%ROWTYPE; request_id_value UUID;
BEGIN
  SELECT * INTO project_record FROM public.projects WHERE id=project_id_input AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF preferred_at_input<=NOW() THEN RAISE EXCEPTION 'preferred date must be in the future'; END IF;
  INSERT INTO public.showroom_visit_requests (organization_id,project_id,preferred_at,attendee_count,note,created_by)
  VALUES (project_record.organization_id,project_id_input,preferred_at_input,attendee_count_input,NULLIF(BTRIM(note_input),''),(SELECT auth.uid()))
  RETURNING id INTO request_id_value;
  PERFORM public.write_audit_event(project_record.organization_id,'showroom_visit',request_id_value,'REQUESTED');
  RETURN request_id_value;
END; $$;

CREATE OR REPLACE FUNCTION public.request_supplier_disclosure(project_id_input UUID, product_id_input UUID, reason_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE project_record public.projects%ROWTYPE; supplier_id_value UUID; grant_id_value UUID;
BEGIN
  SELECT * INTO project_record FROM public.projects WHERE id=project_id_input AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'reason required'; END IF;
  SELECT supplier_id INTO supplier_id_value FROM public.products WHERE id=product_id_input AND status='PUBLISHED';
  IF supplier_id_value IS NULL THEN RAISE EXCEPTION 'published product not found'; END IF;
  INSERT INTO public.supplier_disclosure_grants (organization_id,project_id,supplier_id,reason,requested_by)
  VALUES (project_record.organization_id,project_id_input,supplier_id_value,BTRIM(reason_input),(SELECT auth.uid()))
  ON CONFLICT (organization_id,project_id,supplier_id) DO UPDATE SET reason=EXCLUDED.reason,status='REQUESTED',
    requested_by=(SELECT auth.uid()),reviewed_by=NULL,reviewed_at=NULL,expires_at=NULL RETURNING id INTO grant_id_value;
  PERFORM public.write_audit_event(project_record.organization_id,'supplier_disclosure',grant_id_value,'REQUESTED',NULL,
    jsonb_build_object('product_id',product_id_input));
  RETURN grant_id_value;
END; $$;

ALTER TABLE public.showroom_visit_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_disclosure_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY showroom_visit_requests_org_select ON public.showroom_visit_requests FOR SELECT TO authenticated
  USING (public.can_access_org(organization_id));

CREATE POLICY supplier_disclosure_grants_org_select ON public.supplier_disclosure_grants FOR SELECT TO authenticated
  USING (public.can_access_org(organization_id));

REVOKE ALL ON public.showroom_visit_requests,public.supplier_disclosure_grants FROM anon,authenticated;

GRANT SELECT ON public.showroom_visit_requests,public.supplier_disclosure_grants TO authenticated;

REVOKE ALL ON FUNCTION public.create_project_v2(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.create_project_area(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.add_standard_project_item_v2(UUID,UUID,UUID,UUID,JSONB,NUMERIC) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.set_project_item_ready(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.request_showroom_visit(UUID,TIMESTAMPTZ,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.request_supplier_disclosure(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.create_project_v2(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_project_area(UUID,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.add_standard_project_item_v2(UUID,UUID,UUID,UUID,JSONB,NUMERIC) TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_project_item_ready(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.request_showroom_visit(UUID,TIMESTAMPTZ,INTEGER,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.request_supplier_disclosure(UUID,UUID,TEXT) TO authenticated;

GRANT UPDATE (name,phone,email,note,address) ON public.end_customers TO authenticated;

GRANT UPDATE (name,project_type,site_address,expected_need_date,note) ON public.projects TO authenticated;

GRANT UPDATE (name,note,sort_order) ON public.project_areas TO authenticated;

CREATE OR REPLACE FUNCTION public.add_standard_project_item_v2(project_id_input UUID, area_id_input UUID,
  product_id_input UUID, variant_id_input UUID, selected_options_input JSONB, quantity_input NUMERIC)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE project_record public.projects%ROWTYPE; product_record public.products%ROWTYPE;
  variant_record public.product_variants%ROWTYPE; price_record public.product_prices%ROWTYPE;
  item_id_value UUID; vat_rate_value NUMERIC(5,2); ready_value BOOLEAN := TRUE;
BEGIN
  SELECT * INTO project_record FROM public.projects WHERE id=project_id_input AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF project_record.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'project is locked'; END IF;
  IF quantity_input<=0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.project_areas WHERE id=area_id_input AND project_id=project_id_input)
    THEN RAISE EXCEPTION 'area not found'; END IF;
  SELECT * INTO product_record FROM public.products WHERE id=product_id_input AND product_type='STANDARD' AND status='PUBLISHED';
  IF NOT FOUND THEN RAISE EXCEPTION 'published standard product not found'; END IF;
  IF variant_id_input IS NOT NULL THEN
    SELECT * INTO variant_record FROM public.product_variants WHERE id=variant_id_input AND product_id=product_id_input AND status='ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'active variant not found'; END IF;
  ELSIF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=product_id_input AND status='ACTIVE') THEN ready_value:=FALSE; END IF;
  SELECT * INTO price_record FROM public.product_prices WHERE product_id=product_id_input
    AND (variant_id=variant_id_input OR (variant_id IS NULL AND variant_id_input IS NULL))
    AND status='ACTIVE' AND valid_from<=NOW() AND (valid_until IS NULL OR valid_until>NOW())
    ORDER BY valid_from DESC LIMIT 1;
  IF NOT FOUND AND variant_id_input IS NOT NULL THEN
    SELECT * INTO price_record FROM public.product_prices WHERE product_id=product_id_input AND variant_id IS NULL
      AND status='ACTIVE' AND valid_from<=NOW() AND (valid_until IS NULL OR valid_until>NOW()) ORDER BY valid_from DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'active member price not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.product_options WHERE product_id=product_id_input AND is_required)
    AND COALESCE(jsonb_array_length(selected_options_input),0)=0 THEN ready_value:=FALSE; END IF;
  SELECT default_vat_rate INTO vat_rate_value FROM public.company_settings WHERE singleton=TRUE;
  INSERT INTO public.project_items (project_id,organization_id,area_id,product_id,variant_id,item_type,item_name,
    specification_snapshot,selected_options,quantity,current_price_id,current_unit_price,vat_rate_snapshot,status,created_by)
  VALUES (project_id_input,project_record.organization_id,area_id_input,product_id_input,variant_id_input,'STANDARD',
    product_record.name_th,COALESCE(variant_record.name,product_record.specification_summary),COALESCE(selected_options_input,'[]'::jsonb),
    quantity_input,price_record.id,price_record.amount,vat_rate_value,CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT' END,(SELECT auth.uid()))
  RETURNING id INTO item_id_value;
  PERFORM public.write_audit_event(project_record.organization_id,'project_item',item_id_value,
    CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT_CREATED' END);
  RETURN item_id_value;
END; $$;

DROP FUNCTION public.request_supplier_disclosure(UUID,UUID,TEXT);

CREATE OR REPLACE FUNCTION public.request_supplier_disclosure(project_id_input UUID, product_id_input UUID, reason_input TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE project_record public.projects%ROWTYPE; supplier_id_value UUID; grant_id_value UUID;
BEGIN
  SELECT * INTO project_record FROM public.projects WHERE id=project_id_input AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'reason required'; END IF;
  SELECT supplier_id INTO supplier_id_value FROM public.products WHERE id=product_id_input AND status='PUBLISHED';
  IF supplier_id_value IS NULL THEN RAISE EXCEPTION 'published product not found'; END IF;
  INSERT INTO public.supplier_disclosure_grants (organization_id,project_id,supplier_id,reason,requested_by)
  VALUES (project_record.organization_id,project_id_input,supplier_id_value,BTRIM(reason_input),(SELECT auth.uid()))
  ON CONFLICT (organization_id,project_id,supplier_id) DO UPDATE SET reason=EXCLUDED.reason,status='REQUESTED',
    requested_by=(SELECT auth.uid()),reviewed_by=NULL,reviewed_at=NULL,expires_at=NULL RETURNING id INTO grant_id_value;
  PERFORM public.write_audit_event(project_record.organization_id,'supplier_disclosure',grant_id_value,'REQUESTED',NULL,
    jsonb_build_object('product_id',product_id_input));
  RETURN grant_id_value;
END; $$;

REVOKE ALL ON FUNCTION public.request_supplier_disclosure(UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.request_supplier_disclosure(UUID,UUID,TEXT) TO authenticated;

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

INSERT INTO public.permissions (code, name, description)
VALUES ('visits.manage', 'จัดการคำขอเยี่ยมชม', 'อนุมัติ ปฏิเสธ และบันทึกผลการเยี่ยมชม Showroom/โรงงาน')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'visits.manage'
WHERE r.code IN ('SUPER_ADMIN', 'PURCHASING')
ON CONFLICT DO NOTHING;

ALTER TABLE public.project_items
  ADD COLUMN IF NOT EXISTS product_sku_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS category_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS suggested_resale_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS freight_estimate_min NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS freight_estimate_max NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS lead_time_days_snapshot INTEGER;

UPDATE public.project_items pi
SET product_sku_snapshot = COALESCE(pi.product_sku_snapshot, p.sku),
    category_name_snapshot = COALESCE(pi.category_name_snapshot, c.name_th),
    lead_time_days_snapshot = COALESCE(pi.lead_time_days_snapshot, p.default_lead_time_days)
FROM public.products p
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE pi.product_id = p.id;

UPDATE public.project_items pi
SET suggested_resale_amount = COALESCE(pi.suggested_resale_amount, pp.suggested_resale_amount),
    freight_estimate_min = COALESCE(pi.freight_estimate_min, pp.freight_estimate_min),
    freight_estimate_max = COALESCE(pi.freight_estimate_max, pp.freight_estimate_max)
FROM public.product_prices pp
WHERE pp.id = pi.current_price_id;

ALTER TABLE public.showroom_visit_requests
  ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id),
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS visit_instruction TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

UPDATE public.showroom_visit_requests v
SET member_profile_id = p.member_profile_id
FROM public.projects p
WHERE p.id = v.project_id AND v.member_profile_id IS NULL;

UPDATE public.showroom_visit_requests v
SET product_id = COALESCE(v.product_id, (
      SELECT pi.product_id
      FROM public.project_items pi
      WHERE pi.project_id = v.project_id AND pi.product_id IS NOT NULL
      ORDER BY pi.created_at LIMIT 1
    )),
    supplier_id = COALESCE(v.supplier_id, (
      SELECT product.supplier_id
      FROM public.project_items pi
      JOIN public.products product ON product.id = pi.product_id
      WHERE pi.project_id = v.project_id
      ORDER BY pi.created_at LIMIT 1
    ))
WHERE v.product_id IS NULL OR v.supplier_id IS NULL;

ALTER TABLE public.showroom_visit_requests DROP CONSTRAINT IF EXISTS showroom_visit_requests_status_check;

UPDATE public.showroom_visit_requests SET status = 'SUBMITTED' WHERE status = 'REQUESTED';

UPDATE public.showroom_visit_requests SET status = 'APPROVED' WHERE status = 'CONFIRMED';

ALTER TABLE public.showroom_visit_requests
  ADD CONSTRAINT showroom_visit_requests_status_check
  CHECK (status IN ('SUBMITTED','APPROVED','COMPLETED','REJECTED','CANCELLED'));

ALTER TABLE public.showroom_visit_requests
  ALTER COLUMN member_profile_id SET NOT NULL,
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN supplier_id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'SUBMITTED';

CREATE INDEX IF NOT EXISTS showroom_visit_requests_member_idx
  ON public.showroom_visit_requests (member_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS showroom_visit_requests_status_idx
  ON public.showroom_visit_requests (status, preferred_at);

CREATE INDEX IF NOT EXISTS showroom_visit_requests_supplier_idx
  ON public.showroom_visit_requests (supplier_id, created_at DESC);

ALTER TABLE public.supplier_disclosure_grants
  ADD COLUMN IF NOT EXISTS member_profile_id UUID REFERENCES public.member_profiles(id),
  ADD COLUMN IF NOT EXISTS visit_request_id UUID REFERENCES public.showroom_visit_requests(id),
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT;

UPDATE public.supplier_disclosure_grants g
SET member_profile_id = p.member_profile_id
FROM public.projects p
WHERE p.id = g.project_id AND g.member_profile_id IS NULL;

UPDATE public.supplier_disclosure_grants
SET status = 'ACTIVE',
    granted_by = COALESCE(granted_by, reviewed_by),
    granted_at = COALESCE(granted_at, reviewed_at, created_at)
WHERE status = 'APPROVED';

ALTER TABLE public.supplier_disclosure_grants
  DROP CONSTRAINT IF EXISTS supplier_disclosure_grants_status_check,
  DROP CONSTRAINT IF EXISTS supplier_disclosure_grants_organization_id_project_id_suppl_key;

ALTER TABLE public.supplier_disclosure_grants
  ADD CONSTRAINT supplier_disclosure_grants_status_check
  CHECK (status IN ('REQUESTED','REJECTED','ACTIVE','REVOKED'));

ALTER TABLE public.supplier_disclosure_grants ALTER COLUMN member_profile_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_disclosure_grants_member_supplier_unique
  ON public.supplier_disclosure_grants (member_profile_id, supplier_id);

CREATE INDEX IF NOT EXISTS supplier_disclosure_grants_active_idx
  ON public.supplier_disclosure_grants (member_profile_id, supplier_id)
  WHERE status = 'ACTIVE';

DROP POLICY IF EXISTS showroom_visit_requests_org_select ON public.showroom_visit_requests;

DROP POLICY IF EXISTS supplier_disclosure_grants_org_select ON public.supplier_disclosure_grants;

REVOKE ALL ON public.showroom_visit_requests, public.supplier_disclosure_grants FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.slice3_is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.revoked_at IS NULL
      AND u.status = 'ACTIVE'
      AND r.code = 'SUPER_ADMIN'
  )
$$;

REVOKE ALL ON FUNCTION public.slice3_is_super_admin() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.request_supplier_disclosure(UUID,UUID,TEXT);

DROP FUNCTION IF EXISTS public.request_showroom_visit(UUID,TIMESTAMPTZ,INTEGER,TEXT);

CREATE OR REPLACE FUNCTION public.request_showroom_visit(
  project_id_input UUID,
  product_id_input UUID,
  preferred_at_input TIMESTAMPTZ,
  attendee_count_input INTEGER,
  note_input TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  supplier_id_value UUID;
  request_id_value UUID;
BEGIN
  SELECT * INTO project_record
  FROM public.projects
  WHERE id = project_id_input
    AND member_profile_id = public.current_member_profile_id()
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF project_record.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'project is locked'; END IF;
  IF preferred_at_input <= NOW() THEN RAISE EXCEPTION 'preferred date must be in the future'; END IF;
  IF attendee_count_input NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'attendee count out of range'; END IF;

  SELECT supplier_id INTO supplier_id_value
  FROM public.products
  WHERE id = product_id_input AND status = 'PUBLISHED';
  IF supplier_id_value IS NULL THEN RAISE EXCEPTION 'published product not found'; END IF;

  INSERT INTO public.showroom_visit_requests (
    organization_id, member_profile_id, project_id, product_id, supplier_id,
    preferred_at, attendee_count, note, status, created_by
  ) VALUES (
    project_record.organization_id, project_record.member_profile_id, project_id_input,
    product_id_input, supplier_id_value, preferred_at_input, attendee_count_input,
    NULLIF(BTRIM(note_input),''), 'SUBMITTED', (SELECT auth.uid())
  ) RETURNING id INTO request_id_value;

  PERFORM public.write_audit_event(
    project_record.organization_id, 'showroom_visit', request_id_value, 'SUBMITTED', NULL,
    jsonb_build_object('project_id', project_id_input, 'product_id', product_id_input)
  );
  RETURN request_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_showroom_visit(visit_id_input UUID, reason_input TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE visit_record public.showroom_visit_requests%ROWTYPE;
BEGIN
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'reason required'; END IF;
  SELECT * INTO visit_record
  FROM public.showroom_visit_requests
  WHERE id = visit_id_input AND member_profile_id = public.current_member_profile_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit not found'; END IF;
  IF visit_record.status NOT IN ('SUBMITTED','APPROVED') THEN RAISE EXCEPTION 'invalid visit transition'; END IF;

  UPDATE public.showroom_visit_requests
  SET status = 'CANCELLED', review_note = BTRIM(reason_input), cancelled_at = NOW(), updated_at = NOW()
  WHERE id = visit_id_input;
  PERFORM public.write_audit_event(
    visit_record.organization_id, 'showroom_visit', visit_id_input, 'CANCELLED',
    jsonb_build_object('status', visit_record.status),
    jsonb_build_object('status', 'CANCELLED', 'reason', BTRIM(reason_input))
  );
  RETURN visit_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_showroom_visit(
  visit_id_input UUID,
  action_input TEXT,
  note_input TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  visit_record public.showroom_visit_requests%ROWTYPE;
  next_status TEXT;
  grant_id_value UUID;
BEGIN
  IF NOT public.has_permission('visits.manage') THEN RAISE EXCEPTION 'permission denied'; END IF;
  IF action_input NOT IN ('APPROVE','REJECT','COMPLETE') THEN RAISE EXCEPTION 'invalid action'; END IF;
  SELECT * INTO visit_record FROM public.showroom_visit_requests WHERE id = visit_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit not found'; END IF;

  IF action_input = 'APPROVE' THEN
    IF visit_record.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'invalid visit transition'; END IF;
    IF NULLIF(BTRIM(note_input),'') IS NULL THEN RAISE EXCEPTION 'visit instruction required'; END IF;
    next_status := 'APPROVED';
    UPDATE public.showroom_visit_requests
    SET status = next_status, visit_instruction = BTRIM(note_input), review_note = NULL,
        reviewed_by = (SELECT auth.uid()), reviewed_at = NOW(), updated_at = NOW()
    WHERE id = visit_id_input;
  ELSIF action_input = 'REJECT' THEN
    IF visit_record.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'invalid visit transition'; END IF;
    IF NULLIF(BTRIM(note_input),'') IS NULL THEN RAISE EXCEPTION 'rejection reason required'; END IF;
    next_status := 'REJECTED';
    UPDATE public.showroom_visit_requests
    SET status = next_status, review_note = BTRIM(note_input),
        reviewed_by = (SELECT auth.uid()), reviewed_at = NOW(), updated_at = NOW()
    WHERE id = visit_id_input;
  ELSE
    IF visit_record.status <> 'APPROVED' THEN RAISE EXCEPTION 'invalid visit transition'; END IF;
    next_status := 'COMPLETED';
    UPDATE public.showroom_visit_requests
    SET status = next_status, review_note = NULLIF(BTRIM(note_input),''),
        reviewed_by = (SELECT auth.uid()), reviewed_at = NOW(), completed_at = NOW(), updated_at = NOW()
    WHERE id = visit_id_input;

    INSERT INTO public.supplier_disclosure_grants (
      organization_id, member_profile_id, project_id, supplier_id, visit_request_id,
      reason, status, requested_by, reviewed_by, reviewed_at, granted_by, granted_at
    ) VALUES (
      visit_record.organization_id, visit_record.member_profile_id, visit_record.project_id,
      visit_record.supplier_id, visit_record.id, 'VISIT_COMPLETED', 'ACTIVE',
      visit_record.created_by, (SELECT auth.uid()), NOW(), (SELECT auth.uid()), NOW()
    )
    ON CONFLICT (member_profile_id, supplier_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        project_id = EXCLUDED.project_id,
        visit_request_id = EXCLUDED.visit_request_id,
        reason = 'VISIT_COMPLETED', status = 'ACTIVE', requested_by = EXCLUDED.requested_by,
        reviewed_by = EXCLUDED.reviewed_by, reviewed_at = NOW(), granted_by = EXCLUDED.granted_by,
        granted_at = NOW(), revoked_by = NULL, revoked_at = NULL, revoke_reason = NULL
    RETURNING id INTO grant_id_value;

    PERFORM public.write_audit_event(
      visit_record.organization_id, 'supplier_disclosure', grant_id_value, 'GRANTED', NULL,
      jsonb_build_object('member_profile_id', visit_record.member_profile_id,
        'supplier_id', visit_record.supplier_id, 'visit_request_id', visit_record.id)
    );
  END IF;

  PERFORM public.write_audit_event(
    visit_record.organization_id, 'showroom_visit', visit_id_input, next_status,
    jsonb_build_object('status', visit_record.status),
    jsonb_build_object('status', next_status, 'note', NULLIF(BTRIM(note_input),''))
  );
  RETURN visit_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_supplier_disclosure(grant_id_input UUID, reason_input TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE grant_record public.supplier_disclosure_grants%ROWTYPE;
BEGIN
  IF NOT public.slice3_is_super_admin() THEN RAISE EXCEPTION 'super admin required'; END IF;
  IF NULLIF(BTRIM(reason_input),'') IS NULL THEN RAISE EXCEPTION 'revoke reason required'; END IF;
  SELECT * INTO grant_record FROM public.supplier_disclosure_grants WHERE id = grant_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'disclosure grant not found'; END IF;
  IF grant_record.status <> 'ACTIVE' THEN RAISE EXCEPTION 'grant is not active'; END IF;

  UPDATE public.supplier_disclosure_grants
  SET status = 'REVOKED', revoked_by = (SELECT auth.uid()), revoked_at = NOW(),
      revoke_reason = BTRIM(reason_input), reviewed_by = (SELECT auth.uid()), reviewed_at = NOW()
  WHERE id = grant_id_input;
  PERFORM public.write_audit_event(
    grant_record.organization_id, 'supplier_disclosure', grant_id_input, 'REVOKED',
    jsonb_build_object('status', 'ACTIVE'),
    jsonb_build_object('status', 'REVOKED', 'reason', BTRIM(reason_input))
  );
  RETURN grant_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_showroom_visits(project_id_input UUID)
RETURNS TABLE (
  id UUID, product_id UUID, product_name TEXT, preferred_at TIMESTAMPTZ,
  attendee_count INTEGER, note TEXT, status TEXT, review_note TEXT,
  visit_instruction TEXT, created_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT v.id, v.product_id, p.name_th, v.preferred_at, v.attendee_count, v.note,
    v.status, v.review_note, v.visit_instruction, v.created_at, v.completed_at
  FROM public.showroom_visit_requests v
  JOIN public.projects project ON project.id = v.project_id
  JOIN public.products p ON p.id = v.product_id
  WHERE v.project_id = project_id_input
    AND v.member_profile_id = public.current_member_profile_id()
    AND project.member_profile_id = public.current_member_profile_id()
  ORDER BY v.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_member_project_disclosures(project_id_input UUID)
RETURNS TABLE (
  id UUID, reason TEXT, status TEXT, supplier_name TEXT, supplier_legal_name TEXT,
  supplier_address TEXT, supplier_city TEXT, contact_name TEXT, contact_email TEXT,
  contact_phone TEXT, granted_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, revoke_reason TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT g.id, g.reason, g.status,
    CASE WHEN g.status = 'ACTIVE' THEN s.name END,
    CASE WHEN g.status = 'ACTIVE' THEN s.legal_name END,
    CASE WHEN g.status = 'ACTIVE' THEN s.address_line END,
    CASE WHEN g.status = 'ACTIVE' THEN s.city END,
    CASE WHEN g.status = 'ACTIVE' THEN s.contact_name END,
    CASE WHEN g.status = 'ACTIVE' THEN s.contact_email END,
    CASE WHEN g.status = 'ACTIVE' THEN s.contact_phone END,
    g.granted_at, g.revoked_at, g.revoke_reason
  FROM public.supplier_disclosure_grants g
  JOIN public.projects p ON p.id = project_id_input
  JOIN public.suppliers s ON s.id = g.supplier_id
  WHERE g.member_profile_id = public.current_member_profile_id()
    AND p.member_profile_id = public.current_member_profile_id()
    AND (g.project_id = project_id_input OR g.status = 'ACTIVE')
  ORDER BY g.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_member_project_schedule(project_id_input UUID)
RETURNS TABLE (
  item_id UUID, area_name TEXT, product_id UUID, sku TEXT, product_name TEXT,
  category_name TEXT, specification TEXT, selected_options JSONB, quantity NUMERIC,
  unit TEXT, member_price NUMERIC, suggested_resale NUMERIC, freight_min NUMERIC,
  freight_max NUMERIC, lead_time_days INTEGER, item_status TEXT,
  supplier_name TEXT, supplier_address TEXT, supplier_contact TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT pi.id, COALESCE(a.name, 'ไม่ระบุพื้นที่'), pi.product_id,
    COALESCE(pi.product_sku_snapshot, product.sku), pi.item_name,
    COALESCE(pi.category_name_snapshot, category.name_th), pi.specification_snapshot,
    pi.selected_options, pi.quantity, pi.unit, pi.current_unit_price,
    pi.suggested_resale_amount, pi.freight_estimate_min, pi.freight_estimate_max,
    pi.lead_time_days_snapshot, pi.status,
    CASE WHEN grant_row.id IS NOT NULL THEN supplier.name END,
    CASE WHEN grant_row.id IS NOT NULL THEN CONCAT_WS(', ', supplier.address_line, supplier.city, supplier.country_code) END,
    CASE WHEN grant_row.id IS NOT NULL THEN CONCAT_WS(' · ', supplier.contact_name, supplier.contact_phone, supplier.contact_email) END
  FROM public.project_items pi
  JOIN public.projects project ON project.id = pi.project_id
  LEFT JOIN public.project_areas a ON a.id = pi.area_id
  LEFT JOIN public.products product ON product.id = pi.product_id
  LEFT JOIN public.categories category ON category.id = product.category_id
  LEFT JOIN public.suppliers supplier ON supplier.id = product.supplier_id
  LEFT JOIN public.supplier_disclosure_grants grant_row
    ON grant_row.member_profile_id = project.member_profile_id
   AND grant_row.supplier_id = product.supplier_id
   AND grant_row.status = 'ACTIVE'
  WHERE pi.project_id = project_id_input
    AND project.member_profile_id = public.current_member_profile_id()
  ORDER BY a.sort_order NULLS LAST, pi.created_at
$$;

CREATE OR REPLACE FUNCTION public.get_showroom_visit_queue()
RETURNS TABLE (
  id UUID, organization_id UUID, project_id UUID, project_number TEXT, project_name TEXT,
  member_company TEXT, product_name TEXT, supplier_name TEXT, preferred_at TIMESTAMPTZ,
  attendee_count INTEGER, note TEXT, status TEXT, visit_instruction TEXT,
  review_note TEXT, created_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  grant_id UUID, grant_status TEXT, grant_revoked_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT v.id, v.organization_id, v.project_id, project.project_number, project.name,
    member.company_name, product.name_th, supplier.name, v.preferred_at,
    v.attendee_count, v.note, v.status, v.visit_instruction, v.review_note,
    v.created_at, v.completed_at, grant_row.id, grant_row.status, grant_row.revoked_at
  FROM public.showroom_visit_requests v
  JOIN public.projects project ON project.id = v.project_id
  JOIN public.member_profiles member ON member.id = v.member_profile_id
  JOIN public.products product ON product.id = v.product_id
  JOIN public.suppliers supplier ON supplier.id = v.supplier_id
  LEFT JOIN public.supplier_disclosure_grants grant_row
    ON grant_row.member_profile_id = v.member_profile_id AND grant_row.supplier_id = v.supplier_id
  WHERE public.has_permission('visits.manage')
  ORDER BY CASE v.status WHEN 'SUBMITTED' THEN 1 WHEN 'APPROVED' THEN 2 ELSE 3 END,
    v.preferred_at
$$;

CREATE OR REPLACE FUNCTION public.add_standard_project_item_v2(
  project_id_input UUID, area_id_input UUID, product_id_input UUID,
  variant_id_input UUID, selected_options_input JSONB, quantity_input NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  product_record public.products%ROWTYPE;
  variant_record public.product_variants%ROWTYPE;
  price_record public.product_prices%ROWTYPE;
  category_name_value TEXT;
  item_id_value UUID;
  vat_rate_value NUMERIC(5,2);
  ready_value BOOLEAN := TRUE;
BEGIN
  SELECT * INTO project_record FROM public.projects
  WHERE id = project_id_input AND member_profile_id = public.current_member_profile_id()
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF project_record.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'project is locked'; END IF;
  IF quantity_input <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id = area_id_input AND project_id = project_id_input
  ) THEN RAISE EXCEPTION 'area not found'; END IF;

  SELECT * INTO product_record FROM public.products
  WHERE id = product_id_input AND product_type = 'STANDARD' AND status = 'PUBLISHED';
  IF NOT FOUND THEN RAISE EXCEPTION 'published standard product not found'; END IF;
  SELECT name_th INTO category_name_value FROM public.categories WHERE id = product_record.category_id;

  IF variant_id_input IS NOT NULL THEN
    SELECT * INTO variant_record FROM public.product_variants
    WHERE id = variant_id_input AND product_id = product_id_input AND status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'active variant not found'; END IF;
  ELSIF EXISTS (
    SELECT 1 FROM public.product_variants WHERE product_id = product_id_input AND status = 'ACTIVE'
  ) THEN ready_value := FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(selected_options_input,'[]'::jsonb)) selected
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_options option_row
      JOIN public.product_option_values value_row ON value_row.option_id = option_row.id
      WHERE option_row.product_id = product_id_input
        AND option_row.id::TEXT = selected->>'optionId'
        AND value_row.id::TEXT = selected->>'valueId'
        AND option_row.status = 'ACTIVE' AND value_row.status = 'ACTIVE'
    )
  ) THEN RAISE EXCEPTION 'invalid product option'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_options required_option
    WHERE required_option.product_id = product_id_input AND required_option.is_required
      AND required_option.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(selected_options_input,'[]'::jsonb)) selected
        WHERE selected->>'optionId' = required_option.id::TEXT
      )
  ) THEN ready_value := FALSE; END IF;

  SELECT * INTO price_record FROM public.product_prices
  WHERE product_id = product_id_input
    AND (variant_id = variant_id_input OR (variant_id IS NULL AND variant_id_input IS NULL))
    AND status = 'ACTIVE' AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
  ORDER BY valid_from DESC LIMIT 1;
  IF NOT FOUND AND variant_id_input IS NOT NULL THEN
    SELECT * INTO price_record FROM public.product_prices
    WHERE product_id = product_id_input AND variant_id IS NULL
      AND status = 'ACTIVE' AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
    ORDER BY valid_from DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'active member price not found'; END IF;

  SELECT default_vat_rate INTO vat_rate_value FROM public.company_settings WHERE singleton = TRUE;
  INSERT INTO public.project_items (
    project_id, organization_id, area_id, product_id, variant_id, item_type, item_name,
    specification_snapshot, selected_options, quantity, current_price_id, current_unit_price,
    vat_rate_snapshot, status, created_by, product_sku_snapshot, category_name_snapshot,
    suggested_resale_amount, freight_estimate_min, freight_estimate_max, lead_time_days_snapshot
  ) VALUES (
    project_id_input, project_record.organization_id, area_id_input, product_id_input, variant_id_input,
    'STANDARD', product_record.name_th, COALESCE(variant_record.name, product_record.specification_summary),
    COALESCE(selected_options_input,'[]'::jsonb), quantity_input, price_record.id, price_record.amount,
    vat_rate_value, CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT' END, (SELECT auth.uid()),
    product_record.sku, category_name_value, price_record.suggested_resale_amount,
    price_record.freight_estimate_min, price_record.freight_estimate_max,
    product_record.default_lead_time_days
  ) RETURNING id INTO item_id_value;

  PERFORM public.write_audit_event(
    project_record.organization_id, 'project_item', item_id_value,
    CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT_CREATED' END
  );
  RETURN item_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_project_item_v2(
  project_item_id_input UUID, area_id_input UUID, variant_id_input UUID,
  selected_options_input JSONB, quantity_input NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  item_record public.project_items%ROWTYPE;
  project_record public.projects%ROWTYPE;
  product_record public.products%ROWTYPE;
  variant_record public.product_variants%ROWTYPE;
  price_record public.product_prices%ROWTYPE;
  ready_value BOOLEAN := TRUE;
BEGIN
  SELECT * INTO item_record FROM public.project_items WHERE id = project_item_id_input FOR UPDATE;
  IF NOT FOUND OR item_record.item_type <> 'STANDARD' THEN RAISE EXCEPTION 'standard project item not found'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id = item_record.project_id AND member_profile_id = public.current_member_profile_id()
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF item_record.status IN ('PARTIALLY_ORDERED','ORDERED','CANCELLED') THEN RAISE EXCEPTION 'item is locked'; END IF;
  IF quantity_input <= 0 OR quantity_input < item_record.ordered_quantity THEN RAISE EXCEPTION 'invalid quantity'; END IF;
  IF area_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_areas WHERE id = area_id_input AND project_id = item_record.project_id
  ) THEN RAISE EXCEPTION 'area not found'; END IF;

  SELECT * INTO product_record FROM public.products
  WHERE id = item_record.product_id AND product_type = 'STANDARD' AND status = 'PUBLISHED';
  IF NOT FOUND THEN RAISE EXCEPTION 'published standard product not found'; END IF;

  IF variant_id_input IS NOT NULL THEN
    SELECT * INTO variant_record FROM public.product_variants
    WHERE id = variant_id_input AND product_id = item_record.product_id AND status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'active variant not found'; END IF;
  ELSIF EXISTS (
    SELECT 1 FROM public.product_variants WHERE product_id = item_record.product_id AND status = 'ACTIVE'
  ) THEN ready_value := FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(selected_options_input,'[]'::jsonb)) selected
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_options option_row
      JOIN public.product_option_values value_row ON value_row.option_id = option_row.id
      WHERE option_row.product_id = item_record.product_id
        AND option_row.id::TEXT = selected->>'optionId'
        AND value_row.id::TEXT = selected->>'valueId'
        AND option_row.status = 'ACTIVE' AND value_row.status = 'ACTIVE'
    )
  ) THEN RAISE EXCEPTION 'invalid product option'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.product_options required_option
    WHERE required_option.product_id = item_record.product_id AND required_option.is_required
      AND required_option.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(selected_options_input,'[]'::jsonb)) selected
        WHERE selected->>'optionId' = required_option.id::TEXT
      )
  ) THEN ready_value := FALSE; END IF;

  SELECT * INTO price_record FROM public.product_prices
  WHERE product_id = item_record.product_id
    AND (variant_id = variant_id_input OR (variant_id IS NULL AND variant_id_input IS NULL))
    AND status = 'ACTIVE' AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
  ORDER BY valid_from DESC LIMIT 1;
  IF NOT FOUND AND variant_id_input IS NOT NULL THEN
    SELECT * INTO price_record FROM public.product_prices
    WHERE product_id = item_record.product_id AND variant_id IS NULL
      AND status = 'ACTIVE' AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
    ORDER BY valid_from DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'active member price not found'; END IF;

  UPDATE public.project_items
  SET area_id = area_id_input, variant_id = variant_id_input,
      specification_snapshot = COALESCE(variant_record.name, product_record.specification_summary),
      selected_options = COALESCE(selected_options_input,'[]'::jsonb), quantity = quantity_input,
      current_price_id = price_record.id, current_unit_price = price_record.amount,
      suggested_resale_amount = price_record.suggested_resale_amount,
      freight_estimate_min = price_record.freight_estimate_min,
      freight_estimate_max = price_record.freight_estimate_max,
      lead_time_days_snapshot = product_record.default_lead_time_days,
      status = CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT' END,
      updated_at = NOW()
  WHERE id = project_item_id_input;

  PERFORM public.write_audit_event(
    project_record.organization_id, 'project_item', project_item_id_input, 'UPDATED',
    jsonb_build_object('area_id', item_record.area_id, 'variant_id', item_record.variant_id,
      'quantity', item_record.quantity, 'status', item_record.status),
    jsonb_build_object('area_id', area_id_input, 'variant_id', variant_id_input,
      'quantity', quantity_input, 'status', CASE WHEN ready_value THEN 'READY_TO_ORDER' ELSE 'DRAFT' END)
  );
  RETURN project_item_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_project_item_ready(project_item_id_input UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE item_record public.project_items%ROWTYPE; project_record public.projects%ROWTYPE;
BEGIN
  SELECT * INTO item_record FROM public.project_items WHERE id = project_item_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'project item not found'; END IF;
  SELECT * INTO project_record FROM public.projects
  WHERE id = item_record.project_id AND member_profile_id = public.current_member_profile_id()
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF item_record.status <> 'DRAFT' THEN RAISE EXCEPTION 'item is not draft'; END IF;
  IF item_record.variant_id IS NULL AND EXISTS (
    SELECT 1 FROM public.product_variants WHERE product_id = item_record.product_id AND status = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'variant required'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.product_options required_option
    WHERE required_option.product_id = item_record.product_id AND required_option.is_required
      AND required_option.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(item_record.selected_options) selected
        WHERE selected->>'optionId' = required_option.id::TEXT
      )
  ) THEN RAISE EXCEPTION 'required options missing'; END IF;

  UPDATE public.project_items SET status = 'READY_TO_ORDER', updated_at = NOW()
  WHERE id = project_item_id_input;
  PERFORM public.write_audit_event(
    project_record.organization_id, 'project_item', item_record.id, 'READY_TO_ORDER',
    jsonb_build_object('status', item_record.status), jsonb_build_object('status', 'READY_TO_ORDER')
  );
  RETURN item_record.id;
END;
$$;

REVOKE UPDATE ON public.project_items FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.request_showroom_visit(UUID,UUID,TIMESTAMPTZ,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.cancel_showroom_visit(UUID,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.review_showroom_visit(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.revoke_supplier_disclosure(UUID,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.get_member_showroom_visits(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.get_member_project_disclosures(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.get_member_project_schedule(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.get_showroom_visit_queue() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.add_standard_project_item_v2(UUID,UUID,UUID,UUID,JSONB,NUMERIC) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.update_project_item_v2(UUID,UUID,UUID,JSONB,NUMERIC) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.set_project_item_ready(UUID) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.request_showroom_visit(UUID,UUID,TIMESTAMPTZ,INTEGER,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_showroom_visit(UUID,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.review_showroom_visit(UUID,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.revoke_supplier_disclosure(UUID,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_member_showroom_visits(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_member_project_disclosures(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_member_project_schedule(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_showroom_visit_queue() TO authenticated;

GRANT EXECUTE ON FUNCTION public.add_standard_project_item_v2(UUID,UUID,UUID,UUID,JSONB,NUMERIC) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_project_item_v2(UUID,UUID,UUID,JSONB,NUMERIC) TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_project_item_ready(UUID) TO authenticated;

ALTER TABLE public.product_options
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

CREATE INDEX IF NOT EXISTS idx_product_options_active
  ON public.product_options(product_id, sort_order)
  WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION public.request_showroom_visit(
  project_id_input UUID,
  product_id_input UUID,
  preferred_at_input TIMESTAMPTZ,
  attendee_count_input INTEGER,
  note_input TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  supplier_id_value UUID;
  request_id_value UUID;
BEGIN
  SELECT * INTO project_record
  FROM public.projects
  WHERE id = project_id_input
    AND member_profile_id = public.current_member_profile_id()
    AND public.can_access_org(organization_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  IF project_record.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'project is locked'; END IF;
  IF preferred_at_input <= NOW() THEN RAISE EXCEPTION 'preferred date must be in the future'; END IF;
  IF attendee_count_input NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'attendee count out of range'; END IF;

  SELECT product.supplier_id INTO supplier_id_value
  FROM public.products product
  WHERE product.id = product_id_input
    AND product.status = 'PUBLISHED'
    AND EXISTS (
      SELECT 1 FROM public.project_items item
      WHERE item.project_id = project_id_input
        AND item.product_id = product.id
        AND item.status <> 'CANCELLED'
    );
  IF supplier_id_value IS NULL THEN RAISE EXCEPTION 'project product not found'; END IF;

  INSERT INTO public.showroom_visit_requests (
    organization_id, member_profile_id, project_id, product_id, supplier_id,
    preferred_at, attendee_count, note, status, created_by
  ) VALUES (
    project_record.organization_id, project_record.member_profile_id, project_id_input,
    product_id_input, supplier_id_value, preferred_at_input, attendee_count_input,
    NULLIF(BTRIM(note_input),''), 'SUBMITTED', (SELECT auth.uid())
  ) RETURNING id INTO request_id_value;

  PERFORM public.write_audit_event(
    project_record.organization_id, 'showroom_visit', request_id_value, 'SUBMITTED', NULL,
    jsonb_build_object('project_id', project_id_input, 'product_id', product_id_input)
  );
  RETURN request_id_value;
END;
$$;

REVOKE ALL ON FUNCTION public.request_showroom_visit(UUID,UUID,TIMESTAMPTZ,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.request_showroom_visit(UUID,UUID,TIMESTAMPTZ,INTEGER,TEXT) TO authenticated;

ALTER TABLE public.custom_requests
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_by UUID REFERENCES auth.users(id);

ALTER TABLE public.custom_quotations
  ADD COLUMN IF NOT EXISTS quote_note TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_spec_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

UPDATE public.custom_quotations quotation
SET member_profile_id = request.member_profile_id,
    confirmed_spec_json = jsonb_strip_nulls(jsonb_build_object(
      'description', request.specification,
      'width_mm', request.width_mm,
      'depth_mm', request.depth_mm,
      'height_mm', request.height_mm,
      'material', request.requested_material,
      'color', request.requested_color,
      'function', request.requested_function,
      'requested_options', request.requested_options_json
    )),
    accepted_at = CASE WHEN quotation.status = 'ACCEPTED' THEN quotation.responded_at ELSE quotation.accepted_at END,
    rejected_at = CASE WHEN quotation.status = 'REJECTED' THEN quotation.responded_at ELSE quotation.rejected_at END
FROM public.custom_requests request
WHERE request.id = quotation.custom_request_id;

ALTER TABLE public.custom_quotations
  ALTER COLUMN member_profile_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS custom_quotations_member_status_idx
  ON public.custom_quotations(member_profile_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS project_items_one_custom_quote_item_idx
  ON public.project_items(quotation_item_id)
  WHERE quotation_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_custom_request_quotation_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF OLD.status = 'CONVERTED' AND NEW.status IS DISTINCT FROM 'CONVERTED' THEN
    RAISE EXCEPTION 'CONVERTED_CUSTOM_REQUEST_IMMUTABLE';
  END IF;
  IF NEW.status = 'CANCELLED' AND EXISTS (
    SELECT 1 FROM public.custom_quotations quotation
    WHERE quotation.custom_request_id = OLD.id
      AND quotation.status IN ('DRAFT','SENT','ACCEPTED')
  ) THEN RAISE EXCEPTION 'ACTIVE_QUOTATION_MUST_BE_CANCELLED_FIRST'; END IF;
  IF NEW.status = 'CONVERTED' AND NOT EXISTS (
    SELECT 1 FROM public.custom_quotations quotation
    WHERE quotation.custom_request_id = OLD.id AND quotation.status = 'ACCEPTED'
  ) THEN RAISE EXCEPTION 'ACCEPTED_QUOTATION_REQUIRED'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_request_quotation_transition_guard ON public.custom_requests;

CREATE TRIGGER custom_request_quotation_transition_guard
BEFORE UPDATE OF status ON public.custom_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_custom_request_quotation_transition();

CREATE TABLE IF NOT EXISTS public.custom_quotation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.custom_quotations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  member_profile_id UUID NOT NULL REFERENCES public.member_profiles(id),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  message TEXT,
  visibility TEXT NOT NULL DEFAULT 'MEMBER'
    CHECK (visibility IN ('MEMBER', 'INTERNAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_quotation_history_quote_idx
  ON public.custom_quotation_history(quotation_id, created_at);

CREATE INDEX IF NOT EXISTS custom_quotation_history_member_idx
  ON public.custom_quotation_history(member_profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_custom_quotation_history(
  quotation_id_input UUID,
  action_input TEXT,
  from_status_input TEXT,
  to_status_input TEXT,
  message_input TEXT DEFAULT NULL,
  visibility_input TEXT DEFAULT 'MEMBER'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quotation_record public.custom_quotations%ROWTYPE;
  history_id_value UUID;
BEGIN
  SELECT * INTO quotation_record
  FROM public.custom_quotations
  WHERE id = quotation_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION 'QUOTATION_NOT_FOUND'; END IF;

  INSERT INTO public.custom_quotation_history(
    quotation_id, organization_id, member_profile_id, actor_user_id,
    action, from_status, to_status, message, visibility
  ) VALUES (
    quotation_id_input, quotation_record.organization_id,
    quotation_record.member_profile_id, (SELECT auth.uid()),
    action_input, from_status_input, to_status_input,
    NULLIF(BTRIM(message_input), ''), visibility_input
  ) RETURNING id INTO history_id_value;
  RETURN history_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_custom_quotation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'ACCEPTED' THEN
    RAISE EXCEPTION 'ACCEPTED_QUOTATION_IMMUTABLE';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.member_profile_id IS DISTINCT FROM OLD.member_profile_id
    OR NEW.custom_request_id IS DISTINCT FROM OLD.custom_request_id
    OR NEW.quotation_number IS DISTINCT FROM OLD.quotation_number
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.revision_of_id IS DISTINCT FROM OLD.revision_of_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'QUOTATION_IDENTITY_IMMUTABLE';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'DRAFT' AND NEW.status IN ('SENT','CANCELLED','SUPERSEDED'))
    OR (OLD.status = 'SENT' AND NEW.status IN ('ACCEPTED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED'))
    OR (OLD.status IN ('REJECTED','EXPIRED','CANCELLED') AND NEW.status = 'SUPERSEDED')
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION:%->%', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_custom_quotation_child_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quotation_id_value UUID := COALESCE(NEW.quotation_id, OLD.quotation_id);
  quotation_status TEXT;
BEGIN
  SELECT status INTO quotation_status
  FROM public.custom_quotations
  WHERE id = quotation_id_value;
  IF quotation_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'QUOTATION_CONTENT_IMMUTABLE';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_quotation_items_guard ON public.custom_quotation_items;

CREATE TRIGGER custom_quotation_items_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.custom_quotation_items
FOR EACH ROW EXECUTE FUNCTION public.guard_custom_quotation_child_mutation();

DROP TRIGGER IF EXISTS custom_quotation_costs_guard ON public.custom_quotation_costs;

CREATE TRIGGER custom_quotation_costs_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.custom_quotation_costs
FOR EACH ROW EXECUTE FUNCTION public.guard_custom_quotation_child_mutation();

DROP TRIGGER IF EXISTS custom_quotation_history_append_only ON public.custom_quotation_history;

CREATE TRIGGER custom_quotation_history_append_only
BEFORE UPDATE OR DELETE ON public.custom_quotation_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

DROP FUNCTION IF EXISTS public.create_custom_quotation(UUID, NUMERIC, INTEGER, INTEGER, UUID, NUMERIC);

CREATE FUNCTION public.create_custom_quotation(
  custom_request_id_input UUID,
  subtotal_input NUMERIC,
  lead_time_days_input INTEGER,
  valid_days_input INTEGER DEFAULT NULL,
  supplier_id_input UUID DEFAULT NULL,
  supplier_cost_total_input NUMERIC DEFAULT NULL,
  quote_note_input TEXT DEFAULT NULL,
  confirmed_specification_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  previous_quote public.custom_quotations%ROWTYPE;
  quote_id_value UUID;
  next_version INTEGER;
  quote_number_value TEXT;
  vat_rate_value NUMERIC(5,2);
  vat_amount_value NUMERIC(18,2);
  grand_total_value NUMERIC(18,2);
  validity_days INTEGER;
  confirmed_spec_value TEXT;
  confirmed_spec_json_value JSONB;
BEGIN
  IF NOT public.has_permission('quotations.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF subtotal_input IS NULL OR subtotal_input <= 0
    OR lead_time_days_input IS NULL OR lead_time_days_input <= 0
    OR supplier_id_input IS NULL
    OR supplier_cost_total_input IS NULL OR supplier_cost_total_input <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUOTATION_VALUES';
  END IF;

  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = custom_request_id_input
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND'; END IF;
  IF request_record.status <> 'READY_FOR_QUOTE' THEN
    RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_READY_FOR_QUOTE';
  END IF;
  IF NOT public.has_permission('quotations.manage', request_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.custom_request_supplier_candidates candidate
    JOIN public.suppliers supplier ON supplier.id = candidate.supplier_id
    WHERE candidate.custom_request_id = request_record.id
      AND candidate.supplier_id = supplier_id_input
      AND candidate.candidate_status = 'ACTIVE'
      AND supplier.status = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'SUPPLIER_CANDIDATE_REQUIRED'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.custom_quotations
    WHERE custom_request_id = custom_request_id_input AND status = 'ACCEPTED'
  ) THEN RAISE EXCEPTION 'ACCEPTED_QUOTATION_IMMUTABLE'; END IF;

  SELECT * INTO previous_quote
  FROM public.custom_quotations
  WHERE custom_request_id = custom_request_id_input
    AND status <> 'ACCEPTED'
  ORDER BY version DESC
  LIMIT 1
  FOR UPDATE;

  IF previous_quote.id IS NOT NULL AND previous_quote.status <> 'SUPERSEDED' THEN
    UPDATE public.custom_quotations
    SET status = 'SUPERSEDED', superseded_at = NOW()
    WHERE id = previous_quote.id;
    UPDATE public.assignments
    SET status = 'CANCELLED', completed_at = NOW()
    WHERE entity_type = 'CUSTOM_QUOTATION' AND entity_id = previous_quote.id
      AND status IN ('OPEN','IN_PROGRESS');
    PERFORM public.record_custom_quotation_history(
      previous_quote.id, 'SUPERSEDED', previous_quote.status, 'SUPERSEDED',
      'มีการสร้างใบเสนอราคา Revision ใหม่', 'MEMBER'
    );
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.custom_quotations
  WHERE custom_request_id = custom_request_id_input;
  quote_number_value := COALESCE(previous_quote.quotation_number, public.next_document_number('QT'));

  SELECT default_vat_rate, COALESCE(valid_days_input, default_quote_valid_days)
  INTO vat_rate_value, validity_days
  FROM public.company_settings WHERE singleton = TRUE;
  IF validity_days IS NULL OR validity_days <= 0 OR validity_days > 365 THEN
    RAISE EXCEPTION 'INVALID_VALIDITY_DAYS';
  END IF;

  confirmed_spec_value := COALESCE(
    NULLIF(BTRIM(confirmed_specification_input), ''), request_record.specification
  );
  confirmed_spec_json_value := jsonb_strip_nulls(jsonb_build_object(
    'description', confirmed_spec_value,
    'width_mm', request_record.width_mm,
    'depth_mm', request_record.depth_mm,
    'height_mm', request_record.height_mm,
    'material', request_record.requested_material,
    'color', request_record.requested_color,
    'function', request_record.requested_function,
    'requested_options', request_record.requested_options_json
  ));
  vat_amount_value := ROUND(ROUND(subtotal_input, 2) * vat_rate_value / 100, 2);
  grand_total_value := ROUND(ROUND(subtotal_input, 2) + vat_amount_value, 2);

  INSERT INTO public.custom_quotations(
    organization_id, member_profile_id, custom_request_id,
    quotation_number, version, revision_of_id, subtotal, vat_rate,
    vat_amount, grand_total, lead_time_days, confirmed_specification,
    confirmed_spec_json, quote_note, valid_until, created_by
  ) VALUES (
    request_record.organization_id, request_record.member_profile_id,
    request_record.id, quote_number_value, next_version, previous_quote.id,
    ROUND(subtotal_input, 2), vat_rate_value, vat_amount_value,
    grand_total_value, lead_time_days_input, confirmed_spec_value,
    confirmed_spec_json_value, NULLIF(BTRIM(quote_note_input), ''),
    CURRENT_DATE + validity_days, (SELECT auth.uid())
  ) RETURNING id INTO quote_id_value;

  INSERT INTO public.custom_quotation_items(
    quotation_id, line_number, item_name, specification_snapshot,
    quantity, unit, unit_price, line_subtotal
  ) VALUES (
    quote_id_value, 1, request_record.item_name, confirmed_spec_value,
    request_record.quantity, request_record.unit,
    ROUND(subtotal_input / request_record.quantity, 2), ROUND(subtotal_input, 2)
  );

  INSERT INTO public.custom_quotation_costs(
    quotation_id, supplier_id, supplier_cost_total, created_by
  ) VALUES (
    quote_id_value, supplier_id_input, ROUND(supplier_cost_total_input, 2),
    (SELECT auth.uid())
  );

  UPDATE public.custom_requests
  SET selected_supplier_id = supplier_id_input
  WHERE id = request_record.id;

  PERFORM public.record_custom_quotation_history(
    quote_id_value, 'DRAFT_CREATED', NULL, 'DRAFT',
    FORMAT('สร้าง Revision %s', next_version), 'MEMBER'
  );
  PERFORM public.write_audit_event(
    request_record.organization_id, 'custom_quotation', quote_id_value,
    'DRAFT_CREATED', NULL,
    jsonb_build_object('quotation_number', quote_number_value, 'version', next_version)
  );
  RETURN quote_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_custom_quotation_draft(
  quotation_id_input UUID,
  subtotal_input NUMERIC,
  lead_time_days_input INTEGER,
  valid_days_input INTEGER,
  supplier_id_input UUID,
  supplier_cost_total_input NUMERIC,
  quote_note_input TEXT,
  confirmed_specification_input TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quotation_record public.custom_quotations%ROWTYPE;
  vat_amount_value NUMERIC(18,2);
BEGIN
  SELECT * INTO quotation_record FROM public.custom_quotations
  WHERE id = quotation_id_input FOR UPDATE;
  IF NOT FOUND OR quotation_record.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'QUOTATION_NOT_EDITABLE';
  END IF;
  IF NOT public.has_permission('quotations.manage', quotation_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF subtotal_input IS NULL OR subtotal_input <= 0
    OR lead_time_days_input IS NULL OR lead_time_days_input <= 0
    OR valid_days_input IS NULL OR valid_days_input <= 0 OR valid_days_input > 365
    OR supplier_cost_total_input IS NULL OR supplier_cost_total_input <= 0
    OR NULLIF(BTRIM(confirmed_specification_input), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_QUOTATION_VALUES';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.custom_request_supplier_candidates candidate
    JOIN public.suppliers supplier ON supplier.id = candidate.supplier_id
    WHERE candidate.custom_request_id = quotation_record.custom_request_id
      AND candidate.supplier_id = supplier_id_input
      AND candidate.candidate_status = 'ACTIVE'
      AND supplier.status = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'SUPPLIER_CANDIDATE_REQUIRED'; END IF;

  vat_amount_value := ROUND(ROUND(subtotal_input, 2) * quotation_record.vat_rate / 100, 2);
  UPDATE public.custom_quotations SET
    subtotal = ROUND(subtotal_input, 2), vat_amount = vat_amount_value,
    grand_total = ROUND(ROUND(subtotal_input, 2) + vat_amount_value, 2),
    lead_time_days = lead_time_days_input,
    confirmed_specification = BTRIM(confirmed_specification_input),
    confirmed_spec_json = jsonb_set(
      confirmed_spec_json, '{description}', to_jsonb(BTRIM(confirmed_specification_input)), TRUE
    ),
    quote_note = NULLIF(BTRIM(quote_note_input), ''),
    valid_until = CURRENT_DATE + valid_days_input
  WHERE id = quotation_id_input;

  UPDATE public.custom_quotation_items SET
    specification_snapshot = BTRIM(confirmed_specification_input),
    unit_price = ROUND(subtotal_input / quantity, 2),
    line_subtotal = ROUND(subtotal_input, 2)
  WHERE quotation_id = quotation_id_input;
  UPDATE public.custom_quotation_costs SET
    supplier_id = supplier_id_input,
    supplier_cost_total = ROUND(supplier_cost_total_input, 2)
  WHERE quotation_id = quotation_id_input;

  PERFORM public.record_custom_quotation_history(
    quotation_id_input, 'DRAFT_UPDATED', 'DRAFT', 'DRAFT',
    'ปรับข้อมูลใบเสนอราคา', 'INTERNAL'
  );
  PERFORM public.write_audit_event(
    quotation_record.organization_id, 'custom_quotation', quotation_id_input, 'DRAFT_UPDATED'
  );
  RETURN quotation_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_custom_quotation(quotation_id_input UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE quotation_record public.custom_quotations%ROWTYPE;
BEGIN
  SELECT * INTO quotation_record FROM public.custom_quotations
  WHERE id = quotation_id_input FOR UPDATE;
  IF NOT FOUND OR quotation_record.status <> 'DRAFT' THEN RAISE EXCEPTION 'QUOTATION_NOT_SENDABLE'; END IF;
  IF NOT public.has_permission('quotations.manage', quotation_record.organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF quotation_record.valid_until < CURRENT_DATE THEN RAISE EXCEPTION 'QUOTATION_VALIDITY_REQUIRED'; END IF;

  UPDATE public.custom_quotations SET status = 'SENT', sent_at = NOW()
  WHERE id = quotation_id_input;
  INSERT INTO public.assignments(
    organization_id, entity_type, entity_id, assigned_to, due_at,
    action_required, status, created_by
  )
  SELECT quotation_record.organization_id, 'CUSTOM_QUOTATION', quotation_id_input,
    profile.user_id, quotation_record.valid_until::TIMESTAMPTZ + INTERVAL '1 day' - INTERVAL '1 second',
    'ตรวจสอบและตอบรับใบเสนอราคา', 'OPEN', (SELECT auth.uid())
  FROM public.member_profiles profile
  WHERE profile.id = quotation_record.member_profile_id;
  PERFORM public.record_custom_quotation_history(
    quotation_id_input, 'SENT', 'DRAFT', 'SENT',
    'GISP ส่งใบเสนอราคาให้สมาชิกแล้ว', 'MEMBER'
  );
  PERFORM public.write_audit_event(
    quotation_record.organization_id, 'custom_quotation', quotation_id_input, 'SENT'
  );
  RETURN quotation_id_input;
END;
$$;

DROP FUNCTION IF EXISTS public.respond_custom_quotation(UUID, TEXT);

CREATE FUNCTION public.respond_custom_quotation(
  quotation_id_input UUID,
  response_input TEXT,
  reason_input TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  quotation_record public.custom_quotations%ROWTYPE;
  request_record public.custom_requests%ROWTYPE;
  item_record public.custom_quotation_items%ROWTYPE;
  project_item_id_value UUID;
BEGIN
  IF response_input NOT IN ('ACCEPTED','REJECTED') THEN RAISE EXCEPTION 'INVALID_RESPONSE'; END IF;
  IF response_input = 'REJECTED' AND NULLIF(BTRIM(reason_input), '') IS NULL THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;
  SELECT * INTO quotation_record FROM public.custom_quotations
  WHERE id = quotation_id_input FOR UPDATE;
  IF NOT FOUND OR quotation_record.status <> 'SENT'
    OR quotation_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id() THEN
    RAISE EXCEPTION 'QUOTATION_NOT_AVAILABLE';
  END IF;

  IF quotation_record.valid_until < CURRENT_DATE THEN
    UPDATE public.custom_quotations SET
      status = 'EXPIRED', expired_at = NOW(), decision_reason = 'หมดอายุตามวันที่กำหนด'
    WHERE id = quotation_id_input;
    UPDATE public.assignments SET status = 'CANCELLED', completed_at = NOW()
    WHERE entity_type = 'CUSTOM_QUOTATION' AND entity_id = quotation_id_input
      AND status IN ('OPEN','IN_PROGRESS');
    PERFORM public.record_custom_quotation_history(
      quotation_id_input, 'EXPIRED', 'SENT', 'EXPIRED',
      'ใบเสนอราคาหมดอายุแล้ว', 'MEMBER'
    );
    RETURN jsonb_build_object('id', quotation_id_input, 'status', 'EXPIRED');
  END IF;

  UPDATE public.custom_quotations SET
    status = response_input,
    responded_at = NOW(),
    accepted_at = CASE WHEN response_input = 'ACCEPTED' THEN NOW() ELSE accepted_at END,
    rejected_at = CASE WHEN response_input = 'REJECTED' THEN NOW() ELSE rejected_at END,
    decision_reason = NULLIF(BTRIM(reason_input), '')
  WHERE id = quotation_id_input;
  UPDATE public.assignments SET status = 'DONE', completed_at = NOW()
  WHERE entity_type = 'CUSTOM_QUOTATION' AND entity_id = quotation_id_input
    AND status IN ('OPEN','IN_PROGRESS');

  IF response_input = 'ACCEPTED' THEN
    SELECT * INTO request_record FROM public.custom_requests
    WHERE id = quotation_record.custom_request_id FOR UPDATE;
    SELECT * INTO item_record FROM public.custom_quotation_items
    WHERE quotation_id = quotation_id_input ORDER BY line_number LIMIT 1;
    IF request_record.status <> 'READY_FOR_QUOTE' OR item_record.id IS NULL THEN
      RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_CONVERTIBLE';
    END IF;

    INSERT INTO public.project_items(
      project_id, organization_id, area_id, quotation_item_id,
      item_type, item_name, specification_snapshot, selected_options,
      quantity, unit, current_unit_price, vat_rate_snapshot,
      lead_time_days_snapshot, status, created_by
    ) VALUES (
      request_record.project_id, quotation_record.organization_id,
      request_record.area_id, item_record.id, 'CUSTOM', item_record.item_name,
      item_record.specification_snapshot, '[]'::jsonb, item_record.quantity,
      item_record.unit, item_record.unit_price, quotation_record.vat_rate,
      quotation_record.lead_time_days, 'READY_TO_ORDER', (SELECT auth.uid())
    ) RETURNING id INTO project_item_id_value;

    UPDATE public.custom_requests SET
      status = 'CONVERTED', converted_at = NOW(), converted_by = (SELECT auth.uid())
    WHERE id = quotation_record.custom_request_id;
  END IF;

  PERFORM public.record_custom_quotation_history(
    quotation_id_input, response_input, 'SENT', response_input,
    CASE WHEN response_input = 'ACCEPTED' THEN 'สมาชิกยอมรับใบเสนอราคาแล้ว' ELSE BTRIM(reason_input) END,
    'MEMBER'
  );
  PERFORM public.write_audit_event(
    quotation_record.organization_id, 'custom_quotation', quotation_id_input, response_input,
    NULL, jsonb_build_object('project_item_id', project_item_id_value)
  );
  RETURN jsonb_build_object(
    'id', quotation_id_input, 'status', response_input,
    'project_item_id', project_item_id_value
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_transition_custom_quotation(
  quotation_id_input UUID,
  action_input TEXT,
  reason_input TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE quotation_record public.custom_quotations%ROWTYPE; next_status TEXT;
BEGIN
  SELECT * INTO quotation_record FROM public.custom_quotations
  WHERE id = quotation_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('quotations.manage', quotation_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF action_input = 'CANCEL' THEN
    IF quotation_record.status NOT IN ('DRAFT','SENT') OR NULLIF(BTRIM(reason_input), '') IS NULL THEN
      RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED_OR_INVALID_STATUS';
    END IF;
    next_status := 'CANCELLED';
    UPDATE public.custom_quotations SET
      status = next_status, cancelled_at = NOW(), decision_reason = BTRIM(reason_input)
    WHERE id = quotation_id_input;
  ELSIF action_input = 'EXPIRE' THEN
    IF quotation_record.status <> 'SENT' OR quotation_record.valid_until >= CURRENT_DATE THEN
      RAISE EXCEPTION 'QUOTATION_NOT_EXPIRED';
    END IF;
    next_status := 'EXPIRED';
    UPDATE public.custom_quotations SET
      status = next_status, expired_at = NOW(), decision_reason = 'หมดอายุตามวันที่กำหนด'
    WHERE id = quotation_id_input;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;

  UPDATE public.assignments SET status = 'CANCELLED', completed_at = NOW()
  WHERE entity_type = 'CUSTOM_QUOTATION' AND entity_id = quotation_id_input
    AND status IN ('OPEN','IN_PROGRESS');
  PERFORM public.record_custom_quotation_history(
    quotation_id_input, next_status, quotation_record.status, next_status,
    COALESCE(NULLIF(BTRIM(reason_input), ''), 'ใบเสนอราคาหมดอายุแล้ว'), 'MEMBER'
  );
  PERFORM public.write_audit_event(
    quotation_record.organization_id, 'custom_quotation', quotation_id_input, next_status
  );
  RETURN quotation_id_input;
END;
$$;

ALTER TABLE public.custom_quotation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_quotations_org ON public.custom_quotations;

CREATE POLICY custom_quotations_org ON public.custom_quotations
FOR SELECT TO authenticated
USING (
  (member_profile_id = public.current_member_profile_id() AND sent_at IS NOT NULL)
  OR public.has_permission('quotations.manage', organization_id)
);

DROP POLICY IF EXISTS custom_quotation_items_org ON public.custom_quotation_items;

CREATE POLICY custom_quotation_items_org ON public.custom_quotation_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.custom_quotations quotation
  WHERE quotation.id = quotation_id
    AND (
      (quotation.member_profile_id = public.current_member_profile_id() AND quotation.sent_at IS NOT NULL)
      OR public.has_permission('quotations.manage', quotation.organization_id)
    )
));

DROP POLICY IF EXISTS custom_quotation_history_select ON public.custom_quotation_history;

CREATE POLICY custom_quotation_history_select ON public.custom_quotation_history
FOR SELECT TO authenticated
USING (
  (
    member_profile_id = public.current_member_profile_id()
    AND visibility = 'MEMBER'
    AND EXISTS (
      SELECT 1 FROM public.custom_quotations quotation
      WHERE quotation.id = quotation_id AND quotation.sent_at IS NOT NULL
    )
  )
  OR public.has_permission('quotations.manage', organization_id)
);

REVOKE ALL ON public.custom_quotation_history FROM anon, authenticated;

GRANT SELECT (
  id, quotation_id, organization_id, member_profile_id,
  action, from_status, to_status, message, visibility, created_at
) ON public.custom_quotation_history TO authenticated;

REVOKE ALL ON FUNCTION public.record_custom_quotation_history(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.guard_custom_quotation_child_mutation() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.guard_custom_request_quotation_transition() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.create_custom_quotation(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.update_custom_quotation_draft(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.admin_transition_custom_quotation(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.create_custom_quotation(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_custom_quotation_draft(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_transition_custom_quotation(UUID,TEXT,TEXT) TO authenticated;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS shipping_address_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

UPDATE public.customer_orders co
SET member_profile_id = p.member_profile_id
FROM public.projects p
WHERE p.id = co.project_id
  AND co.member_profile_id IS NULL;

ALTER TABLE public.customer_orders
  DROP CONSTRAINT IF EXISTS customer_orders_status_check;

ALTER TABLE public.customer_orders
  ADD CONSTRAINT customer_orders_status_check CHECK (status IN (
    'DRAFT', 'PENDING_DEPOSIT', 'DEPOSIT_VERIFIED', 'CANCELLATION_REQUESTED',
    'PO_ISSUED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'PARTIALLY_SHIPPED',
    'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'
  ));

ALTER TABLE public.supplier_orders
  ADD COLUMN IF NOT EXISTS supplier_order_number TEXT,
  ALTER COLUMN po_number DROP NOT NULL;

UPDATE public.supplier_orders
SET supplier_order_number = public.next_document_number('SO')
WHERE supplier_order_number IS NULL;

UPDATE public.supplier_orders
SET po_number = NULL
WHERE status = 'DRAFT' AND po_issued_at IS NULL;

ALTER TABLE public.supplier_orders
  ALTER COLUMN supplier_order_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_orders_number_uidx
  ON public.supplier_orders(supplier_order_number);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_order_id UUID NOT NULL UNIQUE REFERENCES public.supplier_orders(id) ON DELETE RESTRICT,
  purchase_order_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  currency CHAR(3) NOT NULL,
  total_amount NUMERIC(18,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'CANCELLED')),
  issued_by UUID NOT NULL REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_order_id UUID NOT NULL REFERENCES public.supplier_orders(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('DEPOSIT', 'BALANCE')),
  due_amount NUMERIC(18,2) NOT NULL CHECK (due_amount >= 0),
  paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERPAYMENT_REVIEW', 'CANCELLED'
  )),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_order_id, schedule_type)
);

ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS payment_schedule_id UUID REFERENCES public.supplier_payment_schedules(id),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.supplier_payments
  DROP CONSTRAINT IF EXISTS supplier_payments_status_check;

ALTER TABLE public.supplier_payments
  ADD CONSTRAINT supplier_payments_status_check
  CHECK (status IN ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED'));

CREATE UNIQUE INDEX IF NOT EXISTS supplier_payments_reference_uidx
  ON public.supplier_payments(payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  payment_transfer_id UUID NOT NULL REFERENCES public.payment_transfers(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('VERIFIED', 'REJECTED')),
  amount_snapshot NUMERIC(18,2) NOT NULL CHECK (amount_snapshot > 0),
  schedule_verified_amount_snapshot NUMERIC(18,2) NOT NULL DEFAULT 0,
  schedule_status_snapshot TEXT NOT NULL,
  note TEXT,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_payment_id UUID NOT NULL REFERENCES public.supplier_payments(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('REQUESTED', 'APPROVED', 'REJECTED', 'PAID')),
  amount_snapshot NUMERIC(18,2) NOT NULL CHECK (amount_snapshot > 0),
  note TEXT,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  member_profile_id UUID NOT NULL REFERENCES public.member_profiles(id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED')),
  previous_order_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  supporting_file_id UUID REFERENCES public.file_metadata(id),
  deposit_verified_amount_snapshot NUMERIC(18,2) NOT NULL DEFAULT 0,
  approved_refund_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (approved_refund_amount >= 0),
  approved_deduction_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (approved_deduction_amount >= 0),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cancellation_requests_open_uidx
  ON public.cancellation_requests(order_id)
  WHERE status = 'SUBMITTED';

CREATE INDEX IF NOT EXISTS purchase_orders_org_idx
  ON public.purchase_orders(organization_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS supplier_payment_schedules_order_idx
  ON public.supplier_payment_schedules(supplier_order_id, schedule_type);

CREATE INDEX IF NOT EXISTS payment_verification_logs_transfer_idx
  ON public.payment_verification_logs(payment_transfer_id, created_at);

CREATE INDEX IF NOT EXISTS supplier_payment_history_payment_idx
  ON public.supplier_payment_history(supplier_payment_id, created_at);

CREATE INDEX IF NOT EXISTS cancellation_requests_order_idx
  ON public.cancellation_requests(order_id, created_at DESC);

DROP TRIGGER IF EXISTS supplier_payment_schedules_updated_at ON public.supplier_payment_schedules;

CREATE TRIGGER supplier_payment_schedules_updated_at
BEFORE UPDATE ON public.supplier_payment_schedules
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

DROP TRIGGER IF EXISTS supplier_payments_updated_at ON public.supplier_payments;

CREATE TRIGGER supplier_payments_updated_at
BEFORE UPDATE ON public.supplier_payments
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

DROP TRIGGER IF EXISTS cancellation_requests_updated_at ON public.cancellation_requests;

CREATE TRIGGER cancellation_requests_updated_at
BEFORE UPDATE ON public.cancellation_requests
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

DROP TRIGGER IF EXISTS payment_verification_logs_append_only ON public.payment_verification_logs;

CREATE TRIGGER payment_verification_logs_append_only
BEFORE UPDATE OR DELETE ON public.payment_verification_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

DROP TRIGGER IF EXISTS supplier_payment_history_append_only ON public.supplier_payment_history;

CREATE TRIGGER supplier_payment_history_append_only
BEFORE UPDATE OR DELETE ON public.supplier_payment_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

CREATE OR REPLACE FUNCTION public.create_customer_order(
  project_id_input UUID,
  selections_input JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  selection_record RECORD;
  project_item_record public.project_items%ROWTYPE;
  quotation_cost_record public.custom_quotation_costs%ROWTYPE;
  supplier_id_value UUID;
  factory_unit_cost_value NUMERIC(18,2);
  order_id_value UUID;
  order_item_id_value UUID;
  supplier_order_id_value UUID;
  order_number_value TEXT;
  vat_rate_value NUMERIC(5,2);
  subtotal_value NUMERIC(18,2) := 0;
  vat_amount_value NUMERIC(18,2) := 0;
  grand_total_value NUMERIC(18,2);
  deposit_value NUMERIC(18,2);
  balance_value NUMERIC(18,2);
  line_subtotal_value NUMERIC(18,2);
  line_vat_value NUMERIC(18,2);
BEGIN
  IF jsonb_typeof(selections_input) <> 'array'
    OR jsonb_array_length(selections_input) = 0 THEN
    RAISE EXCEPTION 'AT_LEAST_ONE_ITEM_REQUIRED';
  END IF;

  SELECT * INTO project_record
  FROM public.projects
  WHERE id = project_id_input
    AND member_profile_id = public.current_member_profile_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;

  FOR selection_record IN
    SELECT * FROM jsonb_to_recordset(selections_input)
      AS x(project_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT * INTO project_item_record
    FROM public.project_items
    WHERE id = selection_record.project_item_id
      AND project_id = project_id_input
      AND organization_id = project_record.organization_id
    FOR UPDATE;
    IF NOT FOUND OR project_item_record.status NOT IN ('READY_TO_ORDER', 'PARTIALLY_ORDERED') THEN
      RAISE EXCEPTION 'PROJECT_ITEM_NOT_READY';
    END IF;
    IF selection_record.quantity IS NULL OR selection_record.quantity <= 0
      OR selection_record.quantity > (project_item_record.quantity - project_item_record.ordered_quantity) THEN
      RAISE EXCEPTION 'INVALID_ORDER_QUANTITY';
    END IF;
    IF vat_rate_value IS NULL THEN
      vat_rate_value := project_item_record.vat_rate_snapshot;
    ELSIF vat_rate_value <> project_item_record.vat_rate_snapshot THEN
      RAISE EXCEPTION 'MIXED_VAT_SNAPSHOTS';
    END IF;
    line_subtotal_value := ROUND(selection_record.quantity * project_item_record.current_unit_price, 2);
    line_vat_value := ROUND(line_subtotal_value * project_item_record.vat_rate_snapshot / 100, 2);
    subtotal_value := subtotal_value + line_subtotal_value;
    vat_amount_value := vat_amount_value + line_vat_value;
  END LOOP;

  subtotal_value := ROUND(subtotal_value, 2);
  vat_amount_value := ROUND(vat_amount_value, 2);
  grand_total_value := ROUND(subtotal_value + vat_amount_value, 2);
  deposit_value := ROUND(grand_total_value * 0.50, 2);
  balance_value := ROUND(grand_total_value - deposit_value, 2);
  order_number_value := public.next_document_number('ORD');

  INSERT INTO public.customer_orders (
    organization_id, member_profile_id, project_id, order_number, subtotal,
    vat_rate_snapshot, vat_amount, grand_total, deposit_amount, balance_amount,
    shipping_address_snapshot, created_by
  ) VALUES (
    project_record.organization_id, project_record.member_profile_id, project_id_input,
    order_number_value, subtotal_value, vat_rate_value, vat_amount_value,
    grand_total_value, deposit_value, balance_value,
    jsonb_build_object('site_address', project_record.site_address), (SELECT auth.uid())
  ) RETURNING id INTO order_id_value;

  FOR selection_record IN
    SELECT * FROM jsonb_to_recordset(selections_input)
      AS x(project_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT * INTO project_item_record
    FROM public.project_items WHERE id = selection_record.project_item_id FOR UPDATE;

    IF project_item_record.item_type = 'STANDARD' THEN
      SELECT p.supplier_id, p.factory_cost
      INTO supplier_id_value, factory_unit_cost_value
      FROM public.products p WHERE p.id = project_item_record.product_id;
    ELSE
      SELECT cqc.* INTO quotation_cost_record
      FROM public.custom_quotation_items cqi
      JOIN public.custom_quotation_costs cqc ON cqc.quotation_id = cqi.quotation_id
      WHERE cqi.id = project_item_record.quotation_item_id;
      supplier_id_value := quotation_cost_record.supplier_id;
      SELECT ROUND(quotation_cost_record.supplier_cost_total / cqi.quantity, 2)
      INTO factory_unit_cost_value
      FROM public.custom_quotation_items cqi
      WHERE cqi.id = project_item_record.quotation_item_id;
    END IF;
    IF supplier_id_value IS NULL OR factory_unit_cost_value IS NULL OR factory_unit_cost_value <= 0 THEN
      RAISE EXCEPTION 'SUPPLIER_COST_REQUIRED';
    END IF;

    line_subtotal_value := ROUND(selection_record.quantity * project_item_record.current_unit_price, 2);
    line_vat_value := ROUND(line_subtotal_value * project_item_record.vat_rate_snapshot / 100, 2);
    INSERT INTO public.order_items (
      order_id, organization_id, project_item_id, item_type, item_name_snapshot,
      specification_snapshot, options_snapshot, quantity, unit, unit_price_snapshot,
      line_subtotal, vat_rate_snapshot, vat_amount, line_total
    ) VALUES (
      order_id_value, project_record.organization_id, project_item_record.id,
      project_item_record.item_type, project_item_record.item_name,
      project_item_record.specification_snapshot, project_item_record.selected_options,
      selection_record.quantity, project_item_record.unit, project_item_record.current_unit_price,
      line_subtotal_value, project_item_record.vat_rate_snapshot, line_vat_value,
      ROUND(line_subtotal_value + line_vat_value, 2)
    ) RETURNING id INTO order_item_id_value;

    SELECT id INTO supplier_order_id_value
    FROM public.supplier_orders
    WHERE customer_order_id = order_id_value AND supplier_id = supplier_id_value;
    IF supplier_order_id_value IS NULL THEN
      INSERT INTO public.supplier_orders (
        customer_order_id, organization_id, supplier_id, supplier_order_number, po_number
      ) VALUES (
        order_id_value, project_record.organization_id, supplier_id_value,
        public.next_document_number('SO'), NULL
      ) RETURNING id INTO supplier_order_id_value;
    END IF;

    INSERT INTO public.supplier_order_items (
      supplier_order_id, order_item_id, quantity, factory_unit_cost_snapshot, factory_line_total
    ) VALUES (
      supplier_order_id_value, order_item_id_value, selection_record.quantity,
      factory_unit_cost_value, ROUND(factory_unit_cost_value * selection_record.quantity, 2)
    );
    UPDATE public.project_items
    SET ordered_quantity = ordered_quantity + selection_record.quantity,
        status = CASE WHEN ordered_quantity + selection_record.quantity = quantity
          THEN 'ORDERED' ELSE 'PARTIALLY_ORDERED' END
    WHERE id = project_item_record.id;
  END LOOP;

  UPDATE public.supplier_orders so
  SET total_factory_cost = totals.total_value
  FROM (
    SELECT soi.supplier_order_id, ROUND(SUM(soi.factory_line_total), 2) total_value
    FROM public.supplier_order_items soi
    JOIN public.supplier_orders grouped_so ON grouped_so.id = soi.supplier_order_id
    WHERE grouped_so.customer_order_id = order_id_value
    GROUP BY soi.supplier_order_id
  ) totals
  WHERE so.id = totals.supplier_order_id;

  INSERT INTO public.payment_schedules(order_id, organization_id, schedule_type, due_amount)
  VALUES
    (order_id_value, project_record.organization_id, 'DEPOSIT', deposit_value),
    (order_id_value, project_record.organization_id, 'BALANCE', balance_value);

  INSERT INTO public.supplier_payment_schedules(
    organization_id, supplier_order_id, schedule_type, due_amount
  )
  SELECT so.organization_id, so.id, schedule_type,
    CASE WHEN schedule_type = 'DEPOSIT' THEN ROUND(so.total_factory_cost * 0.50, 2)
      ELSE ROUND(so.total_factory_cost - ROUND(so.total_factory_cost * 0.50, 2), 2) END
  FROM public.supplier_orders so
  CROSS JOIN (VALUES ('DEPOSIT'), ('BALANCE')) schedule_types(schedule_type)
  WHERE so.customer_order_id = order_id_value;

  INSERT INTO public.status_events(
    organization_id, entity_type, entity_id, from_status, to_status,
    actor_user_id, reason, is_member_visible
  ) VALUES (
    project_record.organization_id, 'customer_order', order_id_value, NULL,
    'PENDING_DEPOSIT', (SELECT auth.uid()), 'ORDER_CREATED', TRUE
  );
  PERFORM public.write_audit_event(
    project_record.organization_id, 'customer_order', order_id_value, 'CREATED', NULL,
    jsonb_build_object('order_number', order_number_value, 'subtotal', subtotal_value,
      'vat_rate', vat_rate_value, 'vat_amount', vat_amount_value,
      'grand_total', grand_total_value, 'deposit', deposit_value, 'balance', balance_value)
  );
  RETURN order_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_payment_transfer(
  payment_schedule_id_input UUID,
  amount_input NUMERIC,
  transferred_at_input TIMESTAMPTZ,
  evidence_file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  schedule_record public.payment_schedules%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  transfer_id_value UUID;
BEGIN
  SELECT ps.* INTO schedule_record
  FROM public.payment_schedules ps
  JOIN public.customer_orders co ON co.id = ps.order_id
  WHERE ps.id = payment_schedule_id_input
    AND co.member_profile_id = public.current_member_profile_id()
  FOR UPDATE OF ps;
  IF NOT FOUND OR schedule_record.status NOT IN ('PENDING', 'PARTIALLY_VERIFIED') THEN
    RAISE EXCEPTION 'PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;
  SELECT * INTO order_record FROM public.customer_orders WHERE id = schedule_record.order_id;
  IF order_record.status IN ('CANCELLED', 'CANCELLATION_REQUESTED') THEN
    RAISE EXCEPTION 'ORDER_NOT_PAYABLE';
  END IF;
  IF amount_input IS NULL OR amount_input <= 0 THEN RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.file_metadata fm
    WHERE fm.id = evidence_file_id_input
      AND fm.organization_id = schedule_record.organization_id
      AND fm.member_profile_id = order_record.member_profile_id
      AND fm.visibility = 'MEMBER_PRIVATE'
  ) THEN RAISE EXCEPTION 'PAYMENT_EVIDENCE_REQUIRED'; END IF;

  INSERT INTO public.payment_transfers(
    payment_schedule_id, organization_id, transfer_number, amount,
    transferred_at, evidence_file_id, submitted_by
  ) VALUES (
    schedule_record.id, schedule_record.organization_id, public.next_document_number('PAY'),
    ROUND(amount_input, 2), transferred_at_input, evidence_file_id_input, (SELECT auth.uid())
  ) RETURNING id INTO transfer_id_value;
  PERFORM public.write_audit_event(
    schedule_record.organization_id, 'payment_transfer', transfer_id_value,
    'SUBMITTED', NULL, jsonb_build_object('amount', ROUND(amount_input, 2))
  );
  RETURN transfer_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_payment_transfer(
  transfer_id_input UUID,
  approve_input BOOLEAN,
  finance_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  transfer_record public.payment_transfers%ROWTYPE;
  schedule_record public.payment_schedules%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  verified_total NUMERIC(18,2);
  new_schedule_status TEXT;
BEGIN
  IF NOT public.has_permission('payments.verify') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO transfer_record FROM public.payment_transfers
  WHERE id = transfer_id_input FOR UPDATE;
  IF NOT FOUND OR transfer_record.status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'TRANSFER_NOT_VERIFIABLE';
  END IF;
  SELECT * INTO schedule_record FROM public.payment_schedules
  WHERE id = transfer_record.payment_schedule_id FOR UPDATE;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = schedule_record.order_id FOR UPDATE;

  IF NOT approve_input THEN
    IF NULLIF(BTRIM(finance_note_input), '') IS NULL THEN
      RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
    END IF;
    UPDATE public.payment_transfers
    SET status = 'REJECTED', finance_verified_by = (SELECT auth.uid()),
        finance_verified_at = NOW(), finance_note = BTRIM(finance_note_input)
    WHERE id = transfer_id_input;
    INSERT INTO public.payment_verification_logs(
      organization_id, payment_transfer_id, action, amount_snapshot,
      schedule_verified_amount_snapshot, schedule_status_snapshot, note, actor_user_id
    ) VALUES (
      transfer_record.organization_id, transfer_id_input, 'REJECTED', transfer_record.amount,
      schedule_record.verified_amount, schedule_record.status, BTRIM(finance_note_input), (SELECT auth.uid())
    );
    PERFORM public.write_audit_event(
      transfer_record.organization_id, 'payment_transfer', transfer_id_input,
      'REJECTED', NULL, jsonb_build_object('note', BTRIM(finance_note_input))
    );
    RETURN transfer_id_input;
  END IF;

  UPDATE public.payment_transfers
  SET status = 'VERIFIED', finance_verified_by = (SELECT auth.uid()),
      finance_verified_at = NOW(), finance_note = NULLIF(BTRIM(finance_note_input), '')
  WHERE id = transfer_id_input;
  SELECT COALESCE(ROUND(SUM(amount), 2), 0) INTO verified_total
  FROM public.payment_transfers
  WHERE payment_schedule_id = schedule_record.id AND status = 'VERIFIED';
  new_schedule_status := CASE
    WHEN verified_total > schedule_record.due_amount THEN 'OVERPAYMENT_REVIEW'
    WHEN verified_total = schedule_record.due_amount THEN 'VERIFIED'
    WHEN verified_total > 0 THEN 'PARTIALLY_VERIFIED' ELSE 'PENDING' END;
  UPDATE public.payment_schedules
  SET verified_amount = verified_total, status = new_schedule_status,
      verified_at = CASE WHEN new_schedule_status = 'VERIFIED' THEN NOW() ELSE NULL END
  WHERE id = schedule_record.id;

  IF schedule_record.schedule_type = 'DEPOSIT' THEN
    UPDATE public.customer_orders
    SET deposit_verified_at = CASE WHEN new_schedule_status = 'VERIFIED' THEN NOW() ELSE NULL END,
        status = CASE
          WHEN new_schedule_status = 'VERIFIED' AND status = 'PENDING_DEPOSIT' THEN 'DEPOSIT_VERIFIED'
          WHEN new_schedule_status <> 'VERIFIED' AND status = 'DEPOSIT_VERIFIED' THEN 'PENDING_DEPOSIT'
          ELSE status END
    WHERE id = schedule_record.order_id;
  ELSIF schedule_record.schedule_type = 'BALANCE' THEN
    UPDATE public.customer_orders
    SET balance_verified_at = CASE WHEN new_schedule_status = 'VERIFIED' THEN NOW() ELSE NULL END
    WHERE id = schedule_record.order_id;
  END IF;

  INSERT INTO public.payment_verification_logs(
    organization_id, payment_transfer_id, action, amount_snapshot,
    schedule_verified_amount_snapshot, schedule_status_snapshot, note, actor_user_id
  ) VALUES (
    transfer_record.organization_id, transfer_id_input, 'VERIFIED', transfer_record.amount,
    verified_total, new_schedule_status, NULLIF(BTRIM(finance_note_input), ''), (SELECT auth.uid())
  );
  PERFORM public.write_audit_event(
    transfer_record.organization_id, 'payment_transfer', transfer_id_input, 'VERIFIED', NULL,
    jsonb_build_object('amount', transfer_record.amount,
      'schedule_verified_amount', verified_total, 'schedule_status', new_schedule_status)
  );
  RETURN transfer_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_supplier_orders(order_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  order_record public.customer_orders%ROWTYPE;
  supplier_order_record RECORD;
  po_number_value TEXT;
BEGIN
  IF NOT public.has_permission('orders.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = order_id_input FOR UPDATE;
  IF NOT FOUND OR order_record.status <> 'DEPOSIT_VERIFIED' THEN
    RAISE EXCEPTION 'ORDER_NOT_READY_FOR_PO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.payment_schedules
    WHERE order_id = order_id_input AND schedule_type = 'DEPOSIT'
      AND status = 'VERIFIED' AND verified_amount = due_amount
  ) THEN RAISE EXCEPTION 'DEPOSIT_MUST_BE_FULLY_VERIFIED'; END IF;

  FOR supplier_order_record IN
    SELECT * FROM public.supplier_orders
    WHERE customer_order_id = order_id_input AND status = 'DRAFT'
    FOR UPDATE
  LOOP
    po_number_value := public.next_document_number('PO');
    UPDATE public.supplier_orders
    SET status = 'PO_ISSUED', po_number = po_number_value, po_issued_at = NOW()
    WHERE id = supplier_order_record.id;
    INSERT INTO public.purchase_orders(
      organization_id, supplier_order_id, purchase_order_number, supplier_id,
      currency, total_amount, issued_by
    ) VALUES (
      supplier_order_record.organization_id, supplier_order_record.id, po_number_value,
      supplier_order_record.supplier_id, supplier_order_record.supplier_currency,
      supplier_order_record.total_factory_cost, (SELECT auth.uid())
    );
  END LOOP;
  UPDATE public.customer_orders SET status = 'PO_ISSUED' WHERE id = order_id_input;
  INSERT INTO public.status_events(
    organization_id, entity_type, entity_id, from_status, to_status,
    actor_user_id, reason, is_member_visible
  ) VALUES (
    order_record.organization_id, 'customer_order', order_id_input,
    order_record.status, 'PO_ISSUED', (SELECT auth.uid()), 'PURCHASE_ORDERS_ISSUED', TRUE
  );
  PERFORM public.write_audit_event(
    order_record.organization_id, 'customer_order', order_id_input, 'PO_ISSUED'
  );
  RETURN order_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_supplier_payment(
  supplier_order_id_input UUID,
  payment_type_input TEXT,
  amount_input NUMERIC,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  supplier_order_record public.supplier_orders%ROWTYPE;
  schedule_record public.supplier_payment_schedules%ROWTYPE;
  reserved_amount NUMERIC(18,2);
  payment_id_value UUID;
  requested_type TEXT;
BEGIN
  IF NOT public.has_permission('supplier_payments.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF payment_type_input NOT IN ('DEPOSIT', 'BALANCE', 'PARTIAL')
    OR amount_input IS NULL OR amount_input <= 0 THEN
    RAISE EXCEPTION 'INVALID_SUPPLIER_PAYMENT';
  END IF;
  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = supplier_order_id_input FOR UPDATE;
  IF NOT FOUND OR supplier_order_record.status IN ('DRAFT', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUPPLIER_ORDER_NOT_PAYABLE';
  END IF;
  requested_type := CASE WHEN payment_type_input = 'PARTIAL' THEN
    CASE WHEN EXISTS (
      SELECT 1 FROM public.supplier_payment_schedules
      WHERE supplier_order_id = supplier_order_id_input AND schedule_type = 'DEPOSIT'
        AND status NOT IN ('PAID', 'CANCELLED')
    ) THEN 'DEPOSIT' ELSE 'BALANCE' END
    ELSE payment_type_input END;
  SELECT * INTO schedule_record FROM public.supplier_payment_schedules
  WHERE supplier_order_id = supplier_order_id_input AND schedule_type = requested_type
  FOR UPDATE;
  IF NOT FOUND OR schedule_record.status IN ('PAID', 'OVERPAYMENT_REVIEW', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO reserved_amount
  FROM public.supplier_payments
  WHERE payment_schedule_id = schedule_record.id AND status IN ('REQUESTED', 'APPROVED', 'PAID');
  IF ROUND(reserved_amount + amount_input, 2) > schedule_record.due_amount THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_EXCEEDS_OUTSTANDING';
  END IF;
  INSERT INTO public.supplier_payments(
    supplier_order_id, payment_schedule_id, payment_reference, payment_type,
    amount, currency, requested_by, note
  ) VALUES (
    supplier_order_id_input, schedule_record.id, public.next_document_number('PAY'),
    requested_type, ROUND(amount_input, 2), supplier_order_record.supplier_currency,
    (SELECT auth.uid()), NULLIF(BTRIM(note_input), '')
  ) RETURNING id INTO payment_id_value;
  INSERT INTO public.supplier_payment_history(
    organization_id, supplier_payment_id, action, amount_snapshot, note, actor_user_id
  ) VALUES (
    supplier_order_record.organization_id, payment_id_value, 'REQUESTED',
    ROUND(amount_input, 2), NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
  );
  RETURN payment_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_supplier_payment(
  supplier_payment_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  payment_record public.supplier_payments%ROWTYPE;
  supplier_order_record public.supplier_orders%ROWTYPE;
  target_status TEXT;
BEGIN
  IF NOT public.has_permission('supplier_payments.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO payment_record FROM public.supplier_payments
  WHERE id = supplier_payment_id_input FOR UPDATE;
  IF NOT FOUND OR payment_record.status <> 'REQUESTED' THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_NOT_REVIEWABLE';
  END IF;
  IF NOT approve_input AND NULLIF(BTRIM(decision_note_input), '') IS NULL THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;
  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = payment_record.supplier_order_id;
  target_status := CASE WHEN approve_input THEN 'APPROVED' ELSE 'REJECTED' END;
  UPDATE public.supplier_payments
  SET status = target_status, approved_by = (SELECT auth.uid()), reviewed_at = NOW(),
      rejection_reason = CASE WHEN approve_input THEN NULL ELSE BTRIM(decision_note_input) END,
      note = COALESCE(NULLIF(BTRIM(decision_note_input), ''), note)
  WHERE id = supplier_payment_id_input;
  INSERT INTO public.supplier_payment_history(
    organization_id, supplier_payment_id, action, amount_snapshot, note, actor_user_id
  ) VALUES (
    supplier_order_record.organization_id, supplier_payment_id_input, target_status,
    payment_record.amount, NULLIF(BTRIM(decision_note_input), ''), (SELECT auth.uid())
  );
  RETURN supplier_payment_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_supplier_payment_paid(
  supplier_payment_id_input UUID,
  evidence_file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  payment_record public.supplier_payments%ROWTYPE;
  supplier_order_record public.supplier_orders%ROWTYPE;
  schedule_record public.supplier_payment_schedules%ROWTYPE;
  schedule_paid_total NUMERIC(18,2);
  order_paid_total NUMERIC(18,2);
  schedule_status_value TEXT;
BEGIN
  IF NOT public.has_permission('supplier_payments.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO payment_record FROM public.supplier_payments
  WHERE id = supplier_payment_id_input FOR UPDATE;
  IF NOT FOUND OR payment_record.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_MUST_BE_APPROVED';
  END IF;
  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = payment_record.supplier_order_id FOR UPDATE;
  SELECT * INTO schedule_record FROM public.supplier_payment_schedules
  WHERE id = payment_record.payment_schedule_id FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.file_metadata fm
    WHERE fm.id = evidence_file_id_input
      AND fm.organization_id = supplier_order_record.organization_id
      AND fm.visibility = 'CONFIDENTIAL'
  ) THEN RAISE EXCEPTION 'CONFIDENTIAL_PAYMENT_EVIDENCE_REQUIRED'; END IF;

  UPDATE public.supplier_payments
  SET status = 'PAID', evidence_file_id = evidence_file_id_input,
      paid_by = (SELECT auth.uid()), paid_at = NOW()
  WHERE id = supplier_payment_id_input;
  SELECT COALESCE(ROUND(SUM(amount), 2), 0) INTO schedule_paid_total
  FROM public.supplier_payments
  WHERE payment_schedule_id = schedule_record.id AND status = 'PAID';
  schedule_status_value := CASE
    WHEN schedule_paid_total > schedule_record.due_amount THEN 'OVERPAYMENT_REVIEW'
    WHEN schedule_paid_total = schedule_record.due_amount THEN 'PAID'
    WHEN schedule_paid_total > 0 THEN 'PARTIALLY_PAID' ELSE 'PENDING' END;
  UPDATE public.supplier_payment_schedules
  SET paid_amount = schedule_paid_total, status = schedule_status_value,
      paid_at = CASE WHEN schedule_status_value = 'PAID' THEN NOW() ELSE NULL END
  WHERE id = schedule_record.id;
  SELECT COALESCE(ROUND(SUM(amount), 2), 0) INTO order_paid_total
  FROM public.supplier_payments
  WHERE supplier_order_id = supplier_order_record.id AND status = 'PAID';
  UPDATE public.supplier_orders
  SET paid_factory_amount = order_paid_total,
      supplier_balance_paid_at = CASE WHEN order_paid_total = total_factory_cost THEN NOW() ELSE NULL END
  WHERE id = supplier_order_record.id;
  INSERT INTO public.supplier_payment_history(
    organization_id, supplier_payment_id, action, amount_snapshot, note, actor_user_id
  ) VALUES (
    supplier_order_record.organization_id, supplier_payment_id_input, 'PAID',
    payment_record.amount, NULL, (SELECT auth.uid())
  );
  PERFORM public.write_audit_event(
    supplier_order_record.organization_id, 'supplier_payment', supplier_payment_id_input,
    'PAID', NULL, jsonb_build_object('schedule_paid_total', schedule_paid_total,
      'schedule_status', schedule_status_value, 'supplier_order_paid_total', order_paid_total)
  );
  RETURN supplier_payment_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_order_cancellation(
  order_id_input UUID,
  reason_input TEXT,
  supporting_file_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  order_record public.customer_orders%ROWTYPE;
  request_id_value UUID;
  deposit_verified_value NUMERIC(18,2);
  immediate_cancel BOOLEAN;
BEGIN
  IF NULLIF(BTRIM(reason_input), '') IS NULL THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED'; END IF;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = order_id_input AND member_profile_id = public.current_member_profile_id()
  FOR UPDATE;
  IF NOT FOUND OR order_record.status IN ('CANCELLED', 'COMPLETED') THEN
    RAISE EXCEPTION 'ORDER_NOT_CANCELLABLE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.cancellation_requests
    WHERE order_id = order_id_input AND status = 'SUBMITTED'
  ) THEN RAISE EXCEPTION 'CANCELLATION_ALREADY_SUBMITTED'; END IF;
  IF supporting_file_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.file_metadata
    WHERE id = supporting_file_id_input
      AND member_profile_id = order_record.member_profile_id
      AND visibility = 'MEMBER_PRIVATE'
  ) THEN RAISE EXCEPTION 'INVALID_SUPPORTING_FILE'; END IF;
  SELECT COALESCE(SUM(verified_amount), 0) INTO deposit_verified_value
  FROM public.payment_schedules
  WHERE order_id = order_id_input AND schedule_type = 'DEPOSIT';
  immediate_cancel := deposit_verified_value = 0
    AND NOT EXISTS (SELECT 1 FROM public.purchase_orders WHERE supplier_order_id IN (
      SELECT id FROM public.supplier_orders WHERE customer_order_id = order_id_input
    ) AND status = 'ISSUED');

  INSERT INTO public.cancellation_requests(
    organization_id, order_id, member_profile_id, status, previous_order_status,
    reason, supporting_file_id, deposit_verified_amount_snapshot, requested_by,
    decided_by, decided_at, decision_note
  ) VALUES (
    order_record.organization_id, order_id_input, order_record.member_profile_id,
    CASE WHEN immediate_cancel THEN 'APPROVED' ELSE 'SUBMITTED' END,
    order_record.status, BTRIM(reason_input), supporting_file_id_input,
    deposit_verified_value, (SELECT auth.uid()),
    CASE WHEN immediate_cancel THEN (SELECT auth.uid()) ELSE NULL END,
    CASE WHEN immediate_cancel THEN NOW() ELSE NULL END,
    CASE WHEN immediate_cancel THEN 'AUTO_APPROVED_BEFORE_DEPOSIT' ELSE NULL END
  ) RETURNING id INTO request_id_value;

  IF immediate_cancel THEN
    UPDATE public.project_items pi
    SET ordered_quantity = GREATEST(0, pi.ordered_quantity - oi.quantity),
        status = CASE
          WHEN GREATEST(0, pi.ordered_quantity - oi.quantity) = 0 THEN 'READY_TO_ORDER'
          ELSE 'PARTIALLY_ORDERED' END
    FROM public.order_items oi
    WHERE oi.order_id = order_id_input AND pi.id = oi.project_item_id;
    UPDATE public.payment_schedules SET status = 'CANCELLED' WHERE order_id = order_id_input;
    UPDATE public.supplier_payment_schedules SET status = 'CANCELLED'
    WHERE supplier_order_id IN (SELECT id FROM public.supplier_orders WHERE customer_order_id = order_id_input);
    UPDATE public.supplier_orders SET status = 'CANCELLED' WHERE customer_order_id = order_id_input;
    UPDATE public.customer_orders
    SET status = 'CANCELLED', cancelled_at = NOW(), cancellation_reason = BTRIM(reason_input)
    WHERE id = order_id_input;
  ELSE
    UPDATE public.customer_orders SET status = 'CANCELLATION_REQUESTED' WHERE id = order_id_input;
  END IF;
  INSERT INTO public.status_events(
    organization_id, entity_type, entity_id, from_status, to_status,
    actor_user_id, reason, is_member_visible
  ) VALUES (
    order_record.organization_id, 'customer_order', order_id_input, order_record.status,
    CASE WHEN immediate_cancel THEN 'CANCELLED' ELSE 'CANCELLATION_REQUESTED' END,
    (SELECT auth.uid()), BTRIM(reason_input), TRUE
  );
  PERFORM public.write_audit_event(
    order_record.organization_id, 'cancellation_request', request_id_value,
    CASE WHEN immediate_cancel THEN 'AUTO_APPROVED' ELSE 'SUBMITTED' END,
    NULL, jsonb_build_object('order_id', order_id_input,
      'deposit_verified_amount', deposit_verified_value, 'reason', BTRIM(reason_input))
  );
  RETURN request_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_order_cancellation(
  cancellation_request_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT,
  approved_refund_amount_input NUMERIC DEFAULT 0,
  approved_deduction_amount_input NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.cancellation_requests%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  target_status TEXT;
BEGIN
  IF NOT public.has_permission('orders.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(decision_note_input), '') IS NULL THEN RAISE EXCEPTION 'DECISION_NOTE_REQUIRED'; END IF;
  IF COALESCE(approved_refund_amount_input, 0) < 0 OR COALESCE(approved_deduction_amount_input, 0) < 0 THEN
    RAISE EXCEPTION 'INVALID_CANCELLATION_AMOUNT';
  END IF;
  SELECT * INTO request_record FROM public.cancellation_requests
  WHERE id = cancellation_request_id_input FOR UPDATE;
  IF NOT FOUND OR request_record.status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'CANCELLATION_NOT_REVIEWABLE';
  END IF;
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = request_record.order_id FOR UPDATE;
  target_status := CASE WHEN approve_input THEN 'APPROVED' ELSE 'REJECTED' END;
  UPDATE public.cancellation_requests
  SET status = target_status, decided_by = (SELECT auth.uid()), decided_at = NOW(),
      decision_note = BTRIM(decision_note_input),
      approved_refund_amount = ROUND(COALESCE(approved_refund_amount_input, 0), 2),
      approved_deduction_amount = ROUND(COALESCE(approved_deduction_amount_input, 0), 2)
  WHERE id = cancellation_request_id_input;

  IF approve_input THEN
    UPDATE public.project_items pi
    SET ordered_quantity = GREATEST(0, pi.ordered_quantity - oi.quantity),
        status = CASE
          WHEN GREATEST(0, pi.ordered_quantity - oi.quantity) = 0 THEN 'READY_TO_ORDER'
          ELSE 'PARTIALLY_ORDERED' END
    FROM public.order_items oi
    WHERE oi.order_id = order_record.id AND pi.id = oi.project_item_id;
    UPDATE public.payment_schedules SET status = 'CANCELLED' WHERE order_id = order_record.id;
    UPDATE public.supplier_payment_schedules SET status = 'CANCELLED'
    WHERE supplier_order_id IN (SELECT id FROM public.supplier_orders WHERE customer_order_id = order_record.id);
    UPDATE public.purchase_orders SET status = 'CANCELLED', cancelled_at = NOW()
    WHERE supplier_order_id IN (SELECT id FROM public.supplier_orders WHERE customer_order_id = order_record.id)
      AND status = 'ISSUED';
    UPDATE public.supplier_orders SET status = 'CANCELLED' WHERE customer_order_id = order_record.id;
    UPDATE public.customer_orders
    SET status = 'CANCELLED', cancelled_at = NOW(), cancellation_reason = request_record.reason
    WHERE id = order_record.id;
  ELSE
    UPDATE public.customer_orders SET status = request_record.previous_order_status WHERE id = order_record.id;
  END IF;
  INSERT INTO public.status_events(
    organization_id, entity_type, entity_id, from_status, to_status,
    actor_user_id, reason, is_member_visible
  ) VALUES (
    order_record.organization_id, 'customer_order', order_record.id,
    'CANCELLATION_REQUESTED', CASE WHEN approve_input THEN 'CANCELLED' ELSE request_record.previous_order_status END,
    (SELECT auth.uid()), BTRIM(decision_note_input), TRUE
  );
  PERFORM public.write_audit_event(
    request_record.organization_id, 'cancellation_request', request_record.id, target_status,
    NULL, jsonb_build_object('decision_note', BTRIM(decision_note_input),
      'approved_refund_amount', ROUND(COALESCE(approved_refund_amount_input, 0), 2),
      'approved_deduction_amount', ROUND(COALESCE(approved_deduction_amount_input, 0), 2),
      'refund_is_automatic', FALSE)
  );
  RETURN request_record.id;
END;
$$;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_payment_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_verification_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_payment_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_orders_profile ON public.customer_orders;

DROP POLICY IF EXISTS customer_orders_internal ON public.customer_orders;

DROP POLICY IF EXISTS customer_orders_org ON public.customer_orders;

CREATE POLICY customer_orders_slice6_select ON public.customer_orders
FOR SELECT TO authenticated USING (
  member_profile_id = public.current_member_profile_id()
  OR public.has_permission('orders.manage', organization_id)
  OR public.has_permission('payments.verify', organization_id)
);

DROP POLICY IF EXISTS order_items_org ON public.order_items;

CREATE POLICY order_items_slice6_select ON public.order_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.customer_orders co
    WHERE co.id = order_id AND (
      co.member_profile_id = public.current_member_profile_id()
      OR public.has_permission('orders.manage', co.organization_id)
      OR public.has_permission('payments.verify', co.organization_id)
    )
  )
);

DROP POLICY IF EXISTS payment_schedules_org ON public.payment_schedules;

DROP POLICY IF EXISTS payment_schedules_finance ON public.payment_schedules;

CREATE POLICY payment_schedules_slice6_select ON public.payment_schedules
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.customer_orders co
    WHERE co.id = order_id AND (
      co.member_profile_id = public.current_member_profile_id()
      OR public.has_permission('orders.manage', co.organization_id)
      OR public.has_permission('payments.verify', co.organization_id)
    )
  )
);

DROP POLICY IF EXISTS payment_transfers_org ON public.payment_transfers;

DROP POLICY IF EXISTS payment_transfers_finance ON public.payment_transfers;

CREATE POLICY payment_transfers_slice6_select ON public.payment_transfers
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM public.payment_schedules ps
    JOIN public.customer_orders co ON co.id = ps.order_id
    WHERE ps.id = payment_schedule_id AND (
      co.member_profile_id = public.current_member_profile_id()
      OR public.has_permission('orders.manage', co.organization_id)
      OR public.has_permission('payments.verify', co.organization_id)
    )
  )
);

DROP POLICY IF EXISTS supplier_payments_internal ON public.supplier_payments;

CREATE POLICY supplier_payments_slice6_internal ON public.supplier_payments
FOR SELECT TO authenticated USING (public.has_permission('supplier_payments.manage'));

CREATE POLICY purchase_orders_slice6_internal ON public.purchase_orders
FOR SELECT TO authenticated USING (
  public.has_permission('orders.manage', organization_id)
  OR public.has_permission('supplier_payments.manage', organization_id)
);

CREATE POLICY supplier_payment_schedules_slice6_internal ON public.supplier_payment_schedules
FOR SELECT TO authenticated USING (public.has_permission('supplier_payments.manage', organization_id));

CREATE POLICY payment_verification_logs_slice6_internal ON public.payment_verification_logs
FOR SELECT TO authenticated USING (
  public.has_permission('payments.verify', organization_id)
  OR public.has_permission('orders.manage', organization_id)
);

CREATE POLICY supplier_payment_history_slice6_internal ON public.supplier_payment_history
FOR SELECT TO authenticated USING (public.has_permission('supplier_payments.manage', organization_id));

CREATE POLICY cancellation_requests_slice6_select ON public.cancellation_requests
FOR SELECT TO authenticated USING (
  member_profile_id = public.current_member_profile_id()
  OR public.has_permission('orders.manage', organization_id)
);

REVOKE ALL ON public.purchase_orders, public.supplier_payment_schedules,
  public.payment_verification_logs, public.supplier_payment_history,
  public.cancellation_requests FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.purchase_orders, public.supplier_payment_schedules,
  public.payment_verification_logs, public.supplier_payment_history,
  public.cancellation_requests TO authenticated;

REVOKE ALL ON FUNCTION public.review_supplier_payment(UUID, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.request_order_cancellation(UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.decide_order_cancellation(UUID, BOOLEAN, TEXT, NUMERIC, NUMERIC)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.review_supplier_payment(UUID, BOOLEAN, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.request_order_cancellation(UUID, TEXT, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.decide_order_cancellation(UUID, BOOLEAN, TEXT, NUMERIC, NUMERIC) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.current_member_owns_supplier_order(target_supplier_order_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_orders so
    JOIN public.customer_orders co ON co.id=so.customer_order_id
    WHERE so.id=target_supplier_order_id
      AND co.member_profile_id=public.current_member_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.current_member_owns_order_item(target_order_item_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.customer_orders co ON co.id=oi.order_id
    WHERE oi.id=target_order_item_id
      AND co.member_profile_id=public.current_member_profile_id()
  )
$$;

DROP POLICY IF EXISTS production_updates_visible ON public.production_updates;

CREATE POLICY production_updates_visible ON public.production_updates
FOR SELECT TO authenticated USING (
  public.has_permission('production.manage',organization_id)
  OR public.has_permission('qc.manage',organization_id)
  OR (is_member_visible AND public.current_member_owns_supplier_order(supplier_order_id))
);

DROP POLICY IF EXISTS qc_inspections_visible ON public.qc_inspections;

CREATE POLICY qc_inspections_visible ON public.qc_inspections
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR (is_member_visible AND public.current_member_owns_order_item(order_item_id))
);

DROP POLICY IF EXISTS production_update_files_visible ON public.production_update_files;

CREATE POLICY production_update_files_visible ON public.production_update_files
FOR SELECT TO authenticated USING (
  public.has_permission('production.manage',organization_id)
  OR public.has_permission('qc.manage',organization_id)
  OR EXISTS (
    SELECT 1 FROM public.production_updates pu
    WHERE pu.id=production_update_id AND pu.is_member_visible
      AND public.current_member_owns_supplier_order(pu.supplier_order_id)
  )
);

DROP POLICY IF EXISTS qc_checklist_items_visible ON public.qc_checklist_items;

CREATE POLICY qc_checklist_items_visible ON public.qc_checklist_items
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR EXISTS (
    SELECT 1 FROM public.qc_inspections qi
    WHERE qi.id=inspection_id AND qi.is_member_visible
      AND public.current_member_owns_order_item(qi.order_item_id)
  )
);

DROP POLICY IF EXISTS qc_inspection_files_visible ON public.qc_inspection_files;

CREATE POLICY qc_inspection_files_visible ON public.qc_inspection_files
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR EXISTS (
    SELECT 1 FROM public.qc_inspections qi
    WHERE qi.id=inspection_id AND qi.is_member_visible
      AND public.current_member_owns_order_item(qi.order_item_id)
  )
);

REVOKE ALL ON FUNCTION public.current_member_owns_supplier_order(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.current_member_owns_order_item(UUID) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.current_member_owns_supplier_order(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_member_owns_order_item(UUID) TO authenticated;

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

  FOR file_id_value IN SELECT value::UUID FROM jsonb_array_elements_text(file_ids_input)
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
  latest_progress_value NUMERIC(5,2) := 0;
  minimum_progress_value NUMERIC(5,2);
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
  minimum_progress_value := CASE status_input
    WHEN 'ACKNOWLEDGED' THEN 0 WHEN 'MATERIAL_PREPARATION' THEN 10
    WHEN 'IN_PRODUCTION' THEN 30 WHEN 'ASSEMBLY' THEN 60
    WHEN 'FINISHING' THEN 85 WHEN 'PRODUCTION_COMPLETED' THEN 100
    WHEN 'DELAYED' THEN 0 ELSE NULL END;
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

  SELECT COALESCE(progress_percent, 0) INTO latest_progress_value
  FROM public.production_updates
  WHERE supplier_order_id = supplier_order_id_input
  ORDER BY created_at DESC, id DESC LIMIT 1;
  IF NOT FOUND THEN latest_progress_value := 0; END IF;

  IF progress_percent_input IS NULL THEN
    progress_percent_input := CASE
      WHEN status_input = 'DELAYED' THEN latest_progress_value
      ELSE GREATEST(minimum_progress_value, latest_progress_value)
    END;
  END IF;
  IF progress_percent_input < minimum_progress_value THEN
    RAISE EXCEPTION 'progress percent is below the minimum for this production status';
  END IF;
  IF progress_percent_input < latest_progress_value THEN
    RAISE EXCEPTION 'production progress cannot decrease';
  END IF;
  IF status_input = 'DELAYED' AND progress_percent_input <> latest_progress_value THEN
    RAISE EXCEPTION 'delayed status must retain the latest production progress';
  END IF;
  IF status_input = 'PRODUCTION_COMPLETED' AND progress_percent_input <> 100 THEN
    RAISE EXCEPTION 'completed production progress must be 100 percent';
  END IF;
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

  FOR file_id_value IN SELECT value::UUID FROM jsonb_array_elements_text(file_ids_input)
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
  UPDATE public.customer_orders SET status = 'IN_PRODUCTION'
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

INSERT INTO public.permissions(code, name, description)
VALUES (
  'freight.manage',
  'Manage freight billing',
  'Finalize actual logistics charges and issue freight invoices'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'freight.manage'
WHERE r.code IN ('SUPER_ADMIN', 'FINANCE')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_member_owns_order(order_id_input UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_orders co
    WHERE co.id = order_id_input
      AND co.member_profile_id = public.current_member_profile_id()
  )
$$;

CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_code TEXT NOT NULL UNIQUE,
  warehouse_name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  address JSONB NOT NULL DEFAULT '{}'::JSONB,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.warehouse_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  supplier_order_id UUID NOT NULL REFERENCES public.supplier_orders(id) ON DELETE RESTRICT,
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  receipt_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'EXPECTED' CHECK (status IN (
    'EXPECTED', 'PARTIALLY_RECEIVED', 'RECEIVED_COMPLETE',
    'DISCREPANCY', 'DAMAGED', 'READY_FOR_CONSOLIDATION', 'CANCELLED'
  )),
  received_at TIMESTAMPTZ NOT NULL,
  package_count INTEGER NOT NULL DEFAULT 0 CHECK (package_count >= 0),
  actual_weight_kg NUMERIC(14,3) CHECK (actual_weight_kg IS NULL OR actual_weight_kg >= 0),
  actual_cbm NUMERIC(14,4) CHECK (actual_cbm IS NULL OR actual_cbm >= 0),
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.warehouse_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_receipt_id UUID NOT NULL REFERENCES public.warehouse_receipts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_order_item_id UUID NOT NULL REFERENCES public.supplier_order_items(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  expected_quantity NUMERIC(12,3) NOT NULL CHECK (expected_quantity > 0),
  received_quantity NUMERIC(12,3) NOT NULL CHECK (received_quantity > 0),
  released_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (released_quantity >= 0),
  blocked_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (blocked_quantity >= 0),
  condition TEXT NOT NULL DEFAULT 'GOOD'
    CHECK (condition IN ('GOOD', 'DAMAGED', 'MISSING', 'WRONG_ITEM', 'OTHER')),
  discrepancy_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_receipt_id, supplier_order_item_id),
  CHECK (received_quantity <= expected_quantity),
  CHECK (released_quantity + blocked_quantity <= received_quantity)
);

CREATE TABLE public.warehouse_receipt_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_receipt_id UUID NOT NULL REFERENCES public.warehouse_receipts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  file_purpose TEXT NOT NULL DEFAULT 'RECEIPT_EVIDENCE'
    CHECK (file_purpose IN ('RECEIPT_EVIDENCE', 'DAMAGE', 'DISCREPANCY', 'PACKING_LIST')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_receipt_id, file_id)
);

CREATE TABLE public.consolidation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  consolidation_number TEXT NOT NULL UNIQUE,
  strategy TEXT NOT NULL DEFAULT 'CONSOLIDATE_ALL'
    CHECK (strategy IN ('CONSOLIDATE_ALL', 'PARTIAL', 'DIRECT')),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'SHIPMENT_CREATED', 'CANCELLED')),
  revision_of_id UUID REFERENCES public.consolidation_groups(id) ON DELETE RESTRICT,
  reason TEXT,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.consolidation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_group_id UUID NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  warehouse_receipt_item_id UUID NOT NULL REFERENCES public.warehouse_receipt_items(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (consolidation_group_id, warehouse_receipt_item_id)
);

CREATE TABLE public.consolidation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_group_id UUID NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'CREATED', 'ITEM_ADDED', 'CONFIRMED', 'SHIPMENT_CREATED', 'CANCELLED'
  )),
  detail JSONB NOT NULL DEFAULT '{}'::JSONB,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shipments
  ADD COLUMN customer_order_id UUID REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  ADD COLUMN consolidation_group_id UUID REFERENCES public.consolidation_groups(id) ON DELETE RESTRICT,
  ADD COLUMN shipment_type TEXT NOT NULL DEFAULT 'CONSOLIDATED'
    CHECK (shipment_type IN ('CONSOLIDATED', 'PARTIAL', 'DIRECT')),
  ADD COLUMN shipping_method TEXT
    CHECK (shipping_method IS NULL OR shipping_method IN ('LCL', 'FCL', 'TRUCK', 'AIR', 'COURIER')),
  ADD COLUMN origin_warehouse_id UUID REFERENCES public.warehouses(id),
  ADD COLUMN destination_country_code CHAR(2) NOT NULL DEFAULT 'TH',
  ADD COLUMN destination_address_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN package_count INTEGER CHECK (package_count IS NULL OR package_count >= 0),
  ADD COLUMN actual_weight_kg NUMERIC(14,3) CHECK (actual_weight_kg IS NULL OR actual_weight_kg >= 0),
  ADD COLUMN actual_cbm NUMERIC(14,4) CHECK (actual_cbm IS NULL OR actual_cbm >= 0),
  ADD COLUMN container_number TEXT,
  ADD COLUMN bill_of_lading_number TEXT,
  ADD COLUMN etd_at TIMESTAMPTZ,
  ADD COLUMN original_eta_at TIMESTAMPTZ,
  ADD COLUMN actual_departure_at TIMESTAMPTZ,
  ADD COLUMN actual_arrival_at TIMESTAMPTZ,
  ADD COLUMN delay_reason TEXT,
  ADD COLUMN cancellation_reason TEXT,
  ADD CONSTRAINT shipments_etd_eta_check
    CHECK (etd_at IS NULL OR estimated_arrival_at IS NULL OR etd_at <= estimated_arrival_at);

ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_status_check;

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_status_check CHECK (status IN (
    'DRAFT', 'GATE_CHECKED', 'AWAITING_MEMBER_ACKNOWLEDGEMENT',
    'READY_TO_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
    'ARRIVED_THAILAND', 'IMPORT_CUSTOMS', 'THAILAND_WAREHOUSE',
    'READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED'
  ));

ALTER TABLE public.shipment_items
  ADD COLUMN supplier_order_item_id UUID REFERENCES public.supplier_order_items(id) ON DELETE RESTRICT,
  ADD COLUMN warehouse_receipt_item_id UUID REFERENCES public.warehouse_receipt_items(id) ON DELETE RESTRICT,
  ADD COLUMN package_count INTEGER CHECK (package_count IS NULL OR package_count >= 0),
  ADD COLUMN weight_kg NUMERIC(14,3) CHECK (weight_kg IS NULL OR weight_kg >= 0),
  ADD COLUMN cbm NUMERIC(14,4) CHECK (cbm IS NULL OR cbm >= 0);

CREATE TABLE public.partial_shipment_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL UNIQUE REFERENCES public.shipments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  remaining_plan TEXT NOT NULL,
  additional_member_charge NUMERIC(18,2) NOT NULL DEFAULT 0
    CHECK (additional_member_charge >= 0),
  charge_currency CHAR(3) NOT NULL DEFAULT 'THB',
  charge_bearer TEXT NOT NULL DEFAULT 'GISP'
    CHECK (charge_bearer IN ('GISP', 'MEMBER')),
  internal_approved_by UUID NOT NULL REFERENCES auth.users(id),
  internal_approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_acknowledgement_required BOOLEAN NOT NULL DEFAULT FALSE,
  member_acknowledged_at TIMESTAMPTZ,
  member_acknowledged_by UUID REFERENCES auth.users(id),
  member_response_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (additional_member_charge = 0)
    OR (charge_bearer = 'MEMBER' AND member_acknowledgement_required)
    OR (charge_bearer = 'GISP')
  )
);

CREATE TABLE public.partial_shipment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partial_shipment_decision_id UUID NOT NULL REFERENCES public.partial_shipment_decisions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  response TEXT NOT NULL CHECK (response IN ('ACKNOWLEDGED', 'QUESTIONED')),
  note TEXT,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.shipment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  status TEXT NOT NULL CHECK (status IN (
    'FACTORY_PICKUP_SCHEDULED', 'PICKED_UP_FROM_FACTORY',
    'ARRIVED_CHINA_WAREHOUSE', 'CONSOLIDATED', 'BOOKED',
    'EXPORT_CUSTOMS', 'DEPARTED_CHINA', 'IN_TRANSIT',
    'ARRIVED_THAILAND', 'IMPORT_CUSTOMS', 'THAILAND_WAREHOUSE',
    'READY_FOR_DELIVERY', 'DELAY', 'NOTE'
  )),
  location_text TEXT,
  event_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  is_delay BOOLEAN NOT NULL DEFAULT FALSE,
  eta_at TIMESTAMPTZ,
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.shipment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'TRACKING_EVIDENCE', 'BILL_OF_LADING', 'CUSTOMS_ENTRY',
    'PACKING_LIST', 'CARRIER_DOCUMENT', 'OTHER'
  )),
  is_member_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shipment_id, file_id)
);

ALTER TABLE public.deliveries
  ADD COLUMN customer_order_id UUID REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  ADD COLUMN delivery_address_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN scheduled_window_end_at TIMESTAMPTZ,
  ADD COLUMN contact_name TEXT,
  ADD COLUMN contact_phone TEXT,
  ADD COLUMN site_note TEXT,
  ADD COLUMN driver_name TEXT,
  ADD COLUMN driver_phone TEXT,
  ADD COLUMN vehicle_registration TEXT,
  ADD COLUMN member_confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN member_confirmed_at TIMESTAMPTZ,
  ADD COLUMN failure_reason TEXT,
  ADD COLUMN next_delivery_plan TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT deliveries_schedule_window_check
    CHECK (scheduled_window_end_at IS NULL OR scheduled_at IS NULL OR scheduled_at <= scheduled_window_end_at);

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_status_check;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_status_check CHECK (status IN (
    'PROPOSED', 'MEMBER_CONFIRMED', 'RESCHEDULE_REQUESTED', 'UNDER_REVIEW',
    'CONFIRMED', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED',
    'PARTIALLY_DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED', 'RESCHEDULE_REQUIRED'
  ));

ALTER TABLE public.delivery_items
  DROP CONSTRAINT IF EXISTS delivery_items_quantity_delivered_check;

ALTER TABLE public.delivery_items
  ADD COLUMN shipment_item_id UUID REFERENCES public.shipment_items(id) ON DELETE RESTRICT,
  ADD COLUMN expected_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
  ADD COLUMN issue_type TEXT CHECK (issue_type IS NULL OR issue_type IN (
    'DAMAGED', 'MISSING', 'WRONG_ITEM', 'QUALITY', 'OTHER'
  )),
  ADD COLUMN issue_description TEXT,
  ADD COLUMN remaining_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (remaining_quantity >= 0),
  ADD CONSTRAINT delivery_items_quantity_delivered_check CHECK (quantity_delivered >= 0),
  ADD CONSTRAINT delivery_items_expected_check CHECK (quantity_delivered <= expected_quantity);

CREATE TABLE public.delivery_appointment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'PROPOSED', 'MEMBER_CONFIRMED', 'RESCHEDULE_REQUESTED',
    'RESCHEDULE_ACCEPTED', 'RESCHEDULE_REJECTED', 'CONFIRMED',
    'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERY_RECORDED', 'FAILED'
  )),
  scheduled_at_snapshot TIMESTAMPTZ,
  scheduled_window_end_snapshot TIMESTAMPTZ,
  note TEXT,
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.delivery_reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'ACCEPTED', 'REJECTED')),
  preferred_dates JSONB NOT NULL,
  reason TEXT NOT NULL,
  requested_contact_name TEXT,
  requested_contact_phone TEXT,
  requested_site_note TEXT,
  requested_address JSONB,
  address_change_requested BOOLEAN NOT NULL DEFAULT FALSE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  accepted_scheduled_at TIMESTAMPTZ,
  accepted_window_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(preferred_dates) = 'array' AND jsonb_array_length(preferred_dates) > 0)
);

CREATE UNIQUE INDEX delivery_reschedule_open_uidx
  ON public.delivery_reschedule_requests(delivery_id)
  WHERE status = 'SUBMITTED';

CREATE TABLE public.delivery_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN (
    'PHOTO', 'SIGNATURE', 'RECIPIENT_CONFIRMATION', 'ISSUE', 'OTHER'
  )),
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (delivery_id, file_id)
);

CREATE TABLE public.logistics_cost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE RESTRICT,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN (
    'CHINA_DOMESTIC_TRANSPORT', 'WAREHOUSE', 'INSPECTION', 'CONSOLIDATION',
    'PACKING', 'INTERNATIONAL_FREIGHT', 'INSURANCE', 'CUSTOMS', 'TAX',
    'THAILAND_WAREHOUSE', 'THAILAND_DELIVERY', 'LIFTING', 'OTHER'
  )),
  description TEXT NOT NULL,
  supplier_cost NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (supplier_cost >= 0),
  supplier_currency CHAR(3) NOT NULL DEFAULT 'THB',
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
  member_charge NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (member_charge >= 0),
  member_currency CHAR(3) NOT NULL DEFAULT 'THB',
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'FINALIZED', 'INVOICED', 'CANCELLED')),
  adjustment_of_id UUID REFERENCES public.logistics_cost_items(id) ON DELETE RESTRICT,
  adjustment_reason TEXT,
  internal_note TEXT,
  member_visible_note TEXT,
  finalized_by UUID REFERENCES auth.users(id),
  finalized_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (adjustment_of_id IS NULL OR NULLIF(BTRIM(adjustment_reason), '') IS NOT NULL)
);

CREATE TABLE public.logistics_cost_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logistics_cost_item_id UUID NOT NULL REFERENCES public.logistics_cost_items(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (logistics_cost_item_id, file_id)
);

CREATE TABLE public.freight_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  customer_order_id UUID NOT NULL UNIQUE REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  payment_schedule_id UUID UNIQUE REFERENCES public.payment_schedules(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL UNIQUE,
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  subtotal NUMERIC(18,2) NOT NULL CHECK (subtotal >= 0),
  vat_rate_snapshot NUMERIC(5,2) NOT NULL DEFAULT 7.00
    CHECK (vat_rate_snapshot >= 0 AND vat_rate_snapshot <= 100),
  vat_amount NUMERIC(18,2) NOT NULL CHECK (vat_amount >= 0),
  grand_total NUMERIC(18,2) NOT NULL CHECK (grand_total >= 0),
  status TEXT NOT NULL DEFAULT 'ISSUED'
    CHECK (status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERPAYMENT_REVIEW', 'CANCELLED')),
  due_at TIMESTAMPTZ,
  issued_by UUID NOT NULL REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (grand_total = subtotal + vat_amount)
);

CREATE TABLE public.freight_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_invoice_id UUID NOT NULL REFERENCES public.freight_invoices(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  logistics_cost_item_id UUID NOT NULL UNIQUE REFERENCES public.logistics_cost_items(id) ON DELETE RESTRICT,
  category_snapshot TEXT NOT NULL,
  description_snapshot TEXT NOT NULL,
  amount_snapshot NUMERIC(18,2) NOT NULL CHECK (amount_snapshot >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX warehouses_status_idx ON public.warehouses(status, country_code);

CREATE INDEX warehouse_receipts_order_idx ON public.warehouse_receipts(customer_order_id, received_at DESC);

CREATE INDEX warehouse_receipts_supplier_idx ON public.warehouse_receipts(supplier_order_id, received_at DESC);

CREATE INDEX warehouse_receipt_items_order_idx ON public.warehouse_receipt_items(order_item_id);

CREATE INDEX consolidation_groups_order_idx ON public.consolidation_groups(customer_order_id, status);

CREATE INDEX consolidation_items_receipt_idx ON public.consolidation_items(warehouse_receipt_item_id);

CREATE INDEX shipments_order_idx ON public.shipments(customer_order_id, status, created_at DESC);

CREATE INDEX shipment_history_idx ON public.shipment_status_history(shipment_id, event_at, created_at);

CREATE INDEX deliveries_order_idx ON public.deliveries(customer_order_id, status, created_at DESC);

CREATE INDEX delivery_appointment_events_idx ON public.delivery_appointment_events(delivery_id, created_at);

CREATE INDEX delivery_evidence_idx ON public.delivery_evidence(delivery_id, created_at);

CREATE INDEX logistics_cost_order_idx ON public.logistics_cost_items(customer_order_id, status, created_at);

CREATE INDEX freight_invoice_order_idx ON public.freight_invoices(customer_order_id, status);

CREATE TRIGGER warehouses_updated_at BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER warehouse_receipts_updated_at BEFORE UPDATE ON public.warehouse_receipts
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER warehouse_receipt_items_updated_at BEFORE UPDATE ON public.warehouse_receipt_items
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER consolidation_groups_updated_at BEFORE UPDATE ON public.consolidation_groups
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER deliveries_updated_at BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER delivery_reschedule_requests_updated_at BEFORE UPDATE ON public.delivery_reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER logistics_cost_items_updated_at BEFORE UPDATE ON public.logistics_cost_items
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER freight_invoices_updated_at BEFORE UPDATE ON public.freight_invoices
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER consolidation_events_append_only
  BEFORE UPDATE OR DELETE ON public.consolidation_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

CREATE TRIGGER partial_shipment_responses_append_only
  BEFORE UPDATE OR DELETE ON public.partial_shipment_responses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

CREATE TRIGGER shipment_status_history_append_only
  BEFORE UPDATE OR DELETE ON public.shipment_status_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

CREATE TRIGGER delivery_appointment_events_append_only
  BEFORE UPDATE OR DELETE ON public.delivery_appointment_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.warehouse_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.warehouse_receipt_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.warehouse_receipt_files ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.consolidation_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.consolidation_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.consolidation_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.partial_shipment_decisions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.partial_shipment_responses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shipment_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.delivery_appointment_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.delivery_reschedule_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.delivery_evidence ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.logistics_cost_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.logistics_cost_evidence ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.freight_invoices ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.freight_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipments_org ON public.shipments;

DROP POLICY IF EXISTS shipment_items_org ON public.shipment_items;

DROP POLICY IF EXISTS deliveries_org ON public.deliveries;

DROP POLICY IF EXISTS delivery_items_org ON public.delivery_items;

CREATE POLICY warehouses_internal_select ON public.warehouses
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage') OR public.has_permission('freight.manage')
);

CREATE POLICY warehouse_receipts_internal_select ON public.warehouse_receipts
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));

CREATE POLICY warehouse_receipt_items_internal_select ON public.warehouse_receipt_items
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));

CREATE POLICY warehouse_receipt_files_internal_select ON public.warehouse_receipt_files
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));

CREATE POLICY consolidation_groups_internal_select ON public.consolidation_groups
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));

CREATE POLICY consolidation_items_internal_select ON public.consolidation_items
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));

CREATE POLICY consolidation_events_internal_select ON public.consolidation_events
FOR SELECT TO authenticated USING (public.has_permission('shipments.manage', organization_id));

CREATE POLICY shipments_visible ON public.shipments
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR public.has_permission('deliveries.manage', organization_id)
  OR (customer_order_id IS NOT NULL AND public.current_member_owns_order(customer_order_id))
);

CREATE POLICY shipment_items_visible ON public.shipment_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = shipment_id
      AND (
        public.has_permission('shipments.manage', s.organization_id)
        OR public.has_permission('deliveries.manage', s.organization_id)
        OR public.current_member_owns_order(s.customer_order_id)
      )
  )
);

CREATE POLICY partial_shipment_decisions_visible ON public.partial_shipment_decisions
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR public.current_member_owns_order(customer_order_id)
);

CREATE POLICY partial_shipment_responses_visible ON public.partial_shipment_responses
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR EXISTS (
    SELECT 1 FROM public.partial_shipment_decisions psd
    WHERE psd.id = partial_shipment_decision_id
      AND public.current_member_owns_order(psd.customer_order_id)
  )
);

CREATE POLICY shipment_history_visible ON public.shipment_status_history
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR public.has_permission('deliveries.manage', organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = shipment_id AND public.current_member_owns_order(s.customer_order_id)
  ))
);

CREATE POLICY shipment_documents_visible ON public.shipment_documents
FOR SELECT TO authenticated USING (
  public.has_permission('shipments.manage', organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = shipment_id AND public.current_member_owns_order(s.customer_order_id)
  ))
);

CREATE POLICY deliveries_visible ON public.deliveries
FOR SELECT TO authenticated USING (
  public.has_permission('deliveries.manage', organization_id)
  OR public.has_permission('shipments.manage', organization_id)
  OR (customer_order_id IS NOT NULL AND public.current_member_owns_order(customer_order_id))
);

CREATE POLICY delivery_items_visible ON public.delivery_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_id
      AND (
        public.has_permission('deliveries.manage', d.organization_id)
        OR public.has_permission('shipments.manage', d.organization_id)
        OR public.current_member_owns_order(d.customer_order_id)
      )
  )
);

CREATE POLICY delivery_appointment_events_visible ON public.delivery_appointment_events
FOR SELECT TO authenticated USING (
  public.has_permission('deliveries.manage', organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_id AND public.current_member_owns_order(d.customer_order_id)
  ))
);

CREATE POLICY delivery_reschedule_requests_visible ON public.delivery_reschedule_requests
FOR SELECT TO authenticated USING (
  public.has_permission('deliveries.manage', organization_id)
  OR public.current_member_owns_order(customer_order_id)
);

CREATE POLICY delivery_evidence_visible ON public.delivery_evidence
FOR SELECT TO authenticated USING (
  public.has_permission('deliveries.manage', organization_id)
  OR (is_member_visible AND EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_id AND public.current_member_owns_order(d.customer_order_id)
  ))
);

CREATE POLICY logistics_cost_items_internal_select ON public.logistics_cost_items
FOR SELECT TO authenticated USING (
  public.has_permission('freight.manage', organization_id)
  OR public.has_permission('shipments.manage', organization_id)
);

CREATE POLICY logistics_cost_evidence_internal_select ON public.logistics_cost_evidence
FOR SELECT TO authenticated USING (
  public.has_permission('freight.manage', organization_id)
  OR public.has_permission('shipments.manage', organization_id)
);

CREATE POLICY freight_invoices_visible ON public.freight_invoices
FOR SELECT TO authenticated USING (
  public.has_permission('freight.manage', organization_id)
  OR public.has_permission('payments.verify', organization_id)
  OR public.current_member_owns_order(customer_order_id)
);

CREATE POLICY freight_invoice_items_visible ON public.freight_invoice_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.freight_invoices fi
    WHERE fi.id = freight_invoice_id
      AND (
        public.has_permission('freight.manage', fi.organization_id)
        OR public.has_permission('payments.verify', fi.organization_id)
        OR public.current_member_owns_order(fi.customer_order_id)
      )
  )
);

REVOKE ALL ON public.warehouses, public.warehouse_receipts,
  public.warehouse_receipt_items, public.warehouse_receipt_files,
  public.consolidation_groups, public.consolidation_items, public.consolidation_events,
  public.partial_shipment_decisions, public.partial_shipment_responses,
  public.shipment_status_history, public.shipment_documents,
  public.delivery_appointment_events, public.delivery_reschedule_requests,
  public.delivery_evidence, public.logistics_cost_items, public.logistics_cost_evidence,
  public.freight_invoices, public.freight_invoice_items FROM anon, authenticated;

GRANT SELECT ON public.warehouses, public.warehouse_receipts,
  public.warehouse_receipt_items, public.warehouse_receipt_files,
  public.consolidation_groups, public.consolidation_items, public.consolidation_events,
  public.partial_shipment_decisions, public.partial_shipment_responses,
  public.shipment_status_history, public.shipment_documents,
  public.delivery_appointment_events, public.delivery_reschedule_requests,
  public.delivery_evidence, public.logistics_cost_items, public.logistics_cost_evidence,
  public.freight_invoices, public.freight_invoice_items TO authenticated;

REVOKE ALL ON FUNCTION public.current_member_owns_order(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_member_owns_order(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_warehouse_receipt(
  supplier_order_id_input UUID,
  warehouse_id_input UUID,
  received_at_input TIMESTAMPTZ,
  package_count_input INTEGER,
  actual_weight_kg_input NUMERIC,
  actual_cbm_input NUMERIC,
  note_input TEXT,
  items_input JSONB,
  evidence_file_ids_input UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  so_record public.supplier_orders%ROWTYPE;
  item_input RECORD;
  soi_record public.supplier_order_items%ROWTYPE;
  receipt_id_value UUID;
  receipt_status_value TEXT := 'PARTIALLY_RECEIVED';
  previously_received NUMERIC(12,3);
  has_discrepancy BOOLEAN := FALSE;
  has_damage BOOLEAN := FALSE;
BEGIN
  SELECT * INTO so_record FROM public.supplier_orders
  WHERE id = supplier_order_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', so_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF received_at_input IS NULL OR package_count_input IS NULL OR package_count_input < 0
    OR jsonb_typeof(items_input) <> 'array' OR jsonb_array_length(items_input) = 0 THEN
    RAISE EXCEPTION 'INVALID_WAREHOUSE_RECEIPT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = warehouse_id_input AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'WAREHOUSE_NOT_ACTIVE';
  END IF;

  FOR item_input IN SELECT * FROM jsonb_to_recordset(items_input)
    AS x(supplier_order_item_id UUID, received_quantity NUMERIC, condition TEXT,
         blocked_quantity NUMERIC, discrepancy_note TEXT)
  LOOP
    SELECT * INTO soi_record FROM public.supplier_order_items
    WHERE id = item_input.supplier_order_item_id
      AND supplier_order_id = supplier_order_id_input FOR UPDATE;
    IF NOT FOUND OR item_input.received_quantity IS NULL OR item_input.received_quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_WAREHOUSE_RECEIPT_ITEM';
    END IF;
    SELECT COALESCE(SUM(wri.received_quantity), 0) INTO previously_received
    FROM public.warehouse_receipt_items wri
    JOIN public.warehouse_receipts wr ON wr.id = wri.warehouse_receipt_id
    WHERE wri.supplier_order_item_id = soi_record.id AND wr.status <> 'CANCELLED';
    IF previously_received + item_input.received_quantity > soi_record.quantity THEN
      RAISE EXCEPTION 'WAREHOUSE_RECEIPT_EXCEEDS_EXPECTED';
    END IF;
    IF COALESCE(item_input.blocked_quantity, 0) < 0
      OR COALESCE(item_input.blocked_quantity, 0) > item_input.received_quantity THEN
      RAISE EXCEPTION 'INVALID_BLOCKED_QUANTITY';
    END IF;
    IF COALESCE(item_input.condition, 'GOOD') <> 'GOOD' THEN has_damage := TRUE; END IF;
    IF previously_received + item_input.received_quantity <> soi_record.quantity
      OR COALESCE(item_input.blocked_quantity, 0) > 0 THEN has_discrepancy := TRUE; END IF;
    IF (COALESCE(item_input.condition, 'GOOD') <> 'GOOD'
        OR COALESCE(item_input.blocked_quantity, 0) > 0)
      AND (NULLIF(BTRIM(COALESCE(item_input.discrepancy_note, note_input)), '') IS NULL
        OR COALESCE(array_length(evidence_file_ids_input, 1), 0) = 0) THEN
      RAISE EXCEPTION 'DISCREPANCY_NOTE_AND_EVIDENCE_REQUIRED';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(evidence_file_ids_input, ARRAY[]::UUID[])) f(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.file_metadata fm
      WHERE fm.id = f.id AND fm.organization_id = so_record.organization_id
        AND fm.visibility = 'CONFIDENTIAL'
    )
  ) THEN RAISE EXCEPTION 'INVALID_WAREHOUSE_EVIDENCE'; END IF;

  IF has_damage THEN receipt_status_value := 'DAMAGED';
  ELSIF has_discrepancy THEN receipt_status_value := 'DISCREPANCY'; END IF;

  INSERT INTO public.warehouse_receipts(
    organization_id, warehouse_id, supplier_order_id, customer_order_id,
    receipt_number, status, received_at, package_count, actual_weight_kg,
    actual_cbm, note, created_by
  ) VALUES (
    so_record.organization_id, warehouse_id_input, so_record.id, so_record.customer_order_id,
    public.next_record_reference('WRC'), receipt_status_value, received_at_input,
    package_count_input, actual_weight_kg_input, actual_cbm_input,
    NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO receipt_id_value;

  INSERT INTO public.warehouse_receipt_items(
    warehouse_receipt_id, organization_id, supplier_order_item_id, order_item_id,
    expected_quantity, received_quantity, blocked_quantity, condition, discrepancy_note
  )
  SELECT receipt_id_value, so_record.organization_id, soi.id, soi.order_item_id,
    soi.quantity, x.received_quantity, COALESCE(x.blocked_quantity, 0),
    COALESCE(x.condition, 'GOOD'), NULLIF(BTRIM(x.discrepancy_note), '')
  FROM jsonb_to_recordset(items_input)
    AS x(supplier_order_item_id UUID, received_quantity NUMERIC, condition TEXT,
         blocked_quantity NUMERIC, discrepancy_note TEXT)
  JOIN public.supplier_order_items soi ON soi.id = x.supplier_order_item_id;

  INSERT INTO public.warehouse_receipt_files(
    warehouse_receipt_id, organization_id, file_id, file_purpose, created_by
  )
  SELECT receipt_id_value, so_record.organization_id, f.id,
    CASE WHEN has_damage THEN 'DAMAGE' ELSE 'RECEIPT_EVIDENCE' END, (SELECT auth.uid())
  FROM unnest(COALESCE(evidence_file_ids_input, ARRAY[]::UUID[])) f(id);

  PERFORM public.write_audit_event(so_record.organization_id, 'warehouse_receipt',
    receipt_id_value, 'RECEIVED', NULL, jsonb_build_object('status', receipt_status_value));
  RETURN receipt_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_warehouse_receipt_item(
  warehouse_receipt_item_id_input UUID,
  release_quantity_input NUMERIC
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE item_record public.warehouse_receipt_items%ROWTYPE;
BEGIN
  SELECT * INTO item_record FROM public.warehouse_receipt_items
  WHERE id = warehouse_receipt_item_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', item_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF release_quantity_input IS NULL OR release_quantity_input <= 0
    OR item_record.released_quantity + release_quantity_input
      > item_record.received_quantity - item_record.blocked_quantity THEN
    RAISE EXCEPTION 'RELEASE_EXCEEDS_AVAILABLE_QUANTITY';
  END IF;
  UPDATE public.warehouse_receipt_items
  SET released_quantity = released_quantity + release_quantity_input
  WHERE id = item_record.id;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_receipt_items
    WHERE warehouse_receipt_id = item_record.warehouse_receipt_id
      AND released_quantity < received_quantity - blocked_quantity
  ) THEN
    UPDATE public.warehouse_receipts SET status = 'READY_FOR_CONSOLIDATION'
    WHERE id = item_record.warehouse_receipt_id;
  END IF;
  PERFORM public.write_audit_event(item_record.organization_id, 'warehouse_receipt_item',
    item_record.id, 'RELEASED', NULL, jsonb_build_object('quantity', release_quantity_input));
  RETURN item_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_consolidation(
  customer_order_id_input UUID,
  warehouse_id_input UUID,
  strategy_input TEXT,
  reason_input TEXT,
  items_input JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  order_record public.customer_orders%ROWTYPE;
  item_input RECORD;
  receipt_item_record public.warehouse_receipt_items%ROWTYPE;
  already_allocated NUMERIC(12,3);
  consolidation_id_value UUID;
BEGIN
  SELECT * INTO order_record FROM public.customer_orders
  WHERE id = customer_order_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', order_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF strategy_input NOT IN ('CONSOLIDATE_ALL', 'PARTIAL', 'DIRECT')
    OR jsonb_typeof(items_input) <> 'array' OR jsonb_array_length(items_input) = 0 THEN
    RAISE EXCEPTION 'INVALID_CONSOLIDATION';
  END IF;
  IF strategy_input IN ('PARTIAL', 'DIRECT') AND NULLIF(BTRIM(reason_input), '') IS NULL THEN
    RAISE EXCEPTION 'CONSOLIDATION_REASON_REQUIRED';
  END IF;
  FOR item_input IN SELECT * FROM jsonb_to_recordset(items_input)
    AS x(warehouse_receipt_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT wri.* INTO receipt_item_record
    FROM public.warehouse_receipt_items wri
    JOIN public.warehouse_receipts wr ON wr.id = wri.warehouse_receipt_id
    WHERE wri.id = item_input.warehouse_receipt_item_id
      AND wr.customer_order_id = customer_order_id_input
      AND wr.warehouse_id = warehouse_id_input
      AND wr.status <> 'CANCELLED' FOR UPDATE OF wri;
    IF NOT FOUND OR item_input.quantity IS NULL OR item_input.quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_CONSOLIDATION_ITEM';
    END IF;
    SELECT COALESCE(SUM(ci.quantity), 0) INTO already_allocated
    FROM public.consolidation_items ci
    JOIN public.consolidation_groups cg ON cg.id = ci.consolidation_group_id
    WHERE ci.warehouse_receipt_item_id = receipt_item_record.id
      AND cg.status <> 'CANCELLED';
    IF already_allocated + item_input.quantity > receipt_item_record.released_quantity THEN
      RAISE EXCEPTION 'CONSOLIDATION_EXCEEDS_RELEASED_QUANTITY';
    END IF;
  END LOOP;

  INSERT INTO public.consolidation_groups(
    organization_id, customer_order_id, warehouse_id, consolidation_number,
    strategy, reason, created_by
  ) VALUES (
    order_record.organization_id, order_record.id, warehouse_id_input,
    public.next_record_reference('CNS'), strategy_input,
    NULLIF(BTRIM(reason_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO consolidation_id_value;
  INSERT INTO public.consolidation_items(
    consolidation_group_id, organization_id, warehouse_receipt_item_id, order_item_id, quantity
  )
  SELECT consolidation_id_value, order_record.organization_id, wri.id, wri.order_item_id, x.quantity
  FROM jsonb_to_recordset(items_input) AS x(warehouse_receipt_item_id UUID, quantity NUMERIC)
  JOIN public.warehouse_receipt_items wri ON wri.id = x.warehouse_receipt_item_id;
  INSERT INTO public.consolidation_events(
    consolidation_group_id, organization_id, event_type, detail, actor_user_id
  ) VALUES (
    consolidation_id_value, order_record.organization_id, 'CREATED',
    jsonb_build_object('strategy', strategy_input), (SELECT auth.uid())
  );
  RETURN consolidation_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_consolidation(consolidation_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE group_record public.consolidation_groups%ROWTYPE;
BEGIN
  SELECT * INTO group_record FROM public.consolidation_groups
  WHERE id = consolidation_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', group_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF group_record.status <> 'DRAFT' OR NOT EXISTS (
    SELECT 1 FROM public.consolidation_items WHERE consolidation_group_id = group_record.id
  ) THEN RAISE EXCEPTION 'CONSOLIDATION_NOT_CONFIRMABLE'; END IF;
  UPDATE public.consolidation_groups SET status = 'CONFIRMED',
    confirmed_by = (SELECT auth.uid()), confirmed_at = NOW() WHERE id = group_record.id;
  INSERT INTO public.consolidation_events(
    consolidation_group_id, organization_id, event_type, actor_user_id
  ) VALUES (group_record.id, group_record.organization_id, 'CONFIRMED', (SELECT auth.uid()));
  RETURN group_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_shipment_v2(
  consolidation_id_input UUID,
  shipment_name_input TEXT,
  shipping_method_input TEXT,
  tracking_number_input TEXT DEFAULT NULL,
  etd_at_input TIMESTAMPTZ DEFAULT NULL,
  eta_at_input TIMESTAMPTZ DEFAULT NULL,
  remaining_plan_input TEXT DEFAULT NULL,
  additional_member_charge_input NUMERIC DEFAULT 0,
  charge_bearer_input TEXT DEFAULT 'GISP'
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  group_record public.consolidation_groups%ROWTYPE;
  order_record public.customer_orders%ROWTYPE;
  item_record RECORD;
  already_shipped NUMERIC(12,3);
  shipment_id_value UUID;
  shipment_status_value TEXT := 'GATE_CHECKED';
BEGIN
  SELECT * INTO group_record FROM public.consolidation_groups
  WHERE id = consolidation_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', group_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF group_record.status <> 'CONFIRMED' THEN RAISE EXCEPTION 'CONSOLIDATION_NOT_CONFIRMED'; END IF;
  IF NULLIF(BTRIM(shipment_name_input), '') IS NULL
    OR shipping_method_input NOT IN ('LCL', 'FCL', 'TRUCK', 'AIR', 'COURIER')
    OR (etd_at_input IS NOT NULL AND eta_at_input IS NOT NULL AND etd_at_input > eta_at_input) THEN
    RAISE EXCEPTION 'INVALID_SHIPMENT';
  END IF;
  IF group_record.strategy IN ('PARTIAL', 'DIRECT')
    AND NULLIF(BTRIM(COALESCE(remaining_plan_input, group_record.reason)), '') IS NULL THEN
    RAISE EXCEPTION 'PARTIAL_REMAINING_PLAN_REQUIRED';
  END IF;
  IF COALESCE(additional_member_charge_input, 0) < 0
    OR charge_bearer_input NOT IN ('GISP', 'MEMBER') THEN RAISE EXCEPTION 'INVALID_ADDITIONAL_CHARGE'; END IF;
  IF COALESCE(additional_member_charge_input, 0) > 0 AND charge_bearer_input = 'MEMBER' THEN
    shipment_status_value := 'AWAITING_MEMBER_ACKNOWLEDGEMENT';
  END IF;
  SELECT * INTO order_record FROM public.customer_orders WHERE id = group_record.customer_order_id FOR UPDATE;

  FOR item_record IN
    SELECT ci.*, wri.supplier_order_item_id, oi.quantity AS order_quantity
    FROM public.consolidation_items ci
    JOIN public.warehouse_receipt_items wri ON wri.id = ci.warehouse_receipt_item_id
    JOIN public.order_items oi ON oi.id = ci.order_item_id
    WHERE ci.consolidation_group_id = group_record.id
  LOOP
    IF NOT public.can_dispatch_order_item(item_record.order_item_id) THEN
      RAISE EXCEPTION 'DISPATCH_GATE_FAILED';
    END IF;
    SELECT COALESCE(SUM(si.quantity), 0) INTO already_shipped
    FROM public.shipment_items si JOIN public.shipments s ON s.id = si.shipment_id
    WHERE si.order_item_id = item_record.order_item_id AND s.status <> 'CANCELLED';
    IF already_shipped + item_record.quantity > item_record.order_quantity THEN
      RAISE EXCEPTION 'SHIPMENT_EXCEEDS_ORDER_QUANTITY';
    END IF;
  END LOOP;

  INSERT INTO public.shipments(
    organization_id, customer_order_id, consolidation_group_id, shipment_number,
    shipment_name, shipment_type, shipping_method, origin_warehouse_id,
    destination_address_snapshot, status, tracking_number, etd_at,
    estimated_arrival_at, original_eta_at, created_by
  ) VALUES (
    group_record.organization_id, order_record.id, group_record.id,
    public.next_document_number('SHP'), BTRIM(shipment_name_input), group_record.strategy,
    shipping_method_input, group_record.warehouse_id, order_record.shipping_address_snapshot,
    shipment_status_value, NULLIF(BTRIM(tracking_number_input), ''), etd_at_input,
    eta_at_input, eta_at_input, (SELECT auth.uid())
  ) RETURNING id INTO shipment_id_value;
  INSERT INTO public.shipment_items(
    shipment_id, organization_id, order_item_id, supplier_order_item_id,
    warehouse_receipt_item_id, quantity
  )
  SELECT shipment_id_value, group_record.organization_id, ci.order_item_id,
    wri.supplier_order_item_id, ci.warehouse_receipt_item_id, ci.quantity
  FROM public.consolidation_items ci
  JOIN public.warehouse_receipt_items wri ON wri.id = ci.warehouse_receipt_item_id
  WHERE ci.consolidation_group_id = group_record.id;

  IF group_record.strategy IN ('PARTIAL', 'DIRECT') THEN
    INSERT INTO public.partial_shipment_decisions(
      shipment_id, organization_id, customer_order_id, reason, remaining_plan,
      additional_member_charge, charge_bearer, internal_approved_by,
      member_acknowledgement_required
    ) VALUES (
      shipment_id_value, group_record.organization_id, order_record.id,
      COALESCE(NULLIF(BTRIM(group_record.reason), ''), 'DIRECT_SHIPMENT'),
      COALESCE(NULLIF(BTRIM(remaining_plan_input), ''), group_record.reason),
      COALESCE(additional_member_charge_input, 0), charge_bearer_input,
      (SELECT auth.uid()), shipment_status_value = 'AWAITING_MEMBER_ACKNOWLEDGEMENT'
    );
  END IF;
  UPDATE public.consolidation_groups SET status = 'SHIPMENT_CREATED' WHERE id = group_record.id;
  INSERT INTO public.consolidation_events(
    consolidation_group_id, organization_id, event_type, detail, actor_user_id
  ) VALUES (group_record.id, group_record.organization_id, 'SHIPMENT_CREATED',
    jsonb_build_object('shipment_id', shipment_id_value), (SELECT auth.uid()));
  PERFORM public.write_audit_event(group_record.organization_id, 'shipment', shipment_id_value,
    shipment_status_value, NULL, jsonb_build_object('consolidation_id', group_record.id));
  RETURN shipment_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_partial_shipment(
  shipment_id_input UUID,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE decision_record public.partial_shipment_decisions%ROWTYPE;
BEGIN
  SELECT * INTO decision_record FROM public.partial_shipment_decisions
  WHERE shipment_id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.current_member_owns_order(decision_record.customer_order_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT decision_record.member_acknowledgement_required
    OR decision_record.member_acknowledged_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACKNOWLEDGEMENT_NOT_REQUIRED';
  END IF;
  UPDATE public.partial_shipment_decisions SET member_acknowledged_at = NOW(),
    member_acknowledged_by = (SELECT auth.uid()), member_response_note = NULLIF(BTRIM(note_input), '')
  WHERE id = decision_record.id;
  INSERT INTO public.partial_shipment_responses(
    partial_shipment_decision_id, organization_id, response, note, actor_user_id
  ) VALUES (decision_record.id, decision_record.organization_id, 'ACKNOWLEDGED',
    NULLIF(BTRIM(note_input), ''), (SELECT auth.uid()));
  UPDATE public.shipments SET status = 'GATE_CHECKED'
  WHERE id = shipment_id_input AND status = 'AWAITING_MEMBER_ACKNOWLEDGEMENT';
  RETURN shipment_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_shipment(shipment_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE shipment_record public.shipments%ROWTYPE;
BEGIN
  SELECT * INTO shipment_record FROM public.shipments
  WHERE id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', shipment_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF shipment_record.status NOT IN ('GATE_CHECKED', 'READY_TO_DISPATCH') THEN
    RAISE EXCEPTION 'SHIPMENT_NOT_DISPATCHABLE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shipment_items si
    WHERE si.shipment_id = shipment_record.id
      AND NOT public.can_dispatch_order_item(si.order_item_id)
  ) THEN RAISE EXCEPTION 'DISPATCH_GATE_CHANGED'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.partial_shipment_decisions psd
    WHERE psd.shipment_id = shipment_record.id
      AND psd.member_acknowledgement_required AND psd.member_acknowledged_at IS NULL
  ) THEN RAISE EXCEPTION 'MEMBER_ACKNOWLEDGEMENT_REQUIRED'; END IF;

  UPDATE public.shipments SET status = 'DISPATCHED', dispatched_at = NOW(),
    actual_departure_at = COALESCE(actual_departure_at, NOW()) WHERE id = shipment_record.id;
  UPDATE public.customer_orders co SET status = CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.order_items oi WHERE oi.order_id = co.id
        AND COALESCE((SELECT SUM(si.quantity) FROM public.shipment_items si
          JOIN public.shipments s ON s.id = si.shipment_id
          WHERE si.order_item_id = oi.id AND s.status NOT IN ('DRAFT','GATE_CHECKED',
            'AWAITING_MEMBER_ACKNOWLEDGEMENT','READY_TO_DISPATCH','CANCELLED')), 0) < oi.quantity
    ) THEN 'SHIPPED' ELSE 'PARTIALLY_SHIPPED' END
  WHERE co.id = shipment_record.customer_order_id;
  PERFORM public.write_audit_event(shipment_record.organization_id, 'shipment', shipment_record.id, 'DISPATCHED');
  RETURN shipment_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_shipment_event(
  shipment_id_input UUID,
  status_input TEXT,
  event_at_input TIMESTAMPTZ,
  location_input TEXT DEFAULT NULL,
  note_input TEXT DEFAULT NULL,
  eta_at_input TIMESTAMPTZ DEFAULT NULL,
  is_member_visible_input BOOLEAN DEFAULT TRUE,
  evidence_file_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  shipment_record public.shipments%ROWTYPE;
  event_id_value UUID;
  new_rank INTEGER;
  last_rank INTEGER;
BEGIN
  SELECT * INTO shipment_record FROM public.shipments WHERE id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('shipments.manage', shipment_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF shipment_record.status IN ('DRAFT','GATE_CHECKED','AWAITING_MEMBER_ACKNOWLEDGEMENT','CANCELLED')
    OR event_at_input IS NULL THEN RAISE EXCEPTION 'SHIPMENT_NOT_TRACKABLE'; END IF;
  new_rank := CASE status_input
    WHEN 'FACTORY_PICKUP_SCHEDULED' THEN 10 WHEN 'PICKED_UP_FROM_FACTORY' THEN 20
    WHEN 'ARRIVED_CHINA_WAREHOUSE' THEN 30 WHEN 'CONSOLIDATED' THEN 40
    WHEN 'BOOKED' THEN 50 WHEN 'EXPORT_CUSTOMS' THEN 60 WHEN 'DEPARTED_CHINA' THEN 70
    WHEN 'IN_TRANSIT' THEN 80 WHEN 'ARRIVED_THAILAND' THEN 90
    WHEN 'IMPORT_CUSTOMS' THEN 100 WHEN 'THAILAND_WAREHOUSE' THEN 110
    WHEN 'READY_FOR_DELIVERY' THEN 120 WHEN 'DELAY' THEN 0 WHEN 'NOTE' THEN 0 ELSE NULL END;
  IF new_rank IS NULL THEN RAISE EXCEPTION 'INVALID_SHIPMENT_EVENT'; END IF;
  SELECT COALESCE(MAX(CASE status
    WHEN 'FACTORY_PICKUP_SCHEDULED' THEN 10 WHEN 'PICKED_UP_FROM_FACTORY' THEN 20
    WHEN 'ARRIVED_CHINA_WAREHOUSE' THEN 30 WHEN 'CONSOLIDATED' THEN 40
    WHEN 'BOOKED' THEN 50 WHEN 'EXPORT_CUSTOMS' THEN 60 WHEN 'DEPARTED_CHINA' THEN 70
    WHEN 'IN_TRANSIT' THEN 80 WHEN 'ARRIVED_THAILAND' THEN 90
    WHEN 'IMPORT_CUSTOMS' THEN 100 WHEN 'THAILAND_WAREHOUSE' THEN 110
    WHEN 'READY_FOR_DELIVERY' THEN 120 ELSE 0 END), 0) INTO last_rank
  FROM public.shipment_status_history WHERE shipment_id = shipment_record.id;
  IF new_rank > 0 AND new_rank < last_rank THEN RAISE EXCEPTION 'SHIPMENT_STATUS_CANNOT_MOVE_BACKWARD'; END IF;
  IF eta_at_input IS NOT NULL AND shipment_record.estimated_arrival_at IS NOT NULL
    AND eta_at_input > shipment_record.estimated_arrival_at
    AND NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'ETA_DELAY_REASON_REQUIRED'; END IF;
  IF evidence_file_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.file_metadata fm WHERE fm.id = evidence_file_id_input
      AND fm.organization_id = shipment_record.organization_id
      AND (is_member_visible_input = FALSE OR fm.visibility = 'MEMBER_PRIVATE')
  ) THEN RAISE EXCEPTION 'INVALID_TRACKING_EVIDENCE'; END IF;

  INSERT INTO public.shipment_status_history(
    shipment_id, organization_id, status, location_text, event_at, note,
    is_delay, eta_at, is_member_visible, created_by
  ) VALUES (shipment_record.id, shipment_record.organization_id, status_input,
    NULLIF(BTRIM(location_input), ''), event_at_input, NULLIF(BTRIM(note_input), ''),
    status_input = 'DELAY', eta_at_input, is_member_visible_input, (SELECT auth.uid()))
  RETURNING id INTO event_id_value;
  IF evidence_file_id_input IS NOT NULL THEN
    INSERT INTO public.shipment_documents(
      shipment_id, organization_id, file_id, document_type, is_member_visible, created_by
    ) VALUES (shipment_record.id, shipment_record.organization_id, evidence_file_id_input,
      'TRACKING_EVIDENCE', is_member_visible_input, (SELECT auth.uid()));
  END IF;
  UPDATE public.shipments SET
    status = CASE status_input
      WHEN 'DEPARTED_CHINA' THEN 'IN_TRANSIT' WHEN 'IN_TRANSIT' THEN 'IN_TRANSIT'
      WHEN 'ARRIVED_THAILAND' THEN 'ARRIVED_THAILAND' WHEN 'IMPORT_CUSTOMS' THEN 'IMPORT_CUSTOMS'
      WHEN 'THAILAND_WAREHOUSE' THEN 'THAILAND_WAREHOUSE'
      WHEN 'READY_FOR_DELIVERY' THEN 'READY_FOR_DELIVERY' ELSE status END,
    estimated_arrival_at = COALESCE(eta_at_input, estimated_arrival_at),
    delay_reason = CASE WHEN eta_at_input IS NOT NULL AND eta_at_input > COALESCE(estimated_arrival_at, eta_at_input)
      THEN BTRIM(note_input) ELSE delay_reason END,
    actual_departure_at = CASE WHEN status_input = 'DEPARTED_CHINA' THEN event_at_input ELSE actual_departure_at END,
    actual_arrival_at = CASE WHEN status_input = 'ARRIVED_THAILAND' THEN event_at_input ELSE actual_arrival_at END,
    arrived_at = CASE WHEN status_input = 'THAILAND_WAREHOUSE' THEN event_at_input ELSE arrived_at END
  WHERE id = shipment_record.id;
  RETURN event_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_shipment(
  shipment_name_input TEXT,
  items_input JSONB
)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN RAISE EXCEPTION 'USE_CREATE_SHIPMENT_V2'; END; $$;

CREATE OR REPLACE FUNCTION public.record_delivery(
  shipment_id_input UUID,
  recipient_name_input TEXT,
  proof_file_id_input UUID,
  delivered_with_issue_input BOOLEAN DEFAULT FALSE
)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN RAISE EXCEPTION 'USE_RECORD_DELIVERY_V2'; END; $$;

REVOKE ALL ON FUNCTION public.create_warehouse_receipt(UUID,UUID,TIMESTAMPTZ,INTEGER,NUMERIC,NUMERIC,TEXT,JSONB,UUID[]) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.release_warehouse_receipt_item(UUID,NUMERIC) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.create_consolidation(UUID,UUID,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.confirm_consolidation(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.create_shipment_v2(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,NUMERIC,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.acknowledge_partial_shipment(UUID,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.dispatch_shipment(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.add_shipment_event(UUID,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,BOOLEAN,UUID) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.create_warehouse_receipt(UUID,UUID,TIMESTAMPTZ,INTEGER,NUMERIC,NUMERIC,TEXT,JSONB,UUID[]) TO authenticated;

GRANT EXECUTE ON FUNCTION public.release_warehouse_receipt_item(UUID,NUMERIC) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_consolidation(UUID,UUID,TEXT,TEXT,JSONB) TO authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_consolidation(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_shipment_v2(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,NUMERIC,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.acknowledge_partial_shipment(UUID,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.dispatch_shipment(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.add_shipment_event(UUID,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,BOOLEAN,UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.schedule_delivery(
  shipment_id_input UUID,
  scheduled_at_input TIMESTAMPTZ,
  scheduled_window_end_input TIMESTAMPTZ,
  contact_name_input TEXT,
  contact_phone_input TEXT,
  site_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE shipment_record public.shipments%ROWTYPE; delivery_id_value UUID;
BEGIN
  SELECT * INTO shipment_record FROM public.shipments WHERE id = shipment_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('deliveries.manage', shipment_record.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF shipment_record.status NOT IN ('READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED')
    OR scheduled_at_input IS NULL OR scheduled_window_end_input IS NULL
    OR scheduled_at_input > scheduled_window_end_input
    OR NULLIF(BTRIM(contact_name_input), '') IS NULL
    OR NULLIF(BTRIM(contact_phone_input), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_APPOINTMENT';
  END IF;
  IF EXISTS (SELECT 1 FROM public.deliveries WHERE shipment_id = shipment_record.id
    AND status IN ('PROPOSED','MEMBER_CONFIRMED','RESCHEDULE_REQUESTED','UNDER_REVIEW',
      'CONFIRMED','OUT_FOR_DELIVERY','ARRIVED')) THEN
    RAISE EXCEPTION 'OPEN_DELIVERY_ALREADY_EXISTS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shipment_items si WHERE si.shipment_id = shipment_record.id
      AND si.quantity > COALESCE((
        SELECT SUM(di.quantity_delivered) FROM public.delivery_items di
        JOIN public.deliveries d ON d.id = di.delivery_id
        WHERE d.shipment_id = shipment_record.id AND di.order_item_id = si.order_item_id
          AND d.status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')
      ), 0)
  ) THEN RAISE EXCEPTION 'SHIPMENT_ALREADY_DELIVERED'; END IF;

  INSERT INTO public.deliveries(
    shipment_id, customer_order_id, organization_id, delivery_number, status,
    scheduled_at, scheduled_window_end_at, delivery_address_snapshot,
    contact_name, contact_phone, site_note, created_by
  ) VALUES (
    shipment_record.id, shipment_record.customer_order_id, shipment_record.organization_id,
    public.next_document_number('DLV'), 'PROPOSED', scheduled_at_input,
    scheduled_window_end_input, shipment_record.destination_address_snapshot,
    BTRIM(contact_name_input), BTRIM(contact_phone_input), NULLIF(BTRIM(site_note_input), ''),
    (SELECT auth.uid())
  ) RETURNING id INTO delivery_id_value;

  INSERT INTO public.delivery_items(
    delivery_id, organization_id, order_item_id, shipment_item_id,
    expected_quantity, quantity_delivered, remaining_quantity
  )
  SELECT delivery_id_value, shipment_record.organization_id, si.order_item_id, si.id,
    si.quantity - COALESCE(delivered.qty, 0), 0, si.quantity - COALESCE(delivered.qty, 0)
  FROM public.shipment_items si
  LEFT JOIN LATERAL (
    SELECT SUM(di.quantity_delivered) qty FROM public.delivery_items di
    JOIN public.deliveries d ON d.id = di.delivery_id
    WHERE d.shipment_id = shipment_record.id AND di.order_item_id = si.order_item_id
      AND d.status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')
  ) delivered ON TRUE
  WHERE si.shipment_id = shipment_record.id AND si.quantity - COALESCE(delivered.qty, 0) > 0;

  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, scheduled_at_snapshot,
    scheduled_window_end_snapshot, actor_user_id
  ) VALUES (delivery_id_value, shipment_record.organization_id, 'PROPOSED',
    scheduled_at_input, scheduled_window_end_input, (SELECT auth.uid()));
  RETURN delivery_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_delivery_appointment(delivery_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE d public.deliveries%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = delivery_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.current_member_owns_order(d.customer_order_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF d.status <> 'PROPOSED' THEN RAISE EXCEPTION 'DELIVERY_NOT_CONFIRMABLE'; END IF;
  UPDATE public.deliveries SET status = 'MEMBER_CONFIRMED',
    member_confirmed_by = (SELECT auth.uid()), member_confirmed_at = NOW() WHERE id = d.id;
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, scheduled_at_snapshot,
    scheduled_window_end_snapshot, actor_user_id
  ) VALUES (d.id, d.organization_id, 'MEMBER_CONFIRMED', d.scheduled_at,
    d.scheduled_window_end_at, (SELECT auth.uid()));
  RETURN d.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_delivery_reschedule(
  delivery_id_input UUID,
  preferred_dates_input JSONB,
  reason_input TEXT,
  contact_name_input TEXT DEFAULT NULL,
  contact_phone_input TEXT DEFAULT NULL,
  site_note_input TEXT DEFAULT NULL,
  requested_address_input JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE d public.deliveries%ROWTYPE; request_id_value UUID;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = delivery_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.current_member_owns_order(d.customer_order_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF d.status NOT IN ('PROPOSED','MEMBER_CONFIRMED','CONFIRMED')
    OR jsonb_typeof(preferred_dates_input) <> 'array'
    OR jsonb_array_length(preferred_dates_input) = 0
    OR NULLIF(BTRIM(reason_input), '') IS NULL THEN RAISE EXCEPTION 'INVALID_RESCHEDULE_REQUEST'; END IF;
  INSERT INTO public.delivery_reschedule_requests(
    delivery_id, organization_id, customer_order_id, preferred_dates, reason,
    requested_contact_name, requested_contact_phone, requested_site_note,
    requested_address, address_change_requested, requested_by
  ) VALUES (d.id, d.organization_id, d.customer_order_id, preferred_dates_input,
    BTRIM(reason_input), NULLIF(BTRIM(contact_name_input), ''),
    NULLIF(BTRIM(contact_phone_input), ''), NULLIF(BTRIM(site_note_input), ''),
    requested_address_input, requested_address_input IS NOT NULL, (SELECT auth.uid()))
  RETURNING id INTO request_id_value;
  UPDATE public.deliveries SET status = 'RESCHEDULE_REQUESTED' WHERE id = d.id;
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, note, actor_user_id
  ) VALUES (d.id, d.organization_id, 'RESCHEDULE_REQUESTED', BTRIM(reason_input), (SELECT auth.uid()));
  RETURN request_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_delivery_reschedule(
  request_id_input UUID,
  approve_input BOOLEAN,
  decision_note_input TEXT,
  accepted_scheduled_at_input TIMESTAMPTZ DEFAULT NULL,
  accepted_window_end_input TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE r public.delivery_reschedule_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.delivery_reschedule_requests WHERE id = request_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('deliveries.manage', r.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF r.status <> 'SUBMITTED' OR NULLIF(BTRIM(decision_note_input), '') IS NULL THEN
    RAISE EXCEPTION 'RESCHEDULE_NOT_REVIEWABLE';
  END IF;
  IF approve_input AND (accepted_scheduled_at_input IS NULL OR accepted_window_end_input IS NULL
    OR accepted_scheduled_at_input > accepted_window_end_input) THEN
    RAISE EXCEPTION 'ACCEPTED_DELIVERY_WINDOW_REQUIRED';
  END IF;
  UPDATE public.delivery_reschedule_requests SET status = CASE WHEN approve_input THEN 'ACCEPTED' ELSE 'REJECTED' END,
    decided_by = (SELECT auth.uid()), decided_at = NOW(), decision_note = BTRIM(decision_note_input),
    accepted_scheduled_at = CASE WHEN approve_input THEN accepted_scheduled_at_input END,
    accepted_window_end_at = CASE WHEN approve_input THEN accepted_window_end_input END
  WHERE id = r.id;
  UPDATE public.deliveries SET status = 'CONFIRMED',
    scheduled_at = CASE WHEN approve_input THEN accepted_scheduled_at_input ELSE scheduled_at END,
    scheduled_window_end_at = CASE WHEN approve_input THEN accepted_window_end_input ELSE scheduled_window_end_at END,
    contact_name = COALESCE(r.requested_contact_name, contact_name),
    contact_phone = COALESCE(r.requested_contact_phone, contact_phone),
    site_note = COALESCE(r.requested_site_note, site_note),
    delivery_address_snapshot = CASE WHEN approve_input AND r.address_change_requested
      THEN r.requested_address ELSE delivery_address_snapshot END
  WHERE id = r.delivery_id;
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, scheduled_at_snapshot,
    scheduled_window_end_snapshot, note, actor_user_id
  ) VALUES (r.delivery_id, r.organization_id,
    CASE WHEN approve_input THEN 'RESCHEDULE_ACCEPTED' ELSE 'RESCHEDULE_REJECTED' END,
    accepted_scheduled_at_input, accepted_window_end_input, BTRIM(decision_note_input), (SELECT auth.uid()));
  RETURN r.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_delivery_status(
  delivery_id_input UUID,
  target_status_input TEXT,
  reason_input TEXT DEFAULT NULL,
  driver_name_input TEXT DEFAULT NULL,
  driver_phone_input TEXT DEFAULT NULL,
  vehicle_registration_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE d public.deliveries%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = delivery_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('deliveries.manage', d.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT ((d.status IN ('MEMBER_CONFIRMED','CONFIRMED') AND target_status_input = 'OUT_FOR_DELIVERY')
    OR (d.status = 'OUT_FOR_DELIVERY' AND target_status_input = 'ARRIVED')
    OR (d.status IN ('CONFIRMED','OUT_FOR_DELIVERY','ARRIVED')
      AND target_status_input IN ('FAILED','RESCHEDULE_REQUIRED'))) THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_STATUS_TRANSITION';
  END IF;
  IF target_status_input IN ('FAILED','RESCHEDULE_REQUIRED')
    AND NULLIF(BTRIM(reason_input), '') IS NULL THEN RAISE EXCEPTION 'DELIVERY_FAILURE_REASON_REQUIRED'; END IF;
  UPDATE public.deliveries SET status = target_status_input,
    failure_reason = CASE WHEN target_status_input IN ('FAILED','RESCHEDULE_REQUIRED') THEN BTRIM(reason_input) END,
    driver_name = COALESCE(NULLIF(BTRIM(driver_name_input), ''), driver_name),
    driver_phone = COALESCE(NULLIF(BTRIM(driver_phone_input), ''), driver_phone),
    vehicle_registration = COALESCE(NULLIF(BTRIM(vehicle_registration_input), ''), vehicle_registration)
  WHERE id = d.id;
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, note, actor_user_id
  ) VALUES (d.id, d.organization_id,
    CASE target_status_input WHEN 'OUT_FOR_DELIVERY' THEN 'OUT_FOR_DELIVERY'
      WHEN 'ARRIVED' THEN 'ARRIVED' ELSE 'FAILED' END,
    NULLIF(BTRIM(reason_input), ''), (SELECT auth.uid()));
  RETURN d.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_complete_order(order_id_input UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE all_delivered BOOLEAN; freight_verified BOOLEAN; current_status TEXT;
BEGIN
  SELECT status INTO current_status FROM public.customer_orders WHERE id = order_id_input FOR UPDATE;
  IF NOT FOUND OR current_status IN ('CANCELLED','CANCELLATION_REQUESTED') THEN RETURN FALSE; END IF;
  SELECT NOT EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id = order_id_input
      AND COALESCE((SELECT SUM(di.quantity_delivered) FROM public.delivery_items di
        JOIN public.deliveries d ON d.id = di.delivery_id
        WHERE di.order_item_id = oi.id
          AND d.status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')), 0) < oi.quantity
  ) INTO all_delivered;
  SELECT EXISTS (
    SELECT 1 FROM public.freight_invoices fi
    JOIN public.payment_schedules ps ON ps.id = fi.payment_schedule_id
    WHERE fi.customer_order_id = order_id_input AND fi.status = 'PAID'
      AND ps.status = 'VERIFIED' AND ps.verified_amount = ps.due_amount
  ) INTO freight_verified;
  IF all_delivered AND freight_verified THEN
    UPDATE public.customer_orders SET status = 'COMPLETED' WHERE id = order_id_input;
    RETURN TRUE;
  ELSIF all_delivered THEN
    UPDATE public.customer_orders SET status = 'DELIVERED'
    WHERE id = order_id_input AND status NOT IN ('COMPLETED','CANCELLED','CANCELLATION_REQUESTED');
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_delivery_v2(
  delivery_id_input UUID,
  delivered_at_input TIMESTAMPTZ,
  recipient_name_input TEXT,
  recipient_phone_input TEXT,
  items_input JSONB,
  evidence_file_ids_input UUID[],
  next_delivery_plan_input TEXT DEFAULT NULL,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  d public.deliveries%ROWTYPE; item_input RECORD; di public.delivery_items%ROWTYPE;
  result_status TEXT; has_issue BOOLEAN := FALSE; has_remaining BOOLEAN; shipment_complete BOOLEAN;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = delivery_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('deliveries.manage', d.organization_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF d.status NOT IN ('OUT_FOR_DELIVERY','ARRIVED') OR delivered_at_input IS NULL
    OR NULLIF(BTRIM(recipient_name_input), '') IS NULL
    OR jsonb_typeof(items_input) <> 'array' OR jsonb_array_length(items_input) = 0
    OR COALESCE(array_length(evidence_file_ids_input, 1), 0) = 0 THEN
    RAISE EXCEPTION 'INVALID_PROOF_OF_DELIVERY';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(evidence_file_ids_input) f(id) WHERE NOT EXISTS (
      SELECT 1 FROM public.file_metadata fm WHERE fm.id = f.id
        AND fm.organization_id = d.organization_id AND fm.visibility = 'MEMBER_PRIVATE'
    )
  ) THEN RAISE EXCEPTION 'INVALID_DELIVERY_EVIDENCE'; END IF;

  FOR item_input IN SELECT * FROM jsonb_to_recordset(items_input)
    AS x(shipment_item_id UUID, quantity_delivered NUMERIC, condition TEXT,
         issue_type TEXT, issue_description TEXT)
  LOOP
    SELECT * INTO di FROM public.delivery_items
    WHERE delivery_id = d.id AND shipment_item_id = item_input.shipment_item_id FOR UPDATE;
    IF NOT FOUND OR item_input.quantity_delivered IS NULL OR item_input.quantity_delivered < 0
      OR item_input.quantity_delivered > di.expected_quantity
      OR COALESCE(item_input.condition, 'GOOD') NOT IN ('GOOD','DAMAGED','MISSING','WRONG_ITEM','OTHER') THEN
      RAISE EXCEPTION 'INVALID_DELIVERY_ITEM';
    END IF;
    IF COALESCE(item_input.condition, 'GOOD') <> 'GOOD' THEN
      has_issue := TRUE;
      IF item_input.issue_type IS NULL OR NULLIF(BTRIM(item_input.issue_description), '') IS NULL THEN
        RAISE EXCEPTION 'DELIVERY_ISSUE_DETAIL_REQUIRED';
      END IF;
    END IF;
    UPDATE public.delivery_items SET quantity_delivered = item_input.quantity_delivered,
      remaining_quantity = expected_quantity - item_input.quantity_delivered,
      condition = COALESCE(item_input.condition, 'GOOD'), issue_type = item_input.issue_type,
      issue_description = NULLIF(BTRIM(item_input.issue_description), '')
    WHERE id = di.id;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_items WHERE delivery_id = d.id AND quantity_delivered > 0) THEN
    RAISE EXCEPTION 'DELIVERED_QUANTITY_REQUIRED';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.delivery_items WHERE delivery_id = d.id
    AND remaining_quantity > 0) INTO has_remaining;
  IF has_remaining AND NULLIF(BTRIM(next_delivery_plan_input), '') IS NULL THEN
    RAISE EXCEPTION 'NEXT_DELIVERY_PLAN_REQUIRED';
  END IF;
  result_status := CASE WHEN has_issue THEN 'DELIVERED_WITH_ISSUE'
    WHEN has_remaining THEN 'PARTIALLY_DELIVERED' ELSE 'DELIVERED' END;
  UPDATE public.deliveries SET status = result_status, delivered_at = delivered_at_input,
    recipient_name = BTRIM(recipient_name_input), recipient_phone = NULLIF(BTRIM(recipient_phone_input), ''),
    proof_file_id = evidence_file_ids_input[1], next_delivery_plan = NULLIF(BTRIM(next_delivery_plan_input), ''),
    note = NULLIF(BTRIM(note_input), '') WHERE id = d.id;
  INSERT INTO public.delivery_evidence(delivery_id, organization_id, file_id, evidence_type, created_by)
  SELECT d.id, d.organization_id, f.id, CASE WHEN has_issue THEN 'ISSUE' ELSE 'PHOTO' END, (SELECT auth.uid())
  FROM unnest(evidence_file_ids_input) f(id);
  INSERT INTO public.delivery_appointment_events(
    delivery_id, organization_id, event_type, note, actor_user_id
  ) VALUES (d.id, d.organization_id, 'DELIVERY_RECORDED', result_status, (SELECT auth.uid()));

  SELECT NOT EXISTS (
    SELECT 1 FROM public.shipment_items si WHERE si.shipment_id = d.shipment_id
      AND COALESCE((SELECT SUM(di2.quantity_delivered) FROM public.delivery_items di2
        JOIN public.deliveries d2 ON d2.id = di2.delivery_id
        WHERE d2.shipment_id = d.shipment_id AND di2.order_item_id = si.order_item_id
          AND d2.status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')), 0) < si.quantity
  ) INTO shipment_complete;
  UPDATE public.shipments SET status = CASE WHEN shipment_complete THEN 'DELIVERED' ELSE 'PARTIALLY_DELIVERED' END
  WHERE id = d.shipment_id;
  PERFORM public.maybe_complete_order(d.customer_order_id);
  PERFORM public.write_audit_event(d.organization_id, 'delivery', d.id, result_status);
  RETURN d.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_logistics_cost(
  customer_order_id_input UUID,
  shipment_id_input UUID,
  delivery_id_input UUID,
  category_input TEXT,
  description_input TEXT,
  supplier_cost_input NUMERIC,
  supplier_currency_input TEXT,
  exchange_rate_input NUMERIC,
  member_charge_input NUMERIC,
  is_billable_input BOOLEAN,
  internal_note_input TEXT DEFAULT NULL,
  member_visible_note_input TEXT DEFAULT NULL,
  evidence_file_ids_input UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE o public.customer_orders%ROWTYPE; cost_id_value UUID;
BEGIN
  SELECT * INTO o FROM public.customer_orders WHERE id = customer_order_id_input;
  IF NOT FOUND OR NOT (public.has_permission('shipments.manage', o.organization_id)
    OR public.has_permission('freight.manage', o.organization_id)) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF category_input NOT IN ('CHINA_DOMESTIC_TRANSPORT','WAREHOUSE','INSPECTION','CONSOLIDATION',
    'PACKING','INTERNATIONAL_FREIGHT','INSURANCE','CUSTOMS','TAX','THAILAND_WAREHOUSE',
    'THAILAND_DELIVERY','LIFTING','OTHER') OR NULLIF(BTRIM(description_input), '') IS NULL
    OR supplier_cost_input < 0 OR exchange_rate_input <= 0 OR member_charge_input < 0 THEN
    RAISE EXCEPTION 'INVALID_LOGISTICS_COST';
  END IF;
  IF shipment_id_input IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shipments
    WHERE id = shipment_id_input AND customer_order_id = o.id) THEN RAISE EXCEPTION 'SHIPMENT_ORDER_MISMATCH'; END IF;
  IF delivery_id_input IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.deliveries
    WHERE id = delivery_id_input AND customer_order_id = o.id) THEN RAISE EXCEPTION 'DELIVERY_ORDER_MISMATCH'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(evidence_file_ids_input, ARRAY[]::UUID[])) f(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.file_metadata fm WHERE fm.id = f.id
      AND fm.organization_id = o.organization_id AND fm.visibility = 'CONFIDENTIAL')) THEN
    RAISE EXCEPTION 'INVALID_COST_EVIDENCE'; END IF;
  INSERT INTO public.logistics_cost_items(
    organization_id, customer_order_id, shipment_id, delivery_id, category, description,
    supplier_cost, supplier_currency, exchange_rate, member_charge, is_billable,
    internal_note, member_visible_note, created_by
  ) VALUES (o.organization_id, o.id, shipment_id_input, delivery_id_input, category_input,
    BTRIM(description_input), ROUND(supplier_cost_input,2), UPPER(supplier_currency_input),
    exchange_rate_input, ROUND(member_charge_input,2), is_billable_input,
    NULLIF(BTRIM(internal_note_input), ''), NULLIF(BTRIM(member_visible_note_input), ''), (SELECT auth.uid()))
  RETURNING id INTO cost_id_value;
  INSERT INTO public.logistics_cost_evidence(logistics_cost_item_id, organization_id, file_id, created_by)
  SELECT cost_id_value, o.organization_id, f.id, (SELECT auth.uid())
  FROM unnest(COALESCE(evidence_file_ids_input, ARRAY[]::UUID[])) f(id);
  RETURN cost_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_logistics_costs(customer_order_id_input UUID)
RETURNS INTEGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE o public.customer_orders%ROWTYPE; changed_count INTEGER;
BEGIN
  SELECT * INTO o FROM public.customer_orders WHERE id = customer_order_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('freight.manage', o.organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE customer_order_id = o.id
    AND status IN ('DELIVERED','PARTIALLY_DELIVERED','DELIVERED_WITH_ISSUE')) THEN
    RAISE EXCEPTION 'DELIVERY_REQUIRED_BEFORE_COST_FINALIZATION';
  END IF;
  UPDATE public.logistics_cost_items SET status = 'FINALIZED', finalized_by = (SELECT auth.uid()), finalized_at = NOW()
  WHERE customer_order_id = o.id AND status = 'DRAFT';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count = 0 THEN RAISE EXCEPTION 'NO_DRAFT_LOGISTICS_COST'; END IF;
  RETURN changed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_freight_invoice(
  customer_order_id_input UUID,
  vat_rate_input NUMERIC DEFAULT 7.00,
  due_at_input TIMESTAMPTZ DEFAULT NULL,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE o public.customer_orders%ROWTYPE; invoice_id_value UUID; schedule_id_value UUID;
  subtotal_value NUMERIC(18,2); vat_value NUMERIC(18,2); total_value NUMERIC(18,2);
BEGIN
  SELECT * INTO o FROM public.customer_orders WHERE id = customer_order_id_input FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission('freight.manage', o.organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF vat_rate_input < 0 OR vat_rate_input > 100 OR EXISTS (
    SELECT 1 FROM public.logistics_cost_items WHERE customer_order_id = o.id AND status = 'DRAFT'
  ) THEN RAISE EXCEPTION 'LOGISTICS_COSTS_NOT_FINALIZED'; END IF;
  IF EXISTS (SELECT 1 FROM public.freight_invoices WHERE customer_order_id = o.id) THEN
    RAISE EXCEPTION 'FREIGHT_INVOICE_ALREADY_EXISTS';
  END IF;
  SELECT ROUND(COALESCE(SUM(member_charge),0),2) INTO subtotal_value
  FROM public.logistics_cost_items WHERE customer_order_id = o.id AND status = 'FINALIZED' AND is_billable;
  IF subtotal_value <= 0 THEN RAISE EXCEPTION 'BILLABLE_FREIGHT_AMOUNT_REQUIRED'; END IF;
  vat_value := ROUND(subtotal_value * vat_rate_input / 100, 2); total_value := subtotal_value + vat_value;
  INSERT INTO public.payment_schedules(order_id, organization_id, schedule_type, due_amount, due_at)
  VALUES (o.id, o.organization_id, 'FREIGHT', total_value, due_at_input) RETURNING id INTO schedule_id_value;
  INSERT INTO public.freight_invoices(
    organization_id, customer_order_id, payment_schedule_id, invoice_number, currency,
    subtotal, vat_rate_snapshot, vat_amount, grand_total, due_at, issued_by, note
  ) VALUES (o.organization_id, o.id, schedule_id_value, public.next_document_number('INV-FRT'),
    o.currency, subtotal_value, vat_rate_input, vat_value, total_value, due_at_input,
    (SELECT auth.uid()), NULLIF(BTRIM(note_input), '')) RETURNING id INTO invoice_id_value;
  INSERT INTO public.freight_invoice_items(
    freight_invoice_id, organization_id, logistics_cost_item_id, category_snapshot,
    description_snapshot, amount_snapshot
  ) SELECT invoice_id_value, o.organization_id, id, category, description, member_charge
    FROM public.logistics_cost_items WHERE customer_order_id = o.id AND status = 'FINALIZED' AND is_billable;
  UPDATE public.logistics_cost_items SET status = 'INVOICED'
  WHERE customer_order_id = o.id AND status = 'FINALIZED' AND is_billable;
  PERFORM public.write_audit_event(o.organization_id, 'freight_invoice', invoice_id_value,
    'ISSUED', NULL, jsonb_build_object('grand_total', total_value));
  RETURN invoice_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_payment_transfer(
  transfer_id_input UUID,
  approve_input BOOLEAN,
  finance_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE t public.payment_transfers%ROWTYPE; ps public.payment_schedules%ROWTYPE;
  verified_total NUMERIC(18,2); new_status TEXT;
BEGIN
  IF NOT public.has_permission('payments.verify') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO t FROM public.payment_transfers WHERE id = transfer_id_input FOR UPDATE;
  IF NOT FOUND OR t.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'TRANSFER_NOT_VERIFIABLE'; END IF;
  SELECT * INTO ps FROM public.payment_schedules WHERE id = t.payment_schedule_id FOR UPDATE;
  PERFORM 1 FROM public.customer_orders WHERE id = ps.order_id FOR UPDATE;
  IF NOT approve_input THEN
    IF NULLIF(BTRIM(finance_note_input), '') IS NULL THEN RAISE EXCEPTION 'REJECTION_REASON_REQUIRED'; END IF;
    UPDATE public.payment_transfers SET status='REJECTED', finance_verified_by=(SELECT auth.uid()),
      finance_verified_at=NOW(), finance_note=BTRIM(finance_note_input) WHERE id=t.id;
    INSERT INTO public.payment_verification_logs(organization_id,payment_transfer_id,action,
      amount_snapshot,schedule_verified_amount_snapshot,schedule_status_snapshot,note,actor_user_id)
    VALUES(t.organization_id,t.id,'REJECTED',t.amount,ps.verified_amount,ps.status,
      BTRIM(finance_note_input),(SELECT auth.uid()));
    RETURN t.id;
  END IF;
  UPDATE public.payment_transfers SET status='VERIFIED', finance_verified_by=(SELECT auth.uid()),
    finance_verified_at=NOW(), finance_note=NULLIF(BTRIM(finance_note_input),'') WHERE id=t.id;
  SELECT COALESCE(ROUND(SUM(amount),2),0) INTO verified_total FROM public.payment_transfers
  WHERE payment_schedule_id=ps.id AND status='VERIFIED';
  new_status := CASE WHEN verified_total>ps.due_amount THEN 'OVERPAYMENT_REVIEW'
    WHEN verified_total=ps.due_amount THEN 'VERIFIED'
    WHEN verified_total>0 THEN 'PARTIALLY_VERIFIED' ELSE 'PENDING' END;
  UPDATE public.payment_schedules SET verified_amount=verified_total,status=new_status,
    verified_at=CASE WHEN new_status='VERIFIED' THEN NOW() END WHERE id=ps.id;
  IF ps.schedule_type='DEPOSIT' THEN
    UPDATE public.customer_orders SET deposit_verified_at=CASE WHEN new_status='VERIFIED' THEN NOW() END,
      status=CASE WHEN new_status='VERIFIED' AND status='PENDING_DEPOSIT' THEN 'DEPOSIT_VERIFIED'
        WHEN new_status<>'VERIFIED' AND status='DEPOSIT_VERIFIED' THEN 'PENDING_DEPOSIT' ELSE status END
    WHERE id=ps.order_id;
  ELSIF ps.schedule_type='BALANCE' THEN
    UPDATE public.customer_orders SET balance_verified_at=CASE WHEN new_status='VERIFIED' THEN NOW() END
    WHERE id=ps.order_id;
  ELSIF ps.schedule_type='FREIGHT' THEN
    UPDATE public.freight_invoices SET status=CASE
      WHEN new_status='VERIFIED' THEN 'PAID' WHEN new_status='PARTIALLY_VERIFIED' THEN 'PARTIALLY_PAID'
      WHEN new_status='OVERPAYMENT_REVIEW' THEN 'OVERPAYMENT_REVIEW' ELSE 'ISSUED' END,
      paid_at=CASE WHEN new_status='VERIFIED' THEN NOW() END WHERE payment_schedule_id=ps.id;
    PERFORM public.maybe_complete_order(ps.order_id);
  END IF;
  INSERT INTO public.payment_verification_logs(organization_id,payment_transfer_id,action,
    amount_snapshot,schedule_verified_amount_snapshot,schedule_status_snapshot,note,actor_user_id)
  VALUES(t.organization_id,t.id,'VERIFIED',t.amount,verified_total,new_status,
    NULLIF(BTRIM(finance_note_input),''),(SELECT auth.uid()));
  PERFORM public.write_audit_event(t.organization_id,'payment_transfer',t.id,'VERIFIED',NULL,
    jsonb_build_object('amount',t.amount,'schedule_verified_amount',verified_total,'schedule_status',new_status));
  RETURN t.id;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_delivery(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.confirm_delivery_appointment(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.request_delivery_reschedule(UUID,JSONB,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.review_delivery_reschedule(UUID,BOOLEAN,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.advance_delivery_status(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.maybe_complete_order(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.record_delivery_v2(UUID,TIMESTAMPTZ,TEXT,TEXT,JSONB,UUID[],TEXT,TEXT) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.add_logistics_cost(UUID,UUID,UUID,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,BOOLEAN,TEXT,TEXT,UUID[]) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.finalize_logistics_costs(UUID) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.issue_freight_invoice(UUID,NUMERIC,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.schedule_delivery(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_delivery_appointment(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.request_delivery_reschedule(UUID,JSONB,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;

GRANT EXECUTE ON FUNCTION public.review_delivery_reschedule(UUID,BOOLEAN,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated;

GRANT EXECUTE ON FUNCTION public.advance_delivery_status(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_delivery_v2(UUID,TIMESTAMPTZ,TEXT,TEXT,JSONB,UUID[],TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.add_logistics_cost(UUID,UUID,UUID,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,BOOLEAN,TEXT,TEXT,UUID[]) TO authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_logistics_costs(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.issue_freight_invoice(UUID,NUMERIC,TIMESTAMPTZ,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_shipment_milestone()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('DELAY', 'NOTE') AND EXISTS (
    SELECT 1 FROM public.shipment_status_history
    WHERE shipment_id = NEW.shipment_id AND status = NEW.status
  ) THEN
    RAISE EXCEPTION 'SHIPMENT_MILESTONE_ALREADY_RECORDED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shipment_status_history_no_duplicate_milestone
BEFORE INSERT ON public.shipment_status_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_shipment_milestone();

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES public.order_items(id),
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS claimed_quantity NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS packaging_condition TEXT,
  ADD COLUMN IF NOT EXISTS temporary_action TEXT,
  ADD COLUMN IF NOT EXISTS suggested_responsibility TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_responsibility TEXT,
  ADD COLUMN IF NOT EXISTS responsibility_confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS responsibility_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warranty_version_id UUID REFERENCES public.partner_warranty_versions(id),
  ADD COLUMN IF NOT EXISTS warranty_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS target_resolution_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS information_request TEXT,
  ADD COLUMN IF NOT EXISTS resolution_type TEXT,
  ADD COLUMN IF NOT EXISTS resolution_details TEXT,
  ADD COLUMN IF NOT EXISTS resolution_executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_evidence_file_id UUID REFERENCES public.file_metadata(id),
  ADD COLUMN IF NOT EXISTS member_response TEXT,
  ADD COLUMN IF NOT EXISTS member_response_note TEXT,
  ADD COLUMN IF NOT EXISTS member_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT;

UPDATE public.claims c
SET order_item_id = di.order_item_id,
    member_profile_id = co.member_profile_id,
    subject = COALESCE(c.subject, 'Claim ' || c.claim_number),
    claimed_quantity = COALESCE(c.claimed_quantity, LEAST(di.quantity_delivered, 1)),
    severity = COALESCE(c.severity, 'MEDIUM'),
    discovered_at = COALESCE(c.discovered_at, c.created_at),
    suggested_responsibility = COALESCE(c.suggested_responsibility,
      CASE c.issue_type
        WHEN 'QUALITY' THEN 'SUPPLIER'
        WHEN 'WRONG_ITEM' THEN 'SUPPLIER'
        WHEN 'DAMAGED' THEN 'LOGISTICS_INSURANCE'
        WHEN 'MISSING' THEN 'LOGISTICS_INSURANCE'
        ELSE 'UNDETERMINED'
      END),
    warranty_snapshot = COALESCE(c.warranty_snapshot, jsonb_build_object(
      'title', 'เงื่อนไขรับประกันของ Partner ณ วันที่เปิด Claim',
      'member_summary', 'ทีม GISP จะตรวจสอบตามเงื่อนไขที่ผูกกับรายการสั่งซื้อ',
      'captured_at', c.created_at
    ))
FROM public.delivery_items di
JOIN public.order_items oi ON oi.id = di.order_item_id
JOIN public.customer_orders co ON co.id = oi.order_id
WHERE c.delivery_item_id = di.id;

UPDATE public.claims SET status = 'SUBMITTED' WHERE status = 'OPEN';

UPDATE public.claims SET status = 'IN_PROGRESS' WHERE status = 'RESOLUTION_PROPOSED';

ALTER TABLE public.claims
  ALTER COLUMN order_item_id SET NOT NULL,
  ALTER COLUMN member_profile_id SET NOT NULL,
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN claimed_quantity SET NOT NULL,
  ALTER COLUMN severity SET NOT NULL,
  ALTER COLUMN discovered_at SET NOT NULL,
  ALTER COLUMN suggested_responsibility SET NOT NULL,
  ALTER COLUMN warranty_snapshot SET NOT NULL;

ALTER TABLE public.claims
  DROP CONSTRAINT IF EXISTS claims_issue_type_check,
  DROP CONSTRAINT IF EXISTS claims_status_check,
  ADD CONSTRAINT claims_issue_type_check CHECK (issue_type IN (
    'MISSING','WRONG_ITEM','DAMAGED','PRODUCTION_QUALITY',
    'TRANSIT_DAMAGE','INSTALLATION','OTHER'
  )),
  ADD CONSTRAINT claims_status_check CHECK (status IN (
    'SUBMITTED','UNDER_REVIEW','WAITING_INFORMATION','COORDINATING_SUPPLIER',
    'REPAIR_APPROVED','REPLACEMENT_APPROVED','COMPENSATION_PROPOSED',
    'IN_PROGRESS','RESOLVED','CLOSED','REJECTED'
  )),
  ADD CONSTRAINT claims_quantity_check CHECK (claimed_quantity > 0),
  ADD CONSTRAINT claims_severity_check CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ADD CONSTRAINT claims_suggested_responsibility_check CHECK (suggested_responsibility IN (
    'SUPPLIER','LOGISTICS_INSURANCE','INSTALLER','GISP','MEMBER','UNDETERMINED'
  )),
  ADD CONSTRAINT claims_confirmed_responsibility_check CHECK (
    confirmed_responsibility IS NULL OR confirmed_responsibility IN (
      'SUPPLIER','LOGISTICS_INSURANCE','INSTALLER','GISP','MEMBER'
    )
  ),
  ADD CONSTRAINT claims_resolution_type_check CHECK (
    resolution_type IS NULL OR resolution_type IN (
      'REPAIR','REPLACEMENT','SPARE_PART','REWORK','COMPENSATION','CREDIT','NO_ACTION'
    )
  ),
  ADD CONSTRAINT claims_member_response_check CHECK (
    member_response IS NULL OR member_response IN ('RESOLVED','STILL_ISSUE','CONTACT_ME')
  ),
  ADD CONSTRAINT claims_rejection_reason_check CHECK (
    status <> 'REJECTED' OR NULLIF(BTRIM(rejection_reason), '') IS NOT NULL
  ),
  ADD CONSTRAINT claims_closed_requirements_check CHECK (
    status <> 'CLOSED' OR (
      NULLIF(BTRIM(resolution_details), '') IS NOT NULL
      AND resolution_evidence_file_id IS NOT NULL
      AND member_confirmed_at IS NOT NULL
      AND closed_at IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS claims_member_status_idx
  ON public.claims(member_profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS claims_admin_queue_idx
  ON public.claims(status, target_resolution_at, created_at DESC);

CREATE INDEX IF NOT EXISTS claims_order_item_idx
  ON public.claims(order_item_id, created_at DESC);

CREATE TABLE public.claim_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN (
    'ISSUE','PACKAGING','DELIVERY_NOTE','MEASUREMENT','REQUESTED_INFO','RESOLUTION'
  )),
  note TEXT,
  is_member_visible BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(claim_id, file_id)
);

CREATE INDEX claim_evidence_claim_idx
  ON public.claim_evidence(claim_id, created_at);

CREATE TABLE public.claim_internal_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  cost_type TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  internal_note TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX claim_internal_costs_claim_idx
  ON public.claim_internal_costs(claim_id, created_at);

CREATE OR REPLACE FUNCTION public.protect_claim_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.warranty_snapshot IS DISTINCT FROM OLD.warranty_snapshot
     OR NEW.warranty_version_id IS DISTINCT FROM OLD.warranty_version_id THEN
    RAISE EXCEPTION 'warranty snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claims_warranty_snapshot_immutable ON public.claims;

CREATE TRIGGER claims_warranty_snapshot_immutable
BEFORE UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.protect_claim_warranty_snapshot();

ALTER TABLE public.claim_evidence ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.claim_internal_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claims_org ON public.claims;

CREATE POLICY claims_visible ON public.claims
FOR SELECT TO authenticated USING (
  member_profile_id = public.current_member_profile_id()
  OR public.has_permission('claims.manage', organization_id)
);

DROP POLICY IF EXISTS claim_events_visible ON public.claim_events;

CREATE POLICY claim_events_visible ON public.claim_events
FOR SELECT TO authenticated USING (
  public.has_permission('claims.manage', organization_id)
  OR (
    is_member_visible
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_id
        AND c.member_profile_id = public.current_member_profile_id()
    )
  )
);

CREATE POLICY claim_evidence_visible ON public.claim_evidence
FOR SELECT TO authenticated USING (
  public.has_permission('claims.manage', organization_id)
  OR (
    is_member_visible
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_id
        AND c.member_profile_id = public.current_member_profile_id()
    )
  )
);

CREATE POLICY claim_internal_costs_internal_only ON public.claim_internal_costs
FOR SELECT TO authenticated USING (
  public.has_permission('claims.manage', organization_id)
);

REVOKE ALL ON public.claims, public.claim_events, public.claim_evidence,
  public.claim_internal_costs FROM anon, authenticated;

GRANT SELECT ON public.claims, public.claim_events, public.claim_evidence TO authenticated;

GRANT SELECT ON public.claim_internal_costs TO authenticated;

CREATE OR REPLACE FUNCTION public.append_claim_event(
  claim_id_input UUID,
  organization_id_input UUID,
  action_input TEXT,
  note_input TEXT DEFAULT NULL,
  is_member_visible_input BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE event_id_value UUID;
BEGIN
  INSERT INTO public.claim_events(
    claim_id, organization_id, action, note, actor_user_id, is_member_visible
  ) VALUES (
    claim_id_input, organization_id_input, action_input,
    NULLIF(BTRIM(note_input), ''), (SELECT auth.uid()), is_member_visible_input
  ) RETURNING id INTO event_id_value;
  RETURN event_id_value;
END;
$$;

DROP FUNCTION IF EXISTS public.open_claim(UUID,TEXT,TEXT,UUID);

CREATE OR REPLACE FUNCTION public.create_claim(
  delivery_item_id_input UUID,
  issue_type_input TEXT,
  subject_input TEXT,
  description_input TEXT,
  claimed_quantity_input NUMERIC,
  severity_input TEXT,
  discovered_at_input TIMESTAMPTZ,
  packaging_condition_input TEXT,
  temporary_action_input TEXT,
  evidence_file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  delivery_record RECORD;
  file_record RECORD;
  warranty_record RECORD;
  claim_id_value UUID;
  claim_number_value TEXT;
  responsibility_value TEXT;
  already_claimed NUMERIC;
  warranty_value JSONB;
BEGIN
  IF public.current_member_profile_id() IS NULL THEN RAISE EXCEPTION 'member access required'; END IF;
  IF issue_type_input NOT IN (
    'MISSING','WRONG_ITEM','DAMAGED','PRODUCTION_QUALITY','TRANSIT_DAMAGE','INSTALLATION','OTHER'
  ) THEN RAISE EXCEPTION 'invalid claim type'; END IF;
  IF severity_input NOT IN ('LOW','MEDIUM','HIGH','CRITICAL') THEN RAISE EXCEPTION 'invalid severity'; END IF;
  IF NULLIF(BTRIM(subject_input), '') IS NULL OR LENGTH(BTRIM(subject_input)) < 5 THEN
    RAISE EXCEPTION 'claim subject is required';
  END IF;
  IF NULLIF(BTRIM(description_input), '') IS NULL OR LENGTH(BTRIM(description_input)) < 10 THEN
    RAISE EXCEPTION 'claim description is required';
  END IF;

  SELECT di.*, d.status AS delivery_status, oi.order_id, oi.project_item_id,
         co.member_profile_id, co.project_id, soi.supplier_order_id, so.supplier_id,
         pi.product_id
  INTO delivery_record
  FROM public.delivery_items di
  JOIN public.deliveries d ON d.id = di.delivery_id
  JOIN public.order_items oi ON oi.id = di.order_item_id
  JOIN public.customer_orders co ON co.id = oi.order_id
  LEFT JOIN public.supplier_order_items soi ON soi.order_item_id = oi.id
  LEFT JOIN public.supplier_orders so ON so.id = soi.supplier_order_id
  LEFT JOIN public.project_items pi ON pi.id = oi.project_item_id
  WHERE di.id = delivery_item_id_input
    AND co.member_profile_id = public.current_member_profile_id();

  IF NOT FOUND OR delivery_record.delivery_status NOT IN ('DELIVERED','DELIVERED_WITH_ISSUE') THEN
    RAISE EXCEPTION 'delivered item not found';
  END IF;
  IF claimed_quantity_input IS NULL OR claimed_quantity_input <= 0 THEN
    RAISE EXCEPTION 'claimed quantity must be greater than zero';
  END IF;

  SELECT COALESCE(SUM(c.claimed_quantity), 0) INTO already_claimed
  FROM public.claims c
  WHERE c.delivery_item_id = delivery_item_id_input
    AND c.status NOT IN ('REJECTED','CLOSED');
  IF already_claimed + claimed_quantity_input > delivery_record.quantity_delivered THEN
    RAISE EXCEPTION 'claimed quantity exceeds delivered quantity';
  END IF;

  SELECT fm.id, fm.member_profile_id INTO file_record
  FROM public.file_metadata fm
  WHERE fm.id = evidence_file_id_input
    AND fm.member_profile_id = public.current_member_profile_id()
    AND fm.visibility IN ('MEMBER_PRIVATE','MEMBER_VISIBLE');
  IF NOT FOUND THEN RAISE EXCEPTION 'claim evidence required'; END IF;

  responsibility_value := CASE issue_type_input
    WHEN 'WRONG_ITEM' THEN 'SUPPLIER'
    WHEN 'PRODUCTION_QUALITY' THEN 'SUPPLIER'
    WHEN 'DAMAGED' THEN 'LOGISTICS_INSURANCE'
    WHEN 'MISSING' THEN 'LOGISTICS_INSURANCE'
    WHEN 'TRANSIT_DAMAGE' THEN 'LOGISTICS_INSURANCE'
    WHEN 'INSTALLATION' THEN 'INSTALLER'
    ELSE 'UNDETERMINED'
  END;

  SELECT pw.id, pw.version_number, pw.title, pw.member_summary,
         pw.terms_text, pw.duration_months, pw.effective_from
  INTO warranty_record
  FROM public.partner_warranty_versions pw
  WHERE pw.supplier_id = delivery_record.supplier_id
    AND pw.status = 'ACTIVE'
    AND (pw.product_id = delivery_record.product_id OR pw.product_id IS NULL)
  ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
  LIMIT 1;

  warranty_value := CASE WHEN warranty_record.id IS NOT NULL THEN jsonb_build_object(
    'version_number', warranty_record.version_number,
    'title', warranty_record.title,
    'member_summary', warranty_record.member_summary,
    'terms_text', warranty_record.terms_text,
    'duration_months', warranty_record.duration_months,
    'effective_from', warranty_record.effective_from,
    'captured_at', NOW()
  ) ELSE jsonb_build_object(
    'version_number', 1,
    'title', 'เงื่อนไขรับประกันของ Partner ณ วันที่เปิด Claim',
    'member_summary', 'ทีม GISP จะตรวจสอบความรับผิดชอบตามหลักฐานและเงื่อนไขของรายการสั่งซื้อ',
    'terms_text', 'การอนุมัติซ่อม เปลี่ยนสินค้า หรือชดเชย ต้องผ่านการตรวจสอบของ Order Admin และไม่เกิดขึ้นอัตโนมัติ',
    'duration_months', NULL,
    'captured_at', NOW()
  ) END;

  claim_number_value := public.next_document_number('CLM');
  INSERT INTO public.claims(
    organization_id, member_profile_id, delivery_item_id, order_item_id,
    claim_number, issue_type, subject, description, claimed_quantity, severity,
    discovered_at, packaging_condition, temporary_action, evidence_file_id,
    status, suggested_responsibility, warranty_version_id, warranty_snapshot,
    opened_by
  ) VALUES (
    delivery_record.organization_id, delivery_record.member_profile_id,
    delivery_record.id, delivery_record.order_item_id, claim_number_value,
    issue_type_input, BTRIM(subject_input), BTRIM(description_input),
    claimed_quantity_input, severity_input, COALESCE(discovered_at_input, NOW()),
    NULLIF(BTRIM(packaging_condition_input), ''),
    NULLIF(BTRIM(temporary_action_input), ''), evidence_file_id_input,
    'SUBMITTED', responsibility_value, warranty_record.id, warranty_value,
    (SELECT auth.uid())
  ) RETURNING id INTO claim_id_value;

  INSERT INTO public.claim_evidence(
    claim_id, organization_id, file_id, evidence_type, note, uploaded_by
  ) VALUES (
    claim_id_value, delivery_record.organization_id, evidence_file_id_input,
    'ISSUE', 'หลักฐานตอนเปิด Claim', (SELECT auth.uid())
  );
  UPDATE public.file_metadata
  SET entity_id = claim_id_value, entity_type = 'CLAIM_EVIDENCE'
  WHERE id = evidence_file_id_input;

  PERFORM public.append_claim_event(
    claim_id_value, delivery_record.organization_id, 'SUBMITTED',
    'สมาชิกส่ง Claim และหลักฐานแล้ว', TRUE
  );
  PERFORM public.write_audit_event(
    delivery_record.organization_id, 'claim', claim_id_value, 'SUBMITTED',
    NULL, jsonb_build_object('claim_number', claim_number_value, 'issue_type', issue_type_input)
  );
  RETURN claim_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.member_claim_action(
  claim_id_input UUID,
  action_input TEXT,
  note_input TEXT DEFAULT NULL,
  evidence_file_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE claim_record public.claims%ROWTYPE;
DECLARE evidence_type_value TEXT;
BEGIN
  SELECT * INTO claim_record FROM public.claims
  WHERE id = claim_id_input
    AND member_profile_id = public.current_member_profile_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim not found'; END IF;
  IF claim_record.status IN ('CLOSED','REJECTED') THEN RAISE EXCEPTION 'claim is already final'; END IF;

  IF evidence_file_id_input IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.file_metadata fm
      WHERE fm.id = evidence_file_id_input
        AND fm.member_profile_id = public.current_member_profile_id()
    ) THEN RAISE EXCEPTION 'evidence file not found'; END IF;
    evidence_type_value := CASE WHEN action_input = 'ADD_INFORMATION' THEN 'REQUESTED_INFO' ELSE 'ISSUE' END;
    INSERT INTO public.claim_evidence(
      claim_id, organization_id, file_id, evidence_type, note, uploaded_by
    ) VALUES (
      claim_record.id, claim_record.organization_id, evidence_file_id_input,
      evidence_type_value, NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
    );
    UPDATE public.file_metadata
    SET entity_id = claim_record.id, entity_type = 'CLAIM_EVIDENCE'
    WHERE id = evidence_file_id_input;
  END IF;

  CASE action_input
    WHEN 'ADD_INFORMATION' THEN
      IF NULLIF(BTRIM(note_input), '') IS NULL AND evidence_file_id_input IS NULL THEN
        RAISE EXCEPTION 'information or evidence is required';
      END IF;
      UPDATE public.claims SET status = 'UNDER_REVIEW', information_request = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'INFORMATION_ADDED', COALESCE(note_input, 'สมาชิกแนบหลักฐานเพิ่ม'), TRUE);
    WHEN 'CONFIRM_RESOLVED' THEN
      IF claim_record.status <> 'RESOLVED' OR claim_record.resolution_evidence_file_id IS NULL THEN
        RAISE EXCEPTION 'resolution is not ready for confirmation';
      END IF;
      UPDATE public.claims SET member_response = 'RESOLVED',
        member_response_note = NULLIF(BTRIM(note_input), ''),
        member_responded_at = NOW(), member_confirmed_at = NOW()
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'MEMBER_CONFIRMED_RESOLVED', COALESCE(note_input, 'สมาชิกยืนยันว่าแก้ไขแล้ว'), TRUE);
    WHEN 'STILL_ISSUE' THEN
      IF claim_record.status <> 'RESOLVED' THEN RAISE EXCEPTION 'claim is not awaiting response'; END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'member note is required'; END IF;
      UPDATE public.claims SET status = 'IN_PROGRESS', member_response = 'STILL_ISSUE',
        member_response_note = BTRIM(note_input), member_responded_at = NOW(),
        member_confirmed_at = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'MEMBER_REPORTED_ISSUE', note_input, TRUE);
    WHEN 'CONTACT_ME' THEN
      IF claim_record.status <> 'RESOLVED' THEN RAISE EXCEPTION 'claim is not awaiting response'; END IF;
      UPDATE public.claims SET status = 'IN_PROGRESS', member_response = 'CONTACT_ME',
        member_response_note = NULLIF(BTRIM(note_input), ''), member_responded_at = NOW(),
        member_confirmed_at = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'MEMBER_REQUESTED_CONTACT', COALESCE(note_input, 'สมาชิกขอให้ติดต่อกลับ'), TRUE);
    ELSE RAISE EXCEPTION 'invalid member claim action';
  END CASE;

  PERFORM public.write_audit_event(claim_record.organization_id, 'claim', claim_record.id,
    action_input, NULL, jsonb_build_object('member_action', TRUE));
  RETURN claim_record.id;
END;
$$;

DROP FUNCTION IF EXISTS public.resolve_claim(UUID,TEXT,TEXT);

CREATE OR REPLACE FUNCTION public.admin_claim_action(
  claim_id_input UUID,
  action_input TEXT,
  note_input TEXT DEFAULT NULL,
  responsibility_input TEXT DEFAULT NULL,
  resolution_type_input TEXT DEFAULT NULL,
  evidence_file_id_input UUID DEFAULT NULL,
  assigned_to_input UUID DEFAULT NULL,
  target_resolution_at_input TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE claim_record public.claims%ROWTYPE;
DECLARE next_status TEXT;
BEGIN
  SELECT * INTO claim_record FROM public.claims WHERE id = claim_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim not found'; END IF;
  IF NOT public.has_permission('claims.manage', claim_record.organization_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  CASE action_input
    WHEN 'START_REVIEW' THEN
      IF claim_record.status NOT IN ('SUBMITTED','WAITING_INFORMATION') THEN RAISE EXCEPTION 'claim cannot start review'; END IF;
      UPDATE public.claims SET status = 'UNDER_REVIEW', assigned_to = COALESCE(assigned_to_input, (SELECT auth.uid())),
        target_resolution_at = COALESCE(target_resolution_at_input, target_resolution_at)
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'UNDER_REVIEW', COALESCE(note_input, 'Order Admin เริ่มตรวจ Claim'), TRUE);
    WHEN 'REQUEST_INFORMATION' THEN
      IF claim_record.status IN ('CLOSED','REJECTED') THEN RAISE EXCEPTION 'claim is final'; END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'information request is required'; END IF;
      UPDATE public.claims SET status = 'WAITING_INFORMATION', information_request = BTRIM(note_input)
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'WAITING_INFORMATION', note_input, TRUE);
    WHEN 'CONFIRM_RESPONSIBILITY' THEN
      IF claim_record.status IN ('CLOSED','REJECTED') THEN RAISE EXCEPTION 'claim is final'; END IF;
      IF responsibility_input NOT IN ('SUPPLIER','LOGISTICS_INSURANCE','INSTALLER','GISP','MEMBER') THEN
        RAISE EXCEPTION 'invalid responsibility';
      END IF;
      UPDATE public.claims SET confirmed_responsibility = responsibility_input,
        responsibility_confirmed_by = (SELECT auth.uid()), responsibility_confirmed_at = NOW()
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'RESPONSIBILITY_CONFIRMED', 'Order Admin ยืนยันผู้รับผิดชอบ: ' || responsibility_input, TRUE);
    WHEN 'COORDINATE' THEN
      IF claim_record.confirmed_responsibility IS NULL THEN RAISE EXCEPTION 'responsibility confirmation required'; END IF;
      UPDATE public.claims SET status = 'COORDINATING_SUPPLIER'
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'COORDINATING', COALESCE(note_input, 'กำลังประสานผู้รับผิดชอบ'), TRUE);
    WHEN 'PROPOSE_RESOLUTION' THEN
      IF claim_record.confirmed_responsibility IS NULL THEN RAISE EXCEPTION 'responsibility confirmation required'; END IF;
      IF resolution_type_input NOT IN ('REPAIR','REPLACEMENT','SPARE_PART','REWORK','COMPENSATION','CREDIT','NO_ACTION') THEN
        RAISE EXCEPTION 'invalid resolution type';
      END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'resolution details are required'; END IF;
      next_status := CASE resolution_type_input
        WHEN 'REPAIR' THEN 'REPAIR_APPROVED'
        WHEN 'REPLACEMENT' THEN 'REPLACEMENT_APPROVED'
        WHEN 'COMPENSATION' THEN 'COMPENSATION_PROPOSED'
        WHEN 'CREDIT' THEN 'COMPENSATION_PROPOSED'
        ELSE 'IN_PROGRESS'
      END;
      UPDATE public.claims SET status = next_status, resolution_type = resolution_type_input,
        resolution_details = BTRIM(note_input), resolution = BTRIM(note_input),
        target_resolution_at = COALESCE(target_resolution_at_input, target_resolution_at)
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'RESOLUTION_PROPOSED', note_input, TRUE);
    WHEN 'MARK_IN_PROGRESS' THEN
      IF claim_record.resolution_type IS NULL THEN RAISE EXCEPTION 'resolution proposal required'; END IF;
      UPDATE public.claims SET status = 'IN_PROGRESS' WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'IN_PROGRESS', COALESCE(note_input, 'เริ่มดำเนินการตาม Resolution'), TRUE);
    WHEN 'COMPLETE_RESOLUTION' THEN
      IF claim_record.resolution_type IS NULL OR NULLIF(BTRIM(claim_record.resolution_details), '') IS NULL THEN
        RAISE EXCEPTION 'resolution proposal required';
      END IF;
      IF evidence_file_id_input IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.file_metadata fm WHERE fm.id = evidence_file_id_input
      ) THEN RAISE EXCEPTION 'resolution evidence is required'; END IF;
      INSERT INTO public.claim_evidence(
        claim_id, organization_id, file_id, evidence_type, note, uploaded_by
      ) VALUES (
        claim_record.id, claim_record.organization_id, evidence_file_id_input,
        'RESOLUTION', NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
      ) ON CONFLICT (claim_id, file_id) DO NOTHING;
      UPDATE public.file_metadata SET entity_id = claim_record.id, entity_type = 'CLAIM_EVIDENCE'
      WHERE id = evidence_file_id_input;
      UPDATE public.claims SET status = 'RESOLVED', resolution_executed_at = NOW(),
        resolution_evidence_file_id = evidence_file_id_input,
        resolved_by = (SELECT auth.uid()), resolved_at = NOW(),
        member_response = NULL, member_response_note = NULL, member_responded_at = NULL,
        member_confirmed_at = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'RESOLVED', COALESCE(note_input, 'ดำเนินการตาม Resolution แล้ว รอสมาชิกยืนยัน'), TRUE);
    WHEN 'REJECT' THEN
      IF claim_record.status IN ('CLOSED','REJECTED') THEN RAISE EXCEPTION 'claim is final'; END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'rejection reason is required'; END IF;
      UPDATE public.claims SET status = 'REJECTED', rejection_reason = BTRIM(note_input),
        resolved_by = (SELECT auth.uid()), resolved_at = NOW()
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'REJECTED', note_input, TRUE);
    WHEN 'CLOSE' THEN
      IF claim_record.status <> 'RESOLVED' OR claim_record.member_confirmed_at IS NULL
         OR claim_record.resolution_evidence_file_id IS NULL
         OR NULLIF(BTRIM(claim_record.resolution_details), '') IS NULL THEN
        RAISE EXCEPTION 'member confirmation and execution evidence are required';
      END IF;
      UPDATE public.claims SET status = 'CLOSED', closed_by = (SELECT auth.uid()), closed_at = NOW()
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'CLOSED', COALESCE(note_input, 'Order Admin ตรวจทานและปิด Claim'), TRUE);
    WHEN 'REOPEN' THEN
      IF claim_record.status NOT IN ('CLOSED','REJECTED','RESOLVED') THEN RAISE EXCEPTION 'claim is not final'; END IF;
      IF NULLIF(BTRIM(note_input), '') IS NULL THEN RAISE EXCEPTION 'reopen reason is required'; END IF;
      UPDATE public.claims SET status = 'UNDER_REVIEW', reopened_by = (SELECT auth.uid()),
        reopened_at = NOW(), reopen_reason = BTRIM(note_input), closed_by = NULL,
        closed_at = NULL, member_confirmed_at = NULL, rejection_reason = NULL
      WHERE id = claim_record.id;
      PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
        'REOPENED', note_input, TRUE);
    ELSE RAISE EXCEPTION 'invalid admin claim action';
  END CASE;

  PERFORM public.write_audit_event(claim_record.organization_id, 'claim', claim_record.id,
    action_input, NULL, jsonb_build_object('admin_action', TRUE));
  RETURN claim_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_claim_internal_cost(
  claim_id_input UUID,
  cost_type_input TEXT,
  amount_input NUMERIC,
  currency_input TEXT DEFAULT 'THB',
  internal_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE claim_record public.claims%ROWTYPE;
DECLARE cost_id_value UUID;
BEGIN
  SELECT * INTO claim_record FROM public.claims WHERE id = claim_id_input;
  IF NOT FOUND OR NOT public.has_permission('claims.manage', claim_record.organization_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF NULLIF(BTRIM(cost_type_input), '') IS NULL OR amount_input IS NULL OR amount_input < 0 THEN
    RAISE EXCEPTION 'invalid internal cost';
  END IF;
  INSERT INTO public.claim_internal_costs(
    claim_id, organization_id, cost_type, amount, currency, internal_note, recorded_by
  ) VALUES (
    claim_record.id, claim_record.organization_id, BTRIM(cost_type_input), amount_input,
    UPPER(currency_input), NULLIF(BTRIM(internal_note_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO cost_id_value;
  PERFORM public.append_claim_event(claim_record.id, claim_record.organization_id,
    'INTERNAL_COST_RECORDED', 'บันทึกต้นทุนภายในแล้ว', FALSE);
  PERFORM public.write_audit_event(claim_record.organization_id, 'claim', claim_record.id,
    'INTERNAL_COST_RECORDED', NULL, jsonb_build_object('amount', amount_input, 'currency', UPPER(currency_input)));
  RETURN cost_id_value;
END;
$$;

REVOKE ALL ON FUNCTION public.append_claim_event(UUID,UUID,TEXT,TEXT,BOOLEAN) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.protect_claim_warranty_snapshot() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ) TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;

INSERT INTO public.permissions(code, name)
VALUES
  ('reports.fixed.read', 'ดู Fixed Report'),
  ('reports.fixed.export', 'Export Fixed Report')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('reports.fixed.read', 'reports.fixed.export')
WHERE r.code IN (
  'SUPER_ADMIN', 'ORDER_ADMIN', 'PURCHASING', 'FINANCE', 'QC',
  'LOGISTICS', 'CLAIM_ADMIN', 'EXECUTIVE_VIEWER'
)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS customer_orders_member_report_idx
  ON public.customer_orders(member_profile_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS payment_schedules_report_idx
  ON public.payment_schedules(order_id, created_at DESC, status, due_at);

CREATE INDEX IF NOT EXISTS production_updates_latest_report_idx
  ON public.production_updates(supplier_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS shipments_report_idx
  ON public.shipments(customer_order_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS shipment_status_delay_report_idx
  ON public.shipment_status_history(shipment_id, event_at DESC)
  WHERE is_delay = TRUE;

CREATE INDEX IF NOT EXISTS deliveries_report_idx
  ON public.deliveries(customer_order_id, created_at DESC, status, scheduled_at);

CREATE OR REPLACE FUNCTION public.get_member_dashboard()
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  member_id UUID := public.current_member_profile_id();
  active_order_count BIGINT;
  production_order_count BIGINT;
  in_transit_count BIGINT;
  upcoming_delivery_count BIGINT;
  open_claim_count BIGINT;
  outstanding_by_currency JSONB;
  actions JSONB;
BEGIN
  IF member_id IS NULL THEN
    RAISE EXCEPTION 'member access required';
  END IF;

  SELECT COUNT(*) INTO active_order_count
  FROM public.customer_orders co
  WHERE co.member_profile_id = member_id
    AND co.status NOT IN ('COMPLETED', 'CANCELLED');

  SELECT COUNT(*) INTO production_order_count
  FROM public.customer_orders co
  WHERE co.member_profile_id = member_id
    AND co.status = 'IN_PRODUCTION';

  SELECT COUNT(*) INTO in_transit_count
  FROM public.shipments s
  JOIN public.customer_orders co ON co.id = s.customer_order_id
  WHERE co.member_profile_id = member_id
    AND s.status IN (
      'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
      'ARRIVED_THAILAND', 'IMPORT_CUSTOMS'
    );

  SELECT COUNT(*) INTO upcoming_delivery_count
  FROM public.deliveries d
  JOIN public.customer_orders co ON co.id = d.customer_order_id
  WHERE co.member_profile_id = member_id
    AND d.status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')
    AND d.scheduled_at >= NOW()
    AND d.scheduled_at < NOW() + INTERVAL '7 days';

  SELECT COUNT(*) INTO open_claim_count
  FROM public.claims c
  WHERE c.member_profile_id = member_id
    AND c.status NOT IN ('CLOSED', 'REJECTED');

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('currency', x.currency, 'amount', x.amount)
      ORDER BY x.currency
    ),
    '[]'::jsonb
  )
  INTO outstanding_by_currency
  FROM (
    SELECT co.currency,
           SUM(GREATEST(ps.due_amount - ps.verified_amount, 0)) AS amount
    FROM public.payment_schedules ps
    JOIN public.customer_orders co ON co.id = ps.order_id
    WHERE co.member_profile_id = member_id
      AND ps.status <> 'CANCELLED'
    GROUP BY co.currency
    HAVING SUM(GREATEST(ps.due_amount - ps.verified_amount, 0)) > 0
  ) x;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(q) ORDER BY q.priority, q.due_at NULLS LAST, q.created_at DESC),
    '[]'::jsonb
  )
  INTO actions
  FROM (
    SELECT *
    FROM (
      SELECT
        1 AS priority,
        'PAYMENT_OVERDUE'::text AS action_type,
        ps.id AS entity_id,
        co.id AS order_id,
        co.order_number AS reference,
        ('ยอดชำระเกินกำหนด · ' || ps.schedule_type)::text AS title,
        GREATEST(ps.due_amount - ps.verified_amount, 0)::numeric AS amount,
        co.currency::text AS currency,
        ps.due_at,
        ps.created_at
      FROM public.payment_schedules ps
      JOIN public.customer_orders co ON co.id = ps.order_id
      WHERE co.member_profile_id = member_id
        AND ps.status IN ('PENDING', 'PARTIALLY_VERIFIED', 'OVERPAYMENT_REVIEW')
        AND ps.due_at < NOW()
        AND ps.due_amount > ps.verified_amount

      UNION ALL

      SELECT
        2, 'QC_APPROVAL', oi.id, co.id, co.order_number,
        ('รออนุมัติ QC · ' || oi.item_name_snapshot),
        NULL::numeric, co.currency::text, NULL::timestamptz, oi.created_at
      FROM public.order_items oi
      JOIN public.customer_orders co ON co.id = oi.order_id
      WHERE co.member_profile_id = member_id
        AND oi.qc_status = 'WAITING_MEMBER_APPROVAL'

      UNION ALL

      SELECT
        3, 'DELIVERY_CONFIRMATION', d.id, co.id, d.delivery_number,
        'ยืนยันนัดส่งสินค้า',
        NULL::numeric, NULL::text, d.scheduled_at, d.created_at
      FROM public.deliveries d
      JOIN public.customer_orders co ON co.id = d.customer_order_id
      WHERE co.member_profile_id = member_id
        AND d.status IN ('PROPOSED', 'RESCHEDULE_REQUESTED')

      UNION ALL

      SELECT
        4, 'CLAIM_INFORMATION', c.id, oi.order_id, c.claim_number,
        'Claim รอข้อมูลเพิ่มเติม',
        NULL::numeric, NULL::text, c.target_resolution_at, c.created_at
      FROM public.claims c
      JOIN public.order_items oi ON oi.id = c.order_item_id
      WHERE c.member_profile_id = member_id
        AND c.status = 'WAITING_INFORMATION'

      UNION ALL

      SELECT
        5, 'PAYMENT_DUE_SOON', ps.id, co.id, co.order_number,
        ('ยอดชำระใกล้ครบกำหนด · ' || ps.schedule_type),
        GREATEST(ps.due_amount - ps.verified_amount, 0), co.currency::text,
        ps.due_at, ps.created_at
      FROM public.payment_schedules ps
      JOIN public.customer_orders co ON co.id = ps.order_id
      WHERE co.member_profile_id = member_id
        AND ps.status IN ('PENDING', 'PARTIALLY_VERIFIED')
        AND ps.due_at >= NOW()
        AND ps.due_at < NOW() + INTERVAL '7 days'
        AND ps.due_amount > ps.verified_amount
    ) candidates
    ORDER BY priority, due_at NULLS LAST, created_at DESC
    LIMIT 20
  ) q;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'metrics', jsonb_build_object(
      'action_required', jsonb_array_length(actions),
      'active_orders', active_order_count,
      'orders_in_production', production_order_count,
      'shipments_in_transit', in_transit_count,
      'upcoming_deliveries', upcoming_delivery_count,
      'open_claims', open_claim_count,
      'outstanding_by_currency', outstanding_by_currency
    ),
    'actions', actions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_operations_dashboard()
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  can_orders BOOLEAN;
  can_payments BOOLEAN;
  can_production BOOLEAN;
  can_qc BOOLEAN;
  can_shipments BOOLEAN;
  can_deliveries BOOLEAN;
  can_claims BOOLEAN;
  actions JSONB;
BEGIN
  IF NOT public.current_user_is_internal() THEN
    RAISE EXCEPTION 'internal access required';
  END IF;

  can_orders := public.has_permission('orders.manage');
  can_payments := public.has_permission('payments.verify');
  can_production := public.has_permission('production.manage');
  can_qc := public.has_permission('qc.manage');
  can_shipments := public.has_permission('shipments.manage');
  can_deliveries := public.has_permission('deliveries.manage');
  can_claims := public.has_permission('claims.manage');

  SELECT COALESCE(
    jsonb_agg(to_jsonb(q) ORDER BY q.priority, q.due_at NULLS LAST, q.created_at DESC),
    '[]'::jsonb
  )
  INTO actions
  FROM (
    SELECT *
    FROM (
      SELECT
        1 AS priority, 'PAYMENT_REVIEW'::text AS action_type,
        pt.id AS entity_id, co.id AS order_id, pt.transfer_number AS reference,
        'ตรวจหลักฐานชำระเงิน'::text AS title,
        ps.due_at, pt.created_at
      FROM public.payment_transfers pt
      JOIN public.payment_schedules ps ON ps.id = pt.payment_schedule_id
      JOIN public.customer_orders co ON co.id = ps.order_id
      WHERE can_payments AND pt.status = 'SUBMITTED'

      UNION ALL

      SELECT
        1, 'ISSUE_PO', co.id, co.id, co.order_number,
        'มัดจำผ่านแล้ว — รอออก PO',
        NULL::timestamptz, co.created_at
      FROM public.customer_orders co
      WHERE can_orders
        AND co.status = 'DEPOSIT_VERIFIED'
        AND NOT EXISTS (
          SELECT 1 FROM public.supplier_orders so
          WHERE so.customer_order_id = co.id
            AND so.po_issued_at IS NOT NULL
        )

      UNION ALL

      SELECT
        2, 'PRODUCTION_DELAY', latest.supplier_order_id,
        latest.customer_order_id, latest.order_number,
        'Production ล่าช้า',
        latest.estimated_completion_at, latest.created_at
      FROM (
        SELECT DISTINCT ON (pu.supplier_order_id)
          pu.supplier_order_id, so.customer_order_id, co.order_number,
          pu.status, pu.estimated_completion_at, pu.created_at
        FROM public.production_updates pu
        JOIN public.supplier_orders so ON so.id = pu.supplier_order_id
        JOIN public.customer_orders co ON co.id = so.customer_order_id
        ORDER BY pu.supplier_order_id, pu.created_at DESC
      ) latest
      WHERE can_production AND latest.status = 'DELAYED'

      UNION ALL

      SELECT
        2, 'QC_ACTION', oi.id, co.id, co.order_number,
        CASE oi.qc_status
          WHEN 'REWORK_REQUIRED' THEN 'QC รอ Rework'
          ELSE 'QC รอ Member อนุมัติ'
        END,
        NULL::timestamptz, oi.created_at
      FROM public.order_items oi
      JOIN public.customer_orders co ON co.id = oi.order_id
      WHERE can_qc
        AND oi.qc_status IN ('REWORK_REQUIRED', 'WAITING_MEMBER_APPROVAL')

      UNION ALL

      SELECT
        3, 'SHIPMENT_DELAY', s.id, s.customer_order_id, s.shipment_number,
        'Shipment ETA ล่าช้า',
        s.estimated_arrival_at, s.created_at
      FROM public.shipments s
      WHERE can_shipments
        AND s.status IN (
          'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
          'ARRIVED_THAILAND', 'IMPORT_CUSTOMS'
        )
        AND (
          s.delay_reason IS NOT NULL
          OR (s.estimated_arrival_at IS NOT NULL AND s.estimated_arrival_at < NOW())
        )

      UNION ALL

      SELECT
        3, 'DELIVERY_DUE', d.id, d.customer_order_id, d.delivery_number,
        CASE WHEN d.status = 'PROPOSED'
          THEN 'Delivery รอ Member ยืนยัน'
          ELSE 'Delivery ใกล้ถึงกำหนด'
        END,
        d.scheduled_at, d.created_at
      FROM public.deliveries d
      WHERE can_deliveries
        AND d.status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')
        AND (
          d.status = 'PROPOSED'
          OR (d.scheduled_at IS NOT NULL AND d.scheduled_at < NOW() + INTERVAL '2 days')
        )

      UNION ALL

      SELECT
        2, 'CLAIM_ACTION', c.id, oi.order_id, c.claim_number,
        CASE
          WHEN c.target_resolution_at IS NOT NULL AND c.target_resolution_at < NOW()
            THEN 'Claim เกิน SLA'
          WHEN c.status = 'WAITING_INFORMATION'
            THEN 'Claim รอข้อมูล'
          ELSE 'Claim รอตรวจ'
        END,
        c.target_resolution_at, c.created_at
      FROM public.claims c
      JOIN public.order_items oi ON oi.id = c.order_item_id
      WHERE can_claims
        AND c.status NOT IN ('CLOSED', 'REJECTED')
        AND (
          c.status IN ('SUBMITTED', 'WAITING_INFORMATION')
          OR (c.target_resolution_at IS NOT NULL AND c.target_resolution_at < NOW())
        )
    ) candidates
    ORDER BY priority, due_at NULLS LAST, created_at DESC
    LIMIT 50
  ) q;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'permissions', jsonb_build_object(
      'orders', can_orders,
      'payments', can_payments,
      'production', can_production,
      'qc', can_qc,
      'shipments', can_shipments,
      'deliveries', can_deliveries,
      'claims', can_claims,
      'reports', public.has_permission('reports.fixed.read'),
      'executive', public.has_permission('reports.executive.read')
    ),
    'metrics', jsonb_build_object(
      'action_required', jsonb_array_length(actions),
      'active_orders', CASE WHEN can_orders THEN (
        SELECT COUNT(*) FROM public.customer_orders
        WHERE status NOT IN ('COMPLETED', 'CANCELLED')
      ) ELSE NULL END,
      'payment_reviews', CASE WHEN can_payments THEN (
        SELECT COUNT(*) FROM public.payment_transfers WHERE status = 'SUBMITTED'
      ) ELSE NULL END,
      'production_delays', CASE WHEN can_production THEN (
        SELECT COUNT(*)
        FROM (
          SELECT DISTINCT ON (supplier_order_id) supplier_order_id, status
          FROM public.production_updates
          ORDER BY supplier_order_id, created_at DESC
        ) latest
        WHERE latest.status = 'DELAYED'
      ) ELSE NULL END,
      'qc_actions', CASE WHEN can_qc THEN (
        SELECT COUNT(*) FROM public.order_items
        WHERE qc_status IN ('REWORK_REQUIRED', 'WAITING_MEMBER_APPROVAL')
      ) ELSE NULL END,
      'shipments_in_transit', CASE WHEN can_shipments THEN (
        SELECT COUNT(*) FROM public.shipments
        WHERE status IN (
          'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
          'ARRIVED_THAILAND', 'IMPORT_CUSTOMS'
        )
      ) ELSE NULL END,
      'deliveries_due', CASE WHEN can_deliveries THEN (
        SELECT COUNT(*) FROM public.deliveries
        WHERE status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')
          AND scheduled_at IS NOT NULL
          AND scheduled_at < NOW() + INTERVAL '7 days'
      ) ELSE NULL END,
      'open_claims', CASE WHEN can_claims THEN (
        SELECT COUNT(*) FROM public.claims
        WHERE status NOT IN ('CLOSED', 'REJECTED')
      ) ELSE NULL END
    ),
    'actions', actions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_executive_dashboard(
  date_from_input DATE,
  date_to_input DATE
)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  range_end TIMESTAMPTZ;
  order_value JSONB;
  collected JSONB;
  outstanding JSONB;
  supplier_payable JSONB;
  freight_outstanding JSONB;
BEGIN
  IF NOT public.has_permission('reports.executive.read') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF date_from_input IS NULL OR date_to_input IS NULL
     OR date_from_input > date_to_input
     OR date_to_input - date_from_input > 366 THEN
    RAISE EXCEPTION 'invalid report date range';
  END IF;
  range_end := (date_to_input + 1)::timestamptz;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO order_value
  FROM (
    SELECT co.currency::text AS currency, SUM(co.grand_total) AS amount
    FROM public.customer_orders co
    WHERE co.status <> 'CANCELLED'
      AND co.created_at >= date_from_input::timestamptz
      AND co.created_at < range_end
    GROUP BY co.currency
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO collected
  FROM (
    SELECT co.currency::text AS currency, SUM(ps.verified_amount) AS amount
    FROM public.payment_schedules ps
    JOIN public.customer_orders co ON co.id = ps.order_id
    WHERE ps.status <> 'CANCELLED'
      AND ps.created_at >= date_from_input::timestamptz
      AND ps.created_at < range_end
    GROUP BY co.currency
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO outstanding
  FROM (
    SELECT co.currency::text AS currency,
           SUM(GREATEST(ps.due_amount - ps.verified_amount, 0)) AS amount
    FROM public.payment_schedules ps
    JOIN public.customer_orders co ON co.id = ps.order_id
    WHERE ps.status <> 'CANCELLED'
      AND ps.created_at >= date_from_input::timestamptz
      AND ps.created_at < range_end
    GROUP BY co.currency
    HAVING SUM(GREATEST(ps.due_amount - ps.verified_amount, 0)) > 0
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO supplier_payable
  FROM (
    SELECT so.supplier_currency::text AS currency,
           SUM(GREATEST(sps.due_amount - sps.paid_amount, 0)) AS amount
    FROM public.supplier_payment_schedules sps
    JOIN public.supplier_orders so ON so.id = sps.supplier_order_id
    WHERE sps.status <> 'PAID'
      AND sps.created_at >= date_from_input::timestamptz
      AND sps.created_at < range_end
    GROUP BY so.supplier_currency
    HAVING SUM(GREATEST(sps.due_amount - sps.paid_amount, 0)) > 0
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO freight_outstanding
  FROM (
    SELECT fi.currency::text AS currency,
           SUM(CASE WHEN fi.status = 'PAID' THEN 0 ELSE fi.grand_total END) AS amount
    FROM public.freight_invoices fi
    WHERE fi.status <> 'CANCELLED'
      AND fi.created_at >= date_from_input::timestamptz
      AND fi.created_at < range_end
    GROUP BY fi.currency
    HAVING SUM(CASE WHEN fi.status = 'PAID' THEN 0 ELSE fi.grand_total END) > 0
  ) x;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'filters', jsonb_build_object(
      'date_from', date_from_input,
      'date_to', date_to_input
    ),
    'financial', jsonb_build_object(
      'order_value', order_value,
      'collected', collected,
      'customer_outstanding', outstanding,
      'supplier_payable', supplier_payable,
      'freight_outstanding', freight_outstanding
    ),
    'operational', jsonb_build_object(
      'active_orders', (
        SELECT COUNT(*) FROM public.customer_orders
        WHERE status NOT IN ('COMPLETED', 'CANCELLED')
      ),
      'orders_in_production', (
        SELECT COUNT(*) FROM public.customer_orders WHERE status = 'IN_PRODUCTION'
      ),
      'production_delayed', (
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (supplier_order_id) supplier_order_id, status
          FROM public.production_updates
          ORDER BY supplier_order_id, created_at DESC
        ) latest WHERE latest.status = 'DELAYED'
      ),
      'qc_issues', (
        SELECT COUNT(*) FROM public.order_items
        WHERE qc_status IN ('FAILED', 'REWORK_REQUIRED', 'ADDITIONAL_REVIEW_REQUESTED')
      ),
      'goods_in_transit', (
        SELECT COUNT(*) FROM public.shipments
        WHERE status IN (
          'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
          'ARRIVED_THAILAND', 'IMPORT_CUSTOMS'
        )
      ),
      'deliveries_due', (
        SELECT COUNT(*) FROM public.deliveries
        WHERE status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')
          AND scheduled_at IS NOT NULL
          AND scheduled_at < NOW() + INTERVAL '7 days'
      ),
      'open_claims', (
        SELECT COUNT(*) FROM public.claims
        WHERE status NOT IN ('CLOSED', 'REJECTED')
      )
    ),
    'business', jsonb_build_object(
      'active_members', (
        SELECT COUNT(*) FROM public.member_profiles mp
        JOIN public.organizations o ON o.id = mp.organization_id
        WHERE o.status = 'ACTIVE'
      ),
      'members_with_orders', (
        SELECT COUNT(DISTINCT member_profile_id)
        FROM public.customer_orders
        WHERE status <> 'CANCELLED'
      ),
      'active_suppliers', (
        SELECT COUNT(*) FROM public.suppliers WHERE status = 'ACTIVE'
      ),
      'active_products', (
        SELECT COUNT(*) FROM public.products WHERE status = 'PUBLISHED'
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fixed_report(
  report_type_input TEXT,
  date_from_input DATE,
  date_to_input DATE,
  status_filter_input TEXT DEFAULT NULL,
  row_limit_input INTEGER DEFAULT 500,
  row_offset_input INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  member_id UUID := public.current_member_profile_id();
  internal_access BOOLEAN := public.current_user_is_internal();
  normalized_type TEXT := LOWER(BTRIM(report_type_input));
  normalized_status TEXT := NULLIF(UPPER(BTRIM(status_filter_input)), '');
  range_end TIMESTAMPTZ;
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(row_limit_input, 500), 1), 500);
  safe_offset INTEGER := GREATEST(COALESCE(row_offset_input, 0), 0);
  rows_value JSONB := '[]'::jsonb;
BEGIN
  IF member_id IS NULL AND NOT (
    internal_access AND public.has_permission('reports.fixed.read')
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF normalized_type NOT IN ('order', 'payment', 'delay', 'delivery', 'claim') THEN
    RAISE EXCEPTION 'unsupported report type';
  END IF;
  IF date_from_input IS NULL OR date_to_input IS NULL
     OR date_from_input > date_to_input
     OR date_to_input - date_from_input > 366 THEN
    RAISE EXCEPTION 'invalid report date range';
  END IF;
  range_end := (date_to_input + 1)::timestamptz;

  CASE normalized_type
    WHEN 'order' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT
          co.id, co.order_number, co.status, co.currency::text AS currency,
          co.grand_total, co.created_at, p.name AS project_name,
          mp.company_name AS member_company
        FROM public.customer_orders co
        LEFT JOIN public.projects p ON p.id = co.project_id
        LEFT JOIN public.member_profiles mp ON mp.id = co.member_profile_id
        WHERE (internal_access OR co.member_profile_id = member_id)
          AND co.created_at >= date_from_input::timestamptz
          AND co.created_at < range_end
          AND (normalized_status IS NULL OR co.status = normalized_status)
        ORDER BY co.created_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;

    WHEN 'payment' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT
          ps.id, co.id AS order_id, co.order_number,
          ps.schedule_type, ps.status, co.currency::text AS currency,
          ps.due_amount, ps.verified_amount,
          GREATEST(ps.due_amount - ps.verified_amount, 0) AS outstanding_amount,
          ps.due_at, ps.verified_at, ps.created_at,
          mp.company_name AS member_company
        FROM public.payment_schedules ps
        JOIN public.customer_orders co ON co.id = ps.order_id
        LEFT JOIN public.member_profiles mp ON mp.id = co.member_profile_id
        WHERE (internal_access OR co.member_profile_id = member_id)
          AND ps.created_at >= date_from_input::timestamptz
          AND ps.created_at < range_end
          AND (normalized_status IS NULL OR ps.status = normalized_status)
        ORDER BY ps.created_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;

    WHEN 'delay' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.event_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT *
        FROM (
          SELECT
            pu.id, 'PRODUCTION'::text AS delay_type,
            so.customer_order_id AS order_id, co.order_number AS reference,
            pu.status, pu.delay_reason AS detail,
            pu.estimated_completion_at AS target_at,
            pu.created_at AS event_at
          FROM public.production_updates pu
          JOIN public.supplier_orders so ON so.id = pu.supplier_order_id
          JOIN public.customer_orders co ON co.id = so.customer_order_id
          WHERE pu.status = 'DELAYED'
            AND (internal_access OR (
              co.member_profile_id = member_id AND pu.is_member_visible
            ))
            AND pu.created_at >= date_from_input::timestamptz
            AND pu.created_at < range_end

          UNION ALL

          SELECT
            sh.id, 'SHIPMENT', s.customer_order_id, s.shipment_number,
            sh.status, sh.note, sh.eta_at, sh.event_at
          FROM public.shipment_status_history sh
          JOIN public.shipments s ON s.id = sh.shipment_id
          JOIN public.customer_orders co ON co.id = s.customer_order_id
          WHERE sh.is_delay
            AND (internal_access OR (
              co.member_profile_id = member_id AND sh.is_member_visible
            ))
            AND sh.event_at >= date_from_input::timestamptz
            AND sh.event_at < range_end

          UNION ALL

          SELECT
            d.id, 'DELIVERY', d.customer_order_id, d.delivery_number,
            d.status,
            CASE
              WHEN d.status = 'FAILED' THEN d.failure_reason
              ELSE d.next_delivery_plan
            END,
            d.scheduled_at, COALESCE(d.updated_at, d.created_at)
          FROM public.deliveries d
          JOIN public.customer_orders co ON co.id = d.customer_order_id
          WHERE (internal_access OR co.member_profile_id = member_id)
            AND (
              d.status IN ('FAILED', 'RESCHEDULE_REQUIRED')
              OR (
                d.scheduled_at < NOW()
                AND d.status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE')
              )
            )
            AND COALESCE(d.updated_at, d.created_at) >= date_from_input::timestamptz
            AND COALESCE(d.updated_at, d.created_at) < range_end
        ) delay_rows
        WHERE normalized_status IS NULL OR delay_rows.status = normalized_status
        ORDER BY event_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;

    WHEN 'delivery' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT
          d.id, d.customer_order_id AS order_id, d.delivery_number,
          co.order_number, d.status, d.scheduled_at,
          d.scheduled_window_end_at, d.delivered_at, d.created_at,
          (d.status IN ('PARTIALLY_DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')) AS issue_flag,
          mp.company_name AS member_company
        FROM public.deliveries d
        JOIN public.customer_orders co ON co.id = d.customer_order_id
        LEFT JOIN public.member_profiles mp ON mp.id = co.member_profile_id
        WHERE (internal_access OR co.member_profile_id = member_id)
          AND d.created_at >= date_from_input::timestamptz
          AND d.created_at < range_end
          AND (normalized_status IS NULL OR d.status = normalized_status)
        ORDER BY d.created_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;

    WHEN 'claim' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT
          c.id, oi.order_id, c.claim_number, co.order_number,
          c.subject, c.issue_type, c.severity, c.status,
          c.suggested_responsibility, c.confirmed_responsibility,
          c.target_resolution_at, c.created_at, c.closed_at,
          mp.company_name AS member_company
        FROM public.claims c
        JOIN public.order_items oi ON oi.id = c.order_item_id
        JOIN public.customer_orders co ON co.id = oi.order_id
        LEFT JOIN public.member_profiles mp ON mp.id = c.member_profile_id
        WHERE (internal_access OR c.member_profile_id = member_id)
          AND c.created_at >= date_from_input::timestamptz
          AND c.created_at < range_end
          AND (normalized_status IS NULL OR c.status = normalized_status)
        ORDER BY c.created_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;
  END CASE;

  RETURN jsonb_build_object(
    'report_type', normalized_type,
    'generated_at', NOW(),
    'filters', jsonb_build_object(
      'date_from', date_from_input,
      'date_to', date_to_input,
      'status', normalized_status,
      'limit', safe_limit,
      'offset', safe_offset
    ),
    'row_count', jsonb_array_length(rows_value),
    'rows', rows_value
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_fixed_report_export(
  report_type_input TEXT,
  filters_input JSONB,
  row_count_input INTEGER
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  member_id UUID := public.current_member_profile_id();
  internal_access BOOLEAN := public.current_user_is_internal();
  normalized_type TEXT := LOWER(BTRIM(report_type_input));
  audit_id UUID;
BEGIN
  IF member_id IS NULL AND NOT (
    internal_access AND public.has_permission('reports.fixed.export')
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF normalized_type NOT IN ('order', 'payment', 'delay', 'delivery', 'claim') THEN
    RAISE EXCEPTION 'unsupported report type';
  END IF;
  IF row_count_input IS NULL OR row_count_input < 0 OR row_count_input > 500 THEN
    RAISE EXCEPTION 'invalid export row count';
  END IF;

  audit_id := public.write_audit_event(
    public.current_user_org_id(),
    'fixed_report',
    (SELECT auth.uid()),
    'EXPORTED',
    NULL,
    jsonb_build_object(
      'report_type', normalized_type,
      'filters', COALESCE(filters_input, '{}'::jsonb),
      'row_count', row_count_input,
      'generated_at', NOW()
    )
  );
  RETURN audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_dashboard()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_admin_operations_dashboard()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_executive_dashboard(DATE, DATE)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_fixed_report(TEXT, DATE, DATE, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.record_fixed_report_export(TEXT, JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_member_dashboard()
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_admin_operations_dashboard()
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_executive_dashboard(DATE, DATE)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_fixed_report(TEXT, DATE, DATE, TEXT, INTEGER, INTEGER)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_fixed_report_export(TEXT, JSONB, INTEGER)
  TO authenticated;

ALTER TABLE public.material_samples
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS member_note TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;

UPDATE public.material_samples ms
SET display_name = COALESCE(
  NULLIF(BTRIM(ms.display_name), ''),
  (SELECT p.name_th FROM public.products p WHERE p.id = ms.product_id),
  (SELECT pov.label FROM public.product_option_values pov WHERE pov.id = ms.option_value_id),
  ms.sample_code
)
WHERE ms.display_name IS NULL OR BTRIM(ms.display_name) = '';

ALTER TABLE public.material_samples
  ALTER COLUMN display_name SET NOT NULL,
  DROP CONSTRAINT IF EXISTS material_samples_display_name_check,
  ADD CONSTRAINT material_samples_display_name_check
    CHECK (CHAR_LENGTH(BTRIM(display_name)) BETWEEN 2 AND 160),
  DROP CONSTRAINT IF EXISTS material_samples_sort_order_check,
  ADD CONSTRAINT material_samples_sort_order_check CHECK (sort_order BETWEEN 0 AND 10000);

CREATE INDEX IF NOT EXISTS material_samples_product_status_sort_idx
  ON public.material_samples(product_id, availability_status, sort_order, sample_code)
  WHERE product_id IS NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS warranty_version_id UUID
    REFERENCES public.partner_warranty_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS warranty_terms_snapshot JSONB;

CREATE OR REPLACE FUNCTION public.resolve_partner_warranty_snapshot(
  supplier_id_input UUID,
  product_id_input UUID,
  captured_at_input TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(warranty_version_id UUID, warranty_snapshot JSONB)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH selected AS (
    SELECT pw.*
    FROM public.partner_warranty_versions pw
    WHERE pw.supplier_id = supplier_id_input
      AND (pw.product_id = product_id_input OR pw.product_id IS NULL)
      AND pw.status IN ('ACTIVE', 'RETIRED')
      AND pw.effective_from <= captured_at_input
      AND (pw.effective_until IS NULL OR pw.effective_until > captured_at_input)
    ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
    LIMIT 1
  )
  SELECT
    selected.id,
    jsonb_build_object(
      'version_number', selected.version_number,
      'title', selected.title,
      'member_summary', selected.member_summary,
      'terms_text', selected.terms_text,
      'duration_months', selected.duration_months,
      'effective_from', selected.effective_from,
      'captured_at', captured_at_input,
      'source', 'PARTNER_WARRANTY'
    )
  FROM selected
  UNION ALL
  SELECT
    NULL::UUID,
    jsonb_build_object(
      'version_number', 1,
      'title', 'เงื่อนไขรับประกันของ Partner ณ วันที่สั่งซื้อ',
      'member_summary', 'ทีม GISP จะตรวจสอบตามหลักฐานและเงื่อนไขที่ผูกกับรายการสั่งซื้อ',
      'terms_text', 'การซ่อม เปลี่ยนสินค้า หรือชดเชยต้องผ่านการตรวจสอบของ Order Admin และไม่เกิดขึ้นอัตโนมัติ',
      'duration_months', NULL,
      'captured_at', captured_at_input,
      'source', 'DEFAULT'
    )
  WHERE NOT EXISTS (SELECT 1 FROM selected)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.capture_order_item_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  product_id_value UUID;
  supplier_id_value UUID;
  resolved RECORD;
BEGIN
  SELECT pi.product_id INTO product_id_value
  FROM public.project_items pi
  WHERE pi.id = NEW.project_item_id;

  IF product_id_value IS NOT NULL THEN
    SELECT p.supplier_id INTO supplier_id_value
    FROM public.products p
    WHERE p.id = product_id_value;
  ELSE
    SELECT cqc.supplier_id INTO supplier_id_value
    FROM public.project_items pi
    JOIN public.custom_quotation_items cqi ON cqi.id = pi.quotation_item_id
    JOIN public.custom_quotation_costs cqc ON cqc.quotation_id = cqi.quotation_id
    WHERE pi.id = NEW.project_item_id;
  END IF;

  SELECT * INTO resolved
  FROM public.resolve_partner_warranty_snapshot(
    supplier_id_value,
    product_id_value,
    COALESCE(NEW.created_at, NOW())
  );

  NEW.warranty_version_id := resolved.warranty_version_id;
  NEW.warranty_terms_snapshot := resolved.warranty_snapshot;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_capture_warranty_snapshot ON public.order_items;

CREATE TRIGGER order_items_capture_warranty_snapshot
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.capture_order_item_warranty_snapshot();

DO $$
DECLARE
  item RECORD;
  resolved RECORD;
BEGIN
  FOR item IN
    SELECT oi.id, oi.created_at, pi.product_id, so.supplier_id
    FROM public.order_items oi
    JOIN public.project_items pi ON pi.id = oi.project_item_id
    LEFT JOIN public.supplier_order_items soi ON soi.order_item_id = oi.id
    LEFT JOIN public.supplier_orders so ON so.id = soi.supplier_order_id
    WHERE oi.warranty_terms_snapshot IS NULL
  LOOP
    SELECT * INTO resolved
    FROM public.resolve_partner_warranty_snapshot(
      item.supplier_id,
      item.product_id,
      item.created_at
    );
    UPDATE public.order_items
    SET warranty_version_id = resolved.warranty_version_id,
        warranty_terms_snapshot = resolved.warranty_snapshot
    WHERE id = item.id;
  END LOOP;
END;
$$;

ALTER TABLE public.order_items
  ALTER COLUMN warranty_terms_snapshot SET NOT NULL;

CREATE INDEX IF NOT EXISTS order_items_warranty_version_idx
  ON public.order_items(warranty_version_id)
  WHERE warranty_version_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_order_item_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  IF NEW.warranty_version_id IS DISTINCT FROM OLD.warranty_version_id
     OR NEW.warranty_terms_snapshot IS DISTINCT FROM OLD.warranty_terms_snapshot THEN
    RAISE EXCEPTION 'ORDER_WARRANTY_SNAPSHOT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_warranty_snapshot_immutable ON public.order_items;

CREATE TRIGGER order_items_warranty_snapshot_immutable
BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.protect_order_item_warranty_snapshot();

CREATE OR REPLACE FUNCTION public.apply_claim_order_warranty_snapshot()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  order_item_record RECORD;
BEGIN
  SELECT oi.warranty_version_id, oi.warranty_terms_snapshot
  INTO order_item_record
  FROM public.order_items oi
  WHERE oi.id = NEW.order_item_id;

  IF order_item_record.warranty_terms_snapshot IS NOT NULL THEN
    NEW.warranty_version_id := order_item_record.warranty_version_id;
    NEW.warranty_snapshot := order_item_record.warranty_terms_snapshot;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claims_apply_order_warranty_snapshot ON public.claims;

CREATE TRIGGER claims_apply_order_warranty_snapshot
BEFORE INSERT ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.apply_claim_order_warranty_snapshot();

CREATE OR REPLACE FUNCTION public.create_supplier_sample_location(
  supplier_id_input UUID,
  country_code_input TEXT,
  city_input TEXT,
  location_type_input TEXT,
  public_label_input TEXT,
  address_line_input TEXT DEFAULT NULL,
  contact_name_input TEXT DEFAULT NULL,
  contact_email_input TEXT DEFAULT NULL,
  contact_phone_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  location_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.sample.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF location_type_input NOT IN ('FACTORY','SHOWROOM','WAREHOUSE')
     OR NULLIF(BTRIM(city_input), '') IS NULL
     OR NULLIF(BTRIM(public_label_input), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: SAMPLE_LOCATION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id_input AND s.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT: SUPPLIER';
  END IF;

  INSERT INTO public.supplier_locations(
    supplier_id, country_code, city, location_type, public_label,
    address_line, contact_name, contact_email, contact_phone, status
  ) VALUES (
    supplier_id_input, UPPER(BTRIM(country_code_input)), BTRIM(city_input),
    location_type_input, BTRIM(public_label_input), NULLIF(BTRIM(address_line_input), ''),
    NULLIF(BTRIM(contact_name_input), ''), NULLIF(BTRIM(contact_email_input), ''),
    NULLIF(BTRIM(contact_phone_input), ''), 'ACTIVE'
  ) RETURNING id INTO location_id_value;

  PERFORM public.write_audit_event(
    NULL, 'supplier_location', location_id_value, 'CREATED', NULL,
    jsonb_build_object('supplierId', supplier_id_input, 'publicLabel', BTRIM(public_label_input))
  );
  RETURN location_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_material_sample(
  product_id_input UUID,
  supplier_location_id_input UUID,
  sample_code_input TEXT,
  sample_type_input TEXT,
  display_name_input TEXT,
  member_note_input TEXT DEFAULT NULL,
  shelf_location_input TEXT DEFAULT NULL,
  internal_note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  product_record RECORD;
  location_record RECORD;
  sample_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.sample.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF sample_type_input NOT IN ('MATERIAL_SWATCH','BUILT_IN_DISPLAY')
     OR NULLIF(BTRIM(sample_code_input), '') IS NULL
     OR CHAR_LENGTH(BTRIM(display_name_input)) < 2 THEN
    RAISE EXCEPTION 'INVALID_INPUT: MATERIAL_SAMPLE';
  END IF;

  SELECT p.id, p.supplier_id, p.product_type, p.status
  INTO product_record
  FROM public.products p
  WHERE p.id = product_id_input;
  SELECT sl.id, sl.supplier_id, sl.status
  INTO location_record
  FROM public.supplier_locations sl
  WHERE sl.id = supplier_location_id_input;

  IF product_record.id IS NULL OR location_record.id IS NULL
     OR product_record.supplier_id IS DISTINCT FROM location_record.supplier_id
     OR location_record.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'INVALID_INPUT: SAMPLE_PRODUCT_LOCATION';
  END IF;
  IF sample_type_input = 'BUILT_IN_DISPLAY'
     AND product_record.product_type <> 'BUILT_IN' THEN
    RAISE EXCEPTION 'INVALID_INPUT: BUILT_IN_DISPLAY_REQUIRES_BUILT_IN_PRODUCT';
  END IF;

  INSERT INTO public.material_samples(
    sample_code, sample_type, product_id, supplier_location_id, display_name,
    member_note, shelf_location, availability_status, internal_note, created_by
  ) VALUES (
    UPPER(BTRIM(sample_code_input)), sample_type_input, product_id_input,
    supplier_location_id_input, BTRIM(display_name_input),
    NULLIF(BTRIM(member_note_input), ''), NULLIF(BTRIM(shelf_location_input), ''),
    'AVAILABLE', NULLIF(BTRIM(internal_note_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO sample_id_value;

  PERFORM public.write_audit_event(
    NULL, 'material_sample', sample_id_value, 'CREATED', NULL,
    jsonb_build_object('sampleCode', UPPER(BTRIM(sample_code_input)),
      'sampleType', sample_type_input, 'productId', product_id_input)
  );
  RETURN sample_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_material_sample_status(
  sample_id_input UUID,
  status_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.sample.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF status_input NOT IN ('AVAILABLE','BORROWED','UNAVAILABLE') THEN
    RAISE EXCEPTION 'INVALID_INPUT: SAMPLE_STATUS';
  END IF;
  SELECT to_jsonb(ms) INTO before_value
  FROM public.material_samples ms WHERE ms.id = sample_id_input FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  UPDATE public.material_samples
  SET availability_status = status_input
  WHERE id = sample_id_input;
  PERFORM public.write_audit_event(
    NULL, 'material_sample', sample_id_input, 'STATUS_CHANGED', before_value,
    jsonb_build_object('availabilityStatus', status_input)
  );
  RETURN sample_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_partner_warranty_draft(
  supplier_id_input UUID,
  product_id_input UUID,
  title_input TEXT,
  member_summary_input TEXT,
  terms_text_input TEXT,
  duration_months_input INTEGER,
  effective_from_input TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  warranty_id_value UUID;
  version_number_value INTEGER;
BEGIN
  IF NOT public.has_permission('catalog.warranty.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NULLIF(BTRIM(title_input), '') IS NULL
     OR NULLIF(BTRIM(member_summary_input), '') IS NULL
     OR NULLIF(BTRIM(terms_text_input), '') IS NULL
     OR (duration_months_input IS NOT NULL AND duration_months_input <= 0) THEN
    RAISE EXCEPTION 'INVALID_INPUT: PARTNER_WARRANTY';
  END IF;
  PERFORM 1 FROM public.suppliers s WHERE s.id = supplier_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF product_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id_input AND p.supplier_id = supplier_id_input
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT: WARRANTY_PRODUCT_SUPPLIER';
  END IF;

  SELECT COALESCE(MAX(pw.version_number), 0) + 1
  INTO version_number_value
  FROM public.partner_warranty_versions pw
  WHERE pw.supplier_id = supplier_id_input
    AND pw.product_id IS NOT DISTINCT FROM product_id_input;

  INSERT INTO public.partner_warranty_versions(
    supplier_id, product_id, version_number, title, member_summary, terms_text,
    duration_months, status, effective_from, created_by
  ) VALUES (
    supplier_id_input, product_id_input, version_number_value, BTRIM(title_input),
    BTRIM(member_summary_input), BTRIM(terms_text_input), duration_months_input,
    'DRAFT', COALESCE(effective_from_input, NOW()), (SELECT auth.uid())
  ) RETURNING id INTO warranty_id_value;

  PERFORM public.write_audit_event(
    NULL, 'partner_warranty', warranty_id_value, 'DRAFT_CREATED', NULL,
    jsonb_build_object('supplierId', supplier_id_input, 'productId', product_id_input,
      'versionNumber', version_number_value)
  );
  RETURN warranty_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_partner_warranty_version(
  warranty_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_record public.partner_warranty_versions%ROWTYPE;
BEGIN
  IF NOT public.has_permission('catalog.warranty.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  SELECT * INTO target_record
  FROM public.partner_warranty_versions
  WHERE id = warranty_id_input FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF target_record.status <> 'DRAFT' OR target_record.effective_from > NOW() THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: WARRANTY_NOT_ACTIVATABLE';
  END IF;

  UPDATE public.partner_warranty_versions
  SET status = 'RETIRED', effective_until = NOW()
  WHERE supplier_id = target_record.supplier_id
    AND product_id IS NOT DISTINCT FROM target_record.product_id
    AND status = 'ACTIVE';

  UPDATE public.partner_warranty_versions
  SET status = 'ACTIVE', effective_until = NULL,
      activated_by = (SELECT auth.uid()), activated_at = NOW()
  WHERE id = warranty_id_input;

  PERFORM public.write_audit_event(
    NULL, 'partner_warranty', warranty_id_input, 'ACTIVATED',
    jsonb_build_object('status', target_record.status),
    jsonb_build_object('status', 'ACTIVE', 'versionNumber', target_record.version_number)
  );
  RETURN warranty_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_partner_warranty_version(
  warranty_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.warranty.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  SELECT to_jsonb(pw) INTO before_value
  FROM public.partner_warranty_versions pw
  WHERE pw.id = warranty_id_input AND pw.status = 'ACTIVE' FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  UPDATE public.partner_warranty_versions
  SET status = 'RETIRED', effective_until = NOW()
  WHERE id = warranty_id_input;
  PERFORM public.write_audit_event(
    NULL, 'partner_warranty', warranty_id_input, 'RETIRED', before_value,
    jsonb_build_object('status', 'RETIRED')
  );
  RETURN warranty_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_product_catalog_extras(
  product_id_input UUID
)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  samples_value JSONB;
  warranty_value JSONB;
BEGIN
  IF public.current_member_profile_id() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id_input AND p.status = 'PUBLISHED' AND p.qa_status = 'PASSED'
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ms.id,
    'sample_code', ms.sample_code,
    'sample_type', ms.sample_type,
    'display_name', ms.display_name,
    'member_note', ms.member_note,
    'availability_status', ms.availability_status,
    'country_code', sl.country_code,
    'city', sl.city,
    'public_location_label', sl.public_label
  ) ORDER BY ms.sort_order, ms.sample_code), '[]'::JSONB)
  INTO samples_value
  FROM public.material_samples ms
  JOIN public.supplier_locations sl ON sl.id = ms.supplier_location_id
  WHERE ms.product_id = product_id_input AND sl.status = 'ACTIVE';

  SELECT jsonb_build_object(
    'version_number', pw.version_number,
    'title', pw.title,
    'member_summary', pw.member_summary,
    'terms_text', pw.terms_text,
    'duration_months', pw.duration_months,
    'effective_from', pw.effective_from
  )
  INTO warranty_value
  FROM public.partner_warranty_versions pw
  JOIN public.products p ON p.id = product_id_input
  WHERE pw.supplier_id = p.supplier_id
    AND (pw.product_id = product_id_input OR pw.product_id IS NULL)
    AND pw.status = 'ACTIVE'
    AND pw.effective_from <= NOW()
    AND (pw.effective_until IS NULL OR pw.effective_until > NOW())
  ORDER BY (pw.product_id IS NOT NULL) DESC, pw.version_number DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'samples', samples_value,
    'warranty', warranty_value
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_partner_warranty_snapshot(UUID,UUID,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.capture_order_item_warranty_snapshot() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.protect_order_item_warranty_snapshot() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.apply_claim_order_warranty_snapshot() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_supplier_sample_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_material_sample(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_material_sample_status(UUID,TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_partner_warranty_draft(UUID,UUID,TEXT,TEXT,TEXT,INTEGER,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.activate_partner_warranty_version(UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.retire_partner_warranty_version(UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_member_product_catalog_extras(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_supplier_sample_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_material_sample(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_material_sample_status(UUID,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_partner_warranty_draft(UUID,UUID,TEXT,TEXT,TEXT,INTEGER,TIMESTAMPTZ) TO authenticated;

GRANT EXECUTE ON FUNCTION public.activate_partner_warranty_version(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.retire_partner_warranty_version(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_member_product_catalog_extras(UUID) TO authenticated;

DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS function_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      function_record.function_signature
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS function_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname = ANY (ARRAY[
        'admin_get_user_email',
        'assign_production_role',
        'current_member_profile_id',
        'get_app_access_context',
        'get_member_history',
        'next_record_reference',
        'provision_internal_user',
        'reactivate_user',
        'register_app_session',
        'reject_member_application',
        'revoke_all_app_sessions',
        'revoke_app_session',
        'revoke_production_role',
        'save_member_onboarding',
        'set_role_permission',
        'submit_member_application',
        'suspend_user',
        'touch_app_session',
        'update_company_settings',
        'write_security_event'
      ]::TEXT[])
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO authenticated',
      function_record.function_signature
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS function_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        p.prorettype = 'trigger'::regtype
        OR p.proname IN ('create_shipment', 'record_delivery', 'submit_custom_request')
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_record.function_signature
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS document_sequences_runtime_deny
  ON public.document_sequences;

CREATE POLICY document_sequences_runtime_deny
  ON public.document_sequences
  FOR ALL TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS showroom_visit_requests_runtime_deny
  ON public.showroom_visit_requests;

CREATE POLICY showroom_visit_requests_runtime_deny
  ON public.showroom_visit_requests
  FOR ALL TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS supplier_disclosure_grants_runtime_deny
  ON public.supplier_disclosure_grants;

CREATE POLICY supplier_disclosure_grants_runtime_deny
  ON public.supplier_disclosure_grants
  FOR ALL TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

ALTER DEFAULT PRIVILEGES FOR ROLE project_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

INSERT INTO public.permissions(code, name, description)
VALUES (
  'supplier_payments.request',
  'สร้างคำขอจ่ายเงินโรงงาน',
  'สร้าง Supplier Payment Request และดูสถานะ โดยไม่สามารถอนุมัติหรือบันทึกว่าจ่ายแล้ว'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'supplier_payments.request'
WHERE r.code IN ('SUPER_ADMIN', 'PURCHASING')
ON CONFLICT DO NOTHING;

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.code = 'PURCHASING'
  AND p.code = 'supplier_payments.manage';

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.code = 'MEMBER_ADMIN'
  AND p.code = 'members.roles.manage';

CREATE OR REPLACE FUNCTION public.create_supplier_payment(
  supplier_order_id_input UUID,
  payment_type_input TEXT,
  amount_input NUMERIC,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  supplier_order_record public.supplier_orders%ROWTYPE;
  schedule_record public.supplier_payment_schedules%ROWTYPE;
  reserved_amount NUMERIC(18,2);
  payment_id_value UUID;
  requested_type TEXT;
BEGIN
  IF NOT public.has_permission('supplier_payments.request') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF payment_type_input NOT IN ('DEPOSIT', 'BALANCE', 'PARTIAL')
    OR amount_input IS NULL OR amount_input <= 0 THEN
    RAISE EXCEPTION 'INVALID_SUPPLIER_PAYMENT';
  END IF;
  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = supplier_order_id_input FOR UPDATE;
  IF NOT FOUND OR supplier_order_record.status IN ('DRAFT', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUPPLIER_ORDER_NOT_PAYABLE';
  END IF;
  requested_type := CASE WHEN payment_type_input = 'PARTIAL' THEN
    CASE WHEN EXISTS (
      SELECT 1 FROM public.supplier_payment_schedules
      WHERE supplier_order_id = supplier_order_id_input AND schedule_type = 'DEPOSIT'
        AND status NOT IN ('PAID', 'CANCELLED')
    ) THEN 'DEPOSIT' ELSE 'BALANCE' END
    ELSE payment_type_input END;
  SELECT * INTO schedule_record FROM public.supplier_payment_schedules
  WHERE supplier_order_id = supplier_order_id_input AND schedule_type = requested_type
  FOR UPDATE;
  IF NOT FOUND OR schedule_record.status IN ('PAID', 'OVERPAYMENT_REVIEW', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO reserved_amount
  FROM public.supplier_payments
  WHERE payment_schedule_id = schedule_record.id AND status IN ('REQUESTED', 'APPROVED', 'PAID');
  IF ROUND(reserved_amount + amount_input, 2) > schedule_record.due_amount THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_EXCEEDS_OUTSTANDING';
  END IF;
  INSERT INTO public.supplier_payments(
    supplier_order_id, payment_schedule_id, payment_reference, payment_type,
    amount, currency, requested_by, note
  ) VALUES (
    supplier_order_id_input, schedule_record.id, public.next_document_number('PAY'),
    requested_type, ROUND(amount_input, 2), supplier_order_record.supplier_currency,
    (SELECT auth.uid()), NULLIF(BTRIM(note_input), '')
  ) RETURNING id INTO payment_id_value;
  INSERT INTO public.supplier_payment_history(
    organization_id, supplier_payment_id, action, amount_snapshot, note, actor_user_id
  ) VALUES (
    supplier_order_record.organization_id, payment_id_value, 'REQUESTED',
    ROUND(amount_input, 2), NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
  );
  RETURN payment_id_value;
END;
$$;

DROP POLICY IF EXISTS supplier_payments_slice6_internal ON public.supplier_payments;

CREATE POLICY supplier_payments_staff_read ON public.supplier_payments
FOR SELECT TO authenticated USING (
  public.has_permission('supplier_payments.request')
  OR public.has_permission('supplier_payments.manage')
);

DROP POLICY IF EXISTS purchase_orders_slice6_internal ON public.purchase_orders;

CREATE POLICY purchase_orders_staff_read ON public.purchase_orders
FOR SELECT TO authenticated USING (
  public.has_permission('orders.manage', organization_id)
  OR public.has_permission('supplier_payments.request', organization_id)
  OR public.has_permission('supplier_payments.manage', organization_id)
);

DROP POLICY IF EXISTS supplier_payment_schedules_slice6_internal ON public.supplier_payment_schedules;

CREATE POLICY supplier_payment_schedules_staff_read ON public.supplier_payment_schedules
FOR SELECT TO authenticated USING (
  public.has_permission('supplier_payments.request', organization_id)
  OR public.has_permission('supplier_payments.manage', organization_id)
);

DROP POLICY IF EXISTS supplier_payment_history_slice6_internal ON public.supplier_payment_history;

CREATE POLICY supplier_payment_history_staff_read ON public.supplier_payment_history
FOR SELECT TO authenticated USING (
  public.has_permission('supplier_payments.request', organization_id)
  OR public.has_permission('supplier_payments.manage', organization_id)
);
