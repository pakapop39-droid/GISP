-- Slice 3: member projects, product schedules, showroom visits and supplier disclosure.
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
