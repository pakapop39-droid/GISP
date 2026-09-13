ALTER TABLE public.catalog_import_enrichment_batches
  ADD COLUMN exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN unchanged_rows INTEGER NOT NULL DEFAULT 0 CHECK (unchanged_rows>=0),
  ADD COLUMN waiting_for_draft_rows INTEGER NOT NULL DEFAULT 0 CHECK (waiting_for_draft_rows>=0);

CREATE OR REPLACE FUNCTION public.refresh_catalog_enrichment_targets(batch_id_input UUID)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $$
DECLARE batch_record RECORD; refreshed_count INTEGER:=0; conflict_count INTEGER:=0;
BEGIN
  IF NOT public.has_permission('catalog.import') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT batch.id,job.source_type INTO batch_record
  FROM public.catalog_import_enrichment_batches batch
  JOIN public.catalog_import_jobs job ON job.id=batch.import_job_id
  WHERE batch.id=batch_id_input FOR UPDATE OF batch;
  IF batch_record.id IS NULL OR batch_record.source_type<>'PDF' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  UPDATE public.catalog_import_enrichment_rows enrichment
  SET product_id=import_row.product_id,cost_status='READY'
  FROM public.catalog_import_rows import_row
  WHERE enrichment.batch_id=batch_id_input AND enrichment.import_row_id=import_row.id
    AND enrichment.cost_status='WAITING_FOR_DRAFT' AND import_row.product_id IS NOT NULL
    AND enrichment.baseline_cost IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.product_cost_versions cost
      WHERE cost.product_id=import_row.product_id AND cost.variant_id IS NULL AND cost.status='ACTIVE');
  GET DIAGNOSTICS refreshed_count=ROW_COUNT;

  UPDATE public.catalog_import_enrichment_rows enrichment
  SET product_id=import_row.product_id,cost_status='CONFLICT',
      error_codes=array_append(enrichment.error_codes,'COST_BASELINE_CHANGED')
  FROM public.catalog_import_rows import_row
  WHERE enrichment.batch_id=batch_id_input AND enrichment.import_row_id=import_row.id
    AND enrichment.cost_status='WAITING_FOR_DRAFT' AND import_row.product_id IS NOT NULL
    AND EXISTS(SELECT 1 FROM public.product_cost_versions cost
      WHERE cost.product_id=import_row.product_id AND cost.variant_id IS NULL AND cost.status='ACTIVE');
  GET DIAGNOSTICS conflict_count=ROW_COUNT;
  PERFORM public.refresh_catalog_enrichment_batch(batch_id_input);
  RETURN jsonb_build_object('batchId',batch_id_input,'refreshed',refreshed_count,'conflicts',conflict_count);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_catalog_enrichment_targets(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_catalog_enrichment_targets(UUID) TO authenticated;
