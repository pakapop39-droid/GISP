-- PDF Catalog Import v1.0 (Development only).
-- Additive extension of the existing Excel/CSV import workflow.

ALTER TABLE public.catalog_import_jobs
  DROP CONSTRAINT IF EXISTS catalog_import_jobs_source_type_check;
ALTER TABLE public.catalog_import_jobs
  ADD CONSTRAINT catalog_import_jobs_source_type_check
  CHECK (source_type IN ('CSV','XLSX','PDF'));

ALTER TABLE public.catalog_import_jobs
  DROP CONSTRAINT IF EXISTS catalog_import_jobs_status_check;
ALTER TABLE public.catalog_import_jobs
  ADD CONSTRAINT catalog_import_jobs_status_check CHECK (status IN (
    'UPLOADED','VALIDATING','QUEUED','EXTRACTING','NORMALIZING',
    'READY_FOR_REVIEW','IMPORTING','COMPLETED','COMPLETED_WITH_ISSUES',
    'FAILED','CANCELLED'
  ));

ALTER TABLE public.catalog_import_jobs
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS processed_pages INTEGER NOT NULL DEFAULT 0 CHECK (processed_pages >= 0),
  ADD COLUMN IF NOT EXISTS file_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS processor_version TEXT,
  ADD COLUMN IF NOT EXISTS model_version TEXT,
  ADD COLUMN IF NOT EXISTS ai_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (ai_cost_usd >= 0 AND ai_cost_usd <= 1),
  ADD COLUMN IF NOT EXISTS compute_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (compute_cost_usd >= 0),
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS security_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (security_status IN ('PENDING','VERIFIED','REJECTED')),
  ADD COLUMN IF NOT EXISTS security_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS failure_message TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE public.catalog_import_jobs
  DROP CONSTRAINT IF EXISTS catalog_import_jobs_pdf_fields_check;
ALTER TABLE public.catalog_import_jobs
  ADD CONSTRAINT catalog_import_jobs_pdf_fields_check CHECK (
    source_type <> 'PDF' OR (supplier_id IS NOT NULL AND page_count IS NOT NULL AND file_sha256 IS NOT NULL)
  );
ALTER TABLE public.catalog_import_jobs
  ADD CONSTRAINT catalog_import_jobs_pdf_security_check CHECK (
    source_type <> 'PDF' OR
    (security_status='PENDING' AND security_verified_at IS NULL) OR
    (security_status='VERIFIED' AND security_verified_at IS NOT NULL) OR
    (security_status='REJECTED' AND security_verified_at IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS catalog_import_pdf_hash_active_unique
  ON public.catalog_import_jobs(supplier_id, file_sha256)
  WHERE source_type='PDF' AND status NOT IN ('FAILED','CANCELLED');

CREATE TABLE public.catalog_import_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.catalog_import_jobs(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','LEASED','EXTRACTED','NORMALIZED','FAILED')),
  extraction_method TEXT CHECK (extraction_method IN ('NATIVE','OCR','NATIVE_AND_OCR')),
  native_text_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  ocr_text_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  text_sha256 TEXT,
  text_summary VARCHAR(500),
  rendered_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  lease_token UUID,
  leased_by TEXT,
  lease_expires_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  failure_code TEXT,
  failure_message TEXT,
  purge_after TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(import_job_id,page_number),
  CHECK ((status='LEASED') = (lease_token IS NOT NULL AND leased_by IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE INDEX catalog_import_pages_queue_idx ON public.catalog_import_pages(status,lease_expires_at,created_at);
CREATE INDEX catalog_import_pages_job_idx ON public.catalog_import_pages(import_job_id,page_number);
CREATE TRIGGER catalog_import_pages_updated_at BEFORE UPDATE ON public.catalog_import_pages
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.catalog_import_rows
  DROP CONSTRAINT IF EXISTS catalog_import_rows_validation_status_check;
ALTER TABLE public.catalog_import_rows
  ADD CONSTRAINT catalog_import_rows_validation_status_check CHECK (validation_status IN (
    'PENDING','REQUIRES_REVIEW','VALID','INVALID','REJECTED','IMPORTED'
  ));

ALTER TABLE public.catalog_import_rows
  ADD COLUMN IF NOT EXISTS source_page_number INTEGER CHECK (source_page_number IS NULL OR source_page_number BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS source_bbox JSONB,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS factory_sku TEXT,
  ADD COLUMN IF NOT EXISTS name_zh TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_th_draft TEXT,
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_code CHAR(2) REFERENCES public.countries(code),
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER CHECK (lead_time_days IS NULL OR lead_time_days > 0),
  ADD COLUMN IF NOT EXISTS width_mm NUMERIC(12,2) CHECK (width_mm IS NULL OR width_mm > 0),
  ADD COLUMN IF NOT EXISTS depth_mm NUMERIC(12,2) CHECK (depth_mm IS NULL OR depth_mm > 0),
  ADD COLUMN IF NOT EXISTS height_mm NUMERIC(12,2) CHECK (height_mm IS NULL OR height_mm > 0),
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(12,3) CHECK (weight_kg IS NULL OR weight_kg > 0),
  ADD COLUMN IF NOT EXISTS cbm NUMERIC(12,4) CHECK (cbm IS NULL OR cbm > 0),
  ADD COLUMN IF NOT EXISTS material_summary TEXT,
  ADD COLUMN IF NOT EXISTS finish_summary TEXT,
  ADD COLUMN IF NOT EXISTS moq NUMERIC(12,2) CHECK (moq IS NULL OR moq > 0),
  ADD COLUMN IF NOT EXISTS description_th TEXT,
  ADD COLUMN IF NOT EXISTS specification_summary TEXT,
  ADD COLUMN IF NOT EXISTS confidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS warning_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'NOT_REVIEWED' CHECK (review_status IN ('NOT_REVIEWED','APPROVED','REJECTED')),
  ADD COLUMN IF NOT EXISTS selected_image_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_image_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_image_source_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS existing_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_product_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS imported_media_id UUID,
  ADD COLUMN IF NOT EXISTS imported_document_id UUID,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS catalog_import_rows_pdf_review_idx
  ON public.catalog_import_rows(import_job_id,review_status,validation_status,row_number);
CREATE TRIGGER catalog_import_rows_updated_at BEFORE UPDATE ON public.catalog_import_rows
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE public.catalog_import_candidate_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_row_id UUID NOT NULL REFERENCES public.catalog_import_rows(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.file_metadata(id) ON DELETE RESTRICT,
  source_page_number INTEGER NOT NULL CHECK (source_page_number BETWEEN 1 AND 100),
  source_bbox JSONB,
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  purge_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(import_row_id,file_id)
);
CREATE INDEX catalog_import_candidate_images_row_idx ON public.catalog_import_candidate_images(import_row_id,created_at);

CREATE TABLE public.catalog_import_ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.catalog_import_jobs(id) ON DELETE CASCADE,
  import_page_id UUID NOT NULL REFERENCES public.catalog_import_pages(id) ON DELETE CASCADE,
  usage_month DATE NOT NULL CHECK (usage_month=date_trunc('month',usage_month)::DATE),
  provider TEXT NOT NULL CHECK (provider='azure'),
  model TEXT NOT NULL,
  request_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('RESERVED','SUCCEEDED','FAILED','SKIPPED_BUDGET')),
  pricing_snapshot JSONB NOT NULL,
  input_token_limit INTEGER NOT NULL CHECK (input_token_limit BETWEEN 1 AND 100000),
  completion_token_limit INTEGER NOT NULL CHECK (completion_token_limit BETWEEN 1 AND 3000),
  reserved_cost_usd NUMERIC(12,6) NOT NULL CHECK (reserved_cost_usd > 0),
  prompt_tokens INTEGER CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens INTEGER CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  raw_ai_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  output_sha256 TEXT,
  error_code TEXT,
  purge_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(import_page_id)
);
CREATE INDEX catalog_import_ai_calls_job_idx ON public.catalog_import_ai_calls(import_job_id,created_at);

CREATE TABLE public.catalog_import_ai_monthly_usage (
  usage_month DATE PRIMARY KEY CHECK (usage_month = date_trunc('month',usage_month)::DATE),
  reserved_usd NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (reserved_usd >= 0),
  actual_usd NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (actual_usd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reserved_usd + actual_usd <= 50)
);

CREATE TABLE public.catalog_import_compute_monthly_usage (
  usage_month DATE PRIMARY KEY CHECK (usage_month=date_trunc('month',usage_month)::DATE),
  reserved_usd NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (reserved_usd>=0),
  actual_usd NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (actual_usd>=0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reserved_usd+actual_usd<=20)
);

CREATE TABLE public.catalog_import_compute_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_month DATE NOT NULL REFERENCES public.catalog_import_compute_monthly_usage(usage_month),
  worker_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','SUCCEEDED','FAILED')),
  reserved_usd NUMERIC(12,6) NOT NULL CHECK (reserved_usd>0 AND reserved_usd<=20),
  actual_usd NUMERIC(12,6) CHECK (actual_usd IS NULL OR (actual_usd>=0 AND actual_usd<=reserved_usd)),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX catalog_import_compute_runs_status_idx ON public.catalog_import_compute_runs(status,started_at);

ALTER TABLE public.catalog_import_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_candidate_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_ai_monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_compute_monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_import_compute_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_import_pages_read ON public.catalog_import_pages FOR SELECT TO authenticated
  USING (public.has_permission('catalog.import'));
CREATE POLICY catalog_import_candidate_images_read ON public.catalog_import_candidate_images FOR SELECT TO authenticated
  USING (public.has_permission('catalog.import'));
CREATE POLICY catalog_import_ai_calls_read ON public.catalog_import_ai_calls FOR SELECT TO authenticated
  USING (public.has_permission('catalog.import'));
CREATE POLICY catalog_import_ai_usage_read ON public.catalog_import_ai_monthly_usage FOR SELECT TO authenticated
  USING (public.has_permission('catalog.import'));
CREATE POLICY catalog_import_compute_usage_read ON public.catalog_import_compute_monthly_usage FOR SELECT TO authenticated
  USING (public.has_permission('catalog.import'));
CREATE POLICY catalog_import_compute_runs_read ON public.catalog_import_compute_runs FOR SELECT TO authenticated
  USING (public.has_permission('catalog.import'));

REVOKE ALL ON public.catalog_import_pages,public.catalog_import_candidate_images,
  public.catalog_import_ai_calls,public.catalog_import_ai_monthly_usage,public.catalog_import_compute_monthly_usage,
  public.catalog_import_compute_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.catalog_import_pages,public.catalog_import_candidate_images,
  public.catalog_import_ai_calls,public.catalog_import_ai_monthly_usage,public.catalog_import_compute_monthly_usage,
  public.catalog_import_compute_runs TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.catalog_import_jobs,public.catalog_import_rows,public.catalog_import_errors FROM authenticated;

-- PDF uploads get the approved 25 MB ceiling. Other application files remain 10 MB.
CREATE OR REPLACE FUNCTION public.guard_file_metadata_v2()
RETURNS TRIGGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE existing_count INTEGER;
BEGIN
  IF NEW.size_bytes IS NULL OR NEW.size_bytes <= 0 OR
     NEW.size_bytes > (CASE WHEN NEW.entity_type='CATALOG_IMPORT' AND NEW.mime_type='application/pdf'
                            THEN 26214400 ELSE 10485760 END) THEN
    RAISE EXCEPTION 'INVALID_FILE';
  END IF;
  IF NEW.entity_type='CATALOG_IMPORT' THEN
    IF NEW.mime_type NOT IN ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','application/pdf') THEN
      RAISE EXCEPTION 'INVALID_FILE';
    END IF;
    IF NEW.visibility<>'CONFIDENTIAL' OR NEW.bucket<>'gisp-confidential' THEN RAISE EXCEPTION 'INVALID_BUCKET'; END IF;
  ELSE
    IF NEW.mime_type NOT IN ('application/pdf','image/jpeg','image/png') AND NOT (
      NEW.entity_type IN ('CATALOG_IMPORT_NATIVE_TEXT','CATALOG_IMPORT_OCR_TEXT','CATALOG_IMPORT_AI_RAW')
      AND NEW.mime_type IN ('text/plain','application/json') AND NEW.visibility='CONFIDENTIAL'
    ) THEN RAISE EXCEPTION 'INVALID_FILE'; END IF;
    IF NEW.visibility='MEMBER_PRIVATE' AND NEW.bucket<>'gisp-member-private' THEN RAISE EXCEPTION 'INVALID_BUCKET'; END IF;
    IF NEW.visibility='CONFIDENTIAL' AND NEW.bucket<>'gisp-confidential' THEN RAISE EXCEPTION 'INVALID_BUCKET'; END IF;
  END IF;
  IF NEW.entity_type='MEMBER_APPLICATION' THEN
    IF NEW.member_profile_id IS NULL THEN RAISE EXCEPTION 'MEMBER_PROFILE_REQUIRED'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.member_profile_id::TEXT,0));
    SELECT COUNT(*) INTO existing_count FROM public.file_metadata fm
      WHERE fm.member_profile_id=NEW.member_profile_id AND fm.entity_type='MEMBER_APPLICATION';
    IF existing_count>=5 THEN RAISE EXCEPTION 'FILE_LIMIT_REACHED'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_catalog_pdf_candidate(
  import_row_id_input UUID, decision_input TEXT, warning_codes_input TEXT[] DEFAULT ARRAY[]::TEXT[]
) RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE row_record RECORD; duplicate_product UUID;
BEGIN
  IF NOT public.has_permission('catalog.import') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF decision_input NOT IN ('APPROVE','REJECT') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  SELECT r.*,j.source_type,j.status AS job_status INTO row_record FROM public.catalog_import_rows r
    JOIN public.catalog_import_jobs j ON j.id=r.import_job_id
    WHERE r.id=import_row_id_input FOR UPDATE OF r;
  IF row_record.id IS NULL OR row_record.source_type<>'PDF' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF row_record.job_status<>'READY_FOR_REVIEW' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF row_record.validation_status='IMPORTED' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF decision_input='APPROVE' THEN
    SELECT id INTO duplicate_product FROM public.products WHERE UPPER(sku)=UPPER(BTRIM(row_record.sku)) LIMIT 1;
    IF NULLIF(BTRIM(row_record.sku),'') IS NULL OR NULLIF(BTRIM(row_record.name_th_draft),'') IS NULL OR
       NULLIF(BTRIM(row_record.product_type),'') IS NULL OR row_record.product_type NOT IN ('STANDARD','CUSTOM_TEMPLATE','READY_TO_ORDER','BUILT_IN','MATERIAL','EQUIPMENT','DECORATIVE') OR
       row_record.country_code IS NULL OR NOT EXISTS(SELECT 1 FROM public.countries WHERE code=row_record.country_code) OR
       row_record.category_id IS NULL OR row_record.selected_image_file_id IS NULL OR duplicate_product IS NOT NULL OR
       EXISTS(SELECT 1 FROM public.catalog_import_rows other WHERE other.import_job_id=row_record.import_job_id AND other.id<>row_record.id
         AND NULLIF(BTRIM(other.sku),'') IS NOT NULL AND UPPER(BTRIM(other.sku))=UPPER(BTRIM(row_record.sku))) OR
       NOT EXISTS(SELECT 1 FROM public.catalog_import_candidate_images image JOIN public.file_metadata file ON file.id=image.file_id
         WHERE image.import_row_id=row_record.id AND image.file_id=row_record.selected_image_file_id
           AND file.visibility='CONFIDENTIAL' AND file.entity_type='CATALOG_IMPORT_CANDIDATE'
           AND file.entity_id=row_record.import_job_id) OR
       COALESCE(array_length(warning_codes_input,1),0)>0 THEN
      RAISE EXCEPTION 'CANDIDATE_NOT_VALID';
    END IF;
    UPDATE public.catalog_import_rows SET validation_status='VALID',review_status='APPROVED',
      warning_codes=warning_codes_input,existing_product_id=NULL,reviewed_by=(SELECT auth.uid()),reviewed_at=NOW()
      WHERE id=import_row_id_input;
  ELSE
    UPDATE public.catalog_import_rows SET validation_status='REJECTED',review_status='REJECTED',
      warning_codes=warning_codes_input,approved_image_file_id=NULL,approved_image_source_file_id=NULL,
      reviewed_by=(SELECT auth.uid()),reviewed_at=NOW()
      WHERE id=import_row_id_input;
  END IF;
  RETURN jsonb_build_object('id',import_row_id_input,'decision',decision_input);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_catalog_pdf_candidate(import_job_id_input UUID,import_row_id_input UUID,patch_input JSONB)
RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row_record RECORD; duplicate_id UUID; selected_file UUID; allowed_keys TEXT[]:=ARRAY[
  'sku','factorySku','nameZh','nameEn','nameThDraft','productType','categoryId','countryCode','leadTimeDays',
  'widthMm','depthMm','heightMm','weightKg','cbm','materialSummary','finishSummary','moq','descriptionTh',
  'specificationSummary','selectedImageFileId'];
BEGIN
  IF NOT public.has_permission('catalog.import') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF jsonb_typeof(patch_input)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch_input) key WHERE NOT key=ANY(allowed_keys)) THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  SELECT r.* INTO row_record FROM public.catalog_import_rows r JOIN public.catalog_import_jobs j ON j.id=r.import_job_id
    WHERE r.id=import_row_id_input AND j.id=import_job_id_input AND j.source_type='PDF' AND j.status='READY_FOR_REVIEW'
    FOR UPDATE OF j,r;
  IF row_record.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF row_record.validation_status='IMPORTED' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(import_job_id_input::TEXT,0));
  IF patch_input?'selectedImageFileId' THEN selected_file:=NULLIF(patch_input->>'selectedImageFileId','')::UUID;
    IF selected_file IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.catalog_import_candidate_images WHERE import_row_id=import_row_id_input AND file_id=selected_file) THEN
      RAISE EXCEPTION 'INVALID_IMAGE';
    END IF;
  ELSE selected_file:=row_record.selected_image_file_id; END IF;
  UPDATE public.catalog_import_rows SET
    sku=CASE WHEN patch_input?'sku' THEN NULLIF(BTRIM(patch_input->>'sku'),'') ELSE sku END,
    factory_sku=CASE WHEN patch_input?'factorySku' THEN NULLIF(BTRIM(patch_input->>'factorySku'),'') ELSE factory_sku END,
    name_zh=CASE WHEN patch_input?'nameZh' THEN NULLIF(BTRIM(patch_input->>'nameZh'),'') ELSE name_zh END,
    name_en=CASE WHEN patch_input?'nameEn' THEN NULLIF(BTRIM(patch_input->>'nameEn'),'') ELSE name_en END,
    name_th_draft=CASE WHEN patch_input?'nameThDraft' THEN NULLIF(BTRIM(patch_input->>'nameThDraft'),'') ELSE name_th_draft END,
    product_type=CASE WHEN patch_input?'productType' THEN UPPER(BTRIM(patch_input->>'productType')) ELSE product_type END,
    category_id=CASE WHEN patch_input?'categoryId' THEN NULLIF(patch_input->>'categoryId','')::UUID ELSE category_id END,
    country_code=CASE WHEN patch_input?'countryCode' THEN UPPER(BTRIM(patch_input->>'countryCode')) ELSE country_code END,
    lead_time_days=CASE WHEN patch_input?'leadTimeDays' THEN NULLIF(patch_input->>'leadTimeDays','')::INTEGER ELSE lead_time_days END,
    width_mm=CASE WHEN patch_input?'widthMm' THEN NULLIF(patch_input->>'widthMm','')::NUMERIC ELSE width_mm END,
    depth_mm=CASE WHEN patch_input?'depthMm' THEN NULLIF(patch_input->>'depthMm','')::NUMERIC ELSE depth_mm END,
    height_mm=CASE WHEN patch_input?'heightMm' THEN NULLIF(patch_input->>'heightMm','')::NUMERIC ELSE height_mm END,
    weight_kg=CASE WHEN patch_input?'weightKg' THEN NULLIF(patch_input->>'weightKg','')::NUMERIC ELSE weight_kg END,
    cbm=CASE WHEN patch_input?'cbm' THEN NULLIF(patch_input->>'cbm','')::NUMERIC ELSE cbm END,
    material_summary=CASE WHEN patch_input?'materialSummary' THEN NULLIF(BTRIM(patch_input->>'materialSummary'),'') ELSE material_summary END,
    finish_summary=CASE WHEN patch_input?'finishSummary' THEN NULLIF(BTRIM(patch_input->>'finishSummary'),'') ELSE finish_summary END,
    moq=CASE WHEN patch_input?'moq' THEN NULLIF(patch_input->>'moq','')::NUMERIC ELSE moq END,
    description_th=CASE WHEN patch_input?'descriptionTh' THEN NULLIF(BTRIM(patch_input->>'descriptionTh'),'') ELSE description_th END,
    specification_summary=CASE WHEN patch_input?'specificationSummary' THEN NULLIF(BTRIM(patch_input->>'specificationSummary'),'') ELSE specification_summary END,
    selected_image_file_id=selected_file,
    approved_image_file_id=CASE WHEN patch_input?'selectedImageFileId' AND selected_file IS DISTINCT FROM selected_image_file_id THEN NULL ELSE approved_image_file_id END,
    approved_image_source_file_id=CASE WHEN patch_input?'selectedImageFileId' AND selected_file IS DISTINCT FROM selected_image_file_id THEN NULL ELSE approved_image_source_file_id END,
    review_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,
    warning_codes=array_remove(array_remove(warning_codes,'DUPLICATE_SKU'),'DUPLICATE_SKU_IN_FILE'),validation_status='REQUIRES_REVIEW',
    source_data=source_data||patch_input
  WHERE id=import_row_id_input;
  SELECT id INTO duplicate_id FROM public.products WHERE UPPER(sku)=UPPER(BTRIM((SELECT sku FROM public.catalog_import_rows WHERE id=import_row_id_input))) LIMIT 1;
  IF duplicate_id IS NOT NULL THEN
    UPDATE public.catalog_import_rows SET validation_status='INVALID',existing_product_id=duplicate_id,warning_codes=array_append(warning_codes,'DUPLICATE_SKU') WHERE id=import_row_id_input;
  ELSE UPDATE public.catalog_import_rows SET existing_product_id=NULL WHERE id=import_row_id_input; END IF;
  IF EXISTS(SELECT 1 FROM public.catalog_import_rows current_row JOIN public.catalog_import_rows other
      ON other.import_job_id=current_row.import_job_id AND other.id<>current_row.id
      AND NULLIF(BTRIM(other.sku),'') IS NOT NULL AND UPPER(BTRIM(other.sku))=UPPER(BTRIM(current_row.sku))
      WHERE current_row.id=import_row_id_input) THEN
    UPDATE public.catalog_import_rows SET validation_status='INVALID',review_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,
      warning_codes=CASE WHEN 'DUPLICATE_SKU_IN_FILE'=ANY(warning_codes) THEN warning_codes ELSE array_append(warning_codes,'DUPLICATE_SKU_IN_FILE') END
      WHERE import_job_id=import_job_id_input AND NULLIF(BTRIM(sku),'') IS NOT NULL
        AND UPPER(BTRIM(sku))=UPPER(BTRIM((SELECT sku FROM public.catalog_import_rows WHERE id=import_row_id_input)));
  END IF;
  IF EXISTS(SELECT 1 FROM public.catalog_import_rows WHERE id=import_row_id_input AND
    (LENGTH(COALESCE(sku,''))>120 OR LENGTH(COALESCE(name_th_draft,''))>5000 OR LENGTH(COALESCE(name_en,''))>5000 OR LENGTH(COALESCE(name_zh,''))>5000)) THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  RETURN (SELECT to_jsonb(r) FROM public.catalog_import_rows r WHERE r.id=import_row_id_input);
END; $$;

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
     pricing_snapshot_input->>'model'<>'openai/gpt-4o-mini' OR pricing_snapshot_input->>'provider'<>'azure' OR
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

CREATE OR REPLACE FUNCTION public.reserve_catalog_pdf_compute_run(worker_id_input TEXT,reserved_usd_input NUMERIC)
RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE month_key DATE:=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE; usage_record RECORD; stale_record RECORD; run_id UUID;
BEGIN
  IF NULLIF(BTRIM(worker_id_input),'') IS NULL OR reserved_usd_input<=0 OR reserved_usd_input>20 THEN RAISE EXCEPTION 'INVALID_RESERVATION'; END IF;
  FOR stale_record IN SELECT * FROM public.catalog_import_compute_runs
    WHERE status='RESERVED' AND started_at<NOW()-INTERVAL '30 minutes' FOR UPDATE
  LOOP
    UPDATE public.catalog_import_compute_monthly_usage SET reserved_usd=GREATEST(0,reserved_usd-stale_record.reserved_usd),
      actual_usd=actual_usd+stale_record.reserved_usd,updated_at=NOW() WHERE usage_month=stale_record.usage_month;
    UPDATE public.catalog_import_compute_runs SET status='FAILED',actual_usd=reserved_usd,completed_at=NOW() WHERE id=stale_record.id;
  END LOOP;
  INSERT INTO public.catalog_import_compute_monthly_usage(usage_month) VALUES(month_key) ON CONFLICT DO NOTHING;
  SELECT * INTO usage_record FROM public.catalog_import_compute_monthly_usage WHERE usage_month=month_key FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.catalog_import_compute_runs WHERE status='RESERVED' AND started_at>=NOW()-INTERVAL '30 minutes') THEN
    RAISE EXCEPTION 'COMPUTE_RUN_ALREADY_ACTIVE';
  END IF;
  IF usage_record.actual_usd+usage_record.reserved_usd+reserved_usd_input>20 THEN RAISE EXCEPTION 'MONTHLY_COMPUTE_BUDGET_EXCEEDED'; END IF;
  INSERT INTO public.catalog_import_compute_runs(usage_month,worker_id,reserved_usd)
    VALUES(month_key,worker_id_input,reserved_usd_input) RETURNING id INTO run_id;
  UPDATE public.catalog_import_compute_monthly_usage SET reserved_usd=reserved_usd+reserved_usd_input,updated_at=NOW() WHERE usage_month=month_key;
  RETURN jsonb_build_object('runId',run_id,'reservedUsd',reserved_usd_input,
    'projectedUsd',usage_record.actual_usd+usage_record.reserved_usd+reserved_usd_input,
    'warning80Percent',usage_record.actual_usd+usage_record.reserved_usd+reserved_usd_input>=16);
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_catalog_pdf_compute_run(
  run_id_input UUID,actual_usd_input NUMERIC,succeeded_input BOOLEAN,job_ids_input UUID[] DEFAULT ARRAY[]::UUID[]
) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE run_record RECORD; job_count INTEGER;
BEGIN
  SELECT * INTO run_record FROM public.catalog_import_compute_runs WHERE id=run_id_input FOR UPDATE;
  IF run_record.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF run_record.status<>'RESERVED' THEN RETURN jsonb_build_object('id',run_id_input,'status',run_record.status,'idempotent',TRUE); END IF;
  IF actual_usd_input<0 OR actual_usd_input>run_record.reserved_usd THEN RAISE EXCEPTION 'COMPUTE_ACTUAL_COST_INVALID'; END IF;
  PERFORM 1 FROM public.catalog_import_compute_monthly_usage WHERE usage_month=run_record.usage_month FOR UPDATE;
  UPDATE public.catalog_import_compute_monthly_usage SET reserved_usd=GREATEST(0,reserved_usd-run_record.reserved_usd),
    actual_usd=actual_usd+actual_usd_input,updated_at=NOW() WHERE usage_month=run_record.usage_month;
  UPDATE public.catalog_import_compute_runs SET status=CASE WHEN succeeded_input THEN 'SUCCEEDED' ELSE 'FAILED' END,
    actual_usd=actual_usd_input,completed_at=NOW() WHERE id=run_id_input;
  SELECT COUNT(DISTINCT id) INTO job_count FROM public.catalog_import_jobs WHERE id=ANY(job_ids_input) AND source_type='PDF';
  IF job_count>0 AND actual_usd_input>0 THEN
    UPDATE public.catalog_import_jobs SET compute_cost_usd=compute_cost_usd+(actual_usd_input/job_count)
      WHERE id=ANY(job_ids_input) AND source_type='PDF';
  END IF;
  RETURN jsonb_build_object('id',run_id_input,'status',CASE WHEN succeeded_input THEN 'SUCCEEDED' ELSE 'FAILED' END,'actualUsd',actual_usd_input);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_catalog_pdf_pages(worker_id_input TEXT,limit_input INTEGER DEFAULT 4)
RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE claimed JSONB;
BEGIN
  IF NULLIF(BTRIM(worker_id_input),'') IS NULL OR limit_input<1 OR limit_input>4 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  WITH candidates AS (
    SELECT p.id FROM public.catalog_import_pages p JOIN public.catalog_import_jobs j ON j.id=p.import_job_id
    WHERE j.source_type='PDF' AND j.status IN ('QUEUED','EXTRACTING') AND
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

CREATE OR REPLACE FUNCTION public.mark_catalog_pdf_job_verified(
  import_job_id_input UUID,import_page_id_input UUID,lease_token_input UUID,worker_id_input TEXT
) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE job_record RECORD;
BEGIN
  SELECT j.id,j.source_type,j.status,j.security_status,p.lease_token,p.leased_by,p.lease_expires_at
    INTO job_record FROM public.catalog_import_jobs j JOIN public.catalog_import_pages p ON p.import_job_id=j.id
    WHERE j.id=import_job_id_input AND p.id=import_page_id_input FOR UPDATE OF j,p;
  IF job_record.id IS NULL OR job_record.source_type<>'PDF' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF job_record.status IN ('FAILED','CANCELLED','IMPORTING','COMPLETED','COMPLETED_WITH_ISSUES') OR job_record.security_status='REJECTED' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  IF job_record.lease_token<>lease_token_input OR job_record.leased_by<>worker_id_input OR job_record.lease_expires_at<NOW() THEN
    RAISE EXCEPTION 'LEASE_INVALID';
  END IF;
  UPDATE public.catalog_import_jobs SET security_status='VERIFIED',security_verified_at=COALESCE(security_verified_at,NOW())
    WHERE id=import_job_id_input;
  RETURN jsonb_build_object('id',import_job_id_input,'securityStatus','VERIFIED');
END; $$;

CREATE OR REPLACE FUNCTION public.complete_catalog_pdf_page(
  import_page_id_input UUID,lease_token_input UUID,worker_id_input TEXT,extraction_method_input TEXT,
  native_text_file_id_input UUID,ocr_text_file_id_input UUID,text_sha256_input TEXT,text_summary_input TEXT,
  rendered_file_id_input UUID,candidates_input JSONB,ai_success_input BOOLEAN DEFAULT FALSE,
  ai_cost_usd_input NUMERIC DEFAULT 0,raw_ai_file_id_input UUID DEFAULT NULL,ai_output_sha256_input TEXT DEFAULT NULL,ai_error_code_input TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE page_record RECORD; candidate JSONB; next_row INTEGER; duplicate_id UUID; duplicate_row_id UUID; category_id_value UUID; warnings TEXT[]; created_count INTEGER:=0; created_row_id UUID;
  reserved_cost NUMERIC:=0; reserved_month DATE; totals RECORD;
BEGIN
  IF extraction_method_input NOT IN ('NATIVE','OCR','NATIVE_AND_OCR') OR jsonb_typeof(candidates_input)<>'array' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT p.*,j.supplier_id,j.security_status INTO page_record FROM public.catalog_import_pages p
    JOIN public.catalog_import_jobs j ON j.id=p.import_job_id WHERE p.id=import_page_id_input FOR UPDATE OF p;
  IF page_record.id IS NULL OR page_record.status<>'LEASED' OR page_record.lease_token<>lease_token_input OR
     page_record.leased_by<>worker_id_input OR page_record.lease_expires_at<NOW() THEN RAISE EXCEPTION 'LEASE_INVALID'; END IF;
  IF page_record.security_status<>'VERIFIED' THEN RAISE EXCEPTION 'SECURITY_NOT_VERIFIED'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY[native_text_file_id_input,ocr_text_file_id_input,rendered_file_id_input,raw_ai_file_id_input]) artifact_id
      WHERE artifact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.file_metadata file
        WHERE file.id=artifact_id AND file.entity_id=page_record.import_job_id AND file.visibility='CONFIDENTIAL'
          AND file.entity_type IN ('CATALOG_IMPORT_NATIVE_TEXT','CATALOG_IMPORT_OCR_TEXT','CATALOG_IMPORT_PAGE','CATALOG_IMPORT_AI_RAW'))) THEN
    RAISE EXCEPTION 'INVALID_PAGE_ARTIFACT';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(page_record.import_job_id::TEXT,0));
  SELECT COALESCE(MAX(row_number),0) INTO next_row FROM public.catalog_import_rows WHERE import_job_id=page_record.import_job_id;
  FOR candidate IN SELECT value FROM jsonb_array_elements(candidates_input)
  LOOP
    next_row:=next_row+1; duplicate_id:=NULL; duplicate_row_id:=NULL; category_id_value:=NULL; warnings:=ARRAY(SELECT jsonb_array_elements_text(COALESCE(candidate->'warningCodes','[]'::JSONB)));
    IF NULLIF(BTRIM(candidate->>'sku'),'') IS NOT NULL THEN
      SELECT id INTO duplicate_id FROM public.products WHERE UPPER(sku)=UPPER(BTRIM(candidate->>'sku')) LIMIT 1;
      SELECT id INTO duplicate_row_id FROM public.catalog_import_rows WHERE import_job_id=page_record.import_job_id
        AND NULLIF(BTRIM(sku),'') IS NOT NULL AND UPPER(BTRIM(sku))=UPPER(BTRIM(candidate->>'sku')) LIMIT 1;
    END IF;
    IF duplicate_id IS NOT NULL THEN warnings:=array_append(warnings,'DUPLICATE_SKU'); END IF;
    IF duplicate_row_id IS NOT NULL THEN warnings:=array_append(warnings,'DUPLICATE_SKU_IN_FILE'); END IF;
    IF NULLIF(BTRIM(candidate->>'nameThDraft'),'') IS NOT NULL THEN warnings:=array_append(warnings,'THAI_NAME_REVIEW_REQUIRED'); END IF;
    IF NULLIF(BTRIM(candidate->>'productType'),'') IS NULL THEN warnings:=array_append(warnings,'PRODUCT_TYPE_REQUIRED'); END IF;
    IF NULLIF(BTRIM(candidate->>'countryCode'),'') IS NULL THEN warnings:=array_append(warnings,'COUNTRY_REQUIRED'); END IF;
    IF NULLIF(candidate->>'categoryId','') IS NULL THEN warnings:=array_append(warnings,'CATEGORY_REQUIRED'); END IF;
    IF NULLIF(candidate->>'imageFileId','') IS NULL THEN warnings:=array_append(warnings,'IMAGE_REQUIRED'); END IF;
    IF NULLIF(candidate->>'imageFileId','') IS NOT NULL THEN
      IF candidate->>'imageFileId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'INVALID_CANDIDATE_IMAGE';
      ELSIF NOT EXISTS(SELECT 1 FROM public.file_metadata image_file WHERE image_file.id=(candidate->>'imageFileId')::UUID
          AND image_file.entity_id=page_record.import_job_id AND image_file.visibility='CONFIDENTIAL'
          AND image_file.entity_type='CATALOG_IMPORT_CANDIDATE') THEN
        RAISE EXCEPTION 'INVALID_CANDIDATE_IMAGE';
      END IF;
    END IF;
    IF NULLIF(candidate->>'categoryId','') IS NOT NULL THEN
      IF candidate->>'categoryId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        SELECT id INTO category_id_value FROM public.categories WHERE id=(candidate->>'categoryId')::UUID AND status='ACTIVE';
      END IF;
      IF category_id_value IS NULL THEN warnings:=array_append(warnings,'CATEGORY_REVIEW_REQUIRED'); END IF;
    END IF;
    INSERT INTO public.catalog_import_rows(import_job_id,row_number,source_data,validation_status,source_page_number,source_bbox,
      sku,factory_sku,name_zh,name_en,name_th_draft,product_type,category_id,country_code,lead_time_days,width_mm,depth_mm,height_mm,
      weight_kg,cbm,material_summary,finish_summary,moq,description_th,specification_summary,confidence,warning_codes,existing_product_id,selected_image_file_id)
    VALUES(page_record.import_job_id,next_row,candidate,CASE WHEN duplicate_id IS NULL AND duplicate_row_id IS NULL THEN 'REQUIRES_REVIEW' ELSE 'INVALID' END,
      page_record.page_number,candidate->'sourceBbox',NULLIF(BTRIM(candidate->>'sku'),''),NULLIF(BTRIM(candidate->>'factorySku'),''),
      NULLIF(BTRIM(candidate->>'nameZh'),''),NULLIF(BTRIM(candidate->>'nameEn'),''),NULLIF(BTRIM(candidate->>'nameThDraft'),''),
      NULLIF(UPPER(BTRIM(candidate->>'productType')),''),category_id_value,
      NULLIF(UPPER(BTRIM(candidate->>'countryCode')),''),NULLIF(candidate->>'leadTimeDays','')::INTEGER,
      NULLIF(candidate->>'widthMm','')::NUMERIC,NULLIF(candidate->>'depthMm','')::NUMERIC,NULLIF(candidate->>'heightMm','')::NUMERIC,
      NULLIF(candidate->>'weightKg','')::NUMERIC,NULLIF(candidate->>'cbm','')::NUMERIC,NULLIF(candidate->>'materialSummary',''),
      NULLIF(candidate->>'finishSummary',''),NULLIF(candidate->>'moq','')::NUMERIC,NULLIF(candidate->>'descriptionTh',''),
      NULLIF(candidate->>'specificationSummary',''),COALESCE(candidate->'confidence','{}'::JSONB),warnings,duplicate_id,
      NULLIF(candidate->>'imageFileId','')::UUID) RETURNING id INTO created_row_id;
    IF duplicate_row_id IS NOT NULL THEN
      UPDATE public.catalog_import_rows SET validation_status='INVALID',review_status='NOT_REVIEWED',reviewed_by=NULL,reviewed_at=NULL,
        warning_codes=CASE WHEN 'DUPLICATE_SKU_IN_FILE'=ANY(warning_codes) THEN warning_codes ELSE array_append(warning_codes,'DUPLICATE_SKU_IN_FILE') END
        WHERE id=duplicate_row_id;
    END IF;
    IF NULLIF(candidate->>'imageFileId','') IS NOT NULL THEN
      INSERT INTO public.catalog_import_candidate_images(import_row_id,file_id,source_page_number,source_bbox,confidence,purge_after)
      VALUES(created_row_id,(candidate->>'imageFileId')::UUID,page_record.page_number,candidate->'sourceBbox',
        NULLIF(candidate->>'imageConfidence','')::NUMERIC,NULL);
    END IF;
    created_count:=created_count+1;
  END LOOP;
  UPDATE public.catalog_import_pages SET status='NORMALIZED',extraction_method=extraction_method_input,
    native_text_file_id=native_text_file_id_input,ocr_text_file_id=ocr_text_file_id_input,text_sha256=text_sha256_input,
    text_summary=LEFT(text_summary_input,500),rendered_file_id=rendered_file_id_input,lease_token=NULL,leased_by=NULL,lease_expires_at=NULL,completed_at=NOW(),purge_after=NULL
    WHERE id=import_page_id_input;
  SELECT reserved_cost_usd,usage_month INTO reserved_cost,reserved_month FROM public.catalog_import_ai_calls WHERE import_page_id=import_page_id_input AND status='RESERVED' FOR UPDATE;
  IF FOUND THEN
    IF ai_cost_usd_input<0 OR ai_cost_usd_input>reserved_cost THEN RAISE EXCEPTION 'AI_ACTUAL_COST_INVALID'; END IF;
    UPDATE public.catalog_import_ai_calls SET status=CASE WHEN ai_success_input THEN 'SUCCEEDED' ELSE 'FAILED' END,
      cost_usd=ai_cost_usd_input,raw_ai_file_id=raw_ai_file_id_input,output_sha256=ai_output_sha256_input,error_code=ai_error_code_input,completed_at=NOW()
      WHERE import_page_id=import_page_id_input;
    UPDATE public.catalog_import_ai_monthly_usage SET reserved_usd=GREATEST(0,reserved_usd-reserved_cost),
      actual_usd=actual_usd+ai_cost_usd_input,updated_at=NOW() WHERE usage_month=reserved_month;
    UPDATE public.catalog_import_jobs SET ai_cost_usd=ai_cost_usd+ai_cost_usd_input,
      model_version='openai/gpt-4o-mini' WHERE id=page_record.import_job_id;
  END IF;
  SELECT COUNT(*) FILTER(WHERE status='NORMALIZED') AS done,COUNT(*) AS total,
    COUNT(*) FILTER(WHERE status='FAILED') AS failed INTO totals FROM public.catalog_import_pages WHERE import_job_id=page_record.import_job_id;
  UPDATE public.catalog_import_jobs SET processed_pages=totals.done+totals.failed,last_heartbeat_at=NOW(),
    status=CASE WHEN totals.done+totals.failed=totals.total THEN 'READY_FOR_REVIEW' ELSE 'NORMALIZING' END,
    total_rows=(SELECT COUNT(*) FROM public.catalog_import_rows WHERE import_job_id=page_record.import_job_id),
    valid_rows=(SELECT COUNT(*) FROM public.catalog_import_rows WHERE import_job_id=page_record.import_job_id AND validation_status='VALID'),
    invalid_rows=(SELECT COUNT(*) FROM public.catalog_import_rows WHERE import_job_id=page_record.import_job_id AND validation_status IN ('INVALID','REJECTED'))
    WHERE id=page_record.import_job_id;
  RETURN jsonb_build_object('created',created_count,'processedPages',totals.done+totals.failed,'totalPages',totals.total);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_catalog_pdf_page(
  import_page_id_input UUID,lease_token_input UUID,worker_id_input TEXT,failure_code_input TEXT,failure_message_input TEXT
) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE page_record RECORD; totals RECORD; reserved_cost NUMERIC:=0; reserved_month DATE;
BEGIN
  SELECT * INTO page_record FROM public.catalog_import_pages WHERE id=import_page_id_input FOR UPDATE;
  IF page_record.id IS NULL OR page_record.lease_token<>lease_token_input OR page_record.leased_by<>worker_id_input THEN RAISE EXCEPTION 'LEASE_INVALID'; END IF;
  UPDATE public.catalog_import_pages SET status=CASE WHEN attempts>=3 THEN 'FAILED' ELSE 'PENDING' END,
    failure_code=failure_code_input,failure_message=LEFT(failure_message_input,1000),lease_token=NULL,leased_by=NULL,lease_expires_at=NULL,
    completed_at=CASE WHEN attempts>=3 THEN NOW() ELSE NULL END,purge_after=CASE WHEN attempts>=3 THEN NOW()+INTERVAL '30 days' ELSE NULL END
    WHERE id=import_page_id_input;
  SELECT reserved_cost_usd,usage_month INTO reserved_cost,reserved_month FROM public.catalog_import_ai_calls WHERE import_page_id=import_page_id_input AND status='RESERVED' FOR UPDATE;
  IF FOUND THEN
    UPDATE public.catalog_import_ai_calls SET status='FAILED',error_code=COALESCE(failure_code_input,'PAGE_PROCESSING_FAILED'),completed_at=NOW()
      WHERE import_page_id=import_page_id_input;
    UPDATE public.catalog_import_ai_monthly_usage SET reserved_usd=GREATEST(0,reserved_usd-reserved_cost),actual_usd=actual_usd+reserved_cost,updated_at=NOW()
      WHERE usage_month=reserved_month;
    UPDATE public.catalog_import_jobs SET ai_cost_usd=ai_cost_usd+reserved_cost,model_version='openai/gpt-4o-mini'
      WHERE id=page_record.import_job_id;
  END IF;
  UPDATE public.catalog_import_jobs SET last_heartbeat_at=NOW(),status=CASE WHEN page_record.attempts>=3 THEN 'NORMALIZING' ELSE 'QUEUED' END
    WHERE id=page_record.import_job_id;
  SELECT COUNT(*) FILTER(WHERE status IN ('NORMALIZED','FAILED')) AS done,COUNT(*) AS total INTO totals
    FROM public.catalog_import_pages WHERE import_job_id=page_record.import_job_id;
  IF totals.done=totals.total THEN
    UPDATE public.catalog_import_jobs SET status='READY_FOR_REVIEW',processed_pages=totals.done,last_heartbeat_at=NOW()
      WHERE id=page_record.import_job_id;
  END IF;
  RETURN jsonb_build_object('retry',page_record.attempts<3);
END; $$;

CREATE OR REPLACE FUNCTION public.fail_catalog_pdf_job_security(import_job_id_input UUID,failure_code_input TEXT)
RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE job_record RECORD; ai_call_record RECORD; reserved_total NUMERIC:=0;
BEGIN
  IF failure_code_input NOT IN ('MALWARE_DETECTED','MALWARE_SCAN_UNAVAILABLE','ENCRYPTED_PDF','MALFORMED_PDF','PDF_PORTFOLIO_NOT_ALLOWED') THEN
    RAISE EXCEPTION 'INVALID_SECURITY_FAILURE';
  END IF;
  SELECT * INTO job_record FROM public.catalog_import_jobs WHERE id=import_job_id_input AND source_type='PDF' FOR UPDATE;
  IF job_record.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF job_record.status='FAILED' AND job_record.failure_code=failure_code_input THEN
    RETURN jsonb_build_object('id',import_job_id_input,'status','FAILED','idempotent',TRUE);
  END IF;
  IF job_record.status IN ('IMPORTING','COMPLETED','COMPLETED_WITH_ISSUES') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  -- A security rejection is terminal. Conservatively recognize every in-flight
  -- reservation because the provider charge outcome may be unknown.
  FOR ai_call_record IN SELECT * FROM public.catalog_import_ai_calls
    WHERE import_job_id=import_job_id_input AND status='RESERVED' FOR UPDATE
  LOOP
    UPDATE public.catalog_import_ai_monthly_usage
      SET reserved_usd=GREATEST(0,reserved_usd-ai_call_record.reserved_cost_usd),
          actual_usd=actual_usd+ai_call_record.reserved_cost_usd,updated_at=NOW()
      WHERE usage_month=ai_call_record.usage_month;
    UPDATE public.catalog_import_ai_calls SET status='FAILED',error_code=failure_code_input,completed_at=NOW()
      WHERE id=ai_call_record.id;
    reserved_total:=reserved_total+ai_call_record.reserved_cost_usd;
  END LOOP;
  UPDATE public.catalog_import_jobs SET status='FAILED',failure_code=failure_code_input,
    failure_message='PDF rejected by security verification',completed_at=NOW(),total_rows=0,valid_rows=0,invalid_rows=0,
    ai_cost_usd=ai_cost_usd+reserved_total,security_status='REJECTED',security_verified_at=NULL WHERE id=import_job_id_input;
  UPDATE public.catalog_import_pages SET status='FAILED',lease_token=NULL,leased_by=NULL,lease_expires_at=NULL,
    failure_code=failure_code_input,failure_message='PDF rejected by security verification',completed_at=NOW(),purge_after=NOW()+INTERVAL '30 days'
    WHERE import_job_id=import_job_id_input AND status IN ('PENDING','LEASED','EXTRACTED','NORMALIZED');
  UPDATE public.catalog_import_pages SET purge_after=NOW()+INTERVAL '30 days' WHERE import_job_id=import_job_id_input;
  UPDATE public.catalog_import_candidate_images image SET purge_after=NOW()+INTERVAL '30 days'
    FROM public.catalog_import_rows row_record WHERE image.import_row_id=row_record.id AND row_record.import_job_id=import_job_id_input;
  UPDATE public.catalog_import_ai_calls SET purge_after=NOW()+INTERVAL '30 days' WHERE import_job_id=import_job_id_input;
  DELETE FROM public.catalog_import_rows WHERE import_job_id=import_job_id_input AND validation_status<>'IMPORTED';
  UPDATE public.file_metadata SET entity_type='CATALOG_IMPORT_QUARANTINE' WHERE id=job_record.source_file_id AND visibility='CONFIDENTIAL';
  RETURN jsonb_build_object('id',import_job_id_input,'status','FAILED','failureCode',failure_code_input);
END; $$;

CREATE OR REPLACE FUNCTION public.recover_catalog_pdf_pages()
RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE recovered INTEGER;
BEGIN
  UPDATE public.catalog_import_pages SET status=CASE WHEN attempts>=3 THEN 'FAILED' ELSE 'PENDING' END,
    failure_code='LEASE_EXPIRED',failure_message='Worker lease expired',lease_token=NULL,leased_by=NULL,lease_expires_at=NULL
    WHERE status='LEASED' AND lease_expires_at<NOW();
  GET DIAGNOSTICS recovered=ROW_COUNT;
  UPDATE public.catalog_import_jobs j SET status='QUEUED',last_heartbeat_at=NOW() WHERE j.source_type='PDF' AND j.status IN ('EXTRACTING','NORMALIZING')
    AND EXISTS(SELECT 1 FROM public.catalog_import_pages p WHERE p.import_job_id=j.id AND p.status='PENDING');
  RETURN jsonb_build_object('recovered',recovered);
END; $$;

CREATE OR REPLACE FUNCTION public.list_catalog_pdf_expired_files(limit_input INTEGER DEFAULT 100)
RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(item),'[]'::JSONB) INTO result FROM (
    SELECT DISTINCT jsonb_build_object('fileId',expired_files.id,'bucket',expired_files.bucket,'key',expired_files.object_key) AS item
    FROM (
      SELECT f.id,f.bucket,f.object_key FROM public.catalog_import_candidate_images i
      JOIN public.catalog_import_rows r ON r.id=i.import_row_id JOIN public.catalog_import_jobs j ON j.id=r.import_job_id
      JOIN public.file_metadata f ON f.id=i.file_id
      WHERE i.purge_after<NOW() AND j.status IN ('COMPLETED','COMPLETED_WITH_ISSUES','FAILED','CANCELLED')
        AND NOT EXISTS(SELECT 1 FROM public.product_media pm WHERE pm.file_id=i.file_id)
      UNION
      SELECT f.id,f.bucket,f.object_key FROM public.catalog_import_pages p
      JOIN public.catalog_import_jobs j ON j.id=p.import_job_id JOIN public.file_metadata f ON f.id=p.rendered_file_id
      WHERE p.purge_after<NOW() AND j.status IN ('COMPLETED','COMPLETED_WITH_ISSUES','FAILED','CANCELLED')
      UNION
      SELECT f.id,f.bucket,f.object_key FROM public.catalog_import_pages p
      JOIN public.catalog_import_jobs j ON j.id=p.import_job_id JOIN public.file_metadata f
        ON f.id IN (p.native_text_file_id,p.ocr_text_file_id)
      WHERE p.purge_after<NOW() AND j.status IN ('COMPLETED','COMPLETED_WITH_ISSUES','FAILED','CANCELLED')
      UNION
      SELECT f.id,f.bucket,f.object_key FROM public.catalog_import_ai_calls call_record
      JOIN public.catalog_import_jobs j ON j.id=call_record.import_job_id JOIN public.file_metadata f ON f.id=call_record.raw_ai_file_id
      WHERE call_record.purge_after<NOW() AND j.status IN ('COMPLETED','COMPLETED_WITH_ISSUES','FAILED','CANCELLED')
      UNION
      SELECT f.id,f.bucket,f.object_key FROM public.file_metadata f
      JOIN public.catalog_import_jobs orphan_job ON orphan_job.id=f.entity_id
      WHERE f.entity_type IN ('CATALOG_IMPORT_CANDIDATE','CATALOG_IMPORT_PAGE','CATALOG_IMPORT_NATIVE_TEXT','CATALOG_IMPORT_OCR_TEXT','CATALOG_IMPORT_AI_RAW','CATALOG_IMPORT_APPROVED_IMAGE')
        AND orphan_job.status IN ('COMPLETED','COMPLETED_WITH_ISSUES','FAILED','CANCELLED')
        AND COALESCE(orphan_job.completed_at,orphan_job.cancelled_at,orphan_job.updated_at)<NOW()-INTERVAL '30 days'
        AND NOT EXISTS(SELECT 1 FROM public.catalog_import_candidate_images i WHERE i.file_id=f.id)
        AND NOT EXISTS(SELECT 1 FROM public.catalog_import_pages p WHERE p.rendered_file_id=f.id)
        AND NOT EXISTS(SELECT 1 FROM public.catalog_import_pages p WHERE f.id IN (p.native_text_file_id,p.ocr_text_file_id))
        AND NOT EXISTS(SELECT 1 FROM public.catalog_import_ai_calls call_record WHERE call_record.raw_ai_file_id=f.id)
        AND NOT EXISTS(SELECT 1 FROM public.catalog_import_rows row_record WHERE row_record.approved_image_file_id=f.id)
        AND NOT EXISTS(SELECT 1 FROM public.product_media pm WHERE pm.file_id=f.id)
    ) expired_files
    LIMIT GREATEST(1,LEAST(limit_input,500))
  ) expired;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_catalog_pdf_expired_file(file_id_input UUID)
RETURNS BOOLEAN LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.product_media WHERE file_id=file_id_input) THEN RETURN FALSE; END IF;
  UPDATE public.catalog_import_pages SET rendered_file_id=NULL WHERE rendered_file_id=file_id_input AND purge_after<NOW();
  UPDATE public.catalog_import_pages SET native_text_file_id=NULL WHERE native_text_file_id=file_id_input AND purge_after<NOW();
  UPDATE public.catalog_import_pages SET ocr_text_file_id=NULL WHERE ocr_text_file_id=file_id_input AND purge_after<NOW();
  UPDATE public.catalog_import_ai_calls SET raw_ai_file_id=NULL WHERE raw_ai_file_id=file_id_input AND purge_after<NOW();
  DELETE FROM public.catalog_import_candidate_images WHERE file_id=file_id_input AND purge_after<NOW();
  IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM public.file_metadata WHERE id=file_id_input AND entity_type IN ('CATALOG_IMPORT_CANDIDATE','CATALOG_IMPORT_PAGE','CATALOG_IMPORT_NATIVE_TEXT','CATALOG_IMPORT_OCR_TEXT','CATALOG_IMPORT_AI_RAW','CATALOG_IMPORT_APPROVED_IMAGE')) THEN RETURN FALSE; END IF;
  DELETE FROM public.file_metadata WHERE id=file_id_input AND entity_type IN ('CATALOG_IMPORT_CANDIDATE','CATALOG_IMPORT_PAGE','CATALOG_IMPORT_NATIVE_TEXT','CATALOG_IMPORT_OCR_TEXT','CATALOG_IMPORT_AI_RAW','CATALOG_IMPORT_APPROVED_IMAGE');
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.stage_catalog_pdf_product_image(
  import_job_id_input UUID,import_row_id_input UUID,source_file_id_input UUID,durable_file_id_input UUID
) RETURNS BOOLEAN LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE staged_row RECORD;
BEGIN
  SELECT row_record.id,row_record.approved_image_file_id,row_record.approved_image_source_file_id INTO staged_row
    FROM public.catalog_import_rows row_record
    JOIN public.catalog_import_jobs job ON job.id=row_record.import_job_id AND job.source_type='PDF' AND job.status='READY_FOR_REVIEW'
    JOIN public.catalog_import_candidate_images image ON image.import_row_id=row_record.id AND image.file_id=source_file_id_input
    JOIN public.file_metadata source_file ON source_file.id=source_file_id_input
    JOIN public.file_metadata durable_file ON durable_file.id=durable_file_id_input
    WHERE row_record.id=import_row_id_input AND row_record.import_job_id=import_job_id_input
      AND row_record.selected_image_file_id=source_file_id_input AND row_record.validation_status<>'IMPORTED'
      AND source_file.visibility='CONFIDENTIAL' AND source_file.entity_type='CATALOG_IMPORT_CANDIDATE'
      AND source_file.entity_id=import_job_id_input
      AND durable_file.visibility='CONFIDENTIAL' AND durable_file.entity_type='CATALOG_IMPORT_APPROVED_IMAGE'
      AND durable_file.entity_id=import_job_id_input AND durable_file.organization_id=source_file.organization_id
    FOR UPDATE OF job,row_record;
  IF staged_row.id IS NULL THEN RAISE EXCEPTION 'INVALID_DURABLE_IMAGE'; END IF;
  IF staged_row.approved_image_file_id=durable_file_id_input AND staged_row.approved_image_source_file_id=source_file_id_input THEN
    RETURN TRUE;
  END IF;
  UPDATE public.catalog_import_rows SET approved_image_file_id=durable_file_id_input,
    approved_image_source_file_id=source_file_id_input WHERE id=import_row_id_input;
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.execute_catalog_pdf_import_job(import_job_id_input UUID,row_ids_input UUID[] DEFAULT NULL)
RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE job_record RECORD; row_record RECORD; product_id_value UUID; media_id_value UUID; document_id_value UUID; imported_count INTEGER:=0; failed_count INTEGER:=0; remaining_count INTEGER:=0; issue_count INTEGER:=0;
BEGIN
  IF NOT public.has_permission('catalog.import') OR NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO job_record FROM public.catalog_import_jobs WHERE id=import_job_id_input FOR UPDATE;
  IF job_record.id IS NULL OR job_record.source_type<>'PDF' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF job_record.status<>'READY_FOR_REVIEW' OR job_record.security_status<>'VERIFIED' OR job_record.security_verified_at IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF row_ids_input IS NOT NULL AND (
    SELECT COUNT(DISTINCT row_record.id) FROM public.catalog_import_rows row_record
    WHERE row_record.import_job_id=import_job_id_input AND row_record.id=ANY(row_ids_input)
      AND row_record.validation_status='VALID' AND row_record.review_status='APPROVED' AND row_record.reviewed_at IS NOT NULL
      AND row_record.category_id IS NOT NULL AND row_record.selected_image_file_id IS NOT NULL AND row_record.approved_image_file_id IS NOT NULL
      AND row_record.approved_image_source_file_id=row_record.selected_image_file_id
      AND COALESCE(array_length(row_record.warning_codes,1),0)=0
  )<>cardinality(row_ids_input) THEN RAISE EXCEPTION 'SELECTION_NOT_VALID'; END IF;
  UPDATE public.catalog_import_jobs SET status='IMPORTING',started_at=COALESCE(started_at,NOW()) WHERE id=import_job_id_input;
  FOR row_record IN SELECT r.* FROM public.catalog_import_rows r WHERE r.import_job_id=import_job_id_input
    AND r.validation_status='VALID' AND r.review_status='APPROVED' AND r.reviewed_at IS NOT NULL
    AND r.category_id IS NOT NULL AND r.selected_image_file_id IS NOT NULL AND r.approved_image_file_id IS NOT NULL
    AND r.approved_image_source_file_id=r.selected_image_file_id
    AND COALESCE(array_length(r.warning_codes,1),0)=0 AND (row_ids_input IS NULL OR r.id=ANY(row_ids_input))
    AND NOT EXISTS(SELECT 1 FROM public.catalog_import_rows duplicate_row WHERE duplicate_row.import_job_id=import_job_id_input
      AND duplicate_row.id<>r.id AND UPPER(BTRIM(duplicate_row.sku))=UPPER(BTRIM(r.sku)))
    ORDER BY r.row_number FOR UPDATE OF r
  LOOP
    media_id_value:=NULL; document_id_value:=NULL;
    BEGIN
      INSERT INTO public.products(supplier_id,category_id,sku,factory_sku,product_type,name_th,name_en,name_zh,country_code,
        default_lead_time_days,width_mm,depth_mm,height_mm,weight_kg,cbm,material_summary,finish_summary,moq,
        description_th,specification_summary,source_catalog_page,status,qa_status,created_by)
      VALUES(job_record.supplier_id,row_record.category_id,UPPER(BTRIM(row_record.sku)),NULLIF(BTRIM(row_record.factory_sku),''),
        UPPER(BTRIM(row_record.product_type)),BTRIM(row_record.name_th_draft),NULLIF(BTRIM(row_record.name_en),''),
        NULLIF(BTRIM(row_record.name_zh),''),row_record.country_code,row_record.lead_time_days,
        row_record.width_mm,row_record.depth_mm,row_record.height_mm,row_record.weight_kg,row_record.cbm,
        row_record.material_summary,row_record.finish_summary,row_record.moq,row_record.description_th,
        row_record.specification_summary,'PDF page '||row_record.source_page_number,'DRAFT','NOT_REVIEWED',(SELECT auth.uid()))
      RETURNING id INTO product_id_value;
      IF row_record.approved_image_file_id IS NOT NULL THEN
        INSERT INTO public.product_media(product_id,file_id,media_type,is_primary,sort_order)
          VALUES(product_id_value,row_record.approved_image_file_id,'IMAGE',TRUE,0) RETURNING id INTO media_id_value;
        UPDATE public.file_metadata SET entity_type='PRODUCT',entity_id=product_id_value WHERE id=row_record.approved_image_file_id;
      END IF;
      INSERT INTO public.product_documents(product_id,file_id,document_type,source_page,is_member_visible,created_by)
        VALUES(product_id_value,job_record.source_file_id,'CATALOG',row_record.source_page_number::TEXT,FALSE,(SELECT auth.uid())) RETURNING id INTO document_id_value;
      UPDATE public.catalog_import_rows SET validation_status='IMPORTED',product_id=product_id_value,imported_media_id=media_id_value,
        imported_document_id=document_id_value,imported_product_snapshot=(SELECT to_jsonb(product_record) FROM public.products product_record WHERE product_record.id=product_id_value),
        imported_at=NOW() WHERE id=row_record.id;
      PERFORM public.write_audit_event(NULL,'product',product_id_value,'PDF_DRAFT_IMPORTED',NULL,
        jsonb_build_object('importJobId',import_job_id_input,'rowId',row_record.id,'sku',row_record.sku));
      imported_count:=imported_count+1;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO product_id_value FROM public.products WHERE UPPER(sku)=UPPER(BTRIM(row_record.sku)) LIMIT 1;
      UPDATE public.catalog_import_rows SET validation_status='INVALID',review_status='NOT_REVIEWED',existing_product_id=product_id_value,
        warning_codes=array_append(warning_codes,'DUPLICATE_SKU') WHERE id=row_record.id;
      failed_count:=failed_count+1;
    END;
  END LOOP;
  SELECT COUNT(*) INTO remaining_count FROM public.catalog_import_rows WHERE import_job_id=import_job_id_input
    AND validation_status IN ('PENDING','REQUIRES_REVIEW','VALID');
  SELECT COUNT(*) INTO issue_count FROM public.catalog_import_rows WHERE import_job_id=import_job_id_input
    AND validation_status IN ('INVALID','REJECTED');
  UPDATE public.catalog_import_jobs SET status=CASE WHEN remaining_count>0 THEN 'READY_FOR_REVIEW'
      WHEN issue_count>0 THEN 'COMPLETED_WITH_ISSUES' ELSE 'COMPLETED' END,
    valid_rows=(SELECT COUNT(*) FROM public.catalog_import_rows WHERE import_job_id=import_job_id_input AND validation_status='VALID'),
    invalid_rows=issue_count,completed_at=CASE WHEN remaining_count=0 THEN NOW() ELSE NULL END WHERE id=import_job_id_input;
  IF remaining_count=0 THEN
    UPDATE public.catalog_import_pages SET purge_after=NOW()+INTERVAL '30 days' WHERE import_job_id=import_job_id_input;
    UPDATE public.catalog_import_candidate_images image SET purge_after=NOW()+INTERVAL '30 days'
      FROM public.catalog_import_rows candidate_row WHERE image.import_row_id=candidate_row.id AND candidate_row.import_job_id=import_job_id_input;
    UPDATE public.catalog_import_ai_calls SET purge_after=NOW()+INTERVAL '30 days' WHERE import_job_id=import_job_id_input;
  END IF;
  RETURN jsonb_build_object('imported',imported_count,'invalid',failed_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_catalog_pdf_drafts(import_job_id_input UUID)
RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE job_record RECORD; row_record RECORD; dependency RECORD; has_dependency BOOLEAN; removed INTEGER:=0;
BEGIN
  IF NOT public.has_permission('catalog.import') OR NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO job_record FROM public.catalog_import_jobs
    WHERE id=import_job_id_input AND source_type='PDF' FOR UPDATE;
  IF job_record.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF job_record.status NOT IN ('COMPLETED','COMPLETED_WITH_ISSUES','READY_FOR_REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  FOR row_record IN SELECT r.product_id,r.imported_product_snapshot,r.imported_media_id,r.imported_document_id,r.approved_image_file_id,
      p.created_at,p.updated_at,to_jsonb(p) AS current_product_snapshot
    FROM public.catalog_import_rows r JOIN public.products p ON p.id=r.product_id
    WHERE r.import_job_id=import_job_id_input AND r.validation_status='IMPORTED'
      AND p.status='DRAFT' AND p.qa_status='NOT_REVIEWED'
    FOR UPDATE OF r,p
  LOOP
    IF row_record.imported_product_snapshot IS NULL OR row_record.current_product_snapshot IS DISTINCT FROM row_record.imported_product_snapshot OR
       EXISTS(SELECT 1 FROM public.project_items WHERE product_id=row_record.product_id) OR
       EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=row_record.product_id) OR
       EXISTS(SELECT 1 FROM public.product_options WHERE product_id=row_record.product_id) OR
       EXISTS(SELECT 1 FROM public.product_prices WHERE product_id=row_record.product_id) OR
       EXISTS(SELECT 1 FROM public.product_cost_versions WHERE product_id=row_record.product_id)
    THEN RAISE EXCEPTION 'ROLLBACK_NOT_SAFE'; END IF;
    IF EXISTS(SELECT 1 FROM public.product_media WHERE product_id=row_record.product_id AND id IS DISTINCT FROM row_record.imported_media_id) OR
       EXISTS(SELECT 1 FROM public.product_documents WHERE product_id=row_record.product_id AND id IS DISTINCT FROM row_record.imported_document_id)
    THEN RAISE EXCEPTION 'ROLLBACK_NOT_SAFE'; END IF;
    -- Refuse rollback when any current/future downstream table references this product.
    -- Only the source row and the media/document rows created by this import may exist.
    FOR dependency IN
      SELECT namespace.nspname AS schema_name,relation.relname AS table_name,attribute.attname AS column_name
      FROM pg_catalog.pg_constraint constraint_record
      JOIN pg_catalog.pg_class relation ON relation.oid=constraint_record.conrelid
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
      JOIN pg_catalog.pg_attribute attribute ON attribute.attrelid=constraint_record.conrelid
        AND attribute.attnum=constraint_record.conkey[1]
      WHERE constraint_record.contype='f' AND constraint_record.confrelid='public.products'::regclass
        AND array_length(constraint_record.conkey,1)=1
        AND NOT (namespace.nspname='public' AND relation.relname IN ('catalog_import_rows','product_media','product_documents'))
    LOOP
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',dependency.schema_name,dependency.table_name,dependency.column_name)
        INTO has_dependency USING row_record.product_id;
      IF has_dependency THEN RAISE EXCEPTION 'ROLLBACK_NOT_SAFE'; END IF;
    END LOOP;
    DELETE FROM public.product_media WHERE id=row_record.imported_media_id AND product_id=row_record.product_id;
    DELETE FROM public.product_documents WHERE id=row_record.imported_document_id AND product_id=row_record.product_id;
    UPDATE public.file_metadata SET entity_type='CATALOG_IMPORT_APPROVED_IMAGE',entity_id=import_job_id_input
      WHERE id=row_record.approved_image_file_id AND entity_type='PRODUCT' AND entity_id=row_record.product_id;
    DELETE FROM public.products WHERE id=row_record.product_id;
    UPDATE public.catalog_import_rows SET validation_status='VALID',product_id=NULL,imported_product_snapshot=NULL,
      imported_media_id=NULL,imported_document_id=NULL,imported_at=NULL WHERE product_id=row_record.product_id;
    removed:=removed+1;
  END LOOP;
  IF removed>0 THEN
    UPDATE public.catalog_import_jobs SET status='READY_FOR_REVIEW',completed_at=NULL,
      valid_rows=(SELECT COUNT(*) FROM public.catalog_import_rows WHERE import_job_id=import_job_id_input AND validation_status='VALID'),
      invalid_rows=(SELECT COUNT(*) FROM public.catalog_import_rows WHERE import_job_id=import_job_id_input AND validation_status IN ('INVALID','REJECTED'))
      WHERE id=import_job_id_input;
  END IF;
  PERFORM public.write_audit_event(NULL,'catalog_import_job',import_job_id_input,'PDF_DRAFTS_ROLLED_BACK',NULL,jsonb_build_object('removed',removed));
  RETURN jsonb_build_object('removed',removed);
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_catalog_pdf_import(import_job_id_input UUID)
RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE previous_status TEXT;
BEGIN
  IF NOT public.has_permission('catalog.import') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT status INTO previous_status FROM public.catalog_import_jobs WHERE id=import_job_id_input AND source_type='PDF' FOR UPDATE;
  IF previous_status IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF previous_status IN ('COMPLETED','COMPLETED_WITH_ISSUES','FAILED','CANCELLED','IMPORTING') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.catalog_import_jobs SET status='CANCELLED',cancelled_by=(SELECT auth.uid()),cancelled_at=NOW() WHERE id=import_job_id_input;
  UPDATE public.catalog_import_pages SET status='FAILED',lease_token=NULL,leased_by=NULL,lease_expires_at=NULL,
    failure_code='JOB_CANCELLED',failure_message='Import cancelled by reviewer',completed_at=NOW(),purge_after=NOW()+INTERVAL '30 days'
    WHERE import_job_id=import_job_id_input AND status IN ('PENDING','LEASED');
  UPDATE public.catalog_import_pages SET purge_after=NOW()+INTERVAL '30 days' WHERE import_job_id=import_job_id_input;
  UPDATE public.catalog_import_candidate_images image SET purge_after=NOW()+INTERVAL '30 days'
    FROM public.catalog_import_rows row_record WHERE image.import_row_id=row_record.id AND row_record.import_job_id=import_job_id_input;
  UPDATE public.catalog_import_ai_calls SET purge_after=NOW()+INTERVAL '30 days' WHERE import_job_id=import_job_id_input;
  PERFORM public.write_audit_event(NULL,'catalog_import_job',import_job_id_input,'PDF_IMPORT_CANCELLED',
    jsonb_build_object('status',previous_status),jsonb_build_object('status','CANCELLED'));
  RETURN jsonb_build_object('id',import_job_id_input,'status','CANCELLED');
END; $$;

CREATE OR REPLACE FUNCTION public.retry_catalog_pdf_import(import_job_id_input UUID)
RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE changed INTEGER;
BEGIN
  IF NOT public.has_permission('catalog.import') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.catalog_import_jobs WHERE id=import_job_id_input AND source_type='PDF' AND status IN ('FAILED','READY_FOR_REVIEW')
      AND COALESCE(failure_code,'') NOT IN ('MALWARE_DETECTED','MALWARE_SCAN_UNAVAILABLE','ENCRYPTED_PDF','MALFORMED_PDF','PDF_PORTFOLIO_NOT_ALLOWED')) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  UPDATE public.catalog_import_pages SET status='PENDING',attempts=0,failure_code=NULL,failure_message=NULL,completed_at=NULL,purge_after=NULL
    WHERE import_job_id=import_job_id_input AND status='FAILED';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed=0 THEN RAISE EXCEPTION 'NOTHING_TO_RETRY'; END IF;
  UPDATE public.catalog_import_jobs SET status='QUEUED',failure_code=NULL,failure_message=NULL,completed_at=NULL WHERE id=import_job_id_input;
  RETURN jsonb_build_object('id',import_job_id_input,'status','QUEUED','pages',changed);
END; $$;

REVOKE ALL ON FUNCTION public.review_catalog_pdf_candidate(UUID,TEXT,TEXT[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_catalog_pdf_candidate(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_catalog_pdf_ai_call(UUID,NUMERIC,TEXT,JSONB,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_catalog_pdf_compute_run(TEXT,NUMERIC) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_catalog_pdf_compute_run(UUID,NUMERIC,BOOLEAN,UUID[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_catalog_pdf_pages(TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mark_catalog_pdf_job_verified(UUID,UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_catalog_pdf_page(UUID,UUID,TEXT,TEXT,UUID,UUID,TEXT,TEXT,UUID,JSONB,BOOLEAN,NUMERIC,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_catalog_pdf_page(UUID,UUID,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_catalog_pdf_job_security(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.recover_catalog_pdf_pages() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.list_catalog_pdf_expired_files(INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_catalog_pdf_expired_file(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.stage_catalog_pdf_product_image(UUID,UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.execute_catalog_pdf_import_job(UUID,UUID[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rollback_catalog_pdf_drafts(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_catalog_pdf_import(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.retry_catalog_pdf_import(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_catalog_pdf_candidate(UUID,TEXT,TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_catalog_pdf_candidate(UUID,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_catalog_pdf_import_job(UUID,UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_catalog_pdf_drafts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_catalog_pdf_import(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_catalog_pdf_import(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_catalog_pdf_ai_call(UUID,NUMERIC,TEXT,JSONB,INTEGER,INTEGER) TO project_admin;
GRANT EXECUTE ON FUNCTION public.reserve_catalog_pdf_compute_run(TEXT,NUMERIC) TO project_admin;
GRANT EXECUTE ON FUNCTION public.finalize_catalog_pdf_compute_run(UUID,NUMERIC,BOOLEAN,UUID[]) TO project_admin;
GRANT EXECUTE ON FUNCTION public.claim_catalog_pdf_pages(TEXT,INTEGER) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_catalog_pdf_job_verified(UUID,UUID,UUID,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.complete_catalog_pdf_page(UUID,UUID,TEXT,TEXT,UUID,UUID,TEXT,TEXT,UUID,JSONB,BOOLEAN,NUMERIC,UUID,TEXT,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.fail_catalog_pdf_page(UUID,UUID,TEXT,TEXT,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.fail_catalog_pdf_job_security(UUID,TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.recover_catalog_pdf_pages() TO project_admin;
GRANT EXECUTE ON FUNCTION public.list_catalog_pdf_expired_files(INTEGER) TO project_admin;
GRANT EXECUTE ON FUNCTION public.finalize_catalog_pdf_expired_file(UUID) TO project_admin;
GRANT EXECUTE ON FUNCTION public.stage_catalog_pdf_product_image(UUID,UUID,UUID,UUID) TO project_admin;
