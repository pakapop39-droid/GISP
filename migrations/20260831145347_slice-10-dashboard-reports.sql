-- Slice 10: role-aware dashboards and permission-safe fixed reports.

INSERT INTO public.permissions(code, name)
VALUES
  ('reports.fixed.read', 'ดู Fixed Report'),
  ('reports.fixed.export', 'Export Fixed Report')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('reports.fixed.read', 'reports.fixed.export')
WHERE r.code IN (
  'SUPER_ADMIN', 'ORDER_ADMIN', 'PURCHASING', 'FINANCE', 'QC',
  'LOGISTICS', 'CLAIM_ADMIN', 'EXECUTIVE_VIEWER'
)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS customer_orders_member_report_idx
  ON public.customer_orders(member_profile_id, created_at DESC, status);
CREATE INDEX IF NOT EXISTS payment_schedules_report_idx
  ON public.payment_schedules(order_id, created_at DESC, status, due_at);
CREATE INDEX IF NOT EXISTS production_updates_latest_report_idx
  ON public.production_updates(supplier_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shipments_report_idx
  ON public.shipments(customer_order_id, created_at DESC, status);
CREATE INDEX IF NOT EXISTS shipment_status_delay_report_idx
  ON public.shipment_status_history(shipment_id, event_at DESC)
  WHERE is_delay = TRUE;
CREATE INDEX IF NOT EXISTS deliveries_report_idx
  ON public.deliveries(customer_order_id, created_at DESC, status, scheduled_at);

CREATE OR REPLACE FUNCTION public.get_member_dashboard()
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  member_id UUID := public.current_member_profile_id();
  active_order_count BIGINT;
  production_order_count BIGINT;
  in_transit_count BIGINT;
  upcoming_delivery_count BIGINT;
  open_claim_count BIGINT;
  outstanding_by_currency JSONB;
  actions JSONB;
BEGIN
  IF member_id IS NULL THEN
    RAISE EXCEPTION 'member access required';
  END IF;

  SELECT COUNT(*) INTO active_order_count
  FROM public.customer_orders co
  WHERE co.member_profile_id = member_id
    AND co.status NOT IN ('COMPLETED', 'CANCELLED');

  SELECT COUNT(*) INTO production_order_count
  FROM public.customer_orders co
  WHERE co.member_profile_id = member_id
    AND co.status = 'IN_PRODUCTION';

  SELECT COUNT(*) INTO in_transit_count
  FROM public.shipments s
  JOIN public.customer_orders co ON co.id = s.customer_order_id
  WHERE co.member_profile_id = member_id
    AND s.status IN (
      'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
      'ARRIVED_THAILAND', 'IMPORT_CUSTOMS'
    );

  SELECT COUNT(*) INTO upcoming_delivery_count
  FROM public.deliveries d
  JOIN public.customer_orders co ON co.id = d.customer_order_id
  WHERE co.member_profile_id = member_id
    AND d.status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')
    AND d.scheduled_at >= NOW()
    AND d.scheduled_at < NOW() + INTERVAL '7 days';

  SELECT COUNT(*) INTO open_claim_count
  FROM public.claims c
  WHERE c.member_profile_id = member_id
    AND c.status NOT IN ('CLOSED', 'REJECTED');

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('currency', x.currency, 'amount', x.amount)
      ORDER BY x.currency
    ),
    '[]'::jsonb
  )
  INTO outstanding_by_currency
  FROM (
    SELECT co.currency,
           SUM(GREATEST(ps.due_amount - ps.verified_amount, 0)) AS amount
    FROM public.payment_schedules ps
    JOIN public.customer_orders co ON co.id = ps.order_id
    WHERE co.member_profile_id = member_id
      AND ps.status <> 'CANCELLED'
    GROUP BY co.currency
    HAVING SUM(GREATEST(ps.due_amount - ps.verified_amount, 0)) > 0
  ) x;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(q) ORDER BY q.priority, q.due_at NULLS LAST, q.created_at DESC),
    '[]'::jsonb
  )
  INTO actions
  FROM (
    SELECT *
    FROM (
      SELECT
        1 AS priority,
        'PAYMENT_OVERDUE'::text AS action_type,
        ps.id AS entity_id,
        co.id AS order_id,
        co.order_number AS reference,
        ('ยอดชำระเกินกำหนด · ' || ps.schedule_type)::text AS title,
        GREATEST(ps.due_amount - ps.verified_amount, 0)::numeric AS amount,
        co.currency::text AS currency,
        ps.due_at,
        ps.created_at
      FROM public.payment_schedules ps
      JOIN public.customer_orders co ON co.id = ps.order_id
      WHERE co.member_profile_id = member_id
        AND ps.status IN ('PENDING', 'PARTIALLY_VERIFIED', 'OVERPAYMENT_REVIEW')
        AND ps.due_at < NOW()
        AND ps.due_amount > ps.verified_amount

      UNION ALL

      SELECT
        2, 'QC_APPROVAL', oi.id, co.id, co.order_number,
        ('รออนุมัติ QC · ' || oi.item_name_snapshot),
        NULL::numeric, co.currency::text, NULL::timestamptz, oi.created_at
      FROM public.order_items oi
      JOIN public.customer_orders co ON co.id = oi.order_id
      WHERE co.member_profile_id = member_id
        AND oi.qc_status = 'WAITING_MEMBER_APPROVAL'

      UNION ALL

      SELECT
        3, 'DELIVERY_CONFIRMATION', d.id, co.id, d.delivery_number,
        'ยืนยันนัดส่งสินค้า',
        NULL::numeric, NULL::text, d.scheduled_at, d.created_at
      FROM public.deliveries d
      JOIN public.customer_orders co ON co.id = d.customer_order_id
      WHERE co.member_profile_id = member_id
        AND d.status IN ('PROPOSED', 'RESCHEDULE_REQUESTED')

      UNION ALL

      SELECT
        4, 'CLAIM_INFORMATION', c.id, oi.order_id, c.claim_number,
        'Claim รอข้อมูลเพิ่มเติม',
        NULL::numeric, NULL::text, c.target_resolution_at, c.created_at
      FROM public.claims c
      JOIN public.order_items oi ON oi.id = c.order_item_id
      WHERE c.member_profile_id = member_id
        AND c.status = 'WAITING_INFORMATION'

      UNION ALL

      SELECT
        5, 'PAYMENT_DUE_SOON', ps.id, co.id, co.order_number,
        ('ยอดชำระใกล้ครบกำหนด · ' || ps.schedule_type),
        GREATEST(ps.due_amount - ps.verified_amount, 0), co.currency::text,
        ps.due_at, ps.created_at
      FROM public.payment_schedules ps
      JOIN public.customer_orders co ON co.id = ps.order_id
      WHERE co.member_profile_id = member_id
        AND ps.status IN ('PENDING', 'PARTIALLY_VERIFIED')
        AND ps.due_at >= NOW()
        AND ps.due_at < NOW() + INTERVAL '7 days'
        AND ps.due_amount > ps.verified_amount
    ) candidates
    ORDER BY priority, due_at NULLS LAST, created_at DESC
    LIMIT 20
  ) q;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'metrics', jsonb_build_object(
      'action_required', jsonb_array_length(actions),
      'active_orders', active_order_count,
      'orders_in_production', production_order_count,
      'shipments_in_transit', in_transit_count,
      'upcoming_deliveries', upcoming_delivery_count,
      'open_claims', open_claim_count,
      'outstanding_by_currency', outstanding_by_currency
    ),
    'actions', actions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_operations_dashboard()
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  can_orders BOOLEAN;
  can_payments BOOLEAN;
  can_production BOOLEAN;
  can_qc BOOLEAN;
  can_shipments BOOLEAN;
  can_deliveries BOOLEAN;
  can_claims BOOLEAN;
  actions JSONB;
