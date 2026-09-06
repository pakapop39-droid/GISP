-- GISP Slice 2 — trusted pricing engine and price lifecycle API foundation.
-- Runs only on the isolated slice-2-catalog backend branch until merge approval.

-- ---------------------------------------------------------------------------
-- 1. Complete the formula model and narrow direct write access
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions(code, name, description) VALUES
  ('catalog.cost.manage', 'จัดการต้นทุนสินค้า', 'สร้าง Factory Cost Version และ Exchange-rate Snapshot')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'catalog.cost.manage'
WHERE r.code IN ('SUPER_ADMIN', 'PRODUCT_ADMIN', 'PURCHASING')
ON CONFLICT DO NOTHING;

ALTER TABLE public.price_formula_components
  ADD COLUMN IF NOT EXISTS calculation_basis TEXT NOT NULL DEFAULT 'FACTORY_COST_THB';

ALTER TABLE public.price_formula_components
  DROP CONSTRAINT IF EXISTS price_formula_components_calculation_basis_check;
ALTER TABLE public.price_formula_components
  ADD CONSTRAINT price_formula_components_calculation_basis_check
  CHECK (calculation_basis IN ('FACTORY_COST_THB', 'MEMBER_PRICE'));

REVOKE INSERT, UPDATE, DELETE ON public.product_cost_versions,
  public.price_formula_versions, public.price_formula_components,
  public.product_prices
FROM authenticated;

GRANT SELECT ON public.product_cost_versions, public.price_formula_versions,
  public.price_formula_components, public.product_prices
TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Internal resolver: Global -> Supplier -> Product
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pricing_resolved_formula_versions(
  product_id_input UUID,
  formula_version_id_input UUID DEFAULT NULL,
  calculated_at_input TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  scope_type TEXT,
  scope_priority INTEGER,
  suggested_resale_markup_percent NUMERIC,
  freight_estimate_min_percent NUMERIC,
  freight_estimate_max_percent NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH target AS (
    SELECT p.id AS product_id, p.supplier_id
    FROM public.products p
    WHERE p.id = product_id_input
  ),
  override_formula AS (
    SELECT f.*
    FROM public.price_formula_versions f
    JOIN target t ON
      f.scope_type = 'GLOBAL'
      OR (f.scope_type = 'SUPPLIER' AND f.supplier_id = t.supplier_id)
      OR (f.scope_type = 'PRODUCT' AND f.product_id = t.product_id)
    WHERE f.id = formula_version_id_input
      AND f.status IN ('DRAFT', 'ACTIVE')
  ),
  eligible AS (
    SELECT
      f.*,
      CASE f.scope_type
        WHEN 'GLOBAL' THEN 1
        WHEN 'SUPPLIER' THEN 2
        WHEN 'PRODUCT' THEN 3
      END AS priority,
      (f.id = formula_version_id_input) AS is_override
    FROM public.price_formula_versions f
    JOIN target t ON
      f.scope_type = 'GLOBAL'
      OR (f.scope_type = 'SUPPLIER' AND f.supplier_id = t.supplier_id)
      OR (f.scope_type = 'PRODUCT' AND f.product_id = t.product_id)
    WHERE
      (
        f.id = formula_version_id_input
        OR (
          f.status = 'ACTIVE'
          AND f.effective_from <= calculated_at_input
          AND (f.effective_until IS NULL OR f.effective_until > calculated_at_input)
        )
      )
      AND NOT (
        formula_version_id_input IS NOT NULL
        AND f.scope_type = (SELECT o.scope_type FROM override_formula o)
        AND f.id <> formula_version_id_input
      )
  ),
  ranked AS (
    SELECT e.*,
      ROW_NUMBER() OVER (
        PARTITION BY e.scope_type
        ORDER BY e.is_override DESC, e.effective_from DESC, e.version_number DESC
      ) AS row_number
    FROM eligible e
  )
  SELECT
    r.id,
    r.scope_type,
    r.priority,
    r.suggested_resale_markup_percent,
    r.freight_estimate_min_percent,
    r.freight_estimate_max_percent
  FROM ranked r
  WHERE r.row_number = 1
$$;

CREATE OR REPLACE FUNCTION public.pricing_calculate_product_price(
  product_id_input UUID,
  variant_id_input UUID DEFAULT NULL,
  formula_version_id_input UUID DEFAULT NULL,
  calculated_at_input TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  product_record RECORD;
  cost_record RECORD;
  effective_formula RECORD;
  component_record RECORD;
  formula_ids JSONB;
  component_breakdown JSONB := '[]'::JSONB;
  factory_cost_thb_value NUMERIC(18,2);
  member_price_value NUMERIC(18,2);
  basis_value NUMERIC(18,2);
  component_amount_value NUMERIC(18,2);
  suggested_resale_value NUMERIC(18,2);
  freight_min_value NUMERIC(18,2);
  freight_max_value NUMERIC(18,2);
  gross_margin_value NUMERIC(18,2);
  margin_percent_value NUMERIC(18,2);
BEGIN
  SELECT p.id, p.supplier_id, p.sku
  INTO product_record
  FROM public.products p
  WHERE p.id = product_id_input;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: PRODUCT_NOT_FOUND';
  END IF;

  IF variant_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants v
    WHERE v.id = variant_id_input AND v.product_id = product_id_input
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: VARIANT_NOT_FOUND';
  END IF;

  IF formula_version_id_input IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.pricing_resolved_formula_versions(
      product_id_input, formula_version_id_input, calculated_at_input
    ) f
    WHERE f.id = formula_version_id_input
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: FORMULA_SCOPE_MISMATCH';
  END IF;

  SELECT c.*
  INTO cost_record
  FROM public.product_cost_versions c
  WHERE c.product_id = product_id_input
    AND c.status = 'ACTIVE'
    AND c.effective_from <= calculated_at_input
    AND (c.effective_until IS NULL OR c.effective_until > calculated_at_input)
    AND (
      c.variant_id = variant_id_input
      OR (variant_id_input IS NOT NULL AND c.variant_id IS NULL)
      OR (variant_id_input IS NULL AND c.variant_id IS NULL)
    )
  ORDER BY
    CASE WHEN c.variant_id = variant_id_input THEN 0 ELSE 1 END,
    c.effective_from DESC,
    c.created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: ACTIVE_FACTORY_COST_REQUIRED';
  END IF;

  SELECT f.*
  INTO effective_formula
  FROM public.pricing_resolved_formula_versions(
    product_id_input, formula_version_id_input, calculated_at_input
  ) f
  ORDER BY f.scope_priority DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: ACTIVE_PRICING_FORMULA_REQUIRED';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', f.id, 'scopeType', f.scope_type)
      ORDER BY f.scope_priority
    ),
    '[]'::JSONB
  )
  INTO formula_ids
  FROM public.pricing_resolved_formula_versions(
    product_id_input, formula_version_id_input, calculated_at_input
  ) f;

  factory_cost_thb_value := ROUND(cost_record.factory_cost_thb, 2);
  member_price_value := factory_cost_thb_value;

  FOR component_record IN
    WITH selected_formula AS (
      SELECT *
      FROM public.pricing_resolved_formula_versions(
        product_id_input, formula_version_id_input, calculated_at_input
      )
    ),
    ranked_component AS (
      SELECT
        c.*,
        f.scope_type AS source_scope,
        f.scope_priority,
        ROW_NUMBER() OVER (
          PARTITION BY UPPER(c.component_code)
          ORDER BY f.scope_priority DESC
        ) AS row_number
      FROM selected_formula f
      JOIN public.price_formula_components c ON c.formula_version_id = f.id
    )
    SELECT *
    FROM ranked_component
    WHERE row_number = 1
    ORDER BY sort_order, component_code
  LOOP
    IF NOT component_record.is_enabled THEN
      CONTINUE;
    END IF;

    basis_value := CASE component_record.calculation_basis
      WHEN 'FACTORY_COST_THB' THEN factory_cost_thb_value
      WHEN 'MEMBER_PRICE' THEN member_price_value
    END;
    component_amount_value := ROUND(
      CASE component_record.calculation_type
        WHEN 'PERCENTAGE'
          THEN basis_value * component_record.component_value / 100
        WHEN 'FIXED_AMOUNT_THB'
          THEN component_record.component_value
      END,
      2
    );

    IF component_record.included_in_member_price THEN
      member_price_value := ROUND(member_price_value + component_amount_value, 2);
    END IF;

    component_breakdown := component_breakdown || jsonb_build_array(
      jsonb_build_object(
        'code', UPPER(component_record.component_code),
        'name', component_record.component_name,
        'calculationType', component_record.calculation_type,
        'calculationBasis', component_record.calculation_basis,
        'value', component_record.component_value,
        'basisAmount', basis_value,
        'calculatedAmount', component_amount_value,
        'includedInMemberPrice', component_record.included_in_member_price,
        'sourceFormulaId', component_record.formula_version_id,
        'sourceScope', component_record.source_scope
      )
    );
  END LOOP;

  suggested_resale_value := ROUND(
    member_price_value *
      (1 + effective_formula.suggested_resale_markup_percent / 100),
    2
  );
  freight_min_value := ROUND(
    factory_cost_thb_value * effective_formula.freight_estimate_min_percent / 100,
    2
  );
  freight_max_value := ROUND(
    factory_cost_thb_value * effective_formula.freight_estimate_max_percent / 100,
    2
  );
  gross_margin_value := ROUND(member_price_value - factory_cost_thb_value, 2);
  margin_percent_value := CASE
    WHEN member_price_value = 0 THEN 0
    ELSE ROUND(gross_margin_value * 100 / member_price_value, 2)
  END;

  RETURN jsonb_build_object(
    'productId', product_id_input,
    'variantId', variant_id_input,
    'productSku', product_record.sku,
    'calculatedAt', calculated_at_input,
    'costVersionId', cost_record.id,
    'factoryCost', cost_record.factory_cost,
    'factoryCurrency', cost_record.currency,
    'exchangeRateToThb', cost_record.exchange_rate_to_thb,
    'factoryCostThb', factory_cost_thb_value,
    'formulaVersionId', effective_formula.id,
    'formulaVersions', formula_ids,
    'components', component_breakdown,
    'memberPrice', member_price_value,
    'suggestedResalePrice', suggested_resale_value,
    'freightEstimateMin', freight_min_value,
    'freightEstimateMax', freight_max_value,
    'grossMargin', gross_margin_value,
    'marginPercent', margin_percent_value,
    'suggestedResaleMarkupPercent', effective_formula.suggested_resale_markup_percent,
    'freightEstimateMinPercent', effective_formula.freight_estimate_min_percent,
    'freightEstimateMaxPercent', effective_formula.freight_estimate_max_percent
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trusted draft, formula transition, cost and member-price actions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_price_formula_draft(
  formula_version_id_input UUID,
  scope_type_input TEXT,
  supplier_id_input UUID,
  product_id_input UUID,
  name_input TEXT,
  effective_from_input TIMESTAMPTZ,
  effective_until_input TIMESTAMPTZ,
  suggested_resale_markup_percent_input NUMERIC,
  freight_estimate_min_percent_input NUMERIC,
  freight_estimate_max_percent_input NUMERIC,
  components_input JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_id UUID;
  next_version INTEGER;
  before_data JSONB;
BEGIN
  IF NOT public.has_permission('catalog.formula.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF scope_type_input NOT IN ('GLOBAL', 'SUPPLIER', 'PRODUCT')
    OR NULLIF(BTRIM(name_input), '') IS NULL
    OR suggested_resale_markup_percent_input < 0
    OR freight_estimate_min_percent_input < 0
    OR freight_estimate_max_percent_input < freight_estimate_min_percent_input
    OR (effective_until_input IS NOT NULL AND effective_until_input <= effective_from_input)
    OR NOT (
      (scope_type_input = 'GLOBAL' AND supplier_id_input IS NULL AND product_id_input IS NULL)
      OR (scope_type_input = 'SUPPLIER' AND supplier_id_input IS NOT NULL AND product_id_input IS NULL)
      OR (scope_type_input = 'PRODUCT' AND supplier_id_input IS NULL AND product_id_input IS NOT NULL)
    )
    OR jsonb_typeof(components_input) <> 'array'
  THEN
    RAISE EXCEPTION 'INVALID_INPUT: PRICING_FORMULA';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(components_input) AS c(component_code TEXT)
    GROUP BY UPPER(BTRIM(c.component_code))
    HAVING COUNT(*) > 1 OR NULLIF(UPPER(BTRIM(c.component_code)), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT: DUPLICATE_COMPONENT';
  END IF;

  IF formula_version_id_input IS NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        scope_type_input || ':' || COALESCE(supplier_id_input::TEXT, '') || ':' ||
          COALESCE(product_id_input::TEXT, ''),
        0
      )
    );
    SELECT COALESCE(MAX(f.version_number), 0) + 1
    INTO next_version
    FROM public.price_formula_versions f
    WHERE f.scope_type = scope_type_input
      AND f.supplier_id IS NOT DISTINCT FROM supplier_id_input
      AND f.product_id IS NOT DISTINCT FROM product_id_input;

    INSERT INTO public.price_formula_versions(
      scope_type, supplier_id, product_id, version_number, name, status,
      effective_from, effective_until, suggested_resale_markup_percent,
      freight_estimate_min_percent, freight_estimate_max_percent, created_by
    ) VALUES (
      scope_type_input, supplier_id_input, product_id_input, next_version,
      BTRIM(name_input), 'DRAFT', effective_from_input, effective_until_input,
      suggested_resale_markup_percent_input, freight_estimate_min_percent_input,
      freight_estimate_max_percent_input, (SELECT auth.uid())
    )
    RETURNING id INTO target_id;
  ELSE
    SELECT to_jsonb(f.*), f.id
    INTO before_data, target_id
    FROM public.price_formula_versions f
    WHERE f.id = formula_version_id_input AND f.status = 'DRAFT'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: DRAFT_FORMULA_REQUIRED';
    END IF;

    UPDATE public.price_formula_versions
    SET scope_type = scope_type_input,
        supplier_id = supplier_id_input,
        product_id = product_id_input,
        name = BTRIM(name_input),
        effective_from = effective_from_input,
        effective_until = effective_until_input,
        suggested_resale_markup_percent = suggested_resale_markup_percent_input,
        freight_estimate_min_percent = freight_estimate_min_percent_input,
        freight_estimate_max_percent = freight_estimate_max_percent_input
    WHERE id = target_id;
  END IF;

  DELETE FROM public.price_formula_components
  WHERE formula_version_id = target_id;

  INSERT INTO public.price_formula_components(
    formula_version_id, component_code, component_name, calculation_type,
    calculation_basis, component_value, included_in_member_price,
    is_enabled, sort_order
  )
  SELECT
    target_id,
    UPPER(BTRIM(c.component_code)),
    BTRIM(c.component_name),
    c.calculation_type,
    c.calculation_basis,
    c.component_value,
    COALESCE(c.included_in_member_price, TRUE),
    COALESCE(c.is_enabled, TRUE),
    COALESCE(c.sort_order, 0)
  FROM jsonb_to_recordset(components_input) AS c(
    component_code TEXT,
    component_name TEXT,
    calculation_type TEXT,
    calculation_basis TEXT,
    component_value NUMERIC,
    included_in_member_price BOOLEAN,
    is_enabled BOOLEAN,
    sort_order INTEGER
  );

  IF scope_type_input = 'GLOBAL' AND NOT EXISTS (
    SELECT 1 FROM public.price_formula_components c
    WHERE c.formula_version_id = target_id AND c.is_enabled
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT: GLOBAL_COMPONENT_REQUIRED';
  END IF;

  PERFORM public.write_audit_event(
    NULL,
    'price_formula_version',
    target_id,
    CASE WHEN formula_version_id_input IS NULL THEN 'DRAFT_CREATED' ELSE 'DRAFT_UPDATED' END,
    before_data,
    jsonb_build_object(
      'scopeType', scope_type_input,
      'supplierId', supplier_id_input,
      'productId', product_id_input,
      'name', BTRIM(name_input),
      'components', components_input
    )
  );
  RETURN target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_price_formula(formula_version_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  formula_record public.price_formula_versions%ROWTYPE;
BEGIN
  IF NOT public.has_permission('catalog.formula.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  SELECT * INTO formula_record
  FROM public.price_formula_versions
  WHERE id = formula_version_id_input
  FOR UPDATE;
  IF NOT FOUND OR formula_record.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: DRAFT_FORMULA_REQUIRED';
  END IF;
  IF formula_record.effective_from > NOW() THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: FUTURE_FORMULA_CANNOT_ACTIVATE';
  END IF;
  IF formula_record.scope_type = 'GLOBAL' AND NOT EXISTS (
    SELECT 1 FROM public.price_formula_components c
    WHERE c.formula_version_id = formula_record.id AND c.is_enabled
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: GLOBAL_COMPONENT_REQUIRED';
  END IF;

  UPDATE public.price_formula_versions f
  SET status = 'RETIRED',
      effective_until = CASE
        WHEN f.effective_from < NOW() THEN NOW()
        ELSE f.effective_from + INTERVAL '1 second'
      END
  WHERE f.scope_type = formula_record.scope_type
    AND f.supplier_id IS NOT DISTINCT FROM formula_record.supplier_id
    AND f.product_id IS NOT DISTINCT FROM formula_record.product_id
    AND f.status = 'ACTIVE'
    AND f.id <> formula_record.id;

  UPDATE public.price_formula_versions
  SET status = 'ACTIVE', activated_by = (SELECT auth.uid()), activated_at = NOW()
  WHERE id = formula_record.id;

  PERFORM public.write_audit_event(
    NULL, 'price_formula_version', formula_record.id, 'ACTIVATED',
    jsonb_build_object('status', formula_record.status),
    jsonb_build_object('status', 'ACTIVE')
  );
  RETURN formula_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_price_formula(formula_version_id_input UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  formula_record public.price_formula_versions%ROWTYPE;
BEGIN
  IF NOT public.has_permission('catalog.formula.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  SELECT * INTO formula_record
  FROM public.price_formula_versions
  WHERE id = formula_version_id_input
  FOR UPDATE;
  IF NOT FOUND OR formula_record.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: ACTIVE_FORMULA_REQUIRED';
  END IF;

  UPDATE public.price_formula_versions
  SET status = 'RETIRED',
      effective_until = CASE
        WHEN effective_from < NOW() THEN NOW()
        ELSE effective_from + INTERVAL '1 second'
      END
  WHERE id = formula_record.id;

  PERFORM public.write_audit_event(
    NULL, 'price_formula_version', formula_record.id, 'RETIRED',
    jsonb_build_object('status', formula_record.status),
    jsonb_build_object('status', 'RETIRED')
  );
  RETURN formula_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_product_cost_version(
  product_id_input UUID,
  variant_id_input UUID,
  factory_cost_input NUMERIC,
  currency_input TEXT,
  exchange_rate_to_thb_input NUMERIC,
  effective_from_input TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_id UUID;
  calculated_thb NUMERIC(18,2);
BEGIN
  IF NOT public.has_permission('catalog.cost.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF factory_cost_input < 0 OR exchange_rate_to_thb_input <= 0
    OR currency_input !~ '^[A-Z]{3}$'
    OR NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id_input)
    OR (variant_id_input IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.product_variants v
      WHERE v.id = variant_id_input AND v.product_id = product_id_input
    ))
  THEN
    RAISE EXCEPTION 'INVALID_INPUT: PRODUCT_COST';
  END IF;

  calculated_thb := ROUND(factory_cost_input * exchange_rate_to_thb_input, 2);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    product_id_input::TEXT || ':' || COALESCE(variant_id_input::TEXT, 'BASE'), 0
  ));

  UPDATE public.product_cost_versions c
  SET status = 'RETIRED',
      effective_until = CASE
        WHEN c.effective_from < effective_from_input THEN effective_from_input
        ELSE c.effective_from + INTERVAL '1 second'
      END
  WHERE c.product_id = product_id_input
    AND c.variant_id IS NOT DISTINCT FROM variant_id_input
    AND c.status = 'ACTIVE';

  INSERT INTO public.product_cost_versions(
    product_id, variant_id, factory_cost, currency, exchange_rate_to_thb,
    factory_cost_thb, effective_from, status, created_by
  ) VALUES (
    product_id_input, variant_id_input, factory_cost_input, currency_input,
    exchange_rate_to_thb_input, calculated_thb, effective_from_input,
    'ACTIVE', (SELECT auth.uid())
  )
  RETURNING id INTO target_id;

  PERFORM public.write_audit_event(
    NULL, 'product_cost_version', target_id, 'ACTIVATED', NULL,
    jsonb_build_object(
      'productId', product_id_input,
      'variantId', variant_id_input,
      'factoryCost', factory_cost_input,
      'currency', currency_input,
      'exchangeRateToThb', exchange_rate_to_thb_input,
      'factoryCostThb', calculated_thb
    )
  );
  RETURN target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_product_price(
  product_id_input UUID,
  variant_id_input UUID DEFAULT NULL,
  formula_version_id_input UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.has_permission('catalog.formula.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  RETURN public.pricing_calculate_product_price(
    product_id_input, variant_id_input, formula_version_id_input, NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_calculated_product_price(
  product_id_input UUID,
  variant_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  preview JSONB;
  target_id UUID;
  activation_time TIMESTAMPTZ := NOW();
BEGIN
  IF NOT public.has_permission('catalog.formula.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    product_id_input::TEXT || ':' || COALESCE(variant_id_input::TEXT, 'BASE'), 0
  ));
  preview := public.pricing_calculate_product_price(
    product_id_input, variant_id_input, NULL, activation_time
  );

  UPDATE public.product_prices p
  SET status = 'INACTIVE',
      valid_until = CASE
        WHEN p.valid_from < activation_time THEN activation_time
        ELSE p.valid_from + INTERVAL '1 second'
      END
  WHERE p.product_id = product_id_input
    AND p.variant_id IS NOT DISTINCT FROM variant_id_input
    AND p.status = 'ACTIVE';

  INSERT INTO public.product_prices(
    product_id, variant_id, amount, currency, valid_from, status, created_by,
    suggested_resale_amount, freight_estimate_min, freight_estimate_max,
    formula_version_id, source_cost_version_id, calculated_at,
    calculation_snapshot
  ) VALUES (
    product_id_input,
    variant_id_input,
    (preview->>'memberPrice')::NUMERIC,
    'THB',
    activation_time,
    'ACTIVE',
    (SELECT auth.uid()),
    (preview->>'suggestedResalePrice')::NUMERIC,
    (preview->>'freightEstimateMin')::NUMERIC,
    (preview->>'freightEstimateMax')::NUMERIC,
    (preview->>'formulaVersionId')::UUID,
    (preview->>'costVersionId')::UUID,
    activation_time,
    preview
  )
  RETURNING id INTO target_id;

  PERFORM public.write_audit_event(
    NULL, 'product_price', target_id, 'CALCULATED_PRICE_ACTIVATED', NULL, preview
  );
  RETURN target_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Execute grants: clients must use trusted functions for mutations
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.pricing_resolved_formula_versions(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pricing_calculate_product_price(UUID, UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_price_formula_draft(UUID, TEXT, UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_price_formula(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retire_price_formula(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_product_cost_version(UUID, UUID, NUMERIC, TEXT, NUMERIC, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preview_product_price(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_calculated_product_price(UUID, UUID)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_price_formula_draft(UUID, TEXT, UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_price_formula(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.retire_price_formula(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_product_cost_version(UUID, UUID, NUMERIC, TEXT, NUMERIC, TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_product_price(UUID, UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_calculated_product_price(UUID, UUID)
  TO authenticated;
