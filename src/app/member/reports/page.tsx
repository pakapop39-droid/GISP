import { FixedReportWorkspace } from "@/components/fixed-report-workspace";
import { requireAppAccess } from "@/lib/auth/session";
import { parseReportFilters } from "@/modules/reports/presentation";
import { getFixedReport } from "@/modules/reports/repository";
import type { FixedReport } from "@/modules/reports/types";

export default async function MemberReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppAccess({ active: true });
  const filters = parseReportFilters(await searchParams);
  let report: FixedReport | null = null;
  let error: string | undefined;
  try {
    report = await getFixedReport(filters);
  } catch {
    error = "กรุณาลองใหม่ หรือลดช่วงวันที่ของรายงาน";
  }
  return (
    <FixedReportWorkspace
      portal="member"
      filters={filters}
      report={report}
      error={error}
    />
  );
}
