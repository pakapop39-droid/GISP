-- PDF Catalog Import v1.0 (Development only).
-- Keep draining pending pages while completed pages move the job through the
-- NORMALIZING in-progress state.

CREATE OR REPLACE FUNCTION public.claim_catalog_pdf_pages(worker_id_input TEXT,limit_input INTEGER DEFAULT 4)
RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE claimed JSONB;
BEGIN
  IF NULLIF(BTRIM(worker_id_input),'') IS NULL OR limit_input IS NULL OR limit_input<1 OR limit_input>4 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  WITH candidates AS (
    SELECT p.id FROM public.catalog_import_pages p JOIN public.catalog_import_jobs j ON j.id=p.import_job_id
    WHERE j.source_type='PDF' AND j.status IN ('QUEUED','EXTRACTING','NORMALIZING') AND
      (p.status='PENDING' OR (p.status='LEASED' AND p.lease_expires_at<NOW())) AND p.attempts<3
    ORDER BY j.created_at,p.page_number FOR UPDATE OF p SKIP LOCKED LIMIT limit_input
  ), claimed_rows AS (
    UPDATE public.catalog_import_pages p SET status='LEASED',lease_token=gen_random_uuid(),leased_by=worker_id_input,
      lease_expires_at=NOW()+INTERVAL '10 minutes',attempts=p.attempts+1,started_at=COALESCE(p.started_at,NOW())
    FROM candidates c WHERE p.id=c.id
    RETURNING p.*
  ), job_updates AS (
    UPDATE public.catalog_import_jobs j SET status='EXTRACTING',started_at=COALESCE(started_at,NOW()),last_heartbeat_at=NOW()
    WHERE id IN (SELECT import_job_id FROM claimed_rows) RETURNING j.id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',c.id,'jobId',c.import_job_id,'pageNumber',c.page_number,'leaseToken',c.lease_token,
    'sourceBucket',f.bucket,'sourceKey',f.object_key,'organizationId',f.organization_id,'createdBy',j.created_by,
    'categories',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',category.id,'code',category.code,'nameTh',category.name_th,'nameEn',category.name_en) ORDER BY category.sort_order),'[]'::JSONB)
      FROM public.categories category WHERE category.status='ACTIVE')
  ) ORDER BY c.page_number),'[]'::JSONB) INTO claimed
  FROM claimed_rows c JOIN public.catalog_import_jobs j ON j.id=c.import_job_id
  JOIN public.file_metadata f ON f.id=j.source_file_id;
  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_catalog_pdf_pages(TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_catalog_pdf_pages(TEXT,INTEGER) TO project_admin;
