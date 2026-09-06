-- Slice 12: member-branded shared catalogs with immutable publish snapshots.

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
