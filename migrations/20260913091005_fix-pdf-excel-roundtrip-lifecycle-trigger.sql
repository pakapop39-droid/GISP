CREATE OR REPLACE FUNCTION public.guard_catalog_enrichment_lifecycle()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $$
DECLARE job_source TEXT; job_status TEXT; target_batch UUID;
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
