-- Number allocation is an implementation detail of permission-checked actions.
-- SECURITY DEFINER callers retain access as the function owner. Signed-in users
-- must not consume document numbers directly without creating a business record.
REVOKE EXECUTE ON FUNCTION public.next_document_number(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_record_reference(TEXT) FROM PUBLIC, anon, authenticated;
