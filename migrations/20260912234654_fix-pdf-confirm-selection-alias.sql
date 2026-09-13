-- PDF Catalog Import v1.0 (Development only).
-- Runtime fix: avoid colliding with the PL/pgSQL row_record variable while
-- validating an explicit bulk-confirm selection.

CREATE OR REPLACE FUNCTION public.execute_catalog_pdf_import_job(import_job_id_input UUID,row_ids_input UUID[] DEFAULT NULL)
RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE job_record RECORD; row_record RECORD; product_id_value UUID; media_id_value UUID; document_id_value UUID; imported_count INTEGER:=0; failed_count INTEGER:=0; remaining_count INTEGER:=0; issue_count INTEGER:=0;
BEGIN
  IF NOT public.has_permission('catalog.import') OR NOT public.has_permission('catalog.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO job_record FROM public.catalog_import_jobs WHERE id=import_job_id_input FOR UPDATE;
  IF job_record.id IS NULL OR job_record.source_type<>'PDF' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF job_record.status<>'READY_FOR_REVIEW' OR job_record.security_status<>'VERIFIED' OR job_record.security_verified_at IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF row_ids_input IS NOT NULL AND (
    SELECT COUNT(DISTINCT selected_row.id) FROM public.catalog_import_rows selected_row
    WHERE selected_row.import_job_id=import_job_id_input AND selected_row.id=ANY(row_ids_input)
      AND selected_row.validation_status='VALID' AND selected_row.review_status='APPROVED' AND selected_row.reviewed_at IS NOT NULL
      AND selected_row.category_id IS NOT NULL AND selected_row.selected_image_file_id IS NOT NULL AND selected_row.approved_image_file_id IS NOT NULL
      AND selected_row.approved_image_source_file_id=selected_row.selected_image_file_id
      AND COALESCE(array_length(selected_row.warning_codes,1),0)=0
  )<>cardinality(row_ids_input) THEN RAISE EXCEPTION 'SELECTION_NOT_VALID'; END IF;
  UPDATE public.catalog_import_jobs SET status='IMPORTING',started_at=COALESCE(started_at,NOW()) WHERE id=import_job_id_input;
  FOR row_record IN SELECT r.* FROM public.catalog_import_rows r WHERE r.import_job_id=import_job_id_input
    AND r.validation_status='VALID' AND r.review_status='APPROVED' AND r.reviewed_at IS NOT NULL
    AND r.category_id IS NOT NULL AND r.selected_image_file_id IS NOT NULL AND r.approved_image_file_id IS NOT NULL
    AND r.approved_image_source_file_id=r.selected_image_file_id
    AND COALESCE(array_length(r.warning_codes,1),0)=0 AND (row_ids_input IS NULL OR r.id=ANY(row_ids_input))
    AND NOT EXISTS(SELECT 1 FROM public.catalog_import_rows duplicate_row WHERE duplicate_row.import_job_id=import_job_id_input
      AND duplicate_row.id<>r.id AND UPPER(BTRIM(duplicate_row.sku))=UPPER(BTRIM(r.sku)))
    ORDER BY r.row_number FOR UPDATE OF r
  LOOP
    media_id_value:=NULL; document_id_value:=NULL;
    BEGIN
      INSERT INTO public.products(supplier_id,category_id,sku,factory_sku,product_type,name_th,name_en,name_zh,country_code,
        default_lead_time_days,width_mm,depth_mm,height_mm,weight_kg,cbm,material_summary,finish_summary,moq,
        description_th,specification_summary,source_catalog_page,status,qa_status,created_by)
      VALUES(job_record.supplier_id,row_record.category_id,UPPER(BTRIM(row_record.sku)),NULLIF(BTRIM(row_record.factory_sku),''),
        UPPER(BTRIM(row_record.product_type)),BTRIM(row_record.name_th_draft),NULLIF(BTRIM(row_record.name_en),''),
        NULLIF(BTRIM(row_record.name_zh),''),row_record.country_code,row_record.lead_time_days,
        row_record.width_mm,row_record.depth_mm,row_record.height_mm,row_record.weight_kg,row_record.cbm,
        row_record.material_summary,row_record.finish_summary,row_record.moq,row_record.description_th,
        row_record.specification_summary,'PDF page '||row_record.source_page_number,'DRAFT','NOT_REVIEWED',(SELECT auth.uid()))
      RETURNING id INTO product_id_value;
      IF row_record.approved_image_file_id IS NOT NULL THEN
        INSERT INTO public.product_media(product_id,file_id,media_type,is_primary,sort_order)
          VALUES(product_id_value,row_record.approved_image_file_id,'IMAGE',TRUE,0) RETURNING id INTO media_id_value;
        UPDATE public.file_metadata SET entity_type='PRODUCT',entity_id=product_id_value WHERE id=row_record.approved_image_file_id;
      END IF;
      INSERT INTO public.product_documents(product_id,file_id,document_type,source_page,is_member_visible,created_by)
        VALUES(product_id_value,job_record.source_file_id,'CATALOG',row_record.source_page_number::TEXT,FALSE,(SELECT auth.uid())) RETURNING id INTO document_id_value;
      UPDATE public.catalog_import_rows SET validation_status='IMPORTED',product_id=product_id_value,imported_media_id=media_id_value,
        imported_document_id=document_id_value,imported_product_snapshot=(SELECT to_jsonb(product_record) FROM public.products product_record WHERE product_record.id=product_id_value),
        imported_at=NOW() WHERE id=row_record.id;
      PERFORM public.write_audit_event(NULL,'product',product_id_value,'PDF_DRAFT_IMPORTED',NULL,
        jsonb_build_object('importJobId',import_job_id_input,'rowId',row_record.id,'sku',row_record.sku));
      imported_count:=imported_count+1;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO product_id_value FROM public.products WHERE UPPER(sku)=UPPER(BTRIM(row_record.sku)) LIMIT 1;
      UPDATE public.catalog_import_rows SET validation_status='INVALID',review_status='NOT_REVIEWED',existing_product_id=product_id_value,
        warning_codes=array_append(warning_codes,'DUPLICATE_SKU') WHERE id=row_record.id;
      failed_count:=failed_count+1;
    END;
  END LOOP;
  SELECT COUNT(*) INTO remaining_count FROM public.catalog_import_rows WHERE import_job_id=import_job_id_input
    AND validation_status IN ('PENDING','REQUIRES_REVIEW','VALID');
  SELECT COUNT(*) INTO issue_count FROM public.catalog_import_rows WHERE import_job_id=import_job_id_input
    AND validation_status IN ('INVALID','REJECTED');
  UPDATE public.catalog_import_jobs SET status=CASE WHEN remaining_count>0 THEN 'READY_FOR_REVIEW'
      WHEN issue_count>0 THEN 'COMPLETED_WITH_ISSUES' ELSE 'COMPLETED' END,
    valid_rows=(SELECT COUNT(*) FROM public.catalog_import_rows WHERE import_job_id=import_job_id_input AND validation_status='VALID'),
    invalid_rows=issue_count,completed_at=CASE WHEN remaining_count=0 THEN NOW() ELSE NULL END WHERE id=import_job_id_input;
  IF remaining_count=0 THEN
    UPDATE public.catalog_import_pages SET purge_after=NOW()+INTERVAL '30 days' WHERE import_job_id=import_job_id_input;
    UPDATE public.catalog_import_candidate_images image SET purge_after=NOW()+INTERVAL '30 days'
      FROM public.catalog_import_rows candidate_row WHERE image.import_row_id=candidate_row.id AND candidate_row.import_job_id=import_job_id_input;
    UPDATE public.catalog_import_ai_calls SET purge_after=NOW()+INTERVAL '30 days' WHERE import_job_id=import_job_id_input;
  END IF;
  RETURN jsonb_build_object('imported',imported_count,'invalid',failed_count);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_catalog_pdf_import_job(UUID,UUID[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execute_catalog_pdf_import_job(UUID,UUID[]) TO authenticated;
