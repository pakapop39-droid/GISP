-- Use the cost version bound to the Project Item's selected price when creating
-- a STANDARD Order. Keep the Release C public wrapper and private grants intact.
DO $$
BEGIN
  IF to_regprocedure('public.create_customer_order_rlc_impl(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'ORDER_PRIVATE_IMPLEMENTATION_REQUIRED';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_order_rlc_impl(
  project_id_input UUID,
  selections_input JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  selection_record RECORD;
  project_item_record public.project_items%ROWTYPE;
  quotation_cost_record public.custom_quotation_costs%ROWTYPE;
  supplier_id_value UUID;
  factory_unit_cost_value NUMERIC(18,2);
  factory_currency_value CHAR(3);
  selected_price_id_value UUID;
  selected_price_variant_id_value UUID;
  source_cost_version_id_value UUID;
  order_id_value UUID;
  order_item_id_value UUID;
  supplier_order_id_value UUID;
  order_number_value TEXT;
  vat_rate_value NUMERIC(5,2);
  subtotal_value NUMERIC(18,2) := 0;
  vat_amount_value NUMERIC(18,2) := 0;
  grand_total_value NUMERIC(18,2);
  deposit_value NUMERIC(18,2);
  balance_value NUMERIC(18,2);
  line_subtotal_value NUMERIC(18,2);
  line_vat_value NUMERIC(18,2);
BEGIN
  IF jsonb_typeof(selections_input) <> 'array'
    OR jsonb_array_length(selections_input) = 0 THEN
    RAISE EXCEPTION 'AT_LEAST_ONE_ITEM_REQUIRED';
  END IF;

  SELECT * INTO project_record
  FROM public.projects
  WHERE id = project_id_input
    AND member_profile_id = public.current_member_profile_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;

  FOR selection_record IN
    SELECT * FROM jsonb_to_recordset(selections_input)
      AS x(project_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT * INTO project_item_record
    FROM public.project_items
    WHERE id = selection_record.project_item_id
      AND project_id = project_id_input
      AND organization_id = project_record.organization_id
    FOR UPDATE;
    IF NOT FOUND OR project_item_record.status NOT IN ('READY_TO_ORDER', 'PARTIALLY_ORDERED') THEN
      RAISE EXCEPTION 'PROJECT_ITEM_NOT_READY';
    END IF;
    IF selection_record.quantity IS NULL OR selection_record.quantity <= 0
      OR selection_record.quantity > (project_item_record.quantity - project_item_record.ordered_quantity) THEN
      RAISE EXCEPTION 'INVALID_ORDER_QUANTITY';
    END IF;
    IF vat_rate_value IS NULL THEN
      vat_rate_value := project_item_record.vat_rate_snapshot;
    ELSIF vat_rate_value <> project_item_record.vat_rate_snapshot THEN
      RAISE EXCEPTION 'MIXED_VAT_SNAPSHOTS';
    END IF;
    line_subtotal_value := ROUND(selection_record.quantity * project_item_record.current_unit_price, 2);
    line_vat_value := ROUND(line_subtotal_value * project_item_record.vat_rate_snapshot / 100, 2);
    subtotal_value := subtotal_value + line_subtotal_value;
    vat_amount_value := vat_amount_value + line_vat_value;
  END LOOP;

  subtotal_value := ROUND(subtotal_value, 2);
  vat_amount_value := ROUND(vat_amount_value, 2);
  grand_total_value := ROUND(subtotal_value + vat_amount_value, 2);
  deposit_value := ROUND(grand_total_value * 0.50, 2);
  balance_value := ROUND(grand_total_value - deposit_value, 2);
  order_number_value := public.next_document_number('ORD');

  INSERT INTO public.customer_orders (
    organization_id, member_profile_id, project_id, order_number, subtotal,
    vat_rate_snapshot, vat_amount, grand_total, deposit_amount, balance_amount,
    shipping_address_snapshot, created_by
  ) VALUES (
    project_record.organization_id, project_record.member_profile_id, project_id_input,
    order_number_value, subtotal_value, vat_rate_value, vat_amount_value,
    grand_total_value, deposit_value, balance_value,
    jsonb_build_object('site_address', project_record.site_address), (SELECT auth.uid())
  ) RETURNING id INTO order_id_value;

  FOR selection_record IN
    SELECT * FROM jsonb_to_recordset(selections_input)
      AS x(project_item_id UUID, quantity NUMERIC)
  LOOP
    SELECT * INTO project_item_record
    FROM public.project_items WHERE id = selection_record.project_item_id FOR UPDATE;

    IF project_item_record.item_type = 'STANDARD' THEN
      -- A price may be a base-price fallback for a variant. The bound cost may
      -- likewise be a base-cost fallback for that selected price. Historical
      -- price/cost versions remain valid snapshots after later activation.
      SELECT p.supplier_id, p.factory_cost, p.factory_currency,
             pp.id, pp.variant_id, pp.source_cost_version_id
      INTO supplier_id_value, factory_unit_cost_value, factory_currency_value,
           selected_price_id_value, selected_price_variant_id_value,
           source_cost_version_id_value
      FROM public.products p
      LEFT JOIN public.product_prices pp
        ON pp.id = project_item_record.current_price_id
       AND pp.product_id = p.id
       AND (pp.variant_id IS NULL OR pp.variant_id = project_item_record.variant_id)
      WHERE p.id = project_item_record.product_id;

      IF selected_price_id_value IS NULL THEN
        RAISE EXCEPTION 'SUPPLIER_COST_REQUIRED';
      END IF;

      IF source_cost_version_id_value IS NOT NULL THEN
        SELECT c.factory_cost, c.currency
        INTO factory_unit_cost_value, factory_currency_value
        FROM public.product_cost_versions c
        WHERE c.id = source_cost_version_id_value
          AND c.product_id = project_item_record.product_id
          AND (c.variant_id IS NULL OR c.variant_id = selected_price_variant_id_value);
        IF NOT FOUND THEN
          RAISE EXCEPTION 'SUPPLIER_COST_REQUIRED';
        END IF;
      END IF;

      -- supplier_orders currently snapshots CNY; never mislabel another cost
      -- currency as CNY or round a tiny positive value down to zero.
      IF supplier_id_value IS NULL OR factory_unit_cost_value IS NULL
        OR factory_unit_cost_value <= 0 OR factory_currency_value IS DISTINCT FROM 'CNY'
        OR ROUND(factory_unit_cost_value, 2) <= 0 THEN
        RAISE EXCEPTION 'SUPPLIER_COST_REQUIRED';
      END IF;
      factory_unit_cost_value := ROUND(factory_unit_cost_value, 2);
    ELSE
      SELECT cqc.* INTO quotation_cost_record
      FROM public.custom_quotation_items cqi
      JOIN public.custom_quotation_costs cqc ON cqc.quotation_id = cqi.quotation_id
      WHERE cqi.id = project_item_record.quotation_item_id;
      supplier_id_value := quotation_cost_record.supplier_id;
      SELECT ROUND(quotation_cost_record.supplier_cost_total / cqi.quantity, 2)
      INTO factory_unit_cost_value
      FROM public.custom_quotation_items cqi
      WHERE cqi.id = project_item_record.quotation_item_id;
      IF supplier_id_value IS NULL OR factory_unit_cost_value IS NULL
        OR factory_unit_cost_value <= 0 THEN
        RAISE EXCEPTION 'SUPPLIER_COST_REQUIRED';
      END IF;
    END IF;

    line_subtotal_value := ROUND(selection_record.quantity * project_item_record.current_unit_price, 2);
    line_vat_value := ROUND(line_subtotal_value * project_item_record.vat_rate_snapshot / 100, 2);
    INSERT INTO public.order_items (
      order_id, organization_id, project_item_id, item_type, item_name_snapshot,
      specification_snapshot, options_snapshot, quantity, unit, unit_price_snapshot,
      line_subtotal, vat_rate_snapshot, vat_amount, line_total
    ) VALUES (
      order_id_value, project_record.organization_id, project_item_record.id,
      project_item_record.item_type, project_item_record.item_name,
      project_item_record.specification_snapshot, project_item_record.selected_options,
      selection_record.quantity, project_item_record.unit, project_item_record.current_unit_price,
      line_subtotal_value, project_item_record.vat_rate_snapshot, line_vat_value,
      ROUND(line_subtotal_value + line_vat_value, 2)
    ) RETURNING id INTO order_item_id_value;

    SELECT id INTO supplier_order_id_value
    FROM public.supplier_orders
    WHERE customer_order_id = order_id_value AND supplier_id = supplier_id_value;
    IF supplier_order_id_value IS NULL THEN
      INSERT INTO public.supplier_orders (
        customer_order_id, organization_id, supplier_id, supplier_order_number, po_number
      ) VALUES (
        order_id_value, project_record.organization_id, supplier_id_value,
        public.next_document_number('SO'), NULL
      ) RETURNING id INTO supplier_order_id_value;
    END IF;

    INSERT INTO public.supplier_order_items (
      supplier_order_id, order_item_id, quantity, factory_unit_cost_snapshot, factory_line_total
    ) VALUES (
      supplier_order_id_value, order_item_id_value, selection_record.quantity,
      factory_unit_cost_value, ROUND(factory_unit_cost_value * selection_record.quantity, 2)
    );
    UPDATE public.project_items
    SET ordered_quantity = ordered_quantity + selection_record.quantity,
        status = CASE WHEN ordered_quantity + selection_record.quantity = quantity
          THEN 'ORDERED' ELSE 'PARTIALLY_ORDERED' END
    WHERE id = project_item_record.id;
  END LOOP;

  UPDATE public.supplier_orders so
  SET total_factory_cost = totals.total_value
  FROM (
    SELECT soi.supplier_order_id, ROUND(SUM(soi.factory_line_total), 2) total_value
    FROM public.supplier_order_items soi
    JOIN public.supplier_orders grouped_so ON grouped_so.id = soi.supplier_order_id
    WHERE grouped_so.customer_order_id = order_id_value
    GROUP BY soi.supplier_order_id
  ) totals
  WHERE so.id = totals.supplier_order_id;

  INSERT INTO public.payment_schedules(order_id, organization_id, schedule_type, due_amount)
  VALUES
    (order_id_value, project_record.organization_id, 'DEPOSIT', deposit_value),
    (order_id_value, project_record.organization_id, 'BALANCE', balance_value);

  INSERT INTO public.supplier_payment_schedules(
    organization_id, supplier_order_id, schedule_type, due_amount
  )
  SELECT so.organization_id, so.id, schedule_type,
    CASE WHEN schedule_type = 'DEPOSIT' THEN ROUND(so.total_factory_cost * 0.50, 2)
      ELSE ROUND(so.total_factory_cost - ROUND(so.total_factory_cost * 0.50, 2), 2) END
  FROM public.supplier_orders so
  CROSS JOIN (VALUES ('DEPOSIT'), ('BALANCE')) schedule_types(schedule_type)
  WHERE so.customer_order_id = order_id_value;

  INSERT INTO public.status_events(
    organization_id, entity_type, entity_id, from_status, to_status,
    actor_user_id, reason, is_member_visible
  ) VALUES (
    project_record.organization_id, 'customer_order', order_id_value, NULL,
    'PENDING_DEPOSIT', (SELECT auth.uid()), 'ORDER_CREATED', TRUE
  );
  PERFORM public.write_audit_event(
    project_record.organization_id, 'customer_order', order_id_value, 'CREATED', NULL,
    jsonb_build_object('order_number', order_number_value, 'subtotal', subtotal_value,
      'vat_rate', vat_rate_value, 'vat_amount', vat_amount_value,
      'grand_total', grand_total_value, 'deposit', deposit_value, 'balance', balance_value)
  );
  RETURN order_id_value;
END;
$$;
