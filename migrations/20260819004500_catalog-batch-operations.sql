-- GISP Slice 2 — trusted batch enrichment, cost preparation and member-price activation.
-- All changes remain isolated on the slice-2-catalog backend branch until merge approval.

CREATE TABLE public.catalog_batch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN (
    'FILL_LEAD_TIME','FILL_MATERIAL','CREATE_DEFAULT_VARIANTS',
    'PREPARE_COSTS','ACTIVATE_MEMBER_PRICES'
  )),
  requested_count INTEGER NOT NULL CHECK (requested_count > 0),
  succeeded_count INTEGER NOT NULL DEFAULT 0 CHECK (succeeded_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  status TEXT NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING','COMPLETED','COMPLETED_WITH_ERRORS')),
  input_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX catalog_batch_runs_created_idx
  ON public.catalog_batch_runs(created_at DESC);

CREATE TABLE public.catalog_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.catalog_batch_runs(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('SUCCEEDED','SKIPPED','FAILED')),
  result_code TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, product_id)
);

CREATE INDEX catalog_batch_items_run_idx
  ON public.catalog_batch_items(run_id, status, product_id);

CREATE OR REPLACE FUNCTION public.run_catalog_batch(
  action_input TEXT,
  product_ids_input UUID[],
  payload_input JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  run_id_value UUID;
  requested_value INTEGER;
  succeeded_value INTEGER := 0;
  skipped_value INTEGER := 0;
  failed_value INTEGER := 0;
  lead_days_value INTEGER;
  material_value TEXT;
  exchange_rate_value NUMERIC(18,8);
  effective_from_value TIMESTAMPTZ;
  product_record RECORD;
  existing_variant_id UUID;
  active_cost_record RECORD;
  preview_value JSONB;
  outcome_status TEXT;
  outcome_code TEXT;
  outcome_detail JSONB;
BEGIN
  IF action_input NOT IN (
    'FILL_LEAD_TIME','FILL_MATERIAL','CREATE_DEFAULT_VARIANTS',
    'PREPARE_COSTS','ACTIVATE_MEMBER_PRICES'
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT: BATCH_ACTION';
  END IF;

  IF action_input IN ('FILL_LEAD_TIME','FILL_MATERIAL','CREATE_DEFAULT_VARIANTS')
    AND NOT public.has_permission('catalog.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  ELSIF action_input = 'PREPARE_COSTS'
    AND NOT public.has_permission('catalog.cost.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  ELSIF action_input = 'ACTIVATE_MEMBER_PRICES'
    AND NOT public.has_permission('catalog.formula.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT COUNT(DISTINCT item_id)
  INTO requested_value
  FROM unnest(product_ids_input) AS item_id;
  IF requested_value IS NULL OR requested_value = 0 OR requested_value > 1000 THEN
    RAISE EXCEPTION 'INVALID_INPUT: PRODUCT_SELECTION';
  END IF;

  IF action_input = 'FILL_LEAD_TIME' THEN
    BEGIN
      lead_days_value := (payload_input->>'leadTimeDays')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'INVALID_INPUT: LEAD_TIME';
    END;
    IF lead_days_value IS NULL OR lead_days_value <= 0 OR lead_days_value > 3650 THEN
      RAISE EXCEPTION 'INVALID_INPUT: LEAD_TIME';
    END IF;
  ELSIF action_input = 'FILL_MATERIAL' THEN
    material_value := NULLIF(BTRIM(COALESCE(payload_input->>'materialSummary','')), '');
    IF material_value IS NULL OR CHAR_LENGTH(material_value) > 2000 THEN
      RAISE EXCEPTION 'INVALID_INPUT: MATERIAL';
    END IF;
  ELSIF action_input = 'PREPARE_COSTS' THEN
    BEGIN
      exchange_rate_value := (payload_input->>'exchangeRateToThb')::NUMERIC;
      effective_from_value := COALESCE(
        NULLIF(payload_input->>'effectiveFrom','')::TIMESTAMPTZ,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'INVALID_INPUT: COST_PREPARATION';
    END;
    IF exchange_rate_value IS NULL OR exchange_rate_value <= 0 THEN
      RAISE EXCEPTION 'INVALID_INPUT: COST_PREPARATION';
    END IF;
  END IF;

  INSERT INTO public.catalog_batch_runs(
    action, requested_count, input_snapshot, created_by
  ) VALUES (
    action_input,
    requested_value,
    CASE
      WHEN action_input = 'FILL_LEAD_TIME' THEN jsonb_build_object('leadTimeDays', lead_days_value)
      WHEN action_input = 'FILL_MATERIAL' THEN jsonb_build_object('materialSummary', material_value)
      WHEN action_input = 'PREPARE_COSTS' THEN jsonb_build_object(
        'exchangeRateToThb', exchange_rate_value,
        'effectiveFrom', effective_from_value
      )
      ELSE '{}'::JSONB
    END,
    (SELECT auth.uid())
  ) RETURNING id INTO run_id_value;

  FOR product_record IN
    SELECT p.*
    FROM public.products p
    WHERE p.id = ANY(product_ids_input)
    ORDER BY p.sku
    FOR UPDATE
  LOOP
    outcome_status := 'SUCCEEDED';
    outcome_code := 'UPDATED';
    outcome_detail := '{}'::JSONB;

    BEGIN
      IF product_record.status NOT IN ('DRAFT','REVIEW') THEN
        outcome_status := 'SKIPPED';
        outcome_code := 'PRODUCT_NOT_EDITABLE';

      ELSIF action_input = 'FILL_LEAD_TIME' THEN
        IF product_record.default_lead_time_days IS NOT NULL THEN
          outcome_status := 'SKIPPED';
          outcome_code := 'LEAD_TIME_ALREADY_PRESENT';
        ELSE
          UPDATE public.products
          SET default_lead_time_days = lead_days_value,
              status = 'DRAFT', qa_status = 'NOT_REVIEWED', reviewed_by = NULL,
              reviewed_at = NULL, review_note = NULL, updated_at = NOW()
          WHERE id = product_record.id;
          outcome_detail := jsonb_build_object('leadTimeDays', lead_days_value);
        END IF;

      ELSIF action_input = 'FILL_MATERIAL' THEN
        IF NULLIF(BTRIM(COALESCE(product_record.material_summary,'')), '') IS NOT NULL THEN
          outcome_status := 'SKIPPED';
          outcome_code := 'MATERIAL_ALREADY_PRESENT';
        ELSE
          UPDATE public.products
          SET material_summary = material_value,
              status = 'DRAFT', qa_status = 'NOT_REVIEWED', reviewed_by = NULL,
              reviewed_at = NULL, review_note = NULL, updated_at = NOW()
          WHERE id = product_record.id;
          outcome_detail := jsonb_build_object('materialSummary', material_value);
        END IF;

      ELSIF action_input = 'CREATE_DEFAULT_VARIANTS' THEN
        SELECT v.id INTO existing_variant_id
        FROM public.product_variants v
        WHERE v.product_id = product_record.id AND v.status = 'ACTIVE'
        LIMIT 1;
        IF existing_variant_id IS NOT NULL THEN
          outcome_status := 'SKIPPED';
          outcome_code := 'ACTIVE_VARIANT_ALREADY_PRESENT';
        ELSIF product_record.width_mm IS NULL OR product_record.depth_mm IS NULL
          OR product_record.height_mm IS NULL THEN
          outcome_status := 'SKIPPED';
          outcome_code := 'DIMENSIONS_REQUIRED';
        ELSE
          SELECT v.id INTO existing_variant_id
          FROM public.product_variants v
          WHERE v.sku = product_record.sku || '-BASE'
            AND v.product_id = product_record.id
          LIMIT 1;
          IF existing_variant_id IS NULL THEN
            INSERT INTO public.product_variants(
              product_id, sku, factory_sku, name, specification_summary,
              width_mm, depth_mm, height_mm, weight_kg, cbm,
              material_summary, finish_summary, moq, status
            ) VALUES (
              product_record.id, product_record.sku || '-BASE', product_record.factory_sku,
              product_record.name_th, product_record.specification_summary,
              product_record.width_mm, product_record.depth_mm, product_record.height_mm,
              product_record.weight_kg, product_record.cbm, product_record.material_summary,
              product_record.finish_summary, product_record.moq, 'ACTIVE'
            ) RETURNING id INTO existing_variant_id;
          ELSE
            UPDATE public.product_variants
            SET status = 'ACTIVE', updated_at = NOW()
            WHERE id = existing_variant_id;
          END IF;
          UPDATE public.products
          SET status = 'DRAFT', qa_status = 'NOT_REVIEWED', reviewed_by = NULL,
              reviewed_at = NULL, review_note = NULL, updated_at = NOW()
          WHERE id = product_record.id;
          outcome_detail := jsonb_build_object('variantId', existing_variant_id);
        END IF;

      ELSIF action_input = 'PREPARE_COSTS' THEN
        IF product_record.factory_cost IS NULL OR product_record.factory_cost <= 0
          OR product_record.factory_currency IS NULL THEN
          outcome_status := 'SKIPPED';
          outcome_code := 'SOURCE_FACTORY_COST_REQUIRED';
        ELSE
          SELECT c.* INTO active_cost_record
          FROM public.product_cost_versions c
          WHERE c.product_id = product_record.id
            AND c.variant_id IS NULL AND c.status = 'ACTIVE'
          LIMIT 1;
          IF active_cost_record.id IS NOT NULL
            AND active_cost_record.factory_cost = product_record.factory_cost
            AND active_cost_record.currency = product_record.factory_currency
            AND active_cost_record.exchange_rate_to_thb = exchange_rate_value THEN
            outcome_status := 'SKIPPED';
            outcome_code := 'COST_VERSION_ALREADY_CURRENT';
          ELSE
            PERFORM public.create_product_cost_version(
              product_record.id, NULL, product_record.factory_cost,
              product_record.factory_currency, exchange_rate_value, effective_from_value
            );
            outcome_detail := jsonb_build_object(
              'currency', product_record.factory_currency,
              'exchangeRateToThb', exchange_rate_value
            );
          END IF;
        END IF;

      ELSIF action_input = 'ACTIVATE_MEMBER_PRICES' THEN
        preview_value := public.pricing_calculate_product_price(
          product_record.id, NULL, NULL, NOW()
        );
        IF EXISTS (
          SELECT 1 FROM public.product_prices pp
          WHERE pp.product_id = product_record.id
            AND pp.variant_id IS NULL AND pp.status = 'ACTIVE'
            AND pp.source_cost_version_id = (preview_value->>'costVersionId')::UUID
            AND pp.amount = (preview_value->>'memberPrice')::NUMERIC
            AND pp.calculation_snapshot->'formulaVersions' = preview_value->'formulaVersions'
        ) THEN
          outcome_status := 'SKIPPED';
          outcome_code := 'MEMBER_PRICE_ALREADY_CURRENT';
        ELSE
          PERFORM public.activate_calculated_product_price(product_record.id, NULL);
          outcome_detail := jsonb_build_object(
            'memberPrice', preview_value->>'memberPrice',
            'suggestedResalePrice', preview_value->>'suggestedResalePrice',
            'freightEstimateMin', preview_value->>'freightEstimateMin',
            'freightEstimateMax', preview_value->>'freightEstimateMax'
          );
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      outcome_status := 'FAILED';
      outcome_code := LEFT(SQLERRM, 180);
      outcome_detail := jsonb_build_object('sqlState', SQLSTATE);
    END;

    INSERT INTO public.catalog_batch_items(
      run_id, product_id, status, result_code, detail
    ) VALUES (
      run_id_value, product_record.id, outcome_status, outcome_code, outcome_detail
    );
    IF outcome_status = 'SUCCEEDED' THEN
      succeeded_value := succeeded_value + 1;
    ELSIF outcome_status = 'SKIPPED' THEN
      skipped_value := skipped_value + 1;
    ELSE
      failed_value := failed_value + 1;
    END IF;
  END LOOP;

  -- IDs not found are counted as failures without exposing arbitrary identifiers.
  failed_value := failed_value + requested_value - succeeded_value - skipped_value - failed_value;

  UPDATE public.catalog_batch_runs
  SET succeeded_count = succeeded_value,
      skipped_count = skipped_value,
      failed_count = failed_value,
      status = CASE WHEN failed_value > 0 THEN 'COMPLETED_WITH_ERRORS' ELSE 'COMPLETED' END,
      completed_at = NOW()
  WHERE id = run_id_value;

  PERFORM public.write_audit_event(
    NULL, 'catalog_batch_run', run_id_value, action_input, NULL,
    jsonb_build_object(
      'requested', requested_value,
      'succeeded', succeeded_value,
      'skipped', skipped_value,
      'failed', failed_value
    )
  );

  RETURN jsonb_build_object(
    'runId', run_id_value,
    'action', action_input,
    'requested', requested_value,
    'succeeded', succeeded_value,
    'skipped', skipped_value,
    'failed', failed_value
  );
END;
$$;

REVOKE ALL ON public.catalog_batch_runs, public.catalog_batch_items
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.catalog_batch_runs, public.catalog_batch_items TO authenticated;

REVOKE ALL ON FUNCTION public.run_catalog_batch(TEXT, UUID[], JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_catalog_batch(TEXT, UUID[], JSONB)
TO authenticated;

COMMENT ON FUNCTION public.run_catalog_batch(TEXT, UUID[], JSONB) IS
  'Trusted, permission-checked and audited batch actions. Missing business values must be provided explicitly; the function never invents lead time, material or exchange rate.';
