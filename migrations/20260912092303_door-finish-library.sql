-- Door Catalog Slice v1.0 — shared finish library and product option mapping.
-- Additive only. Source documents and swatch files remain confidential; member
-- responses are assembled by the application from an explicit safe projection.

ALTER TABLE public.product_options
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.product_options
  DROP CONSTRAINT IF EXISTS product_options_status_check;
ALTER TABLE public.product_options
  ADD CONSTRAINT product_options_status_check
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

CREATE TABLE IF NOT EXISTS public.finish_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name_th TEXT NOT NULL,
  name_zh TEXT,
  material_category TEXT,
  source_document TEXT NOT NULL,
  source_version TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS finish_collections_supplier_code_unique
  ON public.finish_collections(supplier_id, UPPER(code));
CREATE INDEX IF NOT EXISTS finish_collections_supplier_status_idx
  ON public.finish_collections(supplier_id, status, code);
DROP TRIGGER IF EXISTS finish_collections_updated_at ON public.finish_collections;
CREATE TRIGGER finish_collections_updated_at
BEFORE UPDATE ON public.finish_collections
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE IF NOT EXISTS public.finishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.finish_collections(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name_th TEXT NOT NULL,
  name_zh TEXT,
  material TEXT,
  color_hex TEXT,
  swatch_file_id UUID REFERENCES public.file_metadata(id) ON DELETE SET NULL,
  source_document TEXT NOT NULL,
  source_page TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  CHECK (JSONB_TYPEOF(metadata) = 'object'),
  CHECK (BTRIM(source_document) <> ''),
  CHECK (BTRIM(source_page) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS finishes_collection_code_unique
  ON public.finishes(collection_id, UPPER(code));
CREATE INDEX IF NOT EXISTS finishes_collection_status_idx
  ON public.finishes(collection_id, status, code);
CREATE INDEX IF NOT EXISTS finishes_swatch_file_idx
  ON public.finishes(swatch_file_id) WHERE swatch_file_id IS NOT NULL;
DROP TRIGGER IF EXISTS finishes_updated_at ON public.finishes;
CREATE TRIGGER finishes_updated_at
BEFORE UPDATE ON public.finishes
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE IF NOT EXISTS public.product_option_finish_mappings (
  option_value_id UUID PRIMARY KEY REFERENCES public.product_option_values(id) ON DELETE CASCADE,
  finish_id UUID NOT NULL REFERENCES public.finishes(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_option_finish_mappings_finish_idx
  ON public.product_option_finish_mappings(finish_id, option_value_id);

ALTER TABLE public.finish_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_finish_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finish_collections_internal_read ON public.finish_collections;
CREATE POLICY finish_collections_internal_read ON public.finish_collections
  FOR SELECT TO authenticated
  USING (public.has_permission('catalog.read'));
DROP POLICY IF EXISTS finish_collections_manage ON public.finish_collections;
CREATE POLICY finish_collections_manage ON public.finish_collections
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

DROP POLICY IF EXISTS finishes_internal_read ON public.finishes;
CREATE POLICY finishes_internal_read ON public.finishes
  FOR SELECT TO authenticated
  USING (public.has_permission('catalog.read'));
DROP POLICY IF EXISTS finishes_manage ON public.finishes;
CREATE POLICY finishes_manage ON public.finishes
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

DROP POLICY IF EXISTS product_option_finish_mappings_internal_read ON public.product_option_finish_mappings;
CREATE POLICY product_option_finish_mappings_internal_read ON public.product_option_finish_mappings
  FOR SELECT TO authenticated
  USING (public.has_permission('catalog.read'));
DROP POLICY IF EXISTS product_option_finish_mappings_manage ON public.product_option_finish_mappings;
CREATE POLICY product_option_finish_mappings_manage ON public.product_option_finish_mappings
  FOR ALL TO authenticated
  USING (public.has_permission('catalog.manage'))
  WITH CHECK (public.has_permission('catalog.manage'));

REVOKE ALL ON public.finish_collections, public.finishes,
  public.product_option_finish_mappings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.finish_collections, public.finishes,
  public.product_option_finish_mappings TO authenticated;

CREATE OR REPLACE FUNCTION public.save_finish_collection(
  collection_id_input UUID,
  supplier_id_input UUID,
  code_input TEXT,
  name_th_input TEXT,
  name_zh_input TEXT,
  material_category_input TEXT,
  source_document_input TEXT,
  source_version_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE collection_id_value UUID; before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(code_input), '') IS NULL OR LENGTH(BTRIM(code_input)) > 80
    OR NULLIF(BTRIM(name_th_input), '') IS NULL OR LENGTH(BTRIM(name_th_input)) > 240
    OR LENGTH(BTRIM(COALESCE(name_zh_input, ''))) > 240
    OR LENGTH(BTRIM(COALESCE(material_category_input, ''))) > 240
    OR NULLIF(BTRIM(source_document_input), '') IS NULL OR LENGTH(BTRIM(source_document_input)) > 500
    OR LENGTH(BTRIM(COALESCE(source_version_input, ''))) > 120 THEN
    RAISE EXCEPTION 'INVALID_INPUT: FINISH_COLLECTION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id_input AND s.status IN ('PROSPECT', 'ACTIVE')
  ) THEN RAISE EXCEPTION 'INVALID_INPUT: SUPPLIER'; END IF;

  IF collection_id_input IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.finish_collections fc
      WHERE fc.supplier_id = supplier_id_input AND UPPER(fc.code) = UPPER(BTRIM(code_input))
    ) THEN RAISE EXCEPTION 'DUPLICATE_FINISH_COLLECTION_CODE'; END IF;
    INSERT INTO public.finish_collections(
      supplier_id, code, name_th, name_zh, material_category,
      source_document, source_version, status, created_by, updated_by
    ) VALUES (
      supplier_id_input, UPPER(BTRIM(code_input)), BTRIM(name_th_input),
      NULLIF(BTRIM(name_zh_input), ''), NULLIF(BTRIM(material_category_input), ''),
      BTRIM(source_document_input), NULLIF(BTRIM(source_version_input), ''),
      'DRAFT', (SELECT auth.uid()), (SELECT auth.uid())
    ) RETURNING id INTO collection_id_value;
    PERFORM public.write_audit_event(NULL, 'finish_collection', collection_id_value,
      'CREATED', NULL, jsonb_build_object('code', UPPER(BTRIM(code_input)), 'status', 'DRAFT'));
  ELSE
    SELECT to_jsonb(fc) INTO before_value FROM public.finish_collections fc
    WHERE fc.id = collection_id_input FOR UPDATE;
    IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF (before_value->>'supplier_id')::UUID <> supplier_id_input THEN
      RAISE EXCEPTION 'INVALID_INPUT: FINISH_COLLECTION_SUPPLIER_IMMUTABLE';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.finish_collections fc
      WHERE fc.supplier_id = supplier_id_input
        AND UPPER(fc.code) = UPPER(BTRIM(code_input))
        AND fc.id <> collection_id_input
    ) THEN RAISE EXCEPTION 'DUPLICATE_FINISH_COLLECTION_CODE'; END IF;
    UPDATE public.finish_collections SET
      supplier_id = supplier_id_input,
      code = UPPER(BTRIM(code_input)),
      name_th = BTRIM(name_th_input),
      name_zh = NULLIF(BTRIM(name_zh_input), ''),
      material_category = NULLIF(BTRIM(material_category_input), ''),
      source_document = BTRIM(source_document_input),
      source_version = NULLIF(BTRIM(source_version_input), ''),
      updated_by = (SELECT auth.uid())
    WHERE id = collection_id_input;
    collection_id_value := collection_id_input;
    PERFORM public.write_audit_event(NULL, 'finish_collection', collection_id_value,
      'UPDATED', before_value, jsonb_build_object('code', UPPER(BTRIM(code_input))));
  END IF;
  RETURN collection_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_finish_collection_status(
  collection_id_input UUID,
  status_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF status_input NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT to_jsonb(fc) INTO before_value FROM public.finish_collections fc
  WHERE fc.id = collection_id_input FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  UPDATE public.finish_collections
  SET status = status_input, updated_by = (SELECT auth.uid())
  WHERE id = collection_id_input;
  PERFORM public.write_audit_event(NULL, 'finish_collection', collection_id_input,
    'STATUS_CHANGED', before_value, jsonb_build_object('status', status_input));
  RETURN collection_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_finish(
  finish_id_input UUID,
  collection_id_input UUID,
  code_input TEXT,
  name_th_input TEXT,
  name_zh_input TEXT,
  material_input TEXT,
  color_hex_input TEXT,
  source_document_input TEXT,
  source_page_input TEXT,
  metadata_input JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE finish_id_value UUID; before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(BTRIM(code_input), '') IS NULL OR LENGTH(BTRIM(code_input)) > 80
    OR NULLIF(BTRIM(name_th_input), '') IS NULL OR LENGTH(BTRIM(name_th_input)) > 240
    OR LENGTH(BTRIM(COALESCE(name_zh_input, ''))) > 240
    OR LENGTH(BTRIM(COALESCE(material_input, ''))) > 500
    OR NULLIF(BTRIM(source_document_input), '') IS NULL OR LENGTH(BTRIM(source_document_input)) > 500
    OR NULLIF(BTRIM(source_page_input), '') IS NULL OR LENGTH(BTRIM(source_page_input)) > 80
    OR (NULLIF(BTRIM(color_hex_input), '') IS NOT NULL AND BTRIM(color_hex_input) !~ '^#[0-9A-Fa-f]{6}$')
    OR JSONB_TYPEOF(COALESCE(metadata_input, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT: FINISH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.finish_collections fc WHERE fc.id = collection_id_input) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF finish_id_input IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.finishes f
      WHERE f.collection_id = collection_id_input AND UPPER(f.code) = UPPER(BTRIM(code_input))
    ) THEN RAISE EXCEPTION 'DUPLICATE_FINISH_CODE'; END IF;
    INSERT INTO public.finishes(
      collection_id, code, name_th, name_zh, material, color_hex,
      source_document, source_page, metadata, status, created_by, updated_by
    ) VALUES (
      collection_id_input, UPPER(BTRIM(code_input)), BTRIM(name_th_input),
      NULLIF(BTRIM(name_zh_input), ''), NULLIF(BTRIM(material_input), ''),
      UPPER(NULLIF(BTRIM(color_hex_input), '')), BTRIM(source_document_input),
      BTRIM(source_page_input), COALESCE(metadata_input, '{}'::JSONB),
      'DRAFT', (SELECT auth.uid()), (SELECT auth.uid())
    ) RETURNING id INTO finish_id_value;
    PERFORM public.write_audit_event(NULL, 'finish', finish_id_value, 'CREATED', NULL,
      jsonb_build_object('collectionId', collection_id_input, 'code', UPPER(BTRIM(code_input)), 'status', 'DRAFT'));
  ELSE
    SELECT to_jsonb(f) INTO before_value FROM public.finishes f
    WHERE f.id = finish_id_input FOR UPDATE;
    IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF (before_value->>'collection_id')::UUID <> collection_id_input
      AND EXISTS (
        SELECT 1 FROM public.product_option_finish_mappings m
        WHERE m.finish_id = finish_id_input
      ) THEN RAISE EXCEPTION 'INVALID_TRANSITION: MAPPED_FINISH_COLLECTION_IMMUTABLE'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.finishes f
      WHERE f.collection_id = collection_id_input
        AND UPPER(f.code) = UPPER(BTRIM(code_input)) AND f.id <> finish_id_input
    ) THEN RAISE EXCEPTION 'DUPLICATE_FINISH_CODE'; END IF;
    UPDATE public.finishes SET
      collection_id = collection_id_input,
      code = UPPER(BTRIM(code_input)),
      name_th = BTRIM(name_th_input),
      name_zh = NULLIF(BTRIM(name_zh_input), ''),
      material = NULLIF(BTRIM(material_input), ''),
      color_hex = UPPER(NULLIF(BTRIM(color_hex_input), '')),
      source_document = BTRIM(source_document_input),
      source_page = BTRIM(source_page_input),
      metadata = COALESCE(metadata_input, '{}'::JSONB),
      updated_by = (SELECT auth.uid())
    WHERE id = finish_id_input;
    finish_id_value := finish_id_input;
    PERFORM public.write_audit_event(NULL, 'finish', finish_id_value, 'UPDATED', before_value,
      jsonb_build_object('collectionId', collection_id_input, 'code', UPPER(BTRIM(code_input))));
  END IF;
  RETURN finish_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_finish_swatch(
  finish_id_input UUID,
  file_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT to_jsonb(f) INTO before_value FROM public.finishes f
  WHERE f.id = finish_id_input FOR UPDATE;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.file_metadata fm
    WHERE fm.id = file_id_input AND fm.visibility = 'CONFIDENTIAL'
      AND fm.entity_type = 'FINISH_SWATCH' AND fm.entity_id = finish_id_input
      AND fm.mime_type IN ('image/jpeg', 'image/png', 'image/webp')
  ) THEN RAISE EXCEPTION 'INVALID_FILE'; END IF;
  UPDATE public.finishes
  SET swatch_file_id = file_id_input, updated_by = (SELECT auth.uid())
  WHERE id = finish_id_input;
  PERFORM public.write_audit_event(NULL, 'finish', finish_id_input, 'SWATCH_ATTACHED', before_value,
    jsonb_build_object('fileId', file_id_input));
  RETURN finish_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_finish_status(
  finish_id_input UUID,
  status_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE before_value JSONB; collection_status_value TEXT; swatch_file_id_value UUID;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF status_input NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT to_jsonb(f), fc.status, f.swatch_file_id
  INTO before_value, collection_status_value, swatch_file_id_value
  FROM public.finishes f JOIN public.finish_collections fc ON fc.id = f.collection_id
  WHERE f.id = finish_id_input FOR UPDATE OF f;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF status_input = 'ACTIVE' AND (collection_status_value <> 'ACTIVE' OR swatch_file_id_value IS NULL) THEN
    RAISE EXCEPTION 'FINISH_NOT_READY';
  END IF;
  UPDATE public.finishes
  SET status = status_input, updated_by = (SELECT auth.uid())
  WHERE id = finish_id_input;
  PERFORM public.write_audit_event(NULL, 'finish', finish_id_input, 'STATUS_CHANGED', before_value,
    jsonb_build_object('status', status_input));
  RETURN finish_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.map_finish_to_product_option_value(
  option_value_id_input UUID,
  finish_id_input UUID
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE product_id_value UUID; product_status_value TEXT; before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT p.id, p.status INTO product_id_value, product_status_value
  FROM public.product_option_values pov
  JOIN public.product_options po ON po.id = pov.option_id
  JOIN public.products p ON p.id = po.product_id
  WHERE pov.id = option_value_id_input AND pov.status = 'ACTIVE' AND po.status = 'ACTIVE'
  FOR UPDATE OF p;
  IF product_id_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF product_status_value NOT IN ('DRAFT', 'REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  SELECT to_jsonb(m) INTO before_value FROM public.product_option_finish_mappings m
  WHERE m.option_value_id = option_value_id_input FOR UPDATE;

  IF finish_id_input IS NULL THEN
    DELETE FROM public.product_option_finish_mappings WHERE option_value_id = option_value_id_input;
    PERFORM public.write_audit_event(NULL, 'product_option_value', option_value_id_input,
      'FINISH_UNMAPPED', before_value, NULL);
    RETURN option_value_id_input;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.finishes f
    JOIN public.finish_collections fc ON fc.id = f.collection_id
    JOIN public.products p ON p.id = product_id_value
    WHERE f.id = finish_id_input AND f.status = 'ACTIVE' AND fc.status = 'ACTIVE'
      AND fc.supplier_id = p.supplier_id AND f.swatch_file_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'FINISH_NOT_AVAILABLE'; END IF;

  INSERT INTO public.product_option_finish_mappings(option_value_id, finish_id, created_by)
  VALUES (option_value_id_input, finish_id_input, (SELECT auth.uid()))
  ON CONFLICT (option_value_id) DO UPDATE SET
    finish_id = EXCLUDED.finish_id, created_by = EXCLUDED.created_by, created_at = NOW();
  PERFORM public.write_audit_event(NULL, 'product_option_value', option_value_id_input,
    'FINISH_MAPPED', before_value, jsonb_build_object('finishId', finish_id_input));
  RETURN option_value_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_product_option_status(
  option_id_input UUID,
  status_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE product_id_value UUID; product_status_value TEXT; before_value JSONB;
BEGIN
  IF NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF status_input NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT po.product_id, p.status, to_jsonb(po)
  INTO product_id_value, product_status_value, before_value
  FROM public.product_options po JOIN public.products p ON p.id = po.product_id
  WHERE po.id = option_id_input FOR UPDATE OF po, p;
  IF before_value IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF product_status_value NOT IN ('DRAFT', 'REVIEW') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.product_options SET status = status_input WHERE id = option_id_input;
  UPDATE public.products SET status = 'DRAFT', qa_status = 'NOT_REVIEWED',
    reviewed_by = NULL, reviewed_at = NULL, review_note = NULL, updated_at = NOW()
  WHERE id = product_id_value;
  PERFORM public.write_audit_event(NULL, 'product_option', option_id_input,
    'STATUS_CHANGED', before_value, jsonb_build_object('status', status_input));
  RETURN option_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_finish_manifest(
  supplier_id_input UUID,
  rows_input JSONB
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE row_value JSONB; collection_id_value UUID; finish_id_value UUID; imported_count INTEGER := 0;
BEGIN
  IF NOT public.has_permission('catalog.import') OR NOT public.has_permission('catalog.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF JSONB_TYPEOF(rows_input) <> 'array' OR JSONB_ARRAY_LENGTH(rows_input) < 1
    OR JSONB_ARRAY_LENGTH(rows_input) > 1000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id_input AND s.status IN ('PROSPECT', 'ACTIVE')
  ) THEN RAISE EXCEPTION 'INVALID_INPUT: SUPPLIER'; END IF;

  FOR row_value IN SELECT value FROM JSONB_ARRAY_ELEMENTS(rows_input)
  LOOP
    IF NULLIF(BTRIM(row_value->>'collection_code'), '') IS NULL
      OR LENGTH(BTRIM(COALESCE(row_value->>'collection_code', ''))) > 80
      OR NULLIF(BTRIM(row_value->>'collection_name_th'), '') IS NULL
      OR LENGTH(BTRIM(COALESCE(row_value->>'collection_name_th', ''))) > 240
      OR LENGTH(BTRIM(COALESCE(row_value->>'collection_name_zh', ''))) > 240
      OR NULLIF(BTRIM(row_value->>'finish_code'), '') IS NULL
      OR LENGTH(BTRIM(COALESCE(row_value->>'finish_code', ''))) > 80
      OR NULLIF(BTRIM(row_value->>'finish_name_th'), '') IS NULL
      OR LENGTH(BTRIM(COALESCE(row_value->>'finish_name_th', ''))) > 240
      OR LENGTH(BTRIM(COALESCE(row_value->>'finish_name_zh', ''))) > 240
      OR LENGTH(BTRIM(COALESCE(row_value->>'material', ''))) > 240
      OR NULLIF(BTRIM(row_value->>'source_document'), '') IS NULL
      OR LENGTH(BTRIM(COALESCE(row_value->>'source_document', ''))) > 500
      OR LENGTH(BTRIM(COALESCE(row_value->>'source_version', ''))) > 120
      OR NULLIF(BTRIM(row_value->>'source_page'), '') IS NULL
      OR LENGTH(BTRIM(COALESCE(row_value->>'source_page', ''))) > 80
      OR (NULLIF(BTRIM(row_value->>'color_hex'), '') IS NOT NULL
        AND BTRIM(row_value->>'color_hex') !~ '^#[0-9A-Fa-f]{6}$')
      OR JSONB_TYPEOF(COALESCE(row_value->'metadata', '{}'::JSONB)) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_INPUT: FINISH_MANIFEST';
    END IF;

    SELECT fc.id INTO collection_id_value FROM public.finish_collections fc
    WHERE fc.supplier_id = supplier_id_input
      AND UPPER(fc.code) = UPPER(BTRIM(row_value->>'collection_code'));
    IF collection_id_value IS NULL THEN
      INSERT INTO public.finish_collections(
        supplier_id, code, name_th, name_zh, material_category,
        source_document, source_version, status, created_by, updated_by
      ) VALUES (
        supplier_id_input, UPPER(BTRIM(row_value->>'collection_code')),
        BTRIM(row_value->>'collection_name_th'), NULLIF(BTRIM(row_value->>'collection_name_zh'), ''),
        NULLIF(BTRIM(row_value->>'material'), ''), BTRIM(row_value->>'source_document'),
        NULLIF(BTRIM(row_value->>'source_version'), ''), 'DRAFT',
        (SELECT auth.uid()), (SELECT auth.uid())
      ) RETURNING id INTO collection_id_value;
      PERFORM public.write_audit_event(NULL, 'finish_collection', collection_id_value,
        'DRAFT_IMPORTED', NULL, jsonb_build_object('code', UPPER(BTRIM(row_value->>'collection_code'))));
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.finishes f
      WHERE f.collection_id = collection_id_value
        AND UPPER(f.code) = UPPER(BTRIM(row_value->>'finish_code'))
    ) THEN RAISE EXCEPTION 'DUPLICATE_FINISH_CODE'; END IF;

    INSERT INTO public.finishes(
      collection_id, code, name_th, name_zh, material, color_hex,
      source_document, source_page, metadata, status, created_by, updated_by
    ) VALUES (
      collection_id_value, UPPER(BTRIM(row_value->>'finish_code')),
      BTRIM(row_value->>'finish_name_th'), NULLIF(BTRIM(row_value->>'finish_name_zh'), ''),
      NULLIF(BTRIM(row_value->>'material'), ''), UPPER(NULLIF(BTRIM(row_value->>'color_hex'), '')),
      BTRIM(row_value->>'source_document'), BTRIM(row_value->>'source_page'),
      COALESCE(row_value->'metadata', '{}'::JSONB), 'DRAFT',
      (SELECT auth.uid()), (SELECT auth.uid())
    ) RETURNING id INTO finish_id_value;
    PERFORM public.write_audit_event(NULL, 'finish', finish_id_value, 'DRAFT_IMPORTED', NULL,
      jsonb_build_object('collectionId', collection_id_value, 'code', UPPER(BTRIM(row_value->>'finish_code'))));
    imported_count := imported_count + 1;
  END LOOP;
  RETURN jsonb_build_object('imported', imported_count, 'status', 'DRAFT');
END;
$$;

REVOKE ALL ON FUNCTION public.save_finish_collection(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT),
  public.set_finish_collection_status(UUID,TEXT),
  public.save_finish(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB),
  public.attach_finish_swatch(UUID,UUID), public.set_finish_status(UUID,TEXT),
  public.map_finish_to_product_option_value(UUID,UUID),
  public.set_product_option_status(UUID,TEXT),
  public.import_finish_manifest(UUID,JSONB)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_finish_collection(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT),
  public.set_finish_collection_status(UUID,TEXT),
  public.save_finish(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB),
  public.attach_finish_swatch(UUID,UUID), public.set_finish_status(UUID,TEXT),
  public.map_finish_to_product_option_value(UUID,UUID),
  public.set_product_option_status(UUID,TEXT),
  public.import_finish_manifest(UUID,JSONB)
TO authenticated;
