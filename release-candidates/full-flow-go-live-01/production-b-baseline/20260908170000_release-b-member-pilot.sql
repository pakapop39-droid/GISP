CREATE TABLE public.shared_catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  member_profile_id UUID NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  introduction TEXT,
  brand_name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  line_url TEXT,
  logo_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  price_mode TEXT NOT NULL DEFAULT 'HIDDEN' CHECK (price_mode IN ('HIDDEN','CUSTOM')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','REVOKED')),
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  current_version_id UUID,
  published_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.shared_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES public.shared_catalogs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  customer_price NUMERIC(18,2) CHECK (customer_price IS NULL OR customer_price >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (catalog_id, product_id)
);

CREATE TABLE public.shared_catalog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES public.shared_catalogs(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  title TEXT NOT NULL,
  introduction TEXT,
  brand_name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  line_url TEXT,
  logo_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  price_mode TEXT NOT NULL CHECK (price_mode IN ('HIDDEN','CUSTOM')),
  expires_at TIMESTAMPTZ,
  published_by UUID NOT NULL REFERENCES auth.users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (catalog_id, version_number)
);

ALTER TABLE public.shared_catalogs
  ADD CONSTRAINT shared_catalogs_current_version_fkey
  FOREIGN KEY (current_version_id) REFERENCES public.shared_catalog_versions(id) ON DELETE SET NULL;

CREATE TABLE public.shared_catalog_version_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.shared_catalog_versions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  source_price_id UUID NOT NULL REFERENCES public.product_prices(id),
  image_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  product_type TEXT NOT NULL,
  name_th TEXT NOT NULL,
  name_en TEXT,
  description_th TEXT,
  specification_summary TEXT,
  category_name TEXT,
  lead_time_days INTEGER,
  width_mm NUMERIC(12,2),
  depth_mm NUMERIC(12,2),
  height_mm NUMERIC(12,2),
  material_summary TEXT,
  finish_summary TEXT,
  customer_price NUMERIC(18,2) CHECK (customer_price IS NULL OR customer_price >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, product_id)
);

CREATE TABLE public.shared_catalog_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES public.shared_catalogs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('CREATED','UPDATED','EXTENDED','PUBLISHED','REVOKED','LINK_ROTATED','LOGO_UPDATED')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX shared_catalogs_member_idx ON public.shared_catalogs(member_profile_id, updated_at DESC);

CREATE INDEX shared_catalogs_token_idx ON public.shared_catalogs(share_token);

CREATE INDEX shared_catalog_items_catalog_idx ON public.shared_catalog_items(catalog_id, sort_order);

CREATE INDEX shared_catalog_versions_catalog_idx ON public.shared_catalog_versions(catalog_id, version_number DESC);

CREATE INDEX shared_catalog_version_items_version_idx ON public.shared_catalog_version_items(version_id, sort_order);

CREATE INDEX shared_catalog_events_catalog_idx ON public.shared_catalog_events(catalog_id, created_at DESC);

CREATE TRIGGER shared_catalogs_updated_at BEFORE UPDATE ON public.shared_catalogs
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER shared_catalog_items_updated_at BEFORE UPDATE ON public.shared_catalog_items
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER shared_catalog_versions_append_only BEFORE UPDATE OR DELETE ON public.shared_catalog_versions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

CREATE TRIGGER shared_catalog_version_items_append_only BEFORE UPDATE OR DELETE ON public.shared_catalog_version_items
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

CREATE TRIGGER shared_catalog_events_append_only BEFORE UPDATE OR DELETE ON public.shared_catalog_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_change();

