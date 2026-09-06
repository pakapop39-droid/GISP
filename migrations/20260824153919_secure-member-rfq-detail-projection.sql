CREATE OR REPLACE FUNCTION public.get_member_custom_request_detail(request_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_record public.custom_requests%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO request_record
  FROM public.custom_requests
  WHERE id = request_id_input;

  IF NOT FOUND OR request_record.member_profile_id IS DISTINCT FROM public.current_member_profile_id() THEN
    RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND';
  END IF;

  SELECT jsonb_build_object(
    'request', jsonb_build_object(
      'id', request_record.id,
      'organization_id', request_record.organization_id,
      'member_profile_id', request_record.member_profile_id,
      'project_id', request_record.project_id,
      'area_id', request_record.area_id,
      'base_product_id', request_record.base_product_id,
      'request_number', request_record.request_number,
      'request_type', request_record.request_type,
      'item_name', request_record.item_name,
      'specification', request_record.specification,
      'description', request_record.description,
      'width_mm', request_record.width_mm,
      'depth_mm', request_record.depth_mm,
      'height_mm', request_record.height_mm,
      'quantity', request_record.quantity,
      'unit', request_record.unit,
      'requested_material', request_record.requested_material,
      'requested_color', request_record.requested_color,
      'requested_function', request_record.requested_function,
      'member_note', request_record.member_note,
      'status', request_record.status,
      'submitted_by', request_record.submitted_by,
      'submitted_at', request_record.submitted_at,
      'created_at', request_record.created_at,
      'updated_at', request_record.updated_at
    ),
    'project', (
      SELECT jsonb_build_object(
        'id', p.id,
        'project_number', p.project_number,
        'name', p.name,
        'site_address', p.site_address,
        'expected_need_date', p.expected_need_date
      )
      FROM public.projects p
      WHERE p.id = request_record.project_id
    ),
    'area', (
      SELECT jsonb_build_object('id', pa.id, 'name', pa.name)
      FROM public.project_areas pa
      WHERE pa.id = request_record.area_id
    ),
    'areas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pa.id, 'name', pa.name) ORDER BY pa.created_at)
      FROM public.project_areas pa
      WHERE pa.project_id = request_record.project_id
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id,
        'action', h.action,
        'from_status', h.from_status,
        'to_status', h.to_status,
        'message', h.message,
        'visibility', h.visibility,
        'created_at', h.created_at
      ) ORDER BY h.created_at)
      FROM public.custom_request_history h
      WHERE h.custom_request_id = request_id_input
        AND h.visibility = 'MEMBER'
    ), '[]'::jsonb),
    'files', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fm.id,
        'original_name', fm.original_name,
        'mime_type', fm.mime_type,
        'size_bytes', fm.size_bytes,
        'created_at', fm.created_at,
        'file_role', link.file_role
      ) ORDER BY link.created_at)
      FROM public.custom_request_files link
      JOIN public.file_metadata fm ON fm.id = link.file_id
      WHERE link.custom_request_id = request_id_input
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_custom_request_detail(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_member_custom_request_detail(UUID) TO authenticated;
