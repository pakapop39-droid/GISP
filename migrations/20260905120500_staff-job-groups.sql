-- Simplify day-to-day staff assignment to three job groups while preserving
-- the existing technical roles for backward compatibility and audit history.

INSERT INTO public.permissions(code, name, description)
VALUES (
  'supplier_payments.request',
  'สร้างคำขอจ่ายเงินโรงงาน',
  'สร้าง Supplier Payment Request และดูสถานะ โดยไม่สามารถอนุมัติหรือบันทึกว่าจ่ายแล้ว'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'supplier_payments.request'
WHERE r.code IN ('SUPER_ADMIN', 'PURCHASING')
ON CONFLICT DO NOTHING;

-- Purchasing requests payments; Finance approves and records the actual payment.
DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.code = 'PURCHASING'
  AND p.code = 'supplier_payments.manage';

-- Member Admin manages member accounts, not internal staff roles.
DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.code = 'MEMBER_ADMIN'
  AND p.code = 'members.roles.manage';

CREATE OR REPLACE FUNCTION public.create_supplier_payment(
  supplier_order_id_input UUID,
  payment_type_input TEXT,
  amount_input NUMERIC,
  note_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  supplier_order_record public.supplier_orders%ROWTYPE;
  schedule_record public.supplier_payment_schedules%ROWTYPE;
  reserved_amount NUMERIC(18,2);
  payment_id_value UUID;
  requested_type TEXT;
BEGIN
  IF NOT public.has_permission('supplier_payments.request') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF payment_type_input NOT IN ('DEPOSIT', 'BALANCE', 'PARTIAL')
    OR amount_input IS NULL OR amount_input <= 0 THEN
    RAISE EXCEPTION 'INVALID_SUPPLIER_PAYMENT';
  END IF;
  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = supplier_order_id_input FOR UPDATE;
  IF NOT FOUND OR supplier_order_record.status IN ('DRAFT', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUPPLIER_ORDER_NOT_PAYABLE';
  END IF;
  requested_type := CASE WHEN payment_type_input = 'PARTIAL' THEN
    CASE WHEN EXISTS (
      SELECT 1 FROM public.supplier_payment_schedules
      WHERE supplier_order_id = supplier_order_id_input AND schedule_type = 'DEPOSIT'
        AND status NOT IN ('PAID', 'CANCELLED')
    ) THEN 'DEPOSIT' ELSE 'BALANCE' END
    ELSE payment_type_input END;
  SELECT * INTO schedule_record FROM public.supplier_payment_schedules
  WHERE supplier_order_id = supplier_order_id_input AND schedule_type = requested_type
  FOR UPDATE;
  IF NOT FOUND OR schedule_record.status IN ('PAID', 'OVERPAYMENT_REVIEW', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_SCHEDULE_NOT_AVAILABLE';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO reserved_amount
  FROM public.supplier_payments
  WHERE payment_schedule_id = schedule_record.id AND status IN ('REQUESTED', 'APPROVED', 'PAID');
  IF ROUND(reserved_amount + amount_input, 2) > schedule_record.due_amount THEN
    RAISE EXCEPTION 'SUPPLIER_PAYMENT_EXCEEDS_OUTSTANDING';
  END IF;
  INSERT INTO public.supplier_payments(
    supplier_order_id, payment_schedule_id, payment_reference, payment_type,
    amount, currency, requested_by, note
  ) VALUES (
    supplier_order_id_input, schedule_record.id, public.next_document_number('PAY'),
    requested_type, ROUND(amount_input, 2), supplier_order_record.supplier_currency,
    (SELECT auth.uid()), NULLIF(BTRIM(note_input), '')
  ) RETURNING id INTO payment_id_value;
  INSERT INTO public.supplier_payment_history(
    organization_id, supplier_payment_id, action, amount_snapshot, note, actor_user_id
  ) VALUES (
    supplier_order_record.organization_id, payment_id_value, 'REQUESTED',
    ROUND(amount_input, 2), NULLIF(BTRIM(note_input), ''), (SELECT auth.uid())
  );
  RETURN payment_id_value;
END;
$$;

DROP POLICY IF EXISTS supplier_payments_slice6_internal ON public.supplier_payments;
CREATE POLICY supplier_payments_staff_read ON public.supplier_payments
FOR SELECT TO authenticated USING (
  public.has_permission('supplier_payments.request')
  OR public.has_permission('supplier_payments.manage')
);

DROP POLICY IF EXISTS purchase_orders_slice6_internal ON public.purchase_orders;
CREATE POLICY purchase_orders_staff_read ON public.purchase_orders
FOR SELECT TO authenticated USING (
  public.has_permission('orders.manage', organization_id)
  OR public.has_permission('supplier_payments.request', organization_id)
  OR public.has_permission('supplier_payments.manage', organization_id)
);

DROP POLICY IF EXISTS supplier_payment_schedules_slice6_internal ON public.supplier_payment_schedules;
CREATE POLICY supplier_payment_schedules_staff_read ON public.supplier_payment_schedules
FOR SELECT TO authenticated USING (
  public.has_permission('supplier_payments.request', organization_id)
  OR public.has_permission('supplier_payments.manage', organization_id)
);

DROP POLICY IF EXISTS supplier_payment_history_slice6_internal ON public.supplier_payment_history;
CREATE POLICY supplier_payment_history_staff_read ON public.supplier_payment_history
FOR SELECT TO authenticated USING (
  public.has_permission('supplier_payments.request', organization_id)
  OR public.has_permission('supplier_payments.manage', organization_id)
);
