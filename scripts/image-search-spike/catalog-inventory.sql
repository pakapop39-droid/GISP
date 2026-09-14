-- Read-only inventory. Run through the linked Development InsForge CLI.
-- Matches the product eligibility part of member_catalog; admin inspection does
-- not impersonate a member and does not read supplier/cost/customer data.
SELECT p.id AS product_id, p.sku, p.name_th, c.name_th AS category,
       m.id AS media_id, m.is_primary, m.sort_order,
       f.id AS file_id, f.bucket, f.object_key, f.mime_type, f.size_bytes
FROM public.products p
LEFT JOIN public.categories c ON c.id = p.category_id
JOIN public.product_media m ON m.product_id = p.id AND m.media_type = 'IMAGE'
LEFT JOIN public.file_metadata f ON f.id = m.file_id
WHERE p.status = 'PUBLISHED' AND p.qa_status = 'PASSED'
  AND EXISTS (
    SELECT 1 FROM public.product_prices pp
    WHERE pp.product_id = p.id AND pp.variant_id IS NULL
      AND pp.status = 'ACTIVE' AND pp.valid_from <= now()
      AND (pp.valid_until IS NULL OR pp.valid_until > now())
  )
ORDER BY c.name_th, p.sku, m.is_primary DESC, m.sort_order, m.id;
