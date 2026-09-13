CREATE OR REPLACE FUNCTION public.guard_catalog_enrichment_lifecycle()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $$
DECLARE job_source TEXT; job_status TEXT; target_batch UUID; linked_product UUID; snapshot_product TEXT; imported_time TIMESTAMPTZ;
BEGIN
  IF TG_TABLE_NAME='catalog_import_enrichment_batches' THEN
    target_batch:=NEW.id;
    SELECT job.source_type,job.status INTO job_source,job_status
    FROM public.catalog_import_jobs job WHERE job.id=NEW.import_job_id;
  ELSE
    target_batch:=NEW.batch_id;
    SELECT job.source_type,job.status INTO job_source,job_status
    FROM public.catalog_import_enrichment_batches batch
    JOIN public.catalog_import_jobs job ON job.id=batch.import_job_id
    WHERE batch.id=target_batch;
    IF NEW.product_id IS NOT NULL THEN
      SELECT import_row.product_id,import_row.imported_product_snapshot->>'id',import_row.imported_at
      INTO linked_product,snapshot_product,imported_time
      FROM public.catalog_import_rows import_row WHERE import_row.id=NEW.import_row_id;
      IF linked_product IS DISTINCT FROM NEW.product_id OR snapshot_product IS DISTINCT FROM NEW.product_id::TEXT OR imported_time IS NULL THEN
        RAISE EXCEPTION 'CONFLICT: PDF_PRODUCT_LINKAGE';
      END IF;
    END IF;
  END IF;
  IF job_source IS DISTINCT FROM 'PDF' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF job_status NOT IN ('READY_FOR_REVIEW','COMPLETED','COMPLETED_WITH_ISSUES') THEN
    IF TG_TABLE_NAME='catalog_import_enrichment_batches' THEN
      IF TG_OP='INSERT' OR NEW.status<>'CANCELLED' THEN RAISE EXCEPTION 'INVALID_TRANSITION: PDF_JOB_STATUS'; END IF;
    ELSE
      IF TG_OP='INSERT' OR
         (NEW.detail_status IS DISTINCT FROM OLD.detail_status OR NEW.cost_status IS DISTINCT FROM OLD.cost_status) AND
         NOT (NEW.detail_status IN ('APPLIED','CANCELLED') AND NEW.cost_status IN ('APPLIED','CANCELLED')) THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: PDF_JOB_STATUS';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
