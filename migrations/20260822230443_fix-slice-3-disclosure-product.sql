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