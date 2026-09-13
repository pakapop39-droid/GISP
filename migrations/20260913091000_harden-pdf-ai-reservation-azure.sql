-- PDF Catalog Import v1.0 (Development): fail closed when the Azure pricing
-- identity is missing or JSON null. This replaces only the reservation RPC;
-- the applied base migration remains immutable.

CREATE OR REPLACE FUNCTION public.reserve_catalog_pdf_ai_call(
  import_page_id_input UUID, estimated_cost_usd_input NUMERIC, worker_id_input TEXT,
  pricing_snapshot_input JSONB,input_token_limit_input INTEGER,completion_token_limit_input INTEGER
) RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE page_record RECORD; month_key DATE:=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE; month_record RECORD; job_reserved NUMERIC:=0; job_actual NUMERIC:=0; calculated_cost NUMERIC;
BEGIN
  calculated_cost:=CEIL((
    COALESCE((pricing_snapshot_input->>'promptPerToken')::NUMERIC,-1)*input_token_limit_input+
    COALESCE((pricing_snapshot_input->>'completionPerToken')::NUMERIC,-1)*completion_token_limit_input+
    COALESCE((pricing_snapshot_input->>'requestPerCall')::NUMERIC,-1)+
    COALESCE((pricing_snapshot_input->>'imagePerImage')::NUMERIC,-1)*COALESCE((pricing_snapshot_input->>'imageCount')::INTEGER,-1)
  )*1000000)/1000000;
  IF estimated_cost_usd_input<=0 OR estimated_cost_usd_input>1 OR input_token_limit_input<1 OR input_token_limit_input>100000 OR
     completion_token_limit_input<1 OR completion_token_limit_input>3000 OR
     pricing_snapshot_input->>'model' IS DISTINCT FROM 'openai/gpt-4o-mini' OR
     pricing_snapshot_input->>'provider' IS DISTINCT FROM 'azure' OR
     COALESCE((pricing_snapshot_input->>'promptPerToken')::NUMERIC,-1)<0 OR
     COALESCE((pricing_snapshot_input->>'completionPerToken')::NUMERIC,-1)<0 OR
     COALESCE((pricing_snapshot_input->>'requestPerCall')::NUMERIC,-1)<0 OR
     COALESCE((pricing_snapshot_input->>'imagePerImage')::NUMERIC,-1)<0 OR
     COALESCE((pricing_snapshot_input->>'worstCaseUsd')::NUMERIC,-1)<>estimated_cost_usd_input OR calculated_cost<>estimated_cost_usd_input OR
     COALESCE((pricing_snapshot_input->>'imageCount')::INTEGER,-1) NOT IN (0,1) THEN
    RAISE EXCEPTION 'INVALID_RESERVATION';
  END IF;
  SELECT p.*,j.ai_cost_usd INTO page_record FROM public.catalog_import_pages p
    JOIN public.catalog_import_jobs j ON j.id=p.import_job_id WHERE p.id=import_page_id_input FOR UPDATE OF p;
  IF page_record.id IS NULL OR page_record.leased_by<>worker_id_input OR page_record.lease_expires_at<NOW() THEN RAISE EXCEPTION 'LEASE_INVALID'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(page_record.import_job_id::TEXT,0));
  SELECT ai_cost_usd INTO job_actual FROM public.catalog_import_jobs WHERE id=page_record.import_job_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.catalog_import_ai_calls WHERE import_page_id=import_page_id_input) THEN RAISE EXCEPTION 'AI_CALL_ALREADY_ATTEMPTED'; END IF;
  SELECT COALESCE(SUM(reserved_cost_usd),0) INTO job_reserved FROM public.catalog_import_ai_calls
    WHERE import_job_id=page_record.import_job_id AND status='RESERVED';
  IF job_actual+job_reserved+estimated_cost_usd_input>1 THEN RAISE EXCEPTION 'JOB_AI_BUDGET_EXCEEDED'; END IF;
  INSERT INTO public.catalog_import_ai_monthly_usage(usage_month) VALUES(month_key) ON CONFLICT DO NOTHING;
  SELECT * INTO month_record FROM public.catalog_import_ai_monthly_usage WHERE usage_month=month_key FOR UPDATE;
  IF month_record.actual_usd+month_record.reserved_usd+estimated_cost_usd_input>50 THEN RAISE EXCEPTION 'MONTHLY_AI_BUDGET_EXCEEDED'; END IF;
  UPDATE public.catalog_import_ai_monthly_usage SET reserved_usd=reserved_usd+estimated_cost_usd_input,updated_at=NOW() WHERE usage_month=month_key;
  INSERT INTO public.catalog_import_ai_calls(import_job_id,import_page_id,usage_month,provider,model,status,pricing_snapshot,
      input_token_limit,completion_token_limit,reserved_cost_usd,cost_usd,purge_after)
    VALUES(page_record.import_job_id,import_page_id_input,month_key,'azure','openai/gpt-4o-mini','RESERVED',pricing_snapshot_input,
      input_token_limit_input,completion_token_limit_input,estimated_cost_usd_input,0,NULL);
  RETURN jsonb_build_object('reserved',TRUE,'amount',estimated_cost_usd_input);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_catalog_pdf_ai_call(UUID,NUMERIC,TEXT,JSONB,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_catalog_pdf_ai_call(UUID,NUMERIC,TEXT,JSONB,INTEGER,INTEGER) TO project_admin;
