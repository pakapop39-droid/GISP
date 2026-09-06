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