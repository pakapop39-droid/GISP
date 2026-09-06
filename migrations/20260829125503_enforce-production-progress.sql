-- Keep the production status and the overall job progress consistent.
CREATE OR REPLACE FUNCTION public.add_production_update(
  supplier_order_id_input UUID,
  status_input TEXT,
  note_input TEXT DEFAULT NULL,
  estimated_completion_at_input TIMESTAMPTZ DEFAULT NULL,
  progress_percent_input NUMERIC DEFAULT NULL,
  started_at_input TIMESTAMPTZ DEFAULT NULL,
  actual_completed_at_input TIMESTAMPTZ DEFAULT NULL,
  delay_reason_input TEXT DEFAULT NULL,
  file_ids_input JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  supplier_order_record public.supplier_orders%ROWTYPE;
  latest_status_value TEXT;
  latest_rank INTEGER := 0;
  latest_progress_value NUMERIC(5,2) := 0;
  minimum_progress_value NUMERIC(5,2);
  target_rank INTEGER;
  update_id_value UUID;
  file_id_value UUID;
  member_user_id UUID;
BEGIN
  IF NOT public.has_permission('production.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  target_rank := CASE status_input
    WHEN 'ACKNOWLEDGED' THEN 1 WHEN 'MATERIAL_PREPARATION' THEN 2
    WHEN 'IN_PRODUCTION' THEN 3 WHEN 'ASSEMBLY' THEN 4
    WHEN 'FINISHING' THEN 5 WHEN 'PRODUCTION_COMPLETED' THEN 6
    WHEN 'DELAYED' THEN 99 ELSE NULL END;
  minimum_progress_value := CASE status_input
    WHEN 'ACKNOWLEDGED' THEN 0 WHEN 'MATERIAL_PREPARATION' THEN 10
    WHEN 'IN_PRODUCTION' THEN 30 WHEN 'ASSEMBLY' THEN 60
    WHEN 'FINISHING' THEN 85 WHEN 'PRODUCTION_COMPLETED' THEN 100
    WHEN 'DELAYED' THEN 0 ELSE NULL END;
  IF target_rank IS NULL THEN RAISE EXCEPTION 'unsupported production status'; END IF;
  IF progress_percent_input IS NOT NULL
     AND (progress_percent_input < 0 OR progress_percent_input > 100) THEN
    RAISE EXCEPTION 'progress percent must be between 0 and 100';
  END IF;
  IF status_input = 'DELAYED' AND NULLIF(BTRIM(delay_reason_input), '') IS NULL THEN
    RAISE EXCEPTION 'delay reason is required';
  END IF;

  SELECT * INTO supplier_order_record FROM public.supplier_orders
  WHERE id = supplier_order_id_input FOR UPDATE;
  IF NOT FOUND OR supplier_order_record.status IN ('DRAFT', 'CANCELLED') THEN
    RAISE EXCEPTION 'supplier order cannot receive production updates';
  END IF;

  SELECT status INTO latest_status_value FROM public.production_updates
  WHERE supplier_order_id = supplier_order_id_input AND status <> 'DELAYED'
  ORDER BY created_at DESC, id DESC LIMIT 1;
  latest_rank := CASE latest_status_value
    WHEN 'ACKNOWLEDGED' THEN 1 WHEN 'MATERIAL_PREPARATION' THEN 2
    WHEN 'IN_PRODUCTION' THEN 3 WHEN 'ASSEMBLY' THEN 4
    WHEN 'FINISHING' THEN 5 WHEN 'PRODUCTION_COMPLETED' THEN 6 ELSE 0 END;

  SELECT COALESCE(progress_percent, 0) INTO latest_progress_value
  FROM public.production_updates
  WHERE supplier_order_id = supplier_order_id_input
  ORDER BY created_at DESC, id DESC LIMIT 1;
  IF NOT FOUND THEN latest_progress_value := 0; END IF;

  IF progress_percent_input IS NULL THEN
    progress_percent_input := CASE
      WHEN status_input = 'DELAYED' THEN latest_progress_value
      ELSE GREATEST(minimum_progress_value, latest_progress_value)
    END;
  END IF;
  IF progress_percent_input < minimum_progress_value THEN
    RAISE EXCEPTION 'progress percent is below the minimum for this production status';
  END IF;
  IF progress_percent_input < latest_progress_value THEN
    RAISE EXCEPTION 'production progress cannot decrease';
  END IF;
  IF status_input = 'DELAYED' AND progress_percent_input <> latest_progress_value THEN
    RAISE EXCEPTION 'delayed status must retain the latest production progress';
  END IF;
  IF status_input = 'PRODUCTION_COMPLETED' AND progress_percent_input <> 100 THEN
    RAISE EXCEPTION 'completed production progress must be 100 percent';
  END IF;
  IF status_input <> 'DELAYED' AND target_rank < latest_rank THEN
    RAISE EXCEPTION 'production status cannot move backwards';
  END IF;

  INSERT INTO public.production_updates (
    supplier_order_id, organization_id, status, note,
    estimated_completion_at, progress_percent, started_at,
    actual_completed_at, delay_reason, created_by
  ) VALUES (
    supplier_order_id_input, supplier_order_record.organization_id, status_input,
    NULLIF(BTRIM(note_input), ''), estimated_completion_at_input,
    progress_percent_input, started_at_input,
    CASE WHEN status_input='PRODUCTION_COMPLETED'
      THEN COALESCE(actual_completed_at_input, NOW()) ELSE actual_completed_at_input END,
    NULLIF(BTRIM(delay_reason_input), ''), (SELECT auth.uid())
  ) RETURNING id INTO update_id_value;

  FOR file_id_value IN SELECT value::UUID FROM jsonb_array_elements_text(file_ids_input)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.file_metadata fm
      WHERE fm.id=file_id_value
        AND fm.organization_id=supplier_order_record.organization_id
        AND fm.visibility='MEMBER_PRIVATE'
        AND fm.entity_type='PRODUCTION_MEDIA'
        AND fm.entity_id=supplier_order_id_input
    ) THEN RAISE EXCEPTION 'invalid production media file'; END IF;
    INSERT INTO public.production_update_files(production_update_id,file_id,organization_id)
    VALUES(update_id_value,file_id_value,supplier_order_record.organization_id);
  END LOOP;

  UPDATE public.supplier_orders SET status = CASE
    WHEN status_input='ACKNOWLEDGED' THEN 'ACKNOWLEDGED'
    WHEN status_input='PRODUCTION_COMPLETED' THEN 'PRODUCTION_COMPLETED'
    ELSE 'IN_PRODUCTION' END
  WHERE id=supplier_order_id_input;
  UPDATE public.customer_orders SET status = 'IN_PRODUCTION'
  WHERE id=supplier_order_record.customer_order_id
    AND status NOT IN ('CANCELLED','COMPLETED');

  PERFORM public.write_audit_event(
    supplier_order_record.organization_id,'production_update',update_id_value,status_input,
    NULL,jsonb_build_object('supplier_order_id',supplier_order_id_input,'progress_percent',progress_percent_input)
  );
  IF status_input IN ('PRODUCTION_COMPLETED','DELAYED') THEN
    SELECT mp.user_id INTO member_user_id
    FROM public.customer_orders co JOIN public.member_profiles mp ON mp.id=co.member_profile_id
    WHERE co.id=supplier_order_record.customer_order_id;
    IF member_user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,organization_id,type,title,body,entity_type,entity_id,action_url)
      VALUES(member_user_id,supplier_order_record.organization_id,
        CASE WHEN status_input='DELAYED' THEN 'PRODUCTION_DELAYED' ELSE 'PRODUCTION_COMPLETED' END,
        CASE WHEN status_input='DELAYED' THEN 'อัปเดตความล่าช้าของการผลิต' ELSE 'การผลิตเสร็จแล้ว' END,
        COALESCE(NULLIF(BTRIM(delay_reason_input),''),NULLIF(BTRIM(note_input),''),'มีอัปเดตสถานะการผลิต'),
        'customer_order',supplier_order_record.customer_order_id,
        '/member/orders/'||supplier_order_record.customer_order_id::TEXT);
    END IF;
  END IF;
  RETURN update_id_value;
END;
$$;
