-- TEMPLATE ONLY. Release D10 emergency stop; no data mutation.
REVOKE ALL ON FUNCTION public.get_executive_dashboard(DATE,DATE) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_fixed_report(TEXT,DATE,DATE,TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_fixed_report_export(TEXT,JSONB,INTEGER) FROM PUBLIC,anon,authenticated;
