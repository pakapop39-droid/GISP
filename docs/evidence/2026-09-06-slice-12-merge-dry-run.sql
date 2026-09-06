-- Generated 2026-09-06T03:27:16.583Z
-- ⚠️ MERGE BLOCKED: 1 conflict(s) detected. Resolve before applying.

-- [CONFLICT] migration system.migrations
--   parent_t0_hash:  20260731090000,20260731091000,20260731092000,20260731093000,20260731094000,20260731095000,20260731096000,20260731097000,20260817234156,20260817235342,20260818000655,20260818000926,20260818145357,20260818151117,20260818152901,20260818193000,20260818193001,20260818234345,20260819004500,20260819010500,20260819013000,20260822134500,20260822164929,20260822230021,20260822230443,20260822230534,20260823063000,20260823083000,20260824134357,20260824152626,20260824153919,20260826044926,20260826152450,20260826154205,20260826154330,20260828132933,20260828154027,20260829120215,20260829120915,20260829121001,20260829121209,20260829125503,20260830035151,20260830035826,20260830071420,20260830101141,20260830142001,20260831145347,20260901002810,20260902014026
--   parent_now_hash: 20260731090000,20260731091000,20260731092000,20260731093000,20260731094000,20260731095000,20260731096000,20260731097000,20260817234156,20260817235342,20260818000655,20260818000926,20260818145357,20260818151117,20260818152901,20260818193000,20260818193001,20260818234345,20260819004500,20260819010500,20260819013000,20260822134500,20260822164929,20260822230021,20260822230443,20260822230534,20260823063000,20260823083000,20260824134357,20260824152626,20260824153919,20260826044926,20260826152450,20260826154205,20260826154330,20260828132933,20260828154027,20260829120215,20260829120915,20260829121001,20260829121209,20260829125503,20260830035151,20260830035826,20260830071420,20260830101141,20260830142001,20260831145347,20260901002810,20260902014026,20260905120500
--   branch_now_hash: 20260731090000,20260731091000,20260731092000,20260731093000,20260731094000,20260731095000,20260731096000,20260731097000,20260817234156,20260817235342,20260818000655,20260818000926,20260818145357,20260818151117,20260818152901,20260818193000,20260818193001,20260818234345,20260819004500,20260819010500,20260819013000,20260822134500,20260822164929,20260822230021,20260822230443,20260822230534,20260823063000,20260823083000,20260824134357,20260824152626,20260824153919,20260826044926,20260826152450,20260826154205,20260826154330,20260828132933,20260828154027,20260829120215,20260829120915,20260829121001,20260829121209,20260829125503,20260830035151,20260830035826,20260830071420,20260830101141,20260830142001,20260831145347,20260901002810,20260902014026,20260905120000,20260905120100,20260905120500
--   hint: Both parent and branch added migrations after T0. Manually rebase the branch.

-- The SQL below is what would be applied if no conflicts existed; do NOT run as-is.

BEGIN;

