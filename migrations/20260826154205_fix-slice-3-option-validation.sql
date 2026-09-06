-- Product option groups need an explicit lifecycle state because project-item
-- validation accepts only options that are currently available to members.
ALTER TABLE public.product_options
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

CREATE INDEX IF NOT EXISTS idx_product_options_active
  ON public.product_options(product_id, sort_order)
  WHERE status = 'ACTIVE';
