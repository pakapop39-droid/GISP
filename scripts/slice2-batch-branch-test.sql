DO $$
DECLARE
  product_id_value UUID;
  result_value JSONB;
  preview_value JSONB;
  invalid_rate_rejected BOOLEAN := FALSE;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', (
        SELECT u.id::TEXT
        FROM public.users u
        JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles r ON r.id=ur.role_id
        WHERE r.code='SUPER_ADMIN'
        ORDER BY u.created_at
        LIMIT 1
      ),
      'role', 'authenticated'
    )::TEXT,
    TRUE
  );

  -- This nested block is a subtransaction. The expected sentinel at the end
  -- rolls back every test write, then the outer block exits successfully.
  BEGIN
  SELECT p.id INTO product_id_value
  FROM public.products p
  JOIN public.suppliers s ON s.id = p.supplier_id
  WHERE s.code = 'CN01'
    AND p.status = 'DRAFT'
    AND p.default_lead_time_days IS NULL
    AND NULLIF(BTRIM(COALESCE(p.material_summary,'')), '') IS NULL
    AND p.width_mm IS NOT NULL AND p.depth_mm IS NOT NULL AND p.height_mm IS NOT NULL
    AND p.factory_cost > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.product_variants v
      WHERE v.product_id = p.id AND v.status = 'ACTIVE'
    )
  ORDER BY p.sku
  LIMIT 1;
  IF product_id_value IS NULL THEN
    RAISE EXCEPTION 'TEST_SETUP: ELIGIBLE_CN01_PRODUCT_REQUIRED';
  END IF;

  result_value := public.run_catalog_batch(
    'FILL_LEAD_TIME', ARRAY[product_id_value], '{"leadTimeDays":45}'::JSONB
  );
  IF (result_value->>'succeeded')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: FILL_LEAD_TIME';
  END IF;
  result_value := public.run_catalog_batch(
    'FILL_LEAD_TIME', ARRAY[product_id_value], '{"leadTimeDays":60}'::JSONB
  );
  IF (result_value->>'skipped')::INTEGER <> 1
    OR (SELECT default_lead_time_days FROM public.products WHERE id=product_id_value) <> 45 THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: LEAD_TIME_MUST_NOT_OVERWRITE';
  END IF;

  result_value := public.run_catalog_batch(
    'FILL_MATERIAL', ARRAY[product_id_value], '{"materialSummary":"Branch test material"}'::JSONB
  );
  IF (result_value->>'succeeded')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: FILL_MATERIAL';
  END IF;

  result_value := public.run_catalog_batch(
    'CREATE_DEFAULT_VARIANTS', ARRAY[product_id_value], '{}'::JSONB
  );
  IF (result_value->>'succeeded')::INTEGER <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE product_id=product_id_value AND status='ACTIVE'
  ) THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: DEFAULT_VARIANT';
  END IF;

  BEGIN
    PERFORM public.run_catalog_batch(
      'PREPARE_COSTS', ARRAY[product_id_value], '{"exchangeRateToThb":0}'::JSONB
    );
  EXCEPTION WHEN OTHERS THEN
    invalid_rate_rejected := SQLERRM LIKE 'INVALID_INPUT:%';
  END;
  IF NOT invalid_rate_rejected THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: ZERO_EXCHANGE_RATE_MUST_FAIL';
  END IF;

  result_value := public.run_catalog_batch(
    'PREPARE_COSTS', ARRAY[product_id_value],
    jsonb_build_object('exchangeRateToThb', 5.00000000, 'effectiveFrom', NOW())
  );
  IF (result_value->>'succeeded')::INTEGER <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.product_cost_versions
    WHERE product_id=product_id_value AND variant_id IS NULL AND status='ACTIVE'
  ) THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: PREPARE_COSTS';
  END IF;

  result_value := public.run_catalog_batch(
    'ACTIVATE_MEMBER_PRICES', ARRAY[product_id_value], '{}'::JSONB
  );
  IF (result_value->>'succeeded')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: ACTIVATE_MEMBER_PRICE';
  END IF;
  preview_value := public.pricing_calculate_product_price(product_id_value, NULL, NULL, NOW());
  IF NOT EXISTS (
    SELECT 1 FROM public.product_prices pp
    WHERE pp.product_id=product_id_value AND pp.variant_id IS NULL AND pp.status='ACTIVE'
      AND pp.amount=(preview_value->>'memberPrice')::NUMERIC
      AND pp.suggested_resale_amount=(preview_value->>'suggestedResalePrice')::NUMERIC
      AND pp.freight_estimate_min=(preview_value->>'freightEstimateMin')::NUMERIC
      AND pp.freight_estimate_max=(preview_value->>'freightEstimateMax')::NUMERIC
  ) THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: PRICING_ENGINE_OUTPUT';
  END IF;

  result_value := public.run_catalog_batch(
    'ACTIVATE_MEMBER_PRICES', ARRAY[product_id_value], '{}'::JSONB
  );
  IF (result_value->>'skipped')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: PRICE_RERUN_MUST_BE_IDEMPOTENT';
  END IF;

  IF has_function_privilege('anon', 'public.run_catalog_batch(text,uuid[],jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: ANON_BATCH_EXECUTE';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.run_catalog_batch(text,uuid[],jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: AUTHENTICATED_BATCH_EXECUTE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='member_catalog'
      AND column_name IN (
        'supplier_id','factory_sku','factory_cost','factory_currency',
        'exchange_rate_to_thb','formula_version_id','calculation_snapshot',
        'gross_margin','margin_percent','internal_note'
      )
  ) THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: MEMBER_CATALOG_CONFIDENTIAL_COLUMN';
  END IF;

  -- An uncaught sentinel intentionally rolls back every test write in this statement.
  RAISE EXCEPTION 'EXPECTED_ROLLBACK: ALL_BATCH_ASSERTIONS_PASSED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'EXPECTED_ROLLBACK: ALL_BATCH_ASSERTIONS_PASSED' THEN
      RAISE;
    END IF;
  END;
END;
$$;
