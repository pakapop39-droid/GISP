DO $$
DECLARE product_value uuid; media_value uuid; job public.image_search_jobs%ROWTYPE; old_lease uuid;
  old_revision bigint; caught boolean; budget_value integer;
BEGIN
  IF has_table_privilege('authenticated','public.product_image_embeddings','SELECT')
    OR has_table_privilege('anon','public.image_search_jobs','SELECT')
    OR has_function_privilege('authenticated','public.reserve_image_search_request(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.claim_image_search_jobs(integer)','EXECUTE')
    OR has_function_privilege('anon','public.match_product_images(vector,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'IMAGE_SEARCH_GRANTS_FAILED';
  END IF;
  -- Intentional subtransaction rollback: all catalog/budget/job mutations below
  -- disappear on success as well as on failure. Other sessions cannot see them.
  BEGIN
    SELECT product_id,media_id INTO product_value,media_value FROM public.product_image_embeddings ORDER BY product_id LIMIT 1;
    IF product_value IS NULL THEN RAISE EXCEPTION 'EMPTY_IMAGE_INDEX'; END IF;
    PERFORM public.queue_product_image_search(product_value,true);
    SELECT * INTO job FROM public.claim_image_search_jobs(1);
    IF job.product_id<>product_value OR job.state<>'PROCESSING' THEN RAISE EXCEPTION 'CLAIM_FAILED'; END IF;
    old_lease:=job.lease_id; old_revision:=job.revision;
    PERFORM public.queue_product_image_search(product_value,true);
    IF public.finish_image_search_job(product_value,old_lease,old_revision,'invalid','invalid',NULL) THEN
      RAISE EXCEPTION 'STALE_WORKER_ACCEPTED';
    END IF;
    FOR attempt IN 1..3 LOOP
      UPDATE public.image_search_jobs SET next_attempt_at=now() WHERE product_id=product_value;
      SELECT * INTO job FROM public.claim_image_search_jobs(1);
      PERFORM public.fail_image_search_job(job.product_id,job.lease_id,'TEST');
    END LOOP;
    IF (SELECT state FROM public.image_search_jobs WHERE product_id=product_value)<>'FAILED' THEN RAISE EXCEPTION 'RETRY_LIMIT_FAILED'; END IF;
    DELETE FROM public.product_media WHERE id=media_value;
    IF EXISTS(SELECT 1 FROM public.product_image_embeddings WHERE media_id=media_value)
      OR EXISTS(SELECT 1 FROM public.image_search_jobs WHERE media_id=media_value) THEN RAISE EXCEPTION 'DELETED_MEDIA_STILL_INDEXED'; END IF;
    IF EXISTS(SELECT 1 FROM public.product_media WHERE product_id=product_value AND media_type='IMAGE')
      AND NOT EXISTS(SELECT 1 FROM public.image_search_jobs WHERE product_id=product_value AND state='PENDING') THEN RAISE EXCEPTION 'REPLACEMENT_NOT_QUEUED'; END IF;
    UPDATE public.image_search_budget SET request_limit=2,used_requests=0,enabled=true WHERE id=true;
    PERFORM public.reserve_image_search_request(NULL); PERFORM public.reserve_image_search_request(NULL);
    caught:=false;
    BEGIN PERFORM public.reserve_image_search_request(NULL);
    EXCEPTION WHEN OTHERS THEN IF SQLERRM='IMAGE_SEARCH_QUOTA' THEN caught:=true; ELSE RAISE; END IF; END;
    SELECT used_requests INTO budget_value FROM public.image_search_budget WHERE id=true;
    IF NOT caught OR budget_value<>2 THEN RAISE EXCEPTION 'BUDGET_LIMIT_FAILED'; END IF;
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='ROLLBACK_SUCCESSFUL_IMAGE_TEST';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END $$;
SELECT 'PASS grants, stale worker, retry cap, deletion, replacement, quota and rollback' AS result;
