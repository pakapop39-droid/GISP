-- TEMPLATE ONLY. Full Release C emergency write stop.
-- Apply D10 -> D9 -> D8 -> D7 stops first when those slices are open.
-- No business-row DML. CREATE OR REPLACE preserves project_admin ACL on the
-- two private server executors while their bodies become fail-closed.

-- Nine Release C Member transaction entry points.
REVOKE ALL ON FUNCTION public.submit_custom_request(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_custom_request_draft(UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_custom_request_details(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_custom_request_v2(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_custom_request(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_custom_quotation(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_customer_order(UUID,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_payment_transfer(UUID,NUMERIC,TIMESTAMPTZ,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_order_cancellation(UUID,TEXT,UUID) FROM PUBLIC,anon,authenticated;

-- Nine staff continuations which can mutate C transactions.
REVOKE ALL ON FUNCTION public.create_custom_quotation(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_custom_quotation_draft(UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.send_custom_quotation(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_transition_custom_quotation(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.issue_supplier_orders(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_supplier_payment(UUID,TEXT,NUMERIC,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_supplier_payment(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mark_supplier_payment_paid(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.decide_order_cancellation(UUID,BOOLEAN,TEXT,NUMERIC,NUMERIC) FROM PUBLIC,anon,authenticated;

-- Legacy/direct bypasses never reopen.
REVOKE ALL ON FUNCTION public.verify_payment_transfer(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_payment_transfer_bound_impl(UUID,NUMERIC,TIMESTAMPTZ,UUID) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.record_customer_payment_evidence_preview(
  transfer_id_input UUID, session_token_hash_input TEXT,
  evidence_file_id_input UUID, sha256_input TEXT,
  size_bytes_input BIGINT, mime_type_input TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'EMERGENCY_WRITE_DISABLED';
END;
$$;
REVOKE ALL ON FUNCTION public.record_customer_payment_evidence_preview(UUID,TEXT,UUID,TEXT,BIGINT,TEXT)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.verify_payment_transfer_private(
  transfer_id_input UUID, approve_input BOOLEAN, finance_note_input TEXT,
  session_token_hash_input TEXT, evidence_file_id_input UUID,
  sha256_input TEXT, size_bytes_input BIGINT
)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'EMERGENCY_WRITE_DISABLED';
END;
$$;
REVOKE ALL ON FUNCTION public.verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)
  FROM PUBLIC,anon,authenticated;
