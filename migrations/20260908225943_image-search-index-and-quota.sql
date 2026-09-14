-- Additive Development image-search infrastructure; primary image per product.
CREATE TABLE public.image_search_jobs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES public.product_media(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.file_metadata(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','PROCESSING','READY','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  lease_id uuid, lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  error_code text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_image_embeddings (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES public.product_media(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.file_metadata(id) ON DELETE CASCADE,
  revision bigint NOT NULL,
  model_identity text NOT NULL,
  content_hash text NOT NULL,
  embedding vector(1024) NOT NULL,
  indexed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.image_search_budget (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  enabled boolean NOT NULL DEFAULT true,
  request_limit integer NOT NULL DEFAULT 10000 CHECK(request_limit BETWEEN 1 AND 100000),
  used_requests integer NOT NULL DEFAULT 0 CHECK(used_requests >= 0),
  account_daily_limit integer NOT NULL DEFAULT 30 CHECK(account_daily_limit BETWEEN 1 AND 1000)
);
INSERT INTO public.image_search_budget(id) VALUES(true);
CREATE TABLE public.image_search_daily_usage (
  account_id uuid NOT NULL,
  usage_day date NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  last_request_at timestamptz,
  PRIMARY KEY(account_id,usage_day)
);
ALTER TABLE public.image_search_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_image_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_search_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_search_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.image_search_jobs,public.product_image_embeddings,public.image_search_budget,public.image_search_daily_usage FROM PUBLIC,anon,authenticated;
CREATE INDEX image_search_jobs_pending ON public.image_search_jobs(state,next_attempt_at);

-- Queue changes atomically with the catalog mutation. Other image angles are
-- outside this first index; deleting the main image selects its replacement.
CREATE FUNCTION public.queue_product_image_search(product_input uuid, force_input boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE chosen public.product_media%ROWTYPE;
BEGIN
  SELECT * INTO chosen FROM public.product_media WHERE product_id=product_input AND media_type='IMAGE'
  ORDER BY is_primary DESC,sort_order,id LIMIT 1;
  IF NOT FOUND THEN
    DELETE FROM public.product_image_embeddings WHERE product_id=product_input;
    DELETE FROM public.image_search_jobs WHERE product_id=product_input;
    RETURN;
  END IF;
  INSERT INTO public.image_search_jobs(product_id,media_id,file_id) VALUES(product_input,chosen.id,chosen.file_id)
  ON CONFLICT(product_id) DO UPDATE SET media_id=excluded.media_id,file_id=excluded.file_id,
    revision=image_search_jobs.revision+1,state='PENDING',attempts=0,lease_id=NULL,lease_until=NULL,
    next_attempt_at=now(),error_code=NULL,updated_at=now()
  WHERE force_input OR image_search_jobs.media_id<>excluded.media_id OR image_search_jobs.file_id<>excluded.file_id;
END $$;

CREATE FUNCTION public.image_search_media_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN PERFORM public.queue_product_image_search(OLD.product_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM public.queue_product_image_search(NEW.product_id); END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER image_search_media_changed AFTER INSERT OR UPDATE OR DELETE ON public.product_media
FOR EACH ROW EXECUTE FUNCTION public.image_search_media_changed();

CREATE FUNCTION public.image_search_file_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE product_value uuid;
BEGIN
  FOR product_value IN SELECT product_id FROM public.image_search_jobs WHERE file_id=NEW.id LOOP
    PERFORM public.queue_product_image_search(product_value,true);
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER image_search_file_changed AFTER UPDATE OF bucket,object_key,mime_type,size_bytes,url ON public.file_metadata
FOR EACH ROW WHEN (OLD.bucket IS DISTINCT FROM NEW.bucket OR OLD.object_key IS DISTINCT FROM NEW.object_key
 OR OLD.mime_type IS DISTINCT FROM NEW.mime_type OR OLD.size_bytes IS DISTINCT FROM NEW.size_bytes OR OLD.url IS DISTINCT FROM NEW.url)
EXECUTE FUNCTION public.image_search_file_changed();

CREATE FUNCTION public.claim_image_search_jobs(limit_input integer DEFAULT 8)
RETURNS SETOF public.image_search_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  RETURN QUERY WITH candidates AS (
    SELECT j.product_id FROM public.image_search_jobs j JOIN public.products p ON p.id=j.product_id
    WHERE ((j.state='PENDING' AND j.next_attempt_at<=now()) OR (j.state='PROCESSING' AND j.lease_until<now()))
      AND j.attempts<3 AND p.status='PUBLISHED' AND p.qa_status='PASSED'
      AND EXISTS(SELECT 1 FROM public.product_prices pp WHERE pp.product_id=p.id AND pp.variant_id IS NULL
        AND pp.status='ACTIVE' AND pp.valid_from<=now() AND (pp.valid_until IS NULL OR pp.valid_until>now()))
    ORDER BY j.next_attempt_at,j.product_id FOR UPDATE OF j SKIP LOCKED LIMIT least(greatest(limit_input,1),8)
  ) UPDATE public.image_search_jobs j SET state='PROCESSING',attempts=j.attempts+1,lease_id=gen_random_uuid(),
    lease_until=now()+interval '5 minutes',updated_at=now() FROM candidates c WHERE j.product_id=c.product_id RETURNING j.*;
  UPDATE public.image_search_jobs SET state='FAILED',error_code='LEASE_EXHAUSTED',updated_at=now()
    WHERE state='PROCESSING' AND lease_until<now() AND attempts>=3;
END $$;

CREATE FUNCTION public.finish_image_search_job(product_input uuid, lease_input uuid, revision_input bigint,
  model_input text, hash_input text, embedding_input vector(1024))
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE job public.image_search_jobs%ROWTYPE;
BEGIN
  SELECT * INTO job FROM public.image_search_jobs WHERE product_id=product_input FOR UPDATE;
  IF NOT FOUND OR job.state<>'PROCESSING' OR job.lease_id IS DISTINCT FROM lease_input OR job.revision<>revision_input THEN RETURN false; END IF;
  IF model_input<>'voyageai/voyage-multimodal-3.5-20260727:float1024:normalized-768-jpeg88-v1:input-type-none'
    OR length(hash_input)<>64 OR vector_dims(embedding_input)<>1024 OR vector_norm(embedding_input)<0.99 OR vector_norm(embedding_input)>1.01 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO public.product_image_embeddings(product_id,media_id,file_id,revision,model_identity,content_hash,embedding)
  VALUES(job.product_id,job.media_id,job.file_id,job.revision,model_input,hash_input,embedding_input)
  ON CONFLICT(product_id) DO UPDATE SET media_id=excluded.media_id,file_id=excluded.file_id,revision=excluded.revision,
    model_identity=excluded.model_identity,content_hash=excluded.content_hash,embedding=excluded.embedding,indexed_at=now();
  UPDATE public.image_search_jobs SET state='READY',lease_id=NULL,lease_until=NULL,error_code=NULL,updated_at=now() WHERE product_id=product_input;
  RETURN true;
END $$;

CREATE FUNCTION public.fail_image_search_job(product_input uuid,lease_input uuid,code_input text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  UPDATE public.image_search_jobs SET state=CASE WHEN attempts>=3 THEN 'FAILED' ELSE 'PENDING' END,
    lease_id=NULL,lease_until=NULL,next_attempt_at=now()+interval '5 minutes',
    error_code=left(code_input,80),updated_at=now() WHERE product_id=product_input AND lease_id=lease_input;
$$;

-- One shared, persistent lifetime budget, including indexing retries. API failures
-- retain the reservation. Per-account daily count is derived server-side.
CREATE FUNCTION public.reserve_image_search_request(user_input uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE budget public.image_search_budget%ROWTYPE; account_value uuid; usage_value public.image_search_daily_usage%ROWTYPE;
  day_value date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  SELECT * INTO budget FROM public.image_search_budget WHERE id=true FOR UPDATE;
  IF NOT budget.enabled OR budget.used_requests>=budget.request_limit THEN RAISE EXCEPTION 'IMAGE_SEARCH_QUOTA'; END IF;
  IF user_input IS NOT NULL THEN
    SELECT coalesce(mp.organization_id,mp.user_id) INTO account_value FROM public.member_profiles mp
      JOIN public.users u ON u.id=mp.user_id JOIN public.member_applications ma ON ma.member_profile_id=mp.id
      WHERE mp.user_id=user_input AND u.status='ACTIVE' AND ma.status='APPROVED'
      AND EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
        WHERE ur.user_id=u.id AND ur.revoked_at IS NULL AND r.code='MEMBER');
    IF account_value IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    INSERT INTO public.image_search_daily_usage(account_id,usage_day) VALUES(account_value,day_value) ON CONFLICT DO NOTHING;
    SELECT * INTO usage_value FROM public.image_search_daily_usage WHERE account_id=account_value AND usage_day=day_value FOR UPDATE;
    IF usage_value.requests>=budget.account_daily_limit OR usage_value.last_request_at>now()-interval '2 seconds' THEN RAISE EXCEPTION 'IMAGE_SEARCH_QUOTA'; END IF;
    UPDATE public.image_search_daily_usage SET requests=requests+1,last_request_at=now() WHERE account_id=account_value AND usage_day=day_value;
  END IF;
  UPDATE public.image_search_budget SET used_requests=used_requests+1 WHERE id=true;
END $$;

CREATE FUNCTION public.match_product_images(query_input vector(1024),model_input text,category_input uuid DEFAULT NULL)
RETURNS TABLE(product_id uuid,media_id uuid,similarity double precision)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF public.current_member_profile_id() IS NULL OR NOT EXISTS(SELECT 1 FROM public.member_applications
    WHERE member_profile_id=public.current_member_profile_id() AND status='APPROVED') OR NOT EXISTS(
      SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
      WHERE ur.user_id=(SELECT auth.uid()) AND ur.revoked_at IS NULL AND r.code='MEMBER') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF vector_dims(query_input)<>1024 OR vector_norm(query_input)<0.99 OR vector_norm(query_input)>1.01 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  RETURN QUERY SELECT e.product_id,e.media_id,1-(e.embedding <=> query_input)
  FROM public.product_image_embeddings e JOIN public.image_search_jobs j ON j.product_id=e.product_id AND j.revision=e.revision
    AND j.media_id=e.media_id AND j.file_id=e.file_id AND j.state='READY'
  JOIN public.product_media m ON m.id=e.media_id AND m.file_id=e.file_id AND m.product_id=e.product_id AND m.media_type='IMAGE'
  WHERE e.model_identity=model_input AND EXISTS(SELECT 1 FROM public.member_catalog c
    WHERE c.id=e.product_id AND (category_input IS NULL OR c.category_id=category_input))
  ORDER BY e.embedding <=> query_input,e.product_id LIMIT 12;
END $$;

-- Internal worker/queue/quota RPCs are only executable by project_admin.
REVOKE ALL ON FUNCTION public.queue_product_image_search(uuid,boolean),public.image_search_media_changed(),public.image_search_file_changed(),
  public.claim_image_search_jobs(integer),public.finish_image_search_job(uuid,uuid,bigint,text,text,vector),
  public.fail_image_search_job(uuid,uuid,text),public.reserve_image_search_request(uuid),public.match_product_images(vector,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_product_images(vector,text,uuid) TO authenticated;

-- Backfill jobs only. Cached embeddings are imported after validation, without AI calls.
DO $$ DECLARE item uuid; BEGIN
  FOR item IN SELECT DISTINCT product_id FROM public.product_media WHERE media_type='IMAGE' LOOP
    PERFORM public.queue_product_image_search(item);
  END LOOP;
END $$;
