-- Allow catalog import source files without weakening the existing member-file rules.
-- Catalog imports stay confidential and keep the same 10 MB per-file ceiling.

CREATE OR REPLACE FUNCTION public.guard_file_metadata_v2()
RETURNS TRIGGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE existing_count INTEGER;
BEGIN
  IF NEW.size_bytes IS NULL OR NEW.size_bytes <= 0 OR NEW.size_bytes > 10485760 THEN
    RAISE EXCEPTION 'INVALID_FILE';
  END IF;

  IF NEW.entity_type = 'CATALOG_IMPORT' THEN
    IF NEW.mime_type NOT IN (
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ) THEN
      RAISE EXCEPTION 'INVALID_FILE';
    END IF;
    IF NEW.visibility <> 'CONFIDENTIAL' OR NEW.bucket <> 'gisp-confidential' THEN
      RAISE EXCEPTION 'INVALID_BUCKET';
    END IF;
  ELSE
    IF NEW.mime_type NOT IN ('application/pdf','image/jpeg','image/png') THEN
      RAISE EXCEPTION 'INVALID_FILE';
    END IF;
    IF NEW.visibility='MEMBER_PRIVATE' AND NEW.bucket<>'gisp-member-private' THEN
      RAISE EXCEPTION 'INVALID_BUCKET';
    END IF;
    IF NEW.visibility='CONFIDENTIAL' AND NEW.bucket<>'gisp-confidential' THEN
      RAISE EXCEPTION 'INVALID_BUCKET';
    END IF;
  END IF;

  IF NEW.entity_type='MEMBER_APPLICATION' THEN
    IF NEW.member_profile_id IS NULL THEN RAISE EXCEPTION 'MEMBER_PROFILE_REQUIRED'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.member_profile_id::text, 0));
    SELECT COUNT(*) INTO existing_count FROM public.file_metadata fm
    WHERE fm.member_profile_id=NEW.member_profile_id AND fm.entity_type='MEMBER_APPLICATION';
    IF existing_count >= 5 THEN RAISE EXCEPTION 'FILE_LIMIT_REACHED'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS file_metadata_guard ON public.file_metadata;
CREATE TRIGGER file_metadata_guard
BEFORE INSERT ON public.file_metadata
FOR EACH ROW EXECUTE FUNCTION public.guard_file_metadata_v2();
