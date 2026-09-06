-- Concurrent file limits and append-only evidence for file/session changes.

CREATE OR REPLACE FUNCTION public.guard_member_application_file()
RETURNS TRIGGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE existing_count INTEGER;
BEGIN
  IF NEW.mime_type NOT IN ('application/pdf','image/jpeg','image/png')
    OR NEW.size_bytes IS NULL OR NEW.size_bytes <= 0 OR NEW.size_bytes > 10485760 THEN
    RAISE EXCEPTION 'INVALID_FILE';
  END IF;
  IF NEW.visibility='MEMBER_PRIVATE' AND NEW.bucket<>'gisp-member-private' THEN RAISE EXCEPTION 'INVALID_BUCKET'; END IF;
  IF NEW.visibility='CONFIDENTIAL' AND NEW.bucket<>'gisp-confidential' THEN RAISE EXCEPTION 'INVALID_BUCKET'; END IF;
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
CREATE TRIGGER file_metadata_guard BEFORE INSERT ON public.file_metadata
FOR EACH ROW EXECUTE FUNCTION public.guard_member_application_file();

CREATE OR REPLACE FUNCTION public.audit_file_metadata_change()
RETURNS TRIGGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.audit_events(organization_id,actor_user_id,entity_type,entity_id,action,after_data)
    VALUES(NEW.organization_id,NEW.uploaded_by,'file',NEW.id,'FILE_UPLOADED',
      jsonb_build_object('bucket',NEW.bucket,'objectKey',NEW.object_key,'sizeBytes',NEW.size_bytes,'visibility',NEW.visibility));
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_events(organization_id,actor_user_id,entity_type,entity_id,action,before_data)
  VALUES(OLD.organization_id,(SELECT auth.uid()),'file',OLD.id,'FILE_DELETED',
    jsonb_build_object('bucket',OLD.bucket,'objectKey',OLD.object_key,'visibility',OLD.visibility));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS file_metadata_audit ON public.file_metadata;
CREATE TRIGGER file_metadata_audit AFTER INSERT OR DELETE ON public.file_metadata
FOR EACH ROW EXECUTE FUNCTION public.audit_file_metadata_change();

CREATE OR REPLACE FUNCTION public.audit_app_session_change()
RETURNS TRIGGER
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.audit_events(actor_user_id,entity_type,entity_id,action,after_data)
    VALUES(NEW.user_id,'app_session',NEW.id,'SESSION_CREATED',jsonb_build_object('expiresAt',NEW.expires_at));
  ELSIF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    INSERT INTO public.audit_events(actor_user_id,entity_type,entity_id,action,before_data,after_data)
    VALUES(COALESCE(NEW.revoked_by,NEW.user_id),'app_session',NEW.id,'SESSION_REVOKED',
      jsonb_build_object('revoked',false),jsonb_build_object('revoked',true,'reason',NEW.revoke_reason));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_sessions_audit ON public.app_sessions;
CREATE TRIGGER app_sessions_audit AFTER INSERT OR UPDATE ON public.app_sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_app_session_change();
