CREATE OR REPLACE FUNCTION public.match_product_images(query_input vector(1024),model_input text,category_input uuid DEFAULT NULL)
RETURNS TABLE(product_id uuid,media_id uuid,similarity double precision)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF public.current_member_profile_id() IS NULL OR NOT EXISTS(SELECT 1 FROM public.member_applications
    WHERE member_profile_id=public.current_member_profile_id() AND status='APPROVED') OR NOT EXISTS(
      SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
      WHERE ur.user_id=(SELECT auth.uid()) AND ur.revoked_at IS NULL AND r.code='MEMBER') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF query_input IS NULL OR model_input IS NULL OR vector_dims(query_input)<>1024 OR vector_norm(query_input)<0.99 OR vector_norm(query_input)>1.01 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  RETURN QUERY SELECT e.product_id,e.media_id,1-(e.embedding <=> query_input)
  FROM public.product_image_embeddings e JOIN public.image_search_jobs j ON j.product_id=e.product_id AND j.revision=e.revision
    AND j.media_id=e.media_id AND j.file_id=e.file_id AND j.state='READY'
  JOIN public.product_media m ON m.id=e.media_id AND m.file_id=e.file_id AND m.product_id=e.product_id AND m.media_type='IMAGE'
  WHERE e.model_identity=model_input AND EXISTS(SELECT 1 FROM public.member_catalog c
    WHERE c.id=e.product_id AND (category_input IS NULL OR c.category_id=category_input))
  ORDER BY e.embedding <=> query_input,e.product_id LIMIT 12;
END $$;

-- 
