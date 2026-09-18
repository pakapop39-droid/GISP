-- First atomic step of the isolated PAY-RPC-GATE-001 candidate.
-- Close existing direct Payment writes before replacing either function body.
-- No table/column/data change. Do not apply without separate authorization.
REVOKE ALL ON FUNCTION public.verify_payment_transfer(UUID,BOOLEAN,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_payment_transfer(UUID,NUMERIC,TIMESTAMPTZ,UUID)
  FROM PUBLIC, anon, authenticated;
