-- TEMPLATE ONLY. Forward resume of D10 after C,D7,D8,D9 are independently verified open.
GRANT EXECUTE ON FUNCTION public.get_executive_dashboard(DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fixed_report(TEXT,DATE,DATE,TEXT,INTEGER,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fixed_report_export(TEXT,JSONB,INTEGER) TO authenticated;
