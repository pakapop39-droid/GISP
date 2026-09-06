CREATE OR REPLACE FUNCTION public.current_member_owns_supplier_order(target_supplier_order_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_orders so
    JOIN public.customer_orders co ON co.id=so.customer_order_id
    WHERE so.id=target_supplier_order_id
      AND co.member_profile_id=public.current_member_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.current_member_owns_order_item(target_order_item_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.customer_orders co ON co.id=oi.order_id
    WHERE oi.id=target_order_item_id
      AND co.member_profile_id=public.current_member_profile_id()
  )
$$;

DROP POLICY IF EXISTS production_updates_visible ON public.production_updates;
CREATE POLICY production_updates_visible ON public.production_updates
FOR SELECT TO authenticated USING (
  public.has_permission('production.manage',organization_id)
  OR public.has_permission('qc.manage',organization_id)
  OR (is_member_visible AND public.current_member_owns_supplier_order(supplier_order_id))
);

DROP POLICY IF EXISTS qc_inspections_visible ON public.qc_inspections;
CREATE POLICY qc_inspections_visible ON public.qc_inspections
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR (is_member_visible AND public.current_member_owns_order_item(order_item_id))
);

DROP POLICY IF EXISTS production_update_files_visible ON public.production_update_files;
CREATE POLICY production_update_files_visible ON public.production_update_files
FOR SELECT TO authenticated USING (
  public.has_permission('production.manage',organization_id)
  OR public.has_permission('qc.manage',organization_id)
  OR EXISTS (
    SELECT 1 FROM public.production_updates pu
    WHERE pu.id=production_update_id AND pu.is_member_visible
      AND public.current_member_owns_supplier_order(pu.supplier_order_id)
  )
);

DROP POLICY IF EXISTS qc_checklist_items_visible ON public.qc_checklist_items;
CREATE POLICY qc_checklist_items_visible ON public.qc_checklist_items
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR EXISTS (
    SELECT 1 FROM public.qc_inspections qi
    WHERE qi.id=inspection_id AND qi.is_member_visible
      AND public.current_member_owns_order_item(qi.order_item_id)
  )
);

DROP POLICY IF EXISTS qc_inspection_files_visible ON public.qc_inspection_files;
CREATE POLICY qc_inspection_files_visible ON public.qc_inspection_files
FOR SELECT TO authenticated USING (
  public.has_permission('qc.manage',organization_id)
  OR EXISTS (
    SELECT 1 FROM public.qc_inspections qi
    WHERE qi.id=inspection_id AND qi.is_member_visible
      AND public.current_member_owns_order_item(qi.order_item_id)
  )
);

REVOKE ALL ON FUNCTION public.current_member_owns_supplier_order(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.current_member_owns_order_item(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.current_member_owns_supplier_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_member_owns_order_item(UUID) TO authenticated;
