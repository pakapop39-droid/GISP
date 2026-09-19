-- READ-ONLY evidence query for the exact 54 routines touched by the C/D
-- emergency Stop/Forward-Resume package. Capture this single JSON result before
-- Stop and after Resume, outside the backend, then compare combinedMd5 and every
-- rowMd5. The query fails closed when any exact regprocedure is missing.
--
-- The hash is MD5 because md5(text) is built into PostgreSQL and therefore does
-- not depend on a pgcrypto installation. It is an equality checksum, not a
-- security signature. Evidence files are separately protected with SHA-256.

WITH target(signature) AS (
  VALUES
    ('public.submit_custom_request(uuid,text,text)'),
    ('public.create_custom_request_draft(uuid,uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,text,text,text,text,text)'),
    ('public.save_custom_request_details(uuid,uuid,uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,text,text,text,text,text)'),
    ('public.submit_custom_request_v2(uuid)'),
    ('public.cancel_custom_request(uuid,text)'),
    ('public.respond_custom_quotation(uuid,text,text)'),
    ('public.create_customer_order(uuid,jsonb)'),
    ('public.submit_payment_transfer(uuid,numeric,timestamp with time zone,uuid)'),
    ('public.request_order_cancellation(uuid,text,uuid)'),
    ('public.create_custom_quotation(uuid,numeric,integer,integer,uuid,numeric,text,text)'),
    ('public.update_custom_quotation_draft(uuid,numeric,integer,integer,uuid,numeric,text,text)'),
    ('public.send_custom_quotation(uuid)'),
    ('public.admin_transition_custom_quotation(uuid,text,text)'),
    ('public.issue_supplier_orders(uuid)'),
    ('public.create_supplier_payment(uuid,text,numeric,text)'),
    ('public.review_supplier_payment(uuid,boolean,text)'),
    ('public.mark_supplier_payment_paid(uuid,uuid)'),
    ('public.decide_order_cancellation(uuid,boolean,text,numeric,numeric)'),
    ('public.record_customer_payment_evidence_preview(uuid,text,uuid,text,bigint,text)'),
    ('public.verify_payment_transfer_private(uuid,boolean,text,text,uuid,text,bigint)'),
    ('public.verify_payment_transfer(uuid,boolean,text)'),
    ('public.submit_payment_transfer_bound_impl(uuid,numeric,timestamp with time zone,uuid)'),
    ('public.add_production_update(uuid,text,text,timestamp with time zone,numeric,timestamp with time zone,timestamp with time zone,text,jsonb)'),
    ('public.record_qc_inspection(uuid,text,jsonb,text,text,text,text,uuid,jsonb)'),
    ('public.respond_custom_qc(uuid,text,text)'),
    ('public.approve_custom_qc(uuid)'),
    ('public.reopen_qc_inspection(uuid,text)'),
    ('public.freight_payment_enabled()'),
    ('public.create_warehouse_receipt(uuid,uuid,timestamp with time zone,integer,numeric,numeric,text,jsonb,uuid[])'),
    ('public.release_warehouse_receipt_item(uuid,numeric)'),
    ('public.create_consolidation(uuid,uuid,text,text,jsonb)'),
    ('public.confirm_consolidation(uuid)'),
    ('public.create_shipment_v2(uuid,text,text,text,timestamp with time zone,timestamp with time zone,text,numeric,text)'),
    ('public.acknowledge_partial_shipment(uuid,text)'),
    ('public.dispatch_shipment(uuid)'),
    ('public.add_shipment_event(uuid,text,timestamp with time zone,text,text,timestamp with time zone,boolean,uuid)'),
    ('public.schedule_delivery(uuid,timestamp with time zone,timestamp with time zone,text,text,text)'),
    ('public.confirm_delivery_appointment(uuid)'),
    ('public.request_delivery_reschedule(uuid,jsonb,text,text,text,text,jsonb)'),
    ('public.review_delivery_reschedule(uuid,boolean,text,timestamp with time zone,timestamp with time zone)'),
    ('public.advance_delivery_status(uuid,text,text,text,text,text)'),
    ('public.record_delivery_v2(uuid,timestamp with time zone,text,text,jsonb,uuid[],text,text)'),
    ('public.add_logistics_cost(uuid,uuid,uuid,text,text,numeric,text,numeric,numeric,boolean,text,text,uuid[])'),
    ('public.finalize_logistics_costs(uuid)'),
    ('public.issue_freight_invoice(uuid,numeric,timestamp with time zone,text)'),
    ('public.create_shipment(text,jsonb)'),
    ('public.record_delivery(uuid,text,uuid,boolean)'),
    ('public.create_claim(uuid,text,text,text,numeric,text,timestamp with time zone,text,text,uuid)'),
    ('public.member_claim_action(uuid,text,text,uuid)'),
    ('public.admin_claim_action(uuid,text,text,text,text,uuid,uuid,timestamp with time zone)'),
    ('public.record_claim_internal_cost(uuid,text,numeric,text,text)'),
    ('public.get_executive_dashboard(date,date)'),
    ('public.get_fixed_report(text,date,date,text,integer,integer)'),
    ('public.record_fixed_report_export(text,jsonb,integer)')
), resolved AS (
  SELECT t.signature, to_regprocedure(t.signature) AS oid
  FROM target t
), routine_rows AS (
  SELECT
    r.signature,
    jsonb_build_object(
      'signature', r.signature,
      'definition', pg_get_functiondef(p.oid),
      'owner', owner_role.rolname,
      'language', language_row.lanname,
      'volatility', CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
      END,
      'securityDefiner', p.prosecdef,
      'config', COALESCE((
        SELECT jsonb_agg(config_value ORDER BY config_value)
        FROM unnest(p.proconfig) AS config_value
      ), '[]'::jsonb),
      'acl', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'grantor', COALESCE(grantor_role.rolname, acl.grantor::text),
            'grantee', CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
              ELSE COALESCE(grantee_role.rolname, acl.grantee::text) END,
            'privilege', acl.privilege_type,
            'grantable', acl.is_grantable
          ) ORDER BY
            CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
              ELSE COALESCE(grantee_role.rolname, acl.grantee::text) END,
            acl.privilege_type,
            acl.is_grantable,
            COALESCE(grantor_role.rolname, acl.grantor::text)
        )
        FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
        LEFT JOIN pg_roles grantor_role ON grantor_role.oid = acl.grantor
        LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee
      ), '[]'::jsonb)
    ) AS snapshot
  FROM resolved r
  JOIN pg_proc p ON p.oid = r.oid
  JOIN pg_roles owner_role ON owner_role.oid = p.proowner
  JOIN pg_language language_row ON language_row.oid = p.prolang
), hashed_rows AS (
  SELECT signature, snapshot, md5(snapshot::text) AS row_md5
  FROM routine_rows
), stats AS (
  SELECT
    (SELECT count(*) FROM target) AS expected_count,
    count(*) AS actual_count,
    md5(jsonb_agg(snapshot ORDER BY signature)::text) AS combined_md5
  FROM hashed_rows
), guarded_stats AS (
  SELECT
    expected_count,
    CASE WHEN expected_count = 54 AND actual_count = expected_count
      THEN actual_count
      ELSE 1 / (actual_count - actual_count)
    END AS actual_count,
    combined_md5
  FROM stats
), row_collection AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'signature', signature,
      'rowMd5', row_md5,
      'snapshot', snapshot
    ) ORDER BY signature
  ) AS functions
  FROM hashed_rows
)
SELECT jsonb_build_object(
  'format', 'GISP_FUNCTION_SNAPSHOT_V1',
  'expectedCount', guarded_stats.expected_count,
  'actualCount', guarded_stats.actual_count,
  'combinedMd5', guarded_stats.combined_md5,
  'functions', row_collection.functions
) AS function_snapshot
FROM guarded_stats
CROSS JOIN row_collection;