-- ===== DDL =====
-- [DDL] table public.shared_catalogs (add)
CREATE TABLE IF NOT EXISTS public.shared_catalogs (id uuid NOT NULL DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, member_profile_id uuid NOT NULL, title text NOT NULL, introduction text, brand_name text NOT NULL, contact_name text, contact_phone text, contact_email text, line_url text, logo_file_id uuid, price_mode text NOT NULL DEFAULT 'HIDDEN'::text, status text NOT NULL DEFAULT 'DRAFT'::text, share_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'::text), expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval), current_version_id uuid, published_at timestamp with time zone, created_by uuid NOT NULL, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now(), CHECK (price_mode = ANY (ARRAY['HIDDEN'::text, 'CUSTOM'::text])), CHECK (status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'REVOKED'::text])), PRIMARY KEY (id), UNIQUE (share_token), FOREIGN KEY (organization_id) REFERENCES organizations(id), FOREIGN KEY (member_profile_id) REFERENCES member_profiles(id) ON DELETE CASCADE, FOREIGN KEY (logo_file_id) REFERENCES file_metadata(id) ON DELETE SET NULL, FOREIGN KEY (created_by) REFERENCES auth.users(id), FOREIGN KEY (current_version_id) REFERENCES shared_catalog_versions(id) ON DELETE SET NULL);
CREATE INDEX IF NOT EXISTS shared_catalogs_member_idx ON public.shared_catalogs USING btree (member_profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS shared_catalogs_token_idx ON public.shared_catalogs USING btree (share_token);

-- [DDL] table public.shared_catalog_items (add)
CREATE TABLE IF NOT EXISTS public.shared_catalog_items (id uuid NOT NULL DEFAULT gen_random_uuid(), catalog_id uuid NOT NULL, product_id uuid NOT NULL, customer_price numeric(18,2), sort_order integer NOT NULL DEFAULT 0, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now(), CHECK (customer_price IS NULL OR customer_price >= 0::numeric), PRIMARY KEY (id), UNIQUE (catalog_id, product_id), FOREIGN KEY (catalog_id) REFERENCES shared_catalogs(id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(id));
CREATE INDEX IF NOT EXISTS shared_catalog_items_catalog_idx ON public.shared_catalog_items USING btree (catalog_id, sort_order);

-- [DDL] table public.shared_catalog_events (add)
CREATE TABLE IF NOT EXISTS public.shared_catalog_events (id uuid NOT NULL DEFAULT gen_random_uuid(), catalog_id uuid NOT NULL, organization_id uuid NOT NULL, actor_user_id uuid NOT NULL, action text NOT NULL, detail text, created_at timestamp with time zone NOT NULL DEFAULT now(), CHECK (action = ANY (ARRAY['CREATED'::text, 'UPDATED'::text, 'EXTENDED'::text, 'PUBLISHED'::text, 'REVOKED'::text, 'LINK_ROTATED'::text, 'LOGO_UPDATED'::text])), PRIMARY KEY (id), FOREIGN KEY (catalog_id) REFERENCES shared_catalogs(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id), FOREIGN KEY (actor_user_id) REFERENCES auth.users(id));
CREATE INDEX IF NOT EXISTS shared_catalog_events_catalog_idx ON public.shared_catalog_events USING btree (catalog_id, created_at DESC);

-- [DDL] table public.shared_catalog_versions (add)
CREATE TABLE IF NOT EXISTS public.shared_catalog_versions (id uuid NOT NULL DEFAULT gen_random_uuid(), catalog_id uuid NOT NULL, version_number integer NOT NULL, title text NOT NULL, introduction text, brand_name text NOT NULL, contact_name text, contact_phone text, contact_email text, line_url text, logo_file_id uuid, price_mode text NOT NULL, expires_at timestamp with time zone, published_by uuid NOT NULL, published_at timestamp with time zone NOT NULL DEFAULT now(), CHECK (version_number > 0), CHECK (price_mode = ANY (ARRAY['HIDDEN'::text, 'CUSTOM'::text])), PRIMARY KEY (id), UNIQUE (catalog_id, version_number), FOREIGN KEY (catalog_id) REFERENCES shared_catalogs(id) ON DELETE RESTRICT, FOREIGN KEY (logo_file_id) REFERENCES file_metadata(id) ON DELETE SET NULL, FOREIGN KEY (published_by) REFERENCES auth.users(id));
CREATE INDEX IF NOT EXISTS shared_catalog_versions_catalog_idx ON public.shared_catalog_versions USING btree (catalog_id, version_number DESC);

-- [DDL] table public.shared_catalog_version_items (add)
CREATE TABLE IF NOT EXISTS public.shared_catalog_version_items (id uuid NOT NULL DEFAULT gen_random_uuid(), version_id uuid NOT NULL, product_id uuid NOT NULL, source_price_id uuid NOT NULL, image_file_id uuid, sku text NOT NULL, product_type text NOT NULL, name_th text NOT NULL, name_en text, description_th text, specification_summary text, category_name text, lead_time_days integer, width_mm numeric(12,2), depth_mm numeric(12,2), height_mm numeric(12,2), material_summary text, finish_summary text, customer_price numeric(18,2), currency character(3) NOT NULL DEFAULT 'THB'::bpchar, sort_order integer NOT NULL DEFAULT 0, created_at timestamp with time zone NOT NULL DEFAULT now(), CHECK (customer_price IS NULL OR customer_price >= 0::numeric), PRIMARY KEY (id), UNIQUE (version_id, product_id), FOREIGN KEY (version_id) REFERENCES shared_catalog_versions(id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(id), FOREIGN KEY (source_price_id) REFERENCES product_prices(id), FOREIGN KEY (image_file_id) REFERENCES file_metadata(id) ON DELETE SET NULL);
CREATE INDEX IF NOT EXISTS shared_catalog_version_items_version_idx ON public.shared_catalog_version_items USING btree (version_id, sort_order);

-- [DDL] policy public.shared_catalogs.shared_catalogs_member_select (add)
DROP POLICY IF EXISTS "shared_catalogs_member_select" ON "public"."shared_catalogs";
CREATE POLICY "shared_catalogs_member_select" ON "public"."shared_catalogs"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING ((member_profile_id = current_member_profile_id()));

-- [DDL] policy public.shared_catalog_items.shared_catalog_items_member_select (add)
DROP POLICY IF EXISTS "shared_catalog_items_member_select" ON "public"."shared_catalog_items";
CREATE POLICY "shared_catalog_items_member_select" ON "public"."shared_catalog_items"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING (can_access_shared_catalog(catalog_id));

-- [DDL] policy public.shared_catalog_events.shared_catalog_events_member_select (add)
DROP POLICY IF EXISTS "shared_catalog_events_member_select" ON "public"."shared_catalog_events";
CREATE POLICY "shared_catalog_events_member_select" ON "public"."shared_catalog_events"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING (can_access_shared_catalog(catalog_id));

-- [DDL] policy public.shared_catalog_versions.shared_catalog_versions_member_select (add)
DROP POLICY IF EXISTS "shared_catalog_versions_member_select" ON "public"."shared_catalog_versions";
CREATE POLICY "shared_catalog_versions_member_select" ON "public"."shared_catalog_versions"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING (can_access_shared_catalog(catalog_id));

-- [DDL] policy public.shared_catalog_version_items.shared_catalog_version_items_member_select (add)
DROP POLICY IF EXISTS "shared_catalog_version_items_member_select" ON "public"."shared_catalog_version_items";
CREATE POLICY "shared_catalog_version_items_member_select" ON "public"."shared_catalog_version_items"
  AS PERMISSIVE
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM shared_catalog_versions v
  WHERE ((v.id = shared_catalog_version_items.version_id) AND can_access_shared_catalog(v.catalog_id)))));

-- [DDL] function public.revoke_shared_catalog(catalog_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.revoke_shared_catalog(catalog_id_input uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$;

-- [DDL] function public.publish_shared_catalog(catalog_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.publish_shared_catalog(catalog_id_input uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$;

-- [DDL] function public.can_access_shared_catalog(catalog_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.can_access_shared_catalog(catalog_id_input uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_catalogs c
    WHERE c.id=catalog_id_input AND c.member_profile_id=public.current_member_profile_id()
  );
$function$;

-- [DDL] function public.rotate_shared_catalog_link(catalog_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.rotate_shared_catalog_link(catalog_id_input uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE token_value TEXT;
BEGIN
  IF NOT public.can_access_shared_catalog(catalog_id_input) THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  token_value:=encode(gen_random_bytes(24),'hex');
  UPDATE public.shared_catalogs SET share_token=token_value WHERE id=catalog_id_input;
  PERFORM public.record_shared_catalog_event(catalog_id_input,'LINK_ROTATED',NULL);
  RETURN token_value;
END;
$function$;

-- [DDL] function public.set_shared_catalog_logo(catalog_id_input uuid, file_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.set_shared_catalog_logo(catalog_id_input uuid, file_id_input uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$;

-- [DDL] function public.remove_shared_catalog_item(catalog_id_input uuid, product_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.remove_shared_catalog_item(catalog_id_input uuid, product_id_input uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.can_access_shared_catalog(catalog_id_input) THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  DELETE FROM public.shared_catalog_items WHERE catalog_id=catalog_id_input AND product_id=product_id_input;
  RETURN catalog_id_input;
END;
$function$;

-- [DDL] function public.record_shared_catalog_event(catalog_id_input uuid, action_input text, detail_input text) (add)
CREATE OR REPLACE FUNCTION public.record_shared_catalog_event(catalog_id_input uuid, action_input text, detail_input text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE row_value public.shared_catalogs%ROWTYPE; event_id UUID;
BEGIN
  SELECT * INTO row_value FROM public.shared_catalogs WHERE id=catalog_id_input;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_CATALOG_NOT_FOUND'; END IF;
  INSERT INTO public.shared_catalog_events(catalog_id,organization_id,actor_user_id,action,detail)
  VALUES(catalog_id_input,row_value.organization_id,(SELECT auth.uid()),action_input,NULLIF(BTRIM(detail_input),''))
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$function$;

-- [DDL] function public.set_shared_catalog_item(catalog_id_input uuid, product_id_input uuid, customer_price_input numeric, sort_order_input integer) (add)
CREATE OR REPLACE FUNCTION public.set_shared_catalog_item(catalog_id_input uuid, product_id_input uuid, customer_price_input numeric, sort_order_input integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$;

-- [DDL] function public.create_shared_catalog_draft(title_input text, introduction_input text, brand_name_input text, contact_name_input text, contact_phone_input text, contact_email_input text, line_url_input text, price_mode_input text, expires_at_input timestamp with time zone) (add)
CREATE OR REPLACE FUNCTION public.create_shared_catalog_draft(title_input text, introduction_input text, brand_name_input text, contact_name_input text, contact_phone_input text, contact_email_input text, line_url_input text, price_mode_input text, expires_at_input timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$;

-- [DDL] function public.save_shared_catalog(catalog_id_input uuid, title_input text, introduction_input text, brand_name_input text, contact_name_input text, contact_phone_input text, contact_email_input text, line_url_input text, price_mode_input text, expires_at_input timestamp with time zone) (add)
CREATE OR REPLACE FUNCTION public.save_shared_catalog(catalog_id_input uuid, title_input text, introduction_input text, brand_name_input text, contact_name_input text, contact_phone_input text, contact_email_input text, line_url_input text, price_mode_input text, expires_at_input timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$;

COMMIT;