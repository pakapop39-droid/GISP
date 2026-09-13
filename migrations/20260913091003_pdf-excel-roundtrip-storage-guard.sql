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
  ELSIF NEW.entity_type IN ('CATALOG_ENRICHMENT_EXPORT','CATALOG_ENRICHMENT_UPLOAD') THEN
    IF NEW.mime_type<>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' OR
       NEW.visibility<>'CONFIDENTIAL' OR NEW.bucket<>'gisp-confidential' THEN RAISE EXCEPTION 'INVALID_FILE'; END IF;
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
