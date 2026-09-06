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
