-- Resolve batch relation state inside Postgres so a large product selection is
-- never encoded into an oversized HTTP query string.

CREATE OR REPLACE FUNCTION public.get_catalog_batch_relation_state(
  product_ids_input UUID[]
)
RETURNS TABLE(
  product_id UUID,
  active_variant BOOLEAN,
  primary_image BOOLEAN,
  active_cost BOOLEAN,
  active_price BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.has_permission('catalog.read') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF COALESCE(array_length(product_ids_input, 1), 0) > 1000 THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  RETURN QUERY
  WITH requested AS (
    SELECT DISTINCT UNNEST(COALESCE(product_ids_input, ARRAY[]::UUID[])) AS id
  )
  SELECT
    p.id,
    EXISTS (
      SELECT 1 FROM public.product_variants v
      WHERE v.product_id = p.id AND v.status = 'ACTIVE'
    ),
    EXISTS (
      SELECT 1 FROM public.product_media m
      WHERE m.product_id = p.id AND m.media_type = 'IMAGE' AND m.is_primary
    ),
    EXISTS (
      SELECT 1 FROM public.product_cost_versions c
      WHERE c.product_id = p.id AND c.variant_id IS NULL AND c.status = 'ACTIVE'
    ),
    EXISTS (
      SELECT 1 FROM public.product_prices pp
      WHERE pp.product_id = p.id AND pp.variant_id IS NULL AND pp.status = 'ACTIVE'
    )
  FROM requested r
  JOIN public.products p ON p.id = r.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_catalog_batch_relation_state(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_catalog_batch_relation_state(UUID[]) TO authenticated;

COMMENT ON FUNCTION public.get_catalog_batch_relation_state(UUID[]) IS
  'Returns validation relation flags for up to 1,000 products without exposing cost or price values.';
