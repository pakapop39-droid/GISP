-- Release D Slice 10 only. Existing B dashboard functions remain available;
-- this opens fixed reports and executive/export RPCs after separate approval.
GRANT EXECUTE ON FUNCTION public.get_executive_dashboard(DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fixed_report(TEXT,DATE,DATE,TEXT,INTEGER,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fixed_report_export(TEXT,JSONB,INTEGER) TO authenticated;
