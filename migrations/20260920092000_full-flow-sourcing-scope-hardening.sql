-- FULL-FLOW-GO-LIVE-01 v0.1
-- Organization-scoped Product Sourcing RPC boundary.
-- Forward-only: preserves the existing implementations as private executors.

DO $$
BEGIN
  IF to_regprocedure('public.save_sourcing_candidate_ffgl_impl(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,text,text)') IS NULL THEN
    ALTER FUNCTION public.save_sourcing_candidate(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,NUMERIC,TEXT,TEXT) RENAME TO save_sourcing_candidate_ffgl_impl;
  END IF;
  IF to_regprocedure('public.admin_product_sourcing_action_ffgl_impl(uuid,text,text)') IS NULL THEN
    ALTER FUNCTION public.admin_product_sourcing_action(UUID,TEXT,TEXT) RENAME TO admin_product_sourcing_action_ffgl_impl;
  END IF;
  IF to_regprocedure('public.delete_sourcing_candidate_ffgl_impl(uuid,uuid)') IS NULL THEN
    ALTER FUNCTION public.delete_sourcing_candidate(UUID,UUID) RENAME TO delete_sourcing_candidate_ffgl_impl;
  END IF;
  IF to_regprocedure('public.create_sourcing_product_draft_ffgl_impl(uuid,uuid)') IS NULL THEN
    ALTER FUNCTION public.create_sourcing_product_draft(UUID,UUID) RENAME TO create_sourcing_product_draft_ffgl_impl;
  END IF;
  IF to_regprocedure('public.link_sourcing_product_ffgl_impl(uuid,uuid,uuid)') IS NULL THEN
    ALTER FUNCTION public.link_sourcing_product(UUID,UUID,UUID) RENAME TO link_sourcing_product_ffgl_impl;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_sourcing_candidate_ffgl_impl(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_product_sourcing_action_ffgl_impl(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_sourcing_candidate_ffgl_impl(UUID,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_sourcing_product_draft_ffgl_impl(UUID,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_sourcing_product_ffgl_impl(UUID,UUID,UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sourcing_request_organization(request_id_input UUID)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE target_organization_id UUID;
BEGIN
  SELECT r.organization_id INTO target_organization_id
  FROM public.product_sourcing_requests r WHERE r.id = request_id_input;
  IF target_organization_id IS NULL THEN RAISE EXCEPTION 'SOURCING_REQUEST_NOT_FOUND'; END IF;
  RETURN target_organization_id;
END;
$$;
REVOKE ALL ON FUNCTION public.sourcing_request_organization(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_sourcing_candidate(
  request_id_input UUID,candidate_id_input UUID,supplier_id_input UUID,category_id_input UUID,proposed_sku_input TEXT,
  factory_sku_input TEXT,product_type_input TEXT,country_code_input TEXT,name_th_input TEXT,name_en_input TEXT,
  description_input TEXT,specification_input TEXT,material_input TEXT,finish_input TEXT,member_price_input NUMERIC,
  lead_time_input INTEGER,factory_cost_input NUMERIC,factory_currency_input TEXT,internal_note_input TEXT
) RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE target_organization_id UUID;
BEGIN
  target_organization_id := public.sourcing_request_organization(request_id_input);
  IF NOT public.has_permission('sourcing.manage', target_organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  RETURN public.save_sourcing_candidate_ffgl_impl(request_id_input,candidate_id_input,supplier_id_input,category_id_input,proposed_sku_input,factory_sku_input,product_type_input,country_code_input,name_th_input,name_en_input,description_input,specification_input,material_input,finish_input,member_price_input,lead_time_input,factory_cost_input,factory_currency_input,internal_note_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_product_sourcing_action(request_id_input UUID,action_input TEXT,message_input TEXT)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE target_organization_id UUID;
BEGIN
  target_organization_id := public.sourcing_request_organization(request_id_input);
  IF NOT public.has_permission('sourcing.manage', target_organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  RETURN public.admin_product_sourcing_action_ffgl_impl(request_id_input,action_input,message_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_sourcing_candidate(request_id_input UUID,candidate_id_input UUID)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE target_organization_id UUID;
BEGIN
  target_organization_id := public.sourcing_request_organization(request_id_input);
  IF NOT public.has_permission('sourcing.manage', target_organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  RETURN public.delete_sourcing_candidate_ffgl_impl(request_id_input,candidate_id_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sourcing_product_draft(request_id_input UUID,candidate_id_input UUID)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE target_organization_id UUID;
BEGIN
  target_organization_id := public.sourcing_request_organization(request_id_input);
  IF NOT public.has_permission('sourcing.manage', target_organization_id)
    OR NOT public.has_permission('catalog.manage', target_organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  RETURN public.create_sourcing_product_draft_ffgl_impl(request_id_input,candidate_id_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.link_sourcing_product(request_id_input UUID,candidate_id_input UUID,product_id_input UUID)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE target_organization_id UUID;
BEGIN
  target_organization_id := public.sourcing_request_organization(request_id_input);
  IF NOT public.has_permission('sourcing.manage', target_organization_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  RETURN public.link_sourcing_product_ffgl_impl(request_id_input,candidate_id_input,product_id_input);
END;
$$;

REVOKE ALL ON FUNCTION public.save_sourcing_candidate(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_product_sourcing_action(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_sourcing_candidate(UUID,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_sourcing_product_draft(UUID,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_sourcing_product(UUID,UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_sourcing_candidate(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,INTEGER,NUMERIC,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_product_sourcing_action(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_sourcing_candidate(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sourcing_product_draft(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_sourcing_product(UUID,UUID,UUID) TO authenticated;
