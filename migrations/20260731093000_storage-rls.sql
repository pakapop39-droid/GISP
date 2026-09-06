-- GISP MVP storage policies.
-- Buckets are created by CLI; see docs/INSFORGE SETUP.md.
-- Key format for private buckets: <organization_uuid>/<entity>/<uuid>/<file>.

CREATE OR REPLACE FUNCTION public.storage_org_id(object_key TEXT)
RETURNS UUID
LANGUAGE PLPGSQL
IMMUTABLE
AS $$
DECLARE
  first_segment TEXT;
BEGIN
  first_segment := SPLIT_PART(object_key, '/', 1);
  IF first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN first_segment::UUID;
  END IF;
  RETURN NULL;
END;
$$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_objects_owner_select ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_insert ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_update ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_delete ON storage.objects;

CREATE POLICY gisp_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket = 'gisp-public');

CREATE POLICY gisp_public_internal_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket = 'gisp-public'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
    AND public.has_permission('catalog.manage')
  );

CREATE POLICY gisp_public_internal_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket = 'gisp-public'
    AND public.has_permission('catalog.manage')
  )
  WITH CHECK (
    bucket = 'gisp-public'
    AND public.has_permission('catalog.manage')
  );

CREATE POLICY gisp_public_internal_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket = 'gisp-public'
    AND public.has_permission('catalog.manage')
  );

CREATE POLICY gisp_member_private_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket = 'gisp-member-private'
    AND public.storage_org_id(key) IS NOT NULL
    AND public.can_access_org(public.storage_org_id(key))
  );

CREATE POLICY gisp_member_private_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket = 'gisp-member-private'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
    AND public.storage_org_id(key) IS NOT NULL
    AND public.can_access_org(public.storage_org_id(key))
  );

CREATE POLICY gisp_member_private_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket = 'gisp-member-private'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
    AND public.can_access_org(public.storage_org_id(key))
  )
  WITH CHECK (
    bucket = 'gisp-member-private'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
    AND public.can_access_org(public.storage_org_id(key))
  );

CREATE POLICY gisp_member_private_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket = 'gisp-member-private'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
    AND public.can_access_org(public.storage_org_id(key))
  );

CREATE POLICY gisp_confidential_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket = 'gisp-confidential'
    AND public.storage_org_id(key) IS NOT NULL
    AND public.has_permission(
      'files.confidential.read',
      public.storage_org_id(key)
    )
  );

CREATE POLICY gisp_confidential_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket = 'gisp-confidential'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
    AND public.storage_org_id(key) IS NOT NULL
    AND public.has_permission(
      'files.confidential.manage',
      public.storage_org_id(key)
    )
  );

CREATE POLICY gisp_confidential_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket = 'gisp-confidential'
    AND public.has_permission(
      'files.confidential.manage',
      public.storage_org_id(key)
    )
  )
  WITH CHECK (
    bucket = 'gisp-confidential'
    AND public.has_permission(
      'files.confidential.manage',
      public.storage_org_id(key)
    )
  );

CREATE POLICY gisp_confidential_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket = 'gisp-confidential'
    AND public.has_permission(
      'files.confidential.manage',
      public.storage_org_id(key)
    )
  );

GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

REVOKE ALL ON FUNCTION public.storage_org_id(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_org_id(TEXT) TO authenticated, anon;

