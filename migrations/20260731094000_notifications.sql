-- GISP MVP notification outbox.
-- Business RPC commits first; app calls this RPC in a separate transaction.

CREATE OR REPLACE FUNCTION public.queue_current_user_notification(
  type_input TEXT,
  title_input TEXT,
  body_input TEXT,
  recipient_email_input TEXT,
  action_url_input TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  current_org_id UUID;
  notification_id_value UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF recipient_email_input IS NULL OR recipient_email_input !~* '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'valid recipient email required';
  END IF;

  SELECT primary_organization_id INTO current_org_id
  FROM public.users WHERE id = current_user_id;

  INSERT INTO public.notifications (
    user_id, organization_id, type, title, body, action_url
  )
  VALUES (
    current_user_id, current_org_id, type_input, title_input,
    body_input, action_url_input
  )
  RETURNING id INTO notification_id_value;

  INSERT INTO public.notification_jobs (
    notification_id, channel, recipient, subject, html_body
  )
  VALUES (
    notification_id_value,
    'EMAIL',
    LOWER(BTRIM(recipient_email_input)),
    title_input,
    '<div style="font-family:Arial,sans-serif;line-height:1.6">'
      || '<h2>' || REPLACE(REPLACE(title_input, '&', '&amp;'), '<', '&lt;') || '</h2>'
      || '<p>' || REPLACE(REPLACE(body_input, '&', '&amp;'), '<', '&lt;') || '</p>'
      || '</div>'
  );

  RETURN notification_id_value;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_current_user_notification(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_current_user_notification(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

