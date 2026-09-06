-- General Excel/CSV catalog import workflow. Runs on slice-2-catalog only until merge approval.

CREATE OR REPLACE FUNCTION public.execute_catalog_import_job(import_job_id_input UUID)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  job_record RECORD;
  row_record RECORD;
  product_id_value UUID;
  imported_count INTEGER := 0;
  failed_count INTEGER := 0;
  existing_invalid_count INTEGER := 0;
BEGIN
  IF NOT public.has_permission('catalog.import') OR NOT public.has_permission('catalog.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT * INTO job_record
  FROM public.catalog_import_jobs
  WHERE id = import_job_id_input
  FOR UPDATE;

  IF job_record.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF job_record.status <> 'READY_FOR_REVIEW' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  UPDATE public.catalog_import_jobs
  SET status = 'IMPORTING', started_at = NOW()
  WHERE id = import_job_id_input;

  SELECT COUNT(*) INTO existing_invalid_count
  FROM public.catalog_import_rows
  WHERE import_job_id = import_job_id_input AND validation_status = 'INVALID';

  FOR row_record IN
    SELECT * FROM public.catalog_import_rows
    WHERE import_job_id = import_job_id_input AND validation_status = 'VALID'
    ORDER BY row_number
    FOR UPDATE
  LOOP
    BEGIN
      INSERT INTO public.products(
        supplier_id, category_id, sku, factory_sku, product_type, name_th, name_en,
        country_code, default_lead_time_days, width_mm, depth_mm, height_mm, weight_kg,
        cbm, material_summary, finish_summary, moq, description_th,
        specification_summary, source_catalog_page, status, qa_status, created_by
      ) VALUES (
        (row_record.source_data->>'supplierId')::UUID,
        NULLIF(row_record.source_data->>'categoryId', '')::UUID,
        UPPER(BTRIM(row_record.source_data->>'sku')),
        NULLIF(BTRIM(row_record.source_data->>'factory_sku'), ''),
        UPPER(BTRIM(row_record.source_data->>'product_type')),
        BTRIM(row_record.source_data->>'name_th'),
        NULLIF(BTRIM(row_record.source_data->>'name_en'), ''),
        UPPER(BTRIM(COALESCE(NULLIF(row_record.source_data->>'country_code', ''), 'CN'))),
        NULLIF(row_record.source_data->>'lead_time_days', '')::INTEGER,
        NULLIF(row_record.source_data->>'width_mm', '')::NUMERIC,
        NULLIF(row_record.source_data->>'depth_mm', '')::NUMERIC,
        NULLIF(row_record.source_data->>'height_mm', '')::NUMERIC,
        NULLIF(row_record.source_data->>'weight_kg', '')::NUMERIC,
        NULLIF(row_record.source_data->>'cbm', '')::NUMERIC,
        NULLIF(BTRIM(row_record.source_data->>'material_summary'), ''),
        NULLIF(BTRIM(row_record.source_data->>'finish_summary'), ''),
        NULLIF(row_record.source_data->>'moq', '')::NUMERIC,
        NULLIF(BTRIM(row_record.source_data->>'description_th'), ''),
        NULLIF(BTRIM(row_record.source_data->>'specification_summary'), ''),
        'Import row ' || row_record.row_number::TEXT,
        'DRAFT', 'NOT_REVIEWED', (SELECT auth.uid())
      )
      RETURNING id INTO product_id_value;

      UPDATE public.catalog_import_rows
      SET validation_status = 'IMPORTED', product_id = product_id_value
      WHERE id = row_record.id;

      PERFORM public.write_audit_event(
        NULL, 'product', product_id_value, 'DRAFT_IMPORTED', NULL,
        jsonb_build_object('importJobId', import_job_id_input, 'rowNumber', row_record.row_number, 'sku', row_record.source_data->>'sku')
      );
      imported_count := imported_count + 1;
    EXCEPTION WHEN unique_violation THEN
      UPDATE public.catalog_import_rows SET validation_status = 'INVALID' WHERE id = row_record.id;
      INSERT INTO public.catalog_import_errors(import_row_id, field_name, error_code, error_message)
      VALUES (row_record.id, 'sku', 'DUPLICATE_SKU', 'SKU มีอยู่ใน Catalog แล้วระหว่างยืนยัน Import');
      failed_count := failed_count + 1;
    WHEN OTHERS THEN
      UPDATE public.catalog_import_rows SET validation_status = 'INVALID' WHERE id = row_record.id;
      INSERT INTO public.catalog_import_errors(import_row_id, field_name, error_code, error_message)
      VALUES (row_record.id, NULL, 'IMPORT_FAILED', 'ไม่สามารถสร้าง Product Draft จากแถวนี้ได้');
      failed_count := failed_count + 1;
    END;
  END LOOP;

  UPDATE public.catalog_import_jobs
  SET status = 'COMPLETED',
      valid_rows = imported_count,
      invalid_rows = existing_invalid_count + failed_count,
      completed_at = NOW()
  WHERE id = import_job_id_input;

  PERFORM public.write_audit_event(
    NULL, 'catalog_import_job', import_job_id_input, 'CATALOG_IMPORT_COMPLETED', NULL,
    jsonb_build_object('imported', imported_count, 'invalid', existing_invalid_count + failed_count)
  );

  RETURN jsonb_build_object('imported', imported_count, 'invalid', existing_invalid_count + failed_count);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_catalog_import_job(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_catalog_import_job(UUID) TO authenticated;