CREATE OR REPLACE FUNCTION public.can_access_shared_catalog(catalog_id_input UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_catalogs c
    WHERE c.id=catalog_id_input AND c.member_profile_id=public.current_member_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.record_shared_catalog_event(catalog_id_input UUID, action_input TEXT, detail_input TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE row_value public.shared_catalogs%ROWTYPE; event_id UUID;
BEGIN
  SELECT * INTO row_value FROM public.shared_catalogs WHERE id=catalog_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  INSERT INTO public.shared_catalog_events(catalog_id,organization_id,actor_user_id,action,detail)
  VALUES(catalog_id_input,row_value.organization_id,(SELECT auth.uid()),action_input,NULLIF(BTRIM(detail_input),''))
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.save_shared_catalog(
  catalog_id_input UUID, title_input TEXT, introduction_input TEXT, brand_name_input TEXT,
  contact_name_input TEXT, contact_phone_input TEXT, contact_email_input TEXT,
  line_url_input TEXT, price_mode_input TEXT, expires_at_input TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE row_value public.shared_catalogs%ROWTYPE;
BEGIN
  SELECT * INTO row_value FROM public.shared_catalogs WHERE id=catalog_id_input
    AND member_profile_id=public.current_member_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(title_input,''))) < 2 THEN RAISE EXCEPTION 'TITLE_REQUIRED'; END IF;
  IF price_mode_input NOT IN ('HIDDEN','CUSTOM') THEN RAISE EXCEPTION 'INVALID_PRICE_MODE'; END IF;
  UPDATE public.shared_catalogs SET title=BTRIM(title_input),introduction=NULLIF(BTRIM(introduction_input),''),
    brand_name=BTRIM(brand_name_input),contact_name=NULLIF(BTRIM(contact_name_input),''),
    contact_phone=NULLIF(BTRIM(contact_phone_input),''),contact_email=NULLIF(BTRIM(contact_email_input),''),
    line_url=NULLIF(BTRIM(line_url_input),''),price_mode=price_mode_input,expires_at=expires_at_input
  WHERE id=catalog_id_input;
  PERFORM public.record_shared_catalog_event(catalog_id_input,
    CASE WHEN expires_at_input IS DISTINCT FROM row_value.expires_at THEN 'EXTENDED' ELSE 'UPDATED' END,NULL);
  PERFORM public.write_audit_event(row_value.organization_id,'shared_catalog',catalog_id_input,'UPDATED');
  RETURN catalog_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_shared_catalog_logo(catalog_id_input UUID, file_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE row_value public.shared_catalogs%ROWTYPE;
BEGIN
  SELECT * INTO row_value FROM public.shared_catalogs WHERE id=catalog_id_input
    AND member_profile_id=public.current_member_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.file_metadata f WHERE f.id=file_id_input
    AND f.member_profile_id=row_value.member_profile_id AND f.entity_type='SHARED_CATALOG_LOGO'
    AND f.entity_id=catalog_id_input AND f.visibility='MEMBER_PRIVATE') THEN
    RAISE EXCEPTION 'INVALID_LOGO_FILE';
  END IF;
  UPDATE public.shared_catalogs SET logo_file_id=file_id_input WHERE id=catalog_id_input;
  PERFORM public.record_shared_catalog_event(catalog_id_input,'LOGO_UPDATED',NULL);
  RETURN catalog_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_shared_catalog_item(
  catalog_id_input UUID, product_id_input UUID, customer_price_input NUMERIC, sort_order_input INTEGER
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE row_value public.shared_catalogs%ROWTYPE; item_id_value UUID;
BEGIN
  SELECT * INTO row_value FROM public.shared_catalogs WHERE id=catalog_id_input
    AND member_profile_id=public.current_member_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p JOIN public.product_prices pp ON pp.product_id=p.id
    AND pp.variant_id IS NULL AND pp.price_type='MEMBER' AND pp.status='ACTIVE' AND pp.valid_from<=NOW()
    AND (pp.valid_until IS NULL OR pp.valid_until>NOW())
    WHERE p.id=product_id_input AND p.status='PUBLISHED' AND p.qa_status='PASSED') THEN
    RAISE EXCEPTION 'PRODUCT_NOT_MEMBER_VISIBLE';
  END IF;
  IF row_value.price_mode='CUSTOM' AND (customer_price_input IS NULL OR customer_price_input<0) THEN
    RAISE EXCEPTION 'CUSTOMER_PRICE_REQUIRED';
  END IF;
  INSERT INTO public.shared_catalog_items(catalog_id,product_id,customer_price,sort_order)
  VALUES(catalog_id_input,product_id_input,customer_price_input,COALESCE(sort_order_input,0))
  ON CONFLICT(catalog_id,product_id) DO UPDATE SET customer_price=EXCLUDED.customer_price,sort_order=EXCLUDED.sort_order
  RETURNING id INTO item_id_value;
  RETURN item_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_shared_catalog_item(catalog_id_input UUID, product_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.can_access_shared_catalog(catalog_id_input) THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  DELETE FROM public.shared_catalog_items WHERE catalog_id=catalog_id_input AND product_id=product_id_input;
  RETURN catalog_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_shared_catalog(catalog_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE catalog_record public.shared_catalogs%ROWTYPE; version_id_value UUID; next_version INTEGER;
BEGIN
  SELECT * INTO catalog_record FROM public.shared_catalogs WHERE id=catalog_id_input
    AND member_profile_id=public.current_member_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  IF catalog_record.expires_at IS NOT NULL AND catalog_record.expires_at<=NOW() THEN RAISE EXCEPTION 'EXPIRY_MUST_BE_FUTURE'; END IF;
  IF catalog_record.contact_phone IS NULL AND catalog_record.contact_email IS NULL AND catalog_record.line_url IS NULL THEN
    RAISE EXCEPTION 'CONTACT_CHANNEL_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_catalog_items WHERE catalog_id=catalog_id_input) THEN RAISE EXCEPTION 'CATALOG_ITEMS_REQUIRED'; END IF;
  IF catalog_record.price_mode='CUSTOM' AND EXISTS (SELECT 1 FROM public.shared_catalog_items
    WHERE catalog_id=catalog_id_input AND customer_price IS NULL) THEN RAISE EXCEPTION 'CUSTOMER_PRICE_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_catalog_items i LEFT JOIN public.products p ON p.id=i.product_id
    LEFT JOIN public.product_prices pp ON pp.product_id=p.id AND pp.variant_id IS NULL AND pp.price_type='MEMBER' AND pp.status='ACTIVE'
      AND pp.valid_from<=NOW() AND (pp.valid_until IS NULL OR pp.valid_until>NOW())
    WHERE i.catalog_id=catalog_id_input AND (p.status<>'PUBLISHED' OR p.qa_status<>'PASSED' OR pp.id IS NULL))
  THEN RAISE EXCEPTION 'CATALOG_HAS_UNAVAILABLE_PRODUCT'; END IF;
  SELECT COALESCE(MAX(version_number),0)+1 INTO next_version FROM public.shared_catalog_versions WHERE catalog_id=catalog_id_input;
  INSERT INTO public.shared_catalog_versions(catalog_id,version_number,title,introduction,brand_name,contact_name,
    contact_phone,contact_email,line_url,logo_file_id,price_mode,expires_at,published_by)
  VALUES(catalog_id_input,next_version,catalog_record.title,catalog_record.introduction,catalog_record.brand_name,
    catalog_record.contact_name,catalog_record.contact_phone,catalog_record.contact_email,catalog_record.line_url,
    catalog_record.logo_file_id,catalog_record.price_mode,catalog_record.expires_at,(SELECT auth.uid()))
  RETURNING id INTO version_id_value;
  INSERT INTO public.shared_catalog_version_items(version_id,product_id,source_price_id,image_file_id,sku,product_type,
    name_th,name_en,description_th,specification_summary,category_name,lead_time_days,width_mm,depth_mm,height_mm,
    material_summary,finish_summary,customer_price,currency,sort_order)
  SELECT version_id_value,p.id,pp.id,(
      SELECT pm.file_id FROM public.product_media pm WHERE pm.product_id=p.id AND pm.media_type='IMAGE'
      ORDER BY pm.is_primary DESC,pm.sort_order,pm.created_at LIMIT 1
    ),p.sku,p.product_type,p.name_th,p.name_en,p.description_th,p.specification_summary,c.name_th,
    p.default_lead_time_days,p.width_mm,p.depth_mm,p.height_mm,p.material_summary,p.finish_summary,
    CASE WHEN catalog_record.price_mode='CUSTOM' THEN i.customer_price ELSE NULL END,'THB',i.sort_order
  FROM public.shared_catalog_items i JOIN public.products p ON p.id=i.product_id
  LEFT JOIN public.categories c ON c.id=p.category_id
  JOIN LATERAL (SELECT x.id FROM public.product_prices x WHERE x.product_id=p.id AND x.variant_id IS NULL
    AND x.price_type='MEMBER' AND x.status='ACTIVE' AND x.valid_from<=NOW() AND (x.valid_until IS NULL OR x.valid_until>NOW())
    ORDER BY x.valid_from DESC,x.created_at DESC LIMIT 1) pp ON TRUE
  WHERE i.catalog_id=catalog_id_input ORDER BY i.sort_order,i.created_at;
  UPDATE public.shared_catalogs SET current_version_id=version_id_value,status='PUBLISHED',published_at=NOW()
  WHERE id=catalog_id_input;
  PERFORM public.record_shared_catalog_event(catalog_id_input,'PUBLISHED','version='||next_version);
  PERFORM public.write_audit_event(catalog_record.organization_id,'shared_catalog',catalog_id_input,'PUBLISHED');
  RETURN version_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_shared_catalog(catalog_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE row_value public.shared_catalogs%ROWTYPE;
BEGIN
  SELECT * INTO row_value FROM public.shared_catalogs WHERE id=catalog_id_input
    AND member_profile_id=public.current_member_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  UPDATE public.shared_catalogs SET status='REVOKED' WHERE id=catalog_id_input;
  PERFORM public.record_shared_catalog_event(catalog_id_input,'REVOKED',NULL);
  PERFORM public.write_audit_event(row_value.organization_id,'shared_catalog',catalog_id_input,'REVOKED');
  RETURN catalog_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_shared_catalog_link(catalog_id_input UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE token_value TEXT;
BEGIN
  IF NOT public.can_access_shared_catalog(catalog_id_input) THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  token_value:=encode(gen_random_bytes(24),'hex');
  UPDATE public.shared_catalogs SET share_token=token_value WHERE id=catalog_id_input;
  PERFORM public.record_shared_catalog_event(catalog_id_input,'LINK_ROTATED',NULL);
  RETURN token_value;
END;
$$;

ALTER TABLE public.shared_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shared_catalog_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shared_catalog_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shared_catalog_version_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shared_catalog_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY shared_catalogs_member_select ON public.shared_catalogs FOR SELECT TO authenticated
USING (member_profile_id=public.current_member_profile_id());

CREATE POLICY shared_catalog_items_member_select ON public.shared_catalog_items FOR SELECT TO authenticated
USING (public.can_access_shared_catalog(catalog_id));

CREATE POLICY shared_catalog_versions_member_select ON public.shared_catalog_versions FOR SELECT TO authenticated
USING (public.can_access_shared_catalog(catalog_id));

CREATE POLICY shared_catalog_version_items_member_select ON public.shared_catalog_version_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.shared_catalog_versions v WHERE v.id=version_id AND public.can_access_shared_catalog(v.catalog_id)));

CREATE POLICY shared_catalog_events_member_select ON public.shared_catalog_events FOR SELECT TO authenticated
USING (public.can_access_shared_catalog(catalog_id));

REVOKE ALL ON public.shared_catalogs,public.shared_catalog_items,public.shared_catalog_versions,
  public.shared_catalog_version_items,public.shared_catalog_events FROM PUBLIC,anon,authenticated;

GRANT SELECT ON public.shared_catalogs,public.shared_catalog_items,public.shared_catalog_versions,
  public.shared_catalog_version_items,public.shared_catalog_events TO authenticated;

REVOKE ALL ON FUNCTION public.can_access_shared_catalog(UUID),public.record_shared_catalog_event(UUID,TEXT,TEXT),
  public.create_shared_catalog_draft(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ),
  public.save_shared_catalog(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ),
  public.set_shared_catalog_logo(UUID,UUID),public.set_shared_catalog_item(UUID,UUID,NUMERIC,INTEGER),
  public.remove_shared_catalog_item(UUID,UUID),public.publish_shared_catalog(UUID),
  public.revoke_shared_catalog(UUID),public.rotate_shared_catalog_link(UUID)
FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.can_access_shared_catalog(UUID),
  public.create_shared_catalog_draft(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ),
  public.save_shared_catalog(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ),
  public.set_shared_catalog_logo(UUID,UUID),public.set_shared_catalog_item(UUID,UUID,NUMERIC,INTEGER),
  public.remove_shared_catalog_item(UUID,UUID),public.publish_shared_catalog(UUID),
  public.revoke_shared_catalog(UUID),public.rotate_shared_catalog_link(UUID)
TO authenticated;

COMMENT ON TABLE public.shared_catalog_versions IS 'Immutable member branding snapshot created atomically on publish.';

COMMENT ON TABLE public.shared_catalog_version_items IS 'Immutable customer-safe product and price snapshots; never contains member price, supplier or cost fields.';

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

ALTER TABLE public.shared_catalogs
  ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'CURATED',
  ADD COLUMN source_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN source_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD CONSTRAINT shared_catalogs_scope_type_check
    CHECK (scope_type IN ('CURATED','PRODUCT','PROJECT','FULL_CATALOG')),
  ADD CONSTRAINT shared_catalogs_scope_source_check CHECK (
    (scope_type='CURATED' AND source_product_id IS NULL AND source_project_id IS NULL) OR
    (scope_type='PRODUCT' AND source_product_id IS NOT NULL AND source_project_id IS NULL) OR
    (scope_type='PROJECT' AND source_product_id IS NULL AND source_project_id IS NOT NULL) OR
    (scope_type='FULL_CATALOG' AND source_product_id IS NULL AND source_project_id IS NULL)
  );

ALTER TABLE public.shared_catalog_versions
  ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'CURATED',
  ADD COLUMN source_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN source_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD CONSTRAINT shared_catalog_versions_scope_type_check
    CHECK (scope_type IN ('CURATED','PRODUCT','PROJECT','FULL_CATALOG'));

ALTER TABLE public.shared_catalog_version_items
  DROP CONSTRAINT shared_catalog_version_items_version_id_product_id_key,
  ADD COLUMN source_project_item_id UUID REFERENCES public.project_items(id) ON DELETE SET NULL,
  ADD COLUMN project_area_name TEXT,
  ADD COLUMN selected_options JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD CONSTRAINT shared_catalog_version_items_selected_options_array
    CHECK (jsonb_typeof(selected_options)='array');

CREATE UNIQUE INDEX shared_catalog_version_items_non_project_unique
  ON public.shared_catalog_version_items(version_id,product_id)
  WHERE source_project_item_id IS NULL;

CREATE UNIQUE INDEX shared_catalog_version_items_project_unique
  ON public.shared_catalog_version_items(version_id,source_project_item_id)
  WHERE source_project_item_id IS NOT NULL;

CREATE INDEX shared_catalogs_scope_idx
  ON public.shared_catalogs(member_profile_id,scope_type,updated_at DESC);

CREATE OR REPLACE FUNCTION public.is_customer_browse_product_eligible(product_id_input UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_prices pp ON pp.product_id=p.id
      AND pp.variant_id IS NULL
      AND pp.price_type='MEMBER'
      AND pp.status='ACTIVE'
      AND pp.valid_from<=NOW()
      AND (pp.valid_until IS NULL OR pp.valid_until>NOW())
    WHERE p.id=product_id_input
      AND p.product_type='STANDARD'
      AND p.status='PUBLISHED'
      AND p.qa_status='PASSED'
  );
$$;

CREATE OR REPLACE FUNCTION public.create_customer_browse_catalog_draft(
  title_input TEXT, introduction_input TEXT, brand_name_input TEXT,
  contact_name_input TEXT, contact_phone_input TEXT, contact_email_input TEXT,
  line_url_input TEXT, scope_type_input TEXT, source_id_input UUID,
  expires_at_input TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE profile_record public.member_profiles%ROWTYPE; catalog_id_value UUID;
BEGIN
  SELECT mp.* INTO profile_record
  FROM public.member_profiles mp
  JOIN public.member_applications ma ON ma.member_profile_id=mp.id
  WHERE mp.id=public.current_member_profile_id() AND ma.status='APPROVED';
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVED_MEMBER_REQUIRED'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(title_input,'')))<2 THEN RAISE EXCEPTION 'TITLE_REQUIRED'; END IF;
  IF scope_type_input NOT IN ('CURATED','PRODUCT','PROJECT','FULL_CATALOG') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_SCOPE';
  END IF;
  IF scope_type_input='PRODUCT' AND NOT public.is_customer_browse_product_eligible(source_id_input) THEN
    RAISE EXCEPTION 'PRODUCT_NOT_MEMBER_VISIBLE';
  END IF;
  IF scope_type_input='PROJECT' AND NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id=source_id_input AND p.member_profile_id=profile_record.id
      AND p.status NOT IN ('CANCELLED')
  ) THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF scope_type_input IN ('CURATED','FULL_CATALOG') AND source_id_input IS NOT NULL THEN
    RAISE EXCEPTION 'CATALOG_SCOPE_SOURCE_NOT_ALLOWED';
  END IF;
  IF scope_type_input IN ('PRODUCT','PROJECT') AND source_id_input IS NULL THEN
    RAISE EXCEPTION 'CATALOG_SCOPE_SOURCE_REQUIRED';
  END IF;

  INSERT INTO public.shared_catalogs(
    organization_id,member_profile_id,title,introduction,brand_name,contact_name,
    contact_phone,contact_email,line_url,price_mode,scope_type,source_product_id,
    source_project_id,expires_at,created_by
  ) VALUES (
    profile_record.organization_id,profile_record.id,BTRIM(title_input),NULLIF(BTRIM(introduction_input),''),
    COALESCE(NULLIF(BTRIM(brand_name_input),''),profile_record.company_name),NULLIF(BTRIM(contact_name_input),''),
    NULLIF(BTRIM(contact_phone_input),''),NULLIF(BTRIM(contact_email_input),''),NULLIF(BTRIM(line_url_input),''),
    'HIDDEN',scope_type_input,
    CASE WHEN scope_type_input='PRODUCT' THEN source_id_input ELSE NULL END,
    CASE WHEN scope_type_input='PROJECT' THEN source_id_input ELSE NULL END,
    expires_at_input,(SELECT auth.uid())
  ) RETURNING id INTO catalog_id_value;
  PERFORM public.record_shared_catalog_event(catalog_id_value,'CREATED','scope='||scope_type_input);
  PERFORM public.write_audit_event(profile_record.organization_id,'shared_catalog',catalog_id_value,'CREATED');
  RETURN catalog_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_shared_catalog(
  catalog_id_input UUID, title_input TEXT, introduction_input TEXT, brand_name_input TEXT,
  contact_name_input TEXT, contact_phone_input TEXT, contact_email_input TEXT,
  line_url_input TEXT, price_mode_input TEXT, expires_at_input TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE row_value public.shared_catalogs%ROWTYPE;
BEGIN
  SELECT * INTO row_value FROM public.shared_catalogs WHERE id=catalog_id_input
    AND member_profile_id=public.current_member_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  IF CHAR_LENGTH(BTRIM(COALESCE(title_input,'')))<2 THEN RAISE EXCEPTION 'TITLE_REQUIRED'; END IF;
  UPDATE public.shared_catalogs SET title=BTRIM(title_input),introduction=NULLIF(BTRIM(introduction_input),''),
    brand_name=BTRIM(brand_name_input),contact_name=NULLIF(BTRIM(contact_name_input),''),
    contact_phone=NULLIF(BTRIM(contact_phone_input),''),contact_email=NULLIF(BTRIM(contact_email_input),''),
    line_url=NULLIF(BTRIM(line_url_input),''),price_mode='HIDDEN',expires_at=expires_at_input
  WHERE id=catalog_id_input;
  PERFORM public.record_shared_catalog_event(catalog_id_input,
    CASE WHEN expires_at_input IS DISTINCT FROM row_value.expires_at THEN 'EXTENDED' ELSE 'UPDATED' END,NULL);
  PERFORM public.write_audit_event(row_value.organization_id,'shared_catalog',catalog_id_input,'UPDATED');
  RETURN catalog_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_shared_catalog_item(
  catalog_id_input UUID, product_id_input UUID, customer_price_input NUMERIC, sort_order_input INTEGER
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE row_value public.shared_catalogs%ROWTYPE; item_id_value UUID;
BEGIN
  SELECT * INTO row_value FROM public.shared_catalogs WHERE id=catalog_id_input
    AND member_profile_id=public.current_member_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  IF row_value.scope_type<>'CURATED' THEN RAISE EXCEPTION 'CATALOG_ITEMS_MANAGED_BY_SCOPE'; END IF;
  IF NOT public.is_customer_browse_product_eligible(product_id_input) THEN
    RAISE EXCEPTION 'PRODUCT_NOT_MEMBER_VISIBLE';
  END IF;
  INSERT INTO public.shared_catalog_items(catalog_id,product_id,customer_price,sort_order)
  VALUES(catalog_id_input,product_id_input,NULL,COALESCE(sort_order_input,0))
  ON CONFLICT(catalog_id,product_id) DO UPDATE SET customer_price=NULL,sort_order=EXCLUDED.sort_order
  RETURNING id INTO item_id_value;
  RETURN item_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_shared_catalog_item(catalog_id_input UUID, product_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_catalogs c WHERE c.id=catalog_id_input
      AND c.member_profile_id=public.current_member_profile_id() AND c.scope_type='CURATED'
  ) THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  DELETE FROM public.shared_catalog_items WHERE catalog_id=catalog_id_input AND product_id=product_id_input;
  RETURN catalog_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_shared_catalog(catalog_id_input UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE catalog_record public.shared_catalogs%ROWTYPE; version_id_value UUID; next_version INTEGER;
BEGIN
  SELECT * INTO catalog_record FROM public.shared_catalogs WHERE id=catalog_id_input
    AND member_profile_id=public.current_member_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  IF catalog_record.expires_at IS NOT NULL AND catalog_record.expires_at<=NOW() THEN RAISE EXCEPTION 'EXPIRY_MUST_BE_FUTURE'; END IF;
  IF catalog_record.contact_phone IS NULL AND catalog_record.contact_email IS NULL AND catalog_record.line_url IS NULL THEN
    RAISE EXCEPTION 'CONTACT_CHANNEL_REQUIRED';
  END IF;

  IF catalog_record.scope_type='CURATED' THEN
    IF NOT EXISTS (SELECT 1 FROM public.shared_catalog_items WHERE catalog_id=catalog_id_input) THEN
      RAISE EXCEPTION 'CATALOG_ITEMS_REQUIRED';
    END IF;
    IF EXISTS (SELECT 1 FROM public.shared_catalog_items i WHERE i.catalog_id=catalog_id_input
      AND NOT public.is_customer_browse_product_eligible(i.product_id)) THEN
      RAISE EXCEPTION 'CATALOG_HAS_UNAVAILABLE_PRODUCT';
    END IF;
  ELSIF catalog_record.scope_type='PRODUCT' THEN
    IF NOT public.is_customer_browse_product_eligible(catalog_record.source_product_id) THEN
      RAISE EXCEPTION 'PRODUCT_NOT_MEMBER_VISIBLE';
    END IF;
  ELSIF catalog_record.scope_type='PROJECT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.project_items pi
      JOIN public.projects project ON project.id=pi.project_id
      WHERE project.id=catalog_record.source_project_id
        AND project.member_profile_id=catalog_record.member_profile_id
        AND pi.item_type='STANDARD' AND pi.product_id IS NOT NULL
        AND pi.status<>'CANCELLED'
        AND public.is_customer_browse_product_eligible(pi.product_id)
    ) THEN RAISE EXCEPTION 'PROJECT_HAS_NO_SHAREABLE_PRODUCT'; END IF;
  END IF;

  SELECT COALESCE(MAX(version_number),0)+1 INTO next_version
  FROM public.shared_catalog_versions WHERE catalog_id=catalog_id_input;
  INSERT INTO public.shared_catalog_versions(
    catalog_id,version_number,title,introduction,brand_name,contact_name,contact_phone,
    contact_email,line_url,logo_file_id,price_mode,scope_type,source_product_id,
    source_project_id,expires_at,published_by
  ) VALUES (
    catalog_id_input,next_version,catalog_record.title,catalog_record.introduction,catalog_record.brand_name,
    catalog_record.contact_name,catalog_record.contact_phone,catalog_record.contact_email,catalog_record.line_url,
    catalog_record.logo_file_id,'HIDDEN',catalog_record.scope_type,catalog_record.source_product_id,
    catalog_record.source_project_id,catalog_record.expires_at,(SELECT auth.uid())
  ) RETURNING id INTO version_id_value;

  IF catalog_record.scope_type='CURATED' THEN
    INSERT INTO public.shared_catalog_version_items(
      version_id,product_id,source_price_id,image_file_id,sku,product_type,name_th,name_en,
      description_th,specification_summary,category_name,lead_time_days,width_mm,depth_mm,height_mm,
      material_summary,finish_summary,customer_price,currency,sort_order
    )
    SELECT version_id_value,p.id,pp.id,(
        SELECT pm.file_id FROM public.product_media pm WHERE pm.product_id=p.id AND pm.media_type='IMAGE'
        ORDER BY pm.is_primary DESC,pm.sort_order,pm.created_at LIMIT 1
      ),p.sku,p.product_type,p.name_th,p.name_en,p.description_th,p.specification_summary,c.name_th,
      p.default_lead_time_days,p.width_mm,p.depth_mm,p.height_mm,p.material_summary,p.finish_summary,
      NULL,'THB',i.sort_order
    FROM public.shared_catalog_items i JOIN public.products p ON p.id=i.product_id
    LEFT JOIN public.categories c ON c.id=p.category_id
    JOIN LATERAL (SELECT x.id FROM public.product_prices x WHERE x.product_id=p.id AND x.variant_id IS NULL
      AND x.price_type='MEMBER' AND x.status='ACTIVE' AND x.valid_from<=NOW() AND (x.valid_until IS NULL OR x.valid_until>NOW())
      ORDER BY x.valid_from DESC,x.created_at DESC LIMIT 1) pp ON TRUE
    WHERE i.catalog_id=catalog_id_input ORDER BY i.sort_order,i.created_at;
  ELSIF catalog_record.scope_type='PRODUCT' THEN
    INSERT INTO public.shared_catalog_version_items(
      version_id,product_id,source_price_id,image_file_id,sku,product_type,name_th,name_en,
      description_th,specification_summary,category_name,lead_time_days,width_mm,depth_mm,height_mm,
      material_summary,finish_summary,customer_price,currency,sort_order
    )
    SELECT version_id_value,p.id,pp.id,(
        SELECT pm.file_id FROM public.product_media pm WHERE pm.product_id=p.id AND pm.media_type='IMAGE'
        ORDER BY pm.is_primary DESC,pm.sort_order,pm.created_at LIMIT 1
      ),p.sku,p.product_type,p.name_th,p.name_en,p.description_th,p.specification_summary,c.name_th,
      p.default_lead_time_days,p.width_mm,p.depth_mm,p.height_mm,p.material_summary,p.finish_summary,
      NULL,'THB',0
    FROM public.products p LEFT JOIN public.categories c ON c.id=p.category_id
    JOIN LATERAL (SELECT x.id FROM public.product_prices x WHERE x.product_id=p.id AND x.variant_id IS NULL
      AND x.price_type='MEMBER' AND x.status='ACTIVE' AND x.valid_from<=NOW() AND (x.valid_until IS NULL OR x.valid_until>NOW())
      ORDER BY x.valid_from DESC,x.created_at DESC LIMIT 1) pp ON TRUE
    WHERE p.id=catalog_record.source_product_id;
  ELSIF catalog_record.scope_type='PROJECT' THEN
    INSERT INTO public.shared_catalog_version_items(
      version_id,product_id,source_price_id,image_file_id,source_project_item_id,project_area_name,
      selected_options,sku,product_type,name_th,name_en,description_th,specification_summary,category_name,
      lead_time_days,width_mm,depth_mm,height_mm,material_summary,finish_summary,customer_price,currency,sort_order
    )
    SELECT version_id_value,p.id,pp.id,(
        SELECT pm.file_id FROM public.product_media pm WHERE pm.product_id=p.id AND pm.media_type='IMAGE'
        ORDER BY pm.is_primary DESC,pm.sort_order,pm.created_at LIMIT 1
      ),pi.id,area.name,pi.selected_options,p.sku,p.product_type,p.name_th,p.name_en,p.description_th,
      COALESCE(pi.specification_snapshot,p.specification_summary),c.name_th,
      COALESCE(pi.lead_time_days_snapshot,p.default_lead_time_days),p.width_mm,p.depth_mm,p.height_mm,
      p.material_summary,p.finish_summary,NULL,'THB',ROW_NUMBER() OVER (ORDER BY area.sort_order,pi.created_at)::INTEGER-1
    FROM public.project_items pi
    JOIN public.projects project ON project.id=pi.project_id
    JOIN public.products p ON p.id=pi.product_id
    LEFT JOIN public.project_areas area ON area.id=pi.area_id
    LEFT JOIN public.categories c ON c.id=p.category_id
    JOIN LATERAL (SELECT x.id FROM public.product_prices x WHERE x.product_id=p.id AND x.variant_id IS NULL
      AND x.price_type='MEMBER' AND x.status='ACTIVE' AND x.valid_from<=NOW() AND (x.valid_until IS NULL OR x.valid_until>NOW())
      ORDER BY x.valid_from DESC,x.created_at DESC LIMIT 1) pp ON TRUE
    WHERE project.id=catalog_record.source_project_id
      AND project.member_profile_id=catalog_record.member_profile_id
      AND pi.item_type='STANDARD' AND pi.status<>'CANCELLED'
      AND public.is_customer_browse_product_eligible(pi.product_id)
    ORDER BY area.sort_order,pi.created_at;
  END IF;

  UPDATE public.shared_catalogs SET current_version_id=version_id_value,status='PUBLISHED',
    price_mode='HIDDEN',published_at=NOW() WHERE id=catalog_id_input;
  PERFORM public.record_shared_catalog_event(catalog_id_input,'PUBLISHED',
    'version='||next_version||';scope='||catalog_record.scope_type);
  PERFORM public.write_audit_event(catalog_record.organization_id,'shared_catalog',catalog_id_input,'PUBLISHED');
  RETURN version_id_value;
END;
$$;

REVOKE ALL ON FUNCTION public.is_customer_browse_product_eligible(UUID),
  public.create_customer_browse_catalog_draft(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TIMESTAMPTZ)
FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.create_customer_browse_catalog_draft(
  TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TIMESTAMPTZ
) TO authenticated;

COMMENT ON COLUMN public.shared_catalogs.scope_type IS 'Customer browse scope: curated, one product, project products, or live full catalog.';

COMMENT ON COLUMN public.shared_catalog_version_items.project_area_name IS 'Public-safe project area snapshot; never contains customer or site data.';

COMMENT ON TABLE public.shared_catalog_version_items IS 'Immutable customer-safe product snapshots. Price columns are retained for historical compatibility but public serializers must never expose them.';

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

REVOKE ALL ON FUNCTION public.next_record_reference(TEXT) FROM PUBLIC,anon,authenticated;

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

CREATE OR REPLACE FUNCTION public.enforce_sourcing_candidate_file()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE request_record public.product_sourcing_requests%ROWTYPE;
BEGIN
  SELECT r.* INTO request_record
  FROM public.product_sourcing_candidates c
  JOIN public.product_sourcing_requests r ON r.id=c.request_id
  WHERE c.id=NEW.candidate_id AND c.status='DRAFT'
    AND r.status IN ('SUBMITTED','UNDER_REVIEW','NEED_INFO')
  FOR UPDATE OF r;
  IF request_record.id IS NULL THEN RAISE EXCEPTION 'SOURCING_CANDIDATE_NOT_EDITABLE'; END IF;
  IF (SELECT COUNT(*) FROM public.product_sourcing_candidate_files WHERE candidate_id=NEW.candidate_id) >= 8 THEN
    RAISE EXCEPTION 'CANDIDATE_IMAGE_LIMIT';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.file_metadata f WHERE f.id=NEW.file_id
    AND f.organization_id=request_record.organization_id AND f.member_profile_id=request_record.member_profile_id
    AND f.bucket='gisp-member-private' AND f.visibility='MEMBER_PRIVATE'
    AND f.entity_type='PRODUCT_SOURCING_CANDIDATE' AND f.entity_id=NEW.candidate_id
    AND f.mime_type IN ('image/jpeg','image/png','image/webp') AND f.size_bytes>0 AND f.size_bytes<=10485760)
  THEN RAISE EXCEPTION 'INVALID_CANDIDATE_IMAGE'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sourcing_candidate_file_guard BEFORE INSERT ON public.product_sourcing_candidate_files
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sourcing_candidate_file();

CREATE OR REPLACE FUNCTION public.can_access_sourcing_request(request_id_input UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.product_sourcing_requests r WHERE r.id=request_id_input
    AND (r.member_profile_id=public.current_member_profile_id()
      OR (r.status<>'DRAFT' AND public.has_permission('sourcing.manage',r.organization_id))));
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

CREATE POLICY sourcing_requests_select ON public.product_sourcing_requests FOR SELECT TO authenticated USING(member_profile_id=public.current_member_profile_id() OR (status<>'DRAFT' AND public.has_permission('sourcing.manage',organization_id)));

CREATE POLICY sourcing_files_select ON public.product_sourcing_files FOR SELECT TO authenticated USING(public.can_access_sourcing_request(request_id));

CREATE POLICY sourcing_candidates_select ON public.product_sourcing_candidates FOR SELECT TO authenticated USING(public.can_access_sourcing_request(request_id));

CREATE POLICY sourcing_candidate_files_select ON public.product_sourcing_candidate_files FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.product_sourcing_candidates c WHERE c.id=candidate_id AND public.can_access_sourcing_request(c.request_id)));

CREATE POLICY sourcing_history_select ON public.product_sourcing_history FOR SELECT TO authenticated USING(public.can_access_sourcing_request(request_id) AND (visibility='MEMBER' OR public.has_permission('sourcing.manage',organization_id)));

REVOKE ALL ON public.product_sourcing_requests,public.product_sourcing_files,public.product_sourcing_candidates,public.product_sourcing_candidate_files,public.product_sourcing_history FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.enforce_sourcing_reference_file(),public.enforce_sourcing_candidate_file(),public.can_access_sourcing_request(UUID),public.record_sourcing_history(UUID,TEXT,TEXT,TEXT,TEXT,TEXT),public.create_product_sourcing_draft(UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT),public.save_product_sourcing_request(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT),public.submit_product_sourcing_request(UUID),public.cancel_product_sourcing_request(UUID,TEXT),public.save_sourcing_candidate(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,NUMERIC,TEXT,TEXT),public.admin_product_sourcing_action(UUID,TEXT,TEXT),public.delete_sourcing_candidate(UUID,UUID),public.select_sourcing_candidate(UUID,UUID),public.reject_sourcing_options(UUID,TEXT),public.create_sourcing_product_draft(UUID,UUID),public.link_sourcing_product(UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.can_access_sourcing_request(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_product_sourcing_draft(UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT),public.save_product_sourcing_request(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT),public.submit_product_sourcing_request(UUID),public.cancel_product_sourcing_request(UUID,TEXT),public.select_sourcing_candidate(UUID,UUID),public.reject_sourcing_options(UUID,TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.save_sourcing_candidate(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,NUMERIC,TEXT,TEXT),public.admin_product_sourcing_action(UUID,TEXT,TEXT),public.delete_sourcing_candidate(UUID,UUID),public.create_sourcing_product_draft(UUID,UUID),public.link_sourcing_product(UUID,UUID,UUID) TO authenticated;

COMMENT ON TABLE public.product_sourcing_candidates IS 'Internal sourcing candidates; member APIs must use an explicit safe projection without supplier, cost or internal notes.';

CREATE OR REPLACE FUNCTION public.can_access_sourcing_request(request_id_input UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.product_sourcing_requests r
    WHERE r.id=request_id_input
      AND (
        r.member_profile_id=public.current_member_profile_id()
        OR (r.status<>'DRAFT' AND public.has_permission('sourcing.manage',r.organization_id))
      )
  );
$$;

DROP POLICY IF EXISTS sourcing_requests_select ON public.product_sourcing_requests;

CREATE POLICY sourcing_requests_select
ON public.product_sourcing_requests
FOR SELECT TO authenticated
USING (
  member_profile_id=public.current_member_profile_id()
  OR (status<>'DRAFT' AND public.has_permission('sourcing.manage',organization_id))
);

REVOKE ALL ON FUNCTION public.can_access_sourcing_request(UUID) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.can_access_sourcing_request(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_custom_request(UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.submit_custom_request_v2(UUID)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.cancel_custom_request(UUID,TEXT)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.create_customer_order(UUID,JSONB)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.submit_payment_transfer(UUID,NUMERIC,TIMESTAMPTZ,UUID)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.request_order_cancellation(UUID,TEXT,UUID)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.approve_custom_qc(UUID)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.respond_custom_qc(UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.acknowledge_partial_shipment(UUID,TEXT)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.confirm_delivery_appointment(UUID)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.request_delivery_reschedule(UUID,JSONB,TEXT,TEXT,TEXT,TEXT,JSONB)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.member_claim_action(UUID,TEXT,TEXT,UUID)
  FROM PUBLIC,anon,authenticated;