BEGIN
  IF NOT public.current_user_is_internal() THEN
    RAISE EXCEPTION 'internal access required';
  END IF;

  can_orders := public.has_permission('orders.manage');
  can_payments := public.has_permission('payments.verify');
  can_production := public.has_permission('production.manage');
  can_qc := public.has_permission('qc.manage');
  can_shipments := public.has_permission('shipments.manage');
  can_deliveries := public.has_permission('deliveries.manage');
  can_claims := public.has_permission('claims.manage');

  SELECT COALESCE(
    jsonb_agg(to_jsonb(q) ORDER BY q.priority, q.due_at NULLS LAST, q.created_at DESC),
    '[]'::jsonb
  )
  INTO actions
  FROM (
    SELECT *
    FROM (
      SELECT
        1 AS priority, 'PAYMENT_REVIEW'::text AS action_type,
        pt.id AS entity_id, co.id AS order_id, pt.transfer_number AS reference,
        'ตรวจหลักฐานชำระเงิน'::text AS title,
        ps.due_at, pt.created_at
      FROM public.payment_transfers pt
      JOIN public.payment_schedules ps ON ps.id = pt.payment_schedule_id
      JOIN public.customer_orders co ON co.id = ps.order_id
      WHERE can_payments AND pt.status = 'SUBMITTED'

      UNION ALL

      SELECT
        1, 'ISSUE_PO', co.id, co.id, co.order_number,
        'มัดจำผ่านแล้ว — รอออก PO',
        NULL::timestamptz, co.created_at
      FROM public.customer_orders co
      WHERE can_orders
        AND co.status = 'DEPOSIT_VERIFIED'
        AND NOT EXISTS (
          SELECT 1 FROM public.supplier_orders so
          WHERE so.customer_order_id = co.id
            AND so.po_issued_at IS NOT NULL
        )

      UNION ALL

      SELECT
        2, 'PRODUCTION_DELAY', latest.supplier_order_id,
        latest.customer_order_id, latest.order_number,
        'Production ล่าช้า',
        latest.estimated_completion_at, latest.created_at
      FROM (
        SELECT DISTINCT ON (pu.supplier_order_id)
          pu.supplier_order_id, so.customer_order_id, co.order_number,
          pu.status, pu.estimated_completion_at, pu.created_at
        FROM public.production_updates pu
        JOIN public.supplier_orders so ON so.id = pu.supplier_order_id
        JOIN public.customer_orders co ON co.id = so.customer_order_id
        ORDER BY pu.supplier_order_id, pu.created_at DESC
      ) latest
      WHERE can_production AND latest.status = 'DELAYED'

      UNION ALL

      SELECT
        2, 'QC_ACTION', oi.id, co.id, co.order_number,
        CASE oi.qc_status
          WHEN 'REWORK_REQUIRED' THEN 'QC รอ Rework'
          ELSE 'QC รอ Member อนุมัติ'
        END,
        NULL::timestamptz, oi.created_at
      FROM public.order_items oi
      JOIN public.customer_orders co ON co.id = oi.order_id
      WHERE can_qc
        AND oi.qc_status IN ('REWORK_REQUIRED', 'WAITING_MEMBER_APPROVAL')

      UNION ALL

      SELECT
        3, 'SHIPMENT_DELAY', s.id, s.customer_order_id, s.shipment_number,
        'Shipment ETA ล่าช้า',
        s.estimated_arrival_at, s.created_at
      FROM public.shipments s
      WHERE can_shipments
        AND s.status IN (
          'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
          'ARRIVED_THAILAND', 'IMPORT_CUSTOMS'
        )
        AND (
          s.delay_reason IS NOT NULL
          OR (s.estimated_arrival_at IS NOT NULL AND s.estimated_arrival_at < NOW())
        )

      UNION ALL

      SELECT
        3, 'DELIVERY_DUE', d.id, d.customer_order_id, d.delivery_number,
        CASE WHEN d.status = 'PROPOSED'
          THEN 'Delivery รอ Member ยืนยัน'
          ELSE 'Delivery ใกล้ถึงกำหนด'
        END,
        d.scheduled_at, d.created_at
      FROM public.deliveries d
      WHERE can_deliveries
        AND d.status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')
        AND (
          d.status = 'PROPOSED'
          OR (d.scheduled_at IS NOT NULL AND d.scheduled_at < NOW() + INTERVAL '2 days')
        )

      UNION ALL

      SELECT
        2, 'CLAIM_ACTION', c.id, oi.order_id, c.claim_number,
        CASE
          WHEN c.target_resolution_at IS NOT NULL AND c.target_resolution_at < NOW()
            THEN 'Claim เกิน SLA'
          WHEN c.status = 'WAITING_INFORMATION'
            THEN 'Claim รอข้อมูล'
          ELSE 'Claim รอตรวจ'
        END,
        c.target_resolution_at, c.created_at
      FROM public.claims c
      JOIN public.order_items oi ON oi.id = c.order_item_id
      WHERE can_claims
        AND c.status NOT IN ('CLOSED', 'REJECTED')
        AND (
          c.status IN ('SUBMITTED', 'WAITING_INFORMATION')
          OR (c.target_resolution_at IS NOT NULL AND c.target_resolution_at < NOW())
        )
    ) candidates
    ORDER BY priority, due_at NULLS LAST, created_at DESC
    LIMIT 50
  ) q;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'permissions', jsonb_build_object(
      'orders', can_orders,
      'payments', can_payments,
      'production', can_production,
      'qc', can_qc,
      'shipments', can_shipments,
      'deliveries', can_deliveries,
      'claims', can_claims,
      'reports', public.has_permission('reports.fixed.read'),
      'executive', public.has_permission('reports.executive.read')
    ),
    'metrics', jsonb_build_object(
      'action_required', jsonb_array_length(actions),
      'active_orders', CASE WHEN can_orders THEN (
        SELECT COUNT(*) FROM public.customer_orders
        WHERE status NOT IN ('COMPLETED', 'CANCELLED')
      ) ELSE NULL END,
      'payment_reviews', CASE WHEN can_payments THEN (
        SELECT COUNT(*) FROM public.payment_transfers WHERE status = 'SUBMITTED'
      ) ELSE NULL END,
      'production_delays', CASE WHEN can_production THEN (
        SELECT COUNT(*)
        FROM (
          SELECT DISTINCT ON (supplier_order_id) supplier_order_id, status
          FROM public.production_updates
          ORDER BY supplier_order_id, created_at DESC
        ) latest
        WHERE latest.status = 'DELAYED'
      ) ELSE NULL END,
      'qc_actions', CASE WHEN can_qc THEN (
        SELECT COUNT(*) FROM public.order_items
        WHERE qc_status IN ('REWORK_REQUIRED', 'WAITING_MEMBER_APPROVAL')
      ) ELSE NULL END,
      'shipments_in_transit', CASE WHEN can_shipments THEN (
        SELECT COUNT(*) FROM public.shipments
        WHERE status IN (
          'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
          'ARRIVED_THAILAND', 'IMPORT_CUSTOMS'
        )
      ) ELSE NULL END,
      'deliveries_due', CASE WHEN can_deliveries THEN (
        SELECT COUNT(*) FROM public.deliveries
        WHERE status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')
          AND scheduled_at IS NOT NULL
          AND scheduled_at < NOW() + INTERVAL '7 days'
      ) ELSE NULL END,
      'open_claims', CASE WHEN can_claims THEN (
        SELECT COUNT(*) FROM public.claims
        WHERE status NOT IN ('CLOSED', 'REJECTED')
      ) ELSE NULL END
    ),
    'actions', actions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_executive_dashboard(
  date_from_input DATE,
  date_to_input DATE
)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  range_end TIMESTAMPTZ;
  order_value JSONB;
  collected JSONB;
  outstanding JSONB;
  supplier_payable JSONB;
  freight_outstanding JSONB;
