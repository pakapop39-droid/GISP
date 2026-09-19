-- SELECT-ONLY reconciliation template.
-- Required session input: gisp.cutover_at as an ISO-8601 timestamp.
-- Retain every result set with the incident record before deciding whether
-- forward recovery, export/replay, or a longer stop is required.
-- Message bodies, provider IDs, errors, notes, addresses, object keys and URLs
-- are deliberately excluded because they can contain sensitive information.

WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
), counts AS (
  SELECT 'customer_orders' AS entity,
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (
      WHERE created_at >= params.cutover_at OR updated_at >= params.cutover_at
    )::BIGINT AS changed_since_cutover_count
  FROM public.customer_orders CROSS JOIN params
  UNION ALL
  SELECT 'payment_schedules', COUNT(*)::BIGINT,
    COUNT(*) FILTER (
      WHERE created_at >= params.cutover_at
        OR updated_at >= params.cutover_at
        OR verified_at >= params.cutover_at
    )::BIGINT
  FROM public.payment_schedules CROSS JOIN params
  UNION ALL
  SELECT 'payment_transfers', COUNT(*)::BIGINT,
    COUNT(*) FILTER (
      WHERE created_at >= params.cutover_at OR finance_verified_at >= params.cutover_at
    )::BIGINT
  FROM public.payment_transfers CROSS JOIN params
  UNION ALL
  SELECT 'shipments', COUNT(*)::BIGINT,
    COUNT(*) FILTER (
      WHERE created_at >= params.cutover_at OR updated_at >= params.cutover_at
    )::BIGINT
  FROM public.shipments CROSS JOIN params
  UNION ALL
  SELECT 'file_metadata', COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE created_at >= params.cutover_at)::BIGINT
  FROM public.file_metadata CROSS JOIN params
  UNION ALL
  SELECT 'notifications', COUNT(*)::BIGINT,
    COUNT(*) FILTER (
      WHERE created_at >= params.cutover_at OR read_at >= params.cutover_at
    )::BIGINT
  FROM public.notifications CROSS JOIN params
  UNION ALL
  SELECT 'notification_jobs', COUNT(*)::BIGINT,
    COUNT(*) FILTER (
      WHERE created_at >= params.cutover_at OR sent_at >= params.cutover_at
    )::BIGINT
  FROM public.notification_jobs CROSS JOIN params
  UNION ALL
  SELECT 'audit_events', COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE created_at >= params.cutover_at)::BIGINT
  FROM public.audit_events CROSS JOIN params
)
SELECT entity, total_count, changed_since_cutover_count
FROM counts
ORDER BY entity;

-- Orders created or changed after cutover, including monetary snapshots.
WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
)
SELECT co.id, co.order_number, co.organization_id, co.project_id, co.status,
  co.currency, co.subtotal, co.vat_rate_snapshot, co.vat_amount,
  co.grand_total, co.deposit_amount, co.balance_amount,
  co.deposit_verified_at, co.balance_verified_at, co.created_at, co.updated_at
FROM public.customer_orders co
CROSS JOIN params
WHERE co.created_at >= params.cutover_at OR co.updated_at >= params.cutover_at
ORDER BY co.updated_at, co.id;

-- Schedules changed or verified after cutover, including due/verified values.
WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
)
SELECT ps.id, ps.order_id, ps.organization_id, ps.schedule_type, ps.status,
  ps.due_amount, ps.verified_amount, ps.due_at, ps.verified_at,
  ps.created_at, ps.updated_at
FROM public.payment_schedules ps
CROSS JOIN params
WHERE ps.created_at >= params.cutover_at
   OR ps.updated_at >= params.cutover_at
   OR ps.verified_at >= params.cutover_at
ORDER BY ps.updated_at, ps.id;

-- payment_transfers has no updated_at column in the frozen Production-B schema;
-- finance_verified_at is its authoritative post-submission change timestamp.
WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
)
SELECT pt.id, pt.payment_schedule_id, pt.organization_id, pt.transfer_number,
  pt.status, pt.amount, pt.transferred_at, pt.evidence_file_id,
  pt.submitted_by, pt.finance_verified_by, pt.finance_verified_at, pt.created_at
FROM public.payment_transfers pt
CROSS JOIN params
WHERE pt.created_at >= params.cutover_at
   OR pt.finance_verified_at >= params.cutover_at
ORDER BY COALESCE(pt.finance_verified_at, pt.created_at), pt.id;

-- Shipment state changed after cutover; sensitive routing fields are omitted.
WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
)
SELECT sh.id, sh.shipment_number, sh.organization_id, sh.customer_order_id,
  sh.consolidation_group_id, sh.status, sh.shipment_type, sh.shipping_method,
  sh.package_count, sh.dispatched_at, sh.arrived_at,
  sh.actual_departure_at, sh.actual_arrival_at, sh.created_at, sh.updated_at
FROM public.shipments sh
CROSS JOIN params
WHERE sh.created_at >= params.cutover_at OR sh.updated_at >= params.cutover_at
ORDER BY sh.updated_at, sh.id;

-- Notification records since cutover. Titles, bodies and action URLs are omitted.
WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
)
SELECT n.id, n.user_id, n.organization_id, n.type, n.entity_type, n.entity_id,
  CASE WHEN n.read_at IS NULL THEN 'UNREAD' ELSE 'READ' END AS read_status,
  n.read_at, n.created_at
FROM public.notifications n
CROSS JOIN params
WHERE n.created_at >= params.cutover_at OR n.read_at >= params.cutover_at
ORDER BY n.created_at, n.id;

-- Delivery jobs since cutover. Recipient is retained for replay routing; subject,
-- body, provider message ID and error text are deliberately excluded.
WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
)
SELECT nj.id, nj.notification_id, nj.channel, nj.recipient, nj.status,
  nj.attempts, nj.next_attempt_at, nj.created_at, nj.sent_at
FROM public.notification_jobs nj
CROSS JOIN params
WHERE nj.created_at >= params.cutover_at OR nj.sent_at >= params.cutover_at
ORDER BY COALESCE(nj.sent_at, nj.created_at), nj.id;

WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
)
SELECT fm.entity_type, fm.visibility, COUNT(*)::BIGINT AS file_count,
  COALESCE(SUM(fm.size_bytes),0)::BIGINT AS byte_total
FROM public.file_metadata fm
CROSS JOIN params
WHERE fm.created_at >= params.cutover_at
GROUP BY fm.entity_type, fm.visibility
ORDER BY fm.entity_type, fm.visibility;

-- Audit summary plus event identifiers for export/replay correlation.
WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
)
SELECT ae.entity_type, ae.action, COUNT(*)::BIGINT AS event_count,
  MIN(ae.created_at) AS first_event_at, MAX(ae.created_at) AS last_event_at
FROM public.audit_events ae
CROSS JOIN params
WHERE ae.created_at >= params.cutover_at
GROUP BY ae.entity_type, ae.action
ORDER BY ae.entity_type, ae.action;

WITH params AS (
  SELECT current_setting('gisp.cutover_at')::TIMESTAMPTZ AS cutover_at
)
SELECT ae.id, ae.organization_id, ae.actor_user_id, ae.entity_type,
  ae.entity_id, ae.action, ae.request_id, ae.created_at
FROM public.audit_events ae
CROSS JOIN params
WHERE ae.created_at >= params.cutover_at
ORDER BY ae.created_at, ae.id;
