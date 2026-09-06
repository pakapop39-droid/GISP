-- GISP Slice 2 — batch logs are internal catalog-operation data.

ALTER TABLE public.catalog_batch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_batch_runs_internal_read
ON public.catalog_batch_runs
FOR SELECT TO authenticated
USING (public.has_permission('catalog.read'));

CREATE POLICY catalog_batch_items_internal_read
ON public.catalog_batch_items
FOR SELECT TO authenticated
USING (public.has_permission('catalog.read'));

COMMENT ON TABLE public.catalog_batch_runs IS
  'Internal batch-operation audit summary. RLS requires catalog.read.';
COMMENT ON TABLE public.catalog_batch_items IS
  'Internal per-product batch outcomes. RLS requires catalog.read.';
