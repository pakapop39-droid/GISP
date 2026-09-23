-- SELECT-only function-body and ACL snapshot. Capture outside the backend before Stop and after Resume.
WITH target(signature) AS (VALUES
 ('public.create_customer_order(uuid,jsonb)'),
 ('public.verify_payment_transfer_private(uuid,boolean,text,text,uuid,text,bigint)'),
 ('public.get_dispatch_gate(uuid)'),('public.can_dispatch_order_item(uuid)'),
 ('public.maybe_complete_order(uuid)'),('public.record_qc_inspection(uuid,text,jsonb,text,text,text,text,uuid,jsonb)'),
 ('public.create_shipment_v2(uuid,text,text,text,timestamp with time zone,timestamp with time zone,text,numeric,text)'),
 ('public.record_delivery_v2(uuid,timestamp with time zone,text,text,jsonb,uuid[],text,text)')
), routines AS (
 SELECT signature,to_regprocedure(signature) oid FROM target
)
SELECT signature, oid IS NOT NULL AS exists,
       CASE WHEN oid IS NULL THEN NULL ELSE md5(pg_get_functiondef(oid)) END AS body_md5,
       CASE WHEN oid IS NULL THEN NULL ELSE (SELECT proacl::text FROM pg_proc WHERE pg_proc.oid=routines.oid) END AS acl
FROM routines ORDER BY signature;
