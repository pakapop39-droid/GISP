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
