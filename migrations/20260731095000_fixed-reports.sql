-- GISP MVP Slice 10 — fixed, read-only dashboard summary.

CREATE OR REPLACE FUNCTION public.get_basic_dashboard_summary()
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_org_id UUID := public.current_user_org_id();
  internal_access BOOLEAN := public.current_user_is_internal();
  order_count BIGINT;
  payment_action_count BIGINT;
  delay_count BIGINT;
  delivery_count BIGINT;
  claim_count BIGINT;
  assignment_count BIGINT;
BEGIN
  IF current_org_id IS NULL AND NOT internal_access THEN
    RAISE EXCEPTION 'approved member or internal role required';
  END IF;

  SELECT COUNT(*) INTO order_count
  FROM public.customer_orders co
  WHERE (internal_access OR co.organization_id = current_org_id)
    AND co.status NOT IN ('COMPLETED', 'CANCELLED');

  SELECT COUNT(*) INTO payment_action_count
  FROM public.payment_schedules ps
  WHERE (internal_access OR ps.organization_id = current_org_id)
    AND ps.status IN ('PENDING', 'PARTIALLY_VERIFIED', 'OVERPAYMENT_REVIEW');

  SELECT COUNT(*) INTO delay_count
  FROM public.production_updates pu
  WHERE (internal_access OR pu.organization_id = current_org_id)
    AND pu.status = 'DELAYED'
    AND pu.created_at >= NOW() - INTERVAL '90 days';

  SELECT COUNT(*) INTO delivery_count
  FROM public.deliveries d
  WHERE (internal_access OR d.organization_id = current_org_id)
    AND d.created_at >= DATE_TRUNC('month', CURRENT_DATE);

  SELECT COUNT(*) INTO claim_count
  FROM public.claims c
  WHERE (internal_access OR c.organization_id = current_org_id)
    AND c.status NOT IN ('RESOLVED', 'REJECTED', 'CLOSED');

  SELECT COUNT(*) INTO assignment_count
  FROM public.assignments a
  WHERE (
      a.assigned_to = (SELECT auth.uid())
      OR (internal_access AND a.assigned_role_code IS NOT NULL)
      OR (a.organization_id = current_org_id)
    )
    AND a.status IN ('OPEN', 'IN_PROGRESS');

  RETURN jsonb_build_object(
    'active_orders', order_count,
    'payment_actions', payment_action_count,
    'production_delays', delay_count,
    'deliveries_this_month', delivery_count,
    'open_claims', claim_count,
    'action_required', assignment_count,
    'generated_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_basic_dashboard_summary()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_basic_dashboard_summary()
  TO authenticated;

