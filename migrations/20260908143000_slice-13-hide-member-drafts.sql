CREATE OR REPLACE FUNCTION public.can_access_sourcing_request(request_id_input UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.product_sourcing_requests r
    WHERE r.id=request_id_input
      AND (
        r.member_profile_id=public.current_member_profile_id()
        OR (r.status<>'DRAFT' AND public.has_permission('sourcing.manage',r.organization_id))
      )
  );
$$;

DROP POLICY IF EXISTS sourcing_requests_select ON public.product_sourcing_requests;
CREATE POLICY sourcing_requests_select
ON public.product_sourcing_requests
FOR SELECT TO authenticated
USING (
  member_profile_id=public.current_member_profile_id()
  OR (status<>'DRAFT' AND public.has_permission('sourcing.manage',organization_id))
);

REVOKE ALL ON FUNCTION public.can_access_sourcing_request(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_sourcing_request(UUID) TO authenticated;