BEGIN
  IF NOT public.has_permission('reports.executive.read') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF date_from_input IS NULL OR date_to_input IS NULL
     OR date_from_input > date_to_input
     OR date_to_input - date_from_input > 366 THEN
    RAISE EXCEPTION 'invalid report date range';
  END IF;
  range_end := (date_to_input + 1)::timestamptz;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO order_value
  FROM (
    SELECT co.currency::text AS currency, SUM(co.grand_total) AS amount
    FROM public.customer_orders co
    WHERE co.status <> 'CANCELLED'
      AND co.created_at >= date_from_input::timestamptz
      AND co.created_at < range_end
    GROUP BY co.currency
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO collected
  FROM (
    SELECT co.currency::text AS currency, SUM(ps.verified_amount) AS amount
    FROM public.payment_schedules ps
    JOIN public.customer_orders co ON co.id = ps.order_id
    WHERE ps.status <> 'CANCELLED'
      AND ps.created_at >= date_from_input::timestamptz
      AND ps.created_at < range_end
    GROUP BY co.currency
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO outstanding
  FROM (
    SELECT co.currency::text AS currency,
           SUM(GREATEST(ps.due_amount - ps.verified_amount, 0)) AS amount
    FROM public.payment_schedules ps
    JOIN public.customer_orders co ON co.id = ps.order_id
    WHERE ps.status <> 'CANCELLED'
      AND ps.created_at >= date_from_input::timestamptz
      AND ps.created_at < range_end
    GROUP BY co.currency
    HAVING SUM(GREATEST(ps.due_amount - ps.verified_amount, 0)) > 0
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO supplier_payable
  FROM (
    SELECT so.supplier_currency::text AS currency,
           SUM(GREATEST(sps.due_amount - sps.paid_amount, 0)) AS amount
    FROM public.supplier_payment_schedules sps
    JOIN public.supplier_orders so ON so.id = sps.supplier_order_id
    WHERE sps.status <> 'PAID'
      AND sps.created_at >= date_from_input::timestamptz
      AND sps.created_at < range_end
    GROUP BY so.supplier_currency
    HAVING SUM(GREATEST(sps.due_amount - sps.paid_amount, 0)) > 0
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.currency), '[]'::jsonb)
  INTO freight_outstanding
  FROM (
    SELECT fi.currency::text AS currency,
           SUM(CASE WHEN fi.status = 'PAID' THEN 0 ELSE fi.grand_total END) AS amount
    FROM public.freight_invoices fi
    WHERE fi.status <> 'CANCELLED'
      AND fi.created_at >= date_from_input::timestamptz
      AND fi.created_at < range_end
    GROUP BY fi.currency
    HAVING SUM(CASE WHEN fi.status = 'PAID' THEN 0 ELSE fi.grand_total END) > 0
  ) x;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'filters', jsonb_build_object(
      'date_from', date_from_input,
      'date_to', date_to_input
    ),
    'financial', jsonb_build_object(
      'order_value', order_value,
      'collected', collected,
      'customer_outstanding', outstanding,
      'supplier_payable', supplier_payable,
      'freight_outstanding', freight_outstanding
    ),
    'operational', jsonb_build_object(
      'active_orders', (
        SELECT COUNT(*) FROM public.customer_orders
        WHERE status NOT IN ('COMPLETED', 'CANCELLED')
      ),
      'orders_in_production', (
        SELECT COUNT(*) FROM public.customer_orders WHERE status = 'IN_PRODUCTION'
      ),
      'production_delayed', (
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (supplier_order_id) supplier_order_id, status
          FROM public.production_updates
          ORDER BY supplier_order_id, created_at DESC
        ) latest WHERE latest.status = 'DELAYED'
      ),
      'qc_issues', (
        SELECT COUNT(*) FROM public.order_items
        WHERE qc_status IN ('FAILED', 'REWORK_REQUIRED', 'ADDITIONAL_REVIEW_REQUESTED')
      ),
      'goods_in_transit', (
        SELECT COUNT(*) FROM public.shipments
        WHERE status IN (
          'DISPATCHED', 'IN_TRANSIT', 'ARRIVED',
          'ARRIVED_THAILAND', 'IMPORT_CUSTOMS'
        )
      ),
      'deliveries_due', (
        SELECT COUNT(*) FROM public.deliveries
        WHERE status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')
          AND scheduled_at IS NOT NULL
          AND scheduled_at < NOW() + INTERVAL '7 days'
      ),
      'open_claims', (
        SELECT COUNT(*) FROM public.claims
        WHERE status NOT IN ('CLOSED', 'REJECTED')
      )
    ),
    'business', jsonb_build_object(
      'active_members', (
        SELECT COUNT(*) FROM public.member_profiles mp
        JOIN public.organizations o ON o.id = mp.organization_id
        WHERE o.status = 'ACTIVE'
      ),
      'members_with_orders', (
        SELECT COUNT(DISTINCT member_profile_id)
        FROM public.customer_orders
        WHERE status <> 'CANCELLED'
      ),
      'active_suppliers', (
        SELECT COUNT(*) FROM public.suppliers WHERE status = 'ACTIVE'
      ),
      'active_products', (
        SELECT COUNT(*) FROM public.products WHERE status = 'PUBLISHED'
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fixed_report(
  report_type_input TEXT,
  date_from_input DATE,
  date_to_input DATE,
  status_filter_input TEXT DEFAULT NULL,
  row_limit_input INTEGER DEFAULT 500,
  row_offset_input INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  member_id UUID := public.current_member_profile_id();
  internal_access BOOLEAN := public.current_user_is_internal();
  normalized_type TEXT := LOWER(BTRIM(report_type_input));
  normalized_status TEXT := NULLIF(UPPER(BTRIM(status_filter_input)), '');
  range_end TIMESTAMPTZ;
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(row_limit_input, 500), 1), 500);
  safe_offset INTEGER := GREATEST(COALESCE(row_offset_input, 0), 0);
  rows_value JSONB := '[]'::jsonb;
BEGIN
  IF member_id IS NULL AND NOT (
    internal_access AND public.has_permission('reports.fixed.read')
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF normalized_type NOT IN ('order', 'payment', 'delay', 'delivery', 'claim') THEN
    RAISE EXCEPTION 'unsupported report type';
  END IF;
  IF date_from_input IS NULL OR date_to_input IS NULL
     OR date_from_input > date_to_input
     OR date_to_input - date_from_input > 366 THEN
    RAISE EXCEPTION 'invalid report date range';
  END IF;
  range_end := (date_to_input + 1)::timestamptz;

  CASE normalized_type
    WHEN 'order' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT
          co.id, co.order_number, co.status, co.currency::text AS currency,
          co.grand_total, co.created_at, p.name AS project_name,
          mp.company_name AS member_company
        FROM public.customer_orders co
        LEFT JOIN public.projects p ON p.id = co.project_id
        LEFT JOIN public.member_profiles mp ON mp.id = co.member_profile_id
        WHERE (internal_access OR co.member_profile_id = member_id)
          AND co.created_at >= date_from_input::timestamptz
          AND co.created_at < range_end
          AND (normalized_status IS NULL OR co.status = normalized_status)
        ORDER BY co.created_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;

    WHEN 'payment' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT
          ps.id, co.id AS order_id, co.order_number,
          ps.schedule_type, ps.status, co.currency::text AS currency,
          ps.due_amount, ps.verified_amount,
          GREATEST(ps.due_amount - ps.verified_amount, 0) AS outstanding_amount,
          ps.due_at, ps.verified_at, ps.created_at,
          mp.company_name AS member_company
        FROM public.payment_schedules ps
        JOIN public.customer_orders co ON co.id = ps.order_id
        LEFT JOIN public.member_profiles mp ON mp.id = co.member_profile_id
        WHERE (internal_access OR co.member_profile_id = member_id)
          AND ps.created_at >= date_from_input::timestamptz
          AND ps.created_at < range_end
          AND (normalized_status IS NULL OR ps.status = normalized_status)
        ORDER BY ps.created_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;

    WHEN 'delay' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.event_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT *
        FROM (
          SELECT
            pu.id, 'PRODUCTION'::text AS delay_type,
            so.customer_order_id AS order_id, co.order_number AS reference,
            pu.status, pu.delay_reason AS detail,
            pu.estimated_completion_at AS target_at,
            pu.created_at AS event_at
          FROM public.production_updates pu
          JOIN public.supplier_orders so ON so.id = pu.supplier_order_id
          JOIN public.customer_orders co ON co.id = so.customer_order_id
          WHERE pu.status = 'DELAYED'
            AND (internal_access OR (
              co.member_profile_id = member_id AND pu.is_member_visible
            ))
            AND pu.created_at >= date_from_input::timestamptz
            AND pu.created_at < range_end

          UNION ALL

          SELECT
            sh.id, 'SHIPMENT', s.customer_order_id, s.shipment_number,
            sh.status, sh.note, sh.eta_at, sh.event_at
          FROM public.shipment_status_history sh
          JOIN public.shipments s ON s.id = sh.shipment_id
          JOIN public.customer_orders co ON co.id = s.customer_order_id
          WHERE sh.is_delay
            AND (internal_access OR (
              co.member_profile_id = member_id AND sh.is_member_visible
            ))
            AND sh.event_at >= date_from_input::timestamptz
            AND sh.event_at < range_end

          UNION ALL

          SELECT
            d.id, 'DELIVERY', d.customer_order_id, d.delivery_number,
            d.status,
            CASE
              WHEN d.status = 'FAILED' THEN d.failure_reason
              ELSE d.next_delivery_plan
            END,
            d.scheduled_at, COALESCE(d.updated_at, d.created_at)
          FROM public.deliveries d
          JOIN public.customer_orders co ON co.id = d.customer_order_id
          WHERE (internal_access OR co.member_profile_id = member_id)
            AND (
              d.status IN ('FAILED', 'RESCHEDULE_REQUIRED')
              OR (
                d.scheduled_at < NOW()
                AND d.status NOT IN ('DELIVERED', 'DELIVERED_WITH_ISSUE')
              )
            )
            AND COALESCE(d.updated_at, d.created_at) >= date_from_input::timestamptz
            AND COALESCE(d.updated_at, d.created_at) < range_end
        ) delay_rows
        WHERE normalized_status IS NULL OR delay_rows.status = normalized_status
        ORDER BY event_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;

    WHEN 'delivery' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT
          d.id, d.customer_order_id AS order_id, d.delivery_number,
          co.order_number, d.status, d.scheduled_at,
          d.scheduled_window_end_at, d.delivered_at, d.created_at,
          (d.status IN ('PARTIALLY_DELIVERED', 'DELIVERED_WITH_ISSUE', 'FAILED')) AS issue_flag,
          mp.company_name AS member_company
        FROM public.deliveries d
        JOIN public.customer_orders co ON co.id = d.customer_order_id
        LEFT JOIN public.member_profiles mp ON mp.id = co.member_profile_id
        WHERE (internal_access OR co.member_profile_id = member_id)
          AND d.created_at >= date_from_input::timestamptz
          AND d.created_at < range_end
          AND (normalized_status IS NULL OR d.status = normalized_status)
        ORDER BY d.created_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;

    WHEN 'claim' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO rows_value
      FROM (
        SELECT
          c.id, oi.order_id, c.claim_number, co.order_number,
          c.subject, c.issue_type, c.severity, c.status,
          c.suggested_responsibility, c.confirmed_responsibility,
          c.target_resolution_at, c.created_at, c.closed_at,
          mp.company_name AS member_company
        FROM public.claims c
        JOIN public.order_items oi ON oi.id = c.order_item_id
        JOIN public.customer_orders co ON co.id = oi.order_id
        LEFT JOIN public.member_profiles mp ON mp.id = c.member_profile_id
        WHERE (internal_access OR c.member_profile_id = member_id)
          AND c.created_at >= date_from_input::timestamptz
          AND c.created_at < range_end
          AND (normalized_status IS NULL OR c.status = normalized_status)
        ORDER BY c.created_at DESC
        LIMIT safe_limit OFFSET safe_offset
      ) x;
  END CASE;

  RETURN jsonb_build_object(
    'report_type', normalized_type,
    'generated_at', NOW(),
    'filters', jsonb_build_object(
      'date_from', date_from_input,
      'date_to', date_to_input,
      'status', normalized_status,
      'limit', safe_limit,
      'offset', safe_offset
    ),
    'row_count', jsonb_array_length(rows_value),
    'rows', rows_value
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_fixed_report_export(
  report_type_input TEXT,
  filters_input JSONB,
  row_count_input INTEGER
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  member_id UUID := public.current_member_profile_id();
  internal_access BOOLEAN := public.current_user_is_internal();
  normalized_type TEXT := LOWER(BTRIM(report_type_input));
  audit_id UUID;
BEGIN
  IF member_id IS NULL AND NOT (
    internal_access AND public.has_permission('reports.fixed.export')
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF normalized_type NOT IN ('order', 'payment', 'delay', 'delivery', 'claim') THEN
    RAISE EXCEPTION 'unsupported report type';
  END IF;
  IF row_count_input IS NULL OR row_count_input < 0 OR row_count_input > 500 THEN
    RAISE EXCEPTION 'invalid export row count';
  END IF;

  audit_id := public.write_audit_event(
    public.current_user_org_id(),
    'fixed_report',
    (SELECT auth.uid()),
    'EXPORTED',
    NULL,
    jsonb_build_object(
      'report_type', normalized_type,
      'filters', COALESCE(filters_input, '{}'::jsonb),
      'row_count', row_count_input,
      'generated_at', NOW()
    )
  );
  RETURN audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_dashboard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_admin_operations_dashboard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_executive_dashboard(DATE, DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_fixed_report(TEXT, DATE, DATE, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_fixed_report_export(TEXT, JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_member_dashboard()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_operations_dashboard()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_executive_dashboard(DATE, DATE)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fixed_report(TEXT, DATE, DATE, TEXT, INTEGER, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fixed_report_export(TEXT, JSONB, INTEGER)
  TO authenticated;
