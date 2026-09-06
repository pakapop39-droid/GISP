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
    'request', to_jsonb(request_record),
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

CREATE OR REPLACE FUNCTION public.get_admin_custom_request_detail(request_id_input UUID)
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

  IF NOT FOUND OR NOT public.has_permission('rfq.manage', request_record.organization_id) THEN
    RAISE EXCEPTION 'CUSTOM_REQUEST_NOT_FOUND_OR_PERMISSION_DENIED';
  END IF;

  SELECT jsonb_build_object(
    'request', to_jsonb(request_record),
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
    'member', (
      SELECT jsonb_build_object(
        'id', mp.id,
        'company_name', mp.company_name,
        'contact_name', mp.contact_name,
        'contact_phone', mp.contact_phone
      )
      FROM public.member_profiles mp
      WHERE mp.id = request_record.member_profile_id
    ),
    'candidates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'supplier_id', c.supplier_id,
        'created_at', c.created_at,
        'supplier', jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'status', s.status
        )
      ) ORDER BY c.created_at)
      FROM public.custom_request_supplier_candidates c
      JOIN public.suppliers s ON s.id = c.supplier_id
      WHERE c.custom_request_id = request_id_input
    ), '[]'::jsonb),
    'assignments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'assigned_to', a.assigned_to,
        'assigned_name', u.full_name,
        'due_at', a.due_at,
        'action_required', a.action_required,
        'status', a.status,
        'created_at', a.created_at,
        'completed_at', a.completed_at
      ) ORDER BY a.created_at DESC)
      FROM public.assignments a
      LEFT JOIN public.users u ON u.id = a.assigned_to
      WHERE a.entity_type = 'CUSTOM_REQUEST'
        AND a.entity_id = request_id_input
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id,
        'actor_user_id', h.actor_user_id,
        'actor_name', u.full_name,
        'action', h.action,
        'from_status', h.from_status,
        'to_status', h.to_status,
        'message', h.message,
        'visibility', h.visibility,
        'created_at', h.created_at
      ) ORDER BY h.created_at)
      FROM public.custom_request_history h
      LEFT JOIN public.users u ON u.id = h.actor_user_id
      WHERE h.custom_request_id = request_id_input
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
    ), '[]'::jsonb),
    'options', jsonb_build_object(
      'suppliers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'status', s.status
        ) ORDER BY s.name)
        FROM public.suppliers s
        WHERE s.status IN ('PROSPECT', 'ACTIVE')
      ), '[]'::jsonb),
      'users', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', u.id, 'full_name', u.full_name) ORDER BY u.full_name)
        FROM public.users u
        WHERE u.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id
              AND ur.revoked_at IS NULL
              AND r.code <> 'MEMBER'
          )
      ), '[]'::jsonb)
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_custom_request_detail(UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_admin_custom_request_detail(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_member_custom_request_detail(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_admin_custom_request_detail(UUID) TO authenticated;
