-- SELECT-only Lean reconciliation. No custom GUC and no business data mutation.
SELECT current_database() AS database_name, current_user AS database_role;
SELECT to_regprocedure('public.verify_payment_transfer_private(uuid,boolean,text,text,uuid,text,bigint)') IS NOT NULL AS private_verifier_exists;
SELECT has_function_privilege('anon','public.create_supplier_payment(uuid,text,numeric,text)','EXECUTE') AS anon_supplier_payment,
       has_function_privilege('authenticated','public.create_supplier_payment(uuid,text,numeric,text)','EXECUTE') AS authenticated_supplier_payment,
       has_function_privilege('project_admin','public.create_supplier_payment(uuid,text,numeric,text)','EXECUTE') AS project_admin_supplier_payment;
SELECT has_function_privilege('authenticated','public.verify_payment_transfer_private(uuid,boolean,text,text,uuid,text,bigint)','EXECUTE') AS authenticated_private_verify,
       has_function_privilege('project_admin','public.verify_payment_transfer_private(uuid,boolean,text,text,uuid,text,bigint)','EXECUTE') AS project_admin_private_verify;
SELECT COUNT(*) AS active_financial_holds FROM public.payment_workflow_holds WHERE status='ACTIVE';
SELECT COUNT(*) AS pending_supplier_payments FROM public.supplier_payments WHERE status IN ('REQUESTED','APPROVED');
SELECT COUNT(*) AS pending_notification_jobs FROM public.notification_jobs WHERE status IN ('PENDING','FAILED','PROCESSING');
SELECT COUNT(*) AS delivered_with_issue FROM public.deliveries WHERE status='DELIVERED_WITH_ISSUE';
SELECT COUNT(*) AS completed_with_issue FROM public.customer_orders co WHERE co.status='COMPLETED' AND EXISTS (
  SELECT 1 FROM public.deliveries d JOIN public.shipments s ON s.id=d.shipment_id
  WHERE s.customer_order_id=co.id AND d.status='DELIVERED_WITH_ISSUE'
);
