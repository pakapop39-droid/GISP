-- EMPLOYEE-MGMT-S1-v1.1 hosted reliability correction.
-- Return the complete internal-staff list in one authenticated RPC so the
-- admin page does not fan out one email lookup per historical staff account.
-- Development/UAT only. Production requires separate Release Authorization.

CREATE OR REPLACE FUNCTION public.list_internal_staff_users()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  status TEXT,
  roles TEXT[]
)
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_active_super_admin_user((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.full_name,
    COALESCE(auth_user.email, '')::TEXT AS email,
    u.status::TEXT AS status,
    COALESCE(
      ARRAY_AGG(DISTINCT active_role.code ORDER BY active_role.code)
        FILTER (
          WHERE active_assignment.revoked_at IS NULL
            AND active_assignment.organization_id IS NULL
            AND active_role.code IN (
              'MEMBER_ADMIN', 'PRODUCT_ADMIN', 'ORDER_ADMIN', 'PURCHASING',
              'FINANCE', 'QC', 'LOGISTICS', 'EXECUTIVE_VIEWER', 'SUPER_ADMIN'
            )
        ),
      ARRAY[]::TEXT[]
    ) AS roles
  FROM public.users AS u
  LEFT JOIN auth.users AS auth_user
    ON auth_user.id = u.id
  LEFT JOIN public.user_roles AS active_assignment
    ON active_assignment.user_id = u.id
    AND active_assignment.organization_id IS NULL
    AND active_assignment.revoked_at IS NULL
  LEFT JOIN public.roles AS active_role
    ON active_role.id = active_assignment.role_id
  WHERE u.primary_organization_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_roles AS historical_assignment
      JOIN public.roles AS historical_role
        ON historical_role.id = historical_assignment.role_id
      WHERE historical_assignment.user_id = u.id
        AND historical_assignment.organization_id IS NULL
        AND historical_role.code IN (
          'MEMBER_ADMIN', 'PRODUCT_ADMIN', 'ORDER_ADMIN', 'PURCHASING',
          'FINANCE', 'QC', 'LOGISTICS', 'EXECUTIVE_VIEWER', 'SUPER_ADMIN'
        )
    )
  GROUP BY u.id, u.full_name, auth_user.email, u.status;
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_staff_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_internal_staff_users() TO authenticated;
