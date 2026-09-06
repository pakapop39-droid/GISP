-- Generated 2026-09-06T06:22:04.825Z
-- ⚠️ MERGE BLOCKED: 8 conflict(s) detected. Resolve before applying.

-- [CONFLICT] table public.shared_catalogs
--   parent_t0_hash:  (absent)
--   parent_now_hash: 944f015031764f21f73b5727ac0a698c27b97e2b3f853e49ea38ad168c8506a6
--   branch_now_hash: 41b4de1d13decca76c09000497fe588315229a7f100ca03ce0bd33d305287893
--   hint: Both parent and branch modified this object after branch creation. Resolve manually.

-- [CONFLICT] table public.shared_catalog_versions
--   parent_t0_hash:  (absent)
--   parent_now_hash: 67c7384410af587b2dc0e5db26e852930441aab08fbecaf1e403c43c7ffb0731
--   branch_now_hash: 7a1a23d70e4f842ffa90195bc7b3e821dd5f6971cf252992def98e50bd3af734
--   hint: Both parent and branch modified this object after branch creation. Resolve manually.

-- [CONFLICT] table public.shared_catalog_version_items
--   parent_t0_hash:  (absent)
--   parent_now_hash: 52ae3af8be4ea1d337480c99deb1783d40e3c0332f1407cf8360f181129425c1
--   branch_now_hash: 8e98019a03ab163048da021d0d78f8f0628839ce3e4e36cb1ea26fc6ebe84bf9
--   hint: Both parent and branch modified this object after branch creation. Resolve manually.

-- [CONFLICT] function public.publish_shared_catalog(catalog_id_input uuid)
--   parent_t0_hash:  (absent)
--   parent_now_hash: e87952e7853afe246c8704ffe3aaf5ec79f824df90d612664d443f27618022bc
--   branch_now_hash: 47a49e1696e56836bc56974d3180efca2c2ceb7942528b7d420ebc784e4fe2f2
--   hint: Both parent and branch modified this object after branch creation. Resolve manually.

-- [CONFLICT] function public.remove_shared_catalog_item(catalog_id_input uuid, product_id_input uuid)
--   parent_t0_hash:  (absent)
--   parent_now_hash: e036f246d80b812ec909c1efa3908b65db26aa3545b731957ca61ec05dbe13b4
--   branch_now_hash: bb64cbda1ffeeaa2df9bcf398494a8ad3e1438089244be63e036ed37c186efef
--   hint: Both parent and branch modified this object after branch creation. Resolve manually.

-- [CONFLICT] function public.set_shared_catalog_item(catalog_id_input uuid, product_id_input uuid, customer_price_input numeric, sort_order_input integer)
--   parent_t0_hash:  (absent)
--   parent_now_hash: 1d22e4936ec26eda0ec2d4a307ab434de35a72f2ad8d516bdb3bdb63ae7836d0
--   branch_now_hash: 846c62349df3794d005eb3e0cee9f1471db85abd92cbc860b4160138336632b6
--   hint: Both parent and branch modified this object after branch creation. Resolve manually.

-- [CONFLICT] function public.save_shared_catalog(catalog_id_input uuid, title_input text, introduction_input text, brand_name_input text, contact_name_input text, contact_phone_input text, contact_email_input text, line_url_input text, price_mode_input text, expires_at_input timestamp with time zone)
--   parent_t0_hash:  (absent)
--   parent_now_hash: fd5a8adc31b2c5561bf8125dbeb62b0ff5575d91111402f3feb1b80c4e882bc2
--   branch_now_hash: 8560773aa454f8a603aec0cb49d87775b6c5f91afe94f4aa590588d4998b047f
--   hint: Both parent and branch modified this object after branch creation. Resolve manually.

-- [CONFLICT] migration system.migrations
--   parent_t0_hash:  20260731090000,20260731091000,20260731092000,20260731093000,20260731094000,20260731095000,20260731096000,20260731097000,20260817234156,20260817235342,20260818000655,20260818000926,20260818145357,20260818151117,20260818152901,20260818193000,20260818193001,20260818234345,20260819004500,20260819010500,20260819013000,20260822134500,20260822164929,20260822230021,20260822230443,20260822230534,20260823063000,20260823083000,20260824134357,20260824152626,20260824153919,20260826044926,20260826152450,20260826154205,20260826154330,20260828132933,20260828154027,20260829120215,20260829120915,20260829121001,20260829121209,20260829125503,20260830035151,20260830035826,20260830071420,20260830101141,20260830142001,20260831145347,20260901002810,20260902014026
--   parent_now_hash: 20260731090000,20260731091000,20260731092000,20260731093000,20260731094000,20260731095000,20260731096000,20260731097000,20260817234156,20260817235342,20260818000655,20260818000926,20260818145357,20260818151117,20260818152901,20260818193000,20260818193001,20260818234345,20260819004500,20260819010500,20260819013000,20260822134500,20260822164929,20260822230021,20260822230443,20260822230534,20260823063000,20260823083000,20260824134357,20260824152626,20260824153919,20260826044926,20260826152450,20260826154205,20260826154330,20260828132933,20260828154027,20260829120215,20260829120915,20260829121001,20260829121209,20260829125503,20260830035151,20260830035826,20260830071420,20260830101141,20260830142001,20260831145347,20260901002810,20260902014026,20260905120000,20260905120100,20260905120500
--   branch_now_hash: 20260731090000,20260731091000,20260731092000,20260731093000,20260731094000,20260731095000,20260731096000,20260731097000,20260817234156,20260817235342,20260818000655,20260818000926,20260818145357,20260818151117,20260818152901,20260818193000,20260818193001,20260818234345,20260819004500,20260819010500,20260819013000,20260822134500,20260822164929,20260822230021,20260822230443,20260822230534,20260823063000,20260823083000,20260824134357,20260824152626,20260824153919,20260826044926,20260826152450,20260826154205,20260826154330,20260828132933,20260828154027,20260829120215,20260829120915,20260829121001,20260829121209,20260829125503,20260830035151,20260830035826,20260830071420,20260830101141,20260830142001,20260831145347,20260901002810,20260902014026,20260905120000,20260905120100,20260905120500,20260905120600
--   hint: Both parent and branch added migrations after T0. Manually rebase the branch.

-- The SQL below is what would be applied if no conflicts existed; do NOT run as-is.

BEGIN;

-- ===== DDL =====
-- [DDL] function public.is_customer_browse_product_eligible(product_id_input uuid) (add)
CREATE OR REPLACE FUNCTION public.is_customer_browse_product_eligible(product_id_input uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$;

-- [DDL] function public.create_customer_browse_catalog_draft(title_input text, introduction_input text, brand_name_input text, contact_name_input text, contact_phone_input text, contact_email_input text, line_url_input text, scope_type_input text, source_id_input uuid, expires_at_input timestamp with time zone) (add)
CREATE OR REPLACE FUNCTION public.create_customer_browse_catalog_draft(title_input text, introduction_input text, brand_name_input text, contact_name_input text, contact_phone_input text, contact_email_input text, line_url_input text, scope_type_input text, source_id_input uuid, expires_at_input timestamp with time zone)
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
$function$;

COMMIT;