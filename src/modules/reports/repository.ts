import "server-only";

import { createInsForgeServerClient } from "@/lib/insforge/server";
import type {
  AdminOperationsDashboard,
  ExecutiveDashboard,
  FixedReport,
  FixedReportFilters,
  MemberDashboard,
} from "@/modules/reports/types";

async function callReportRpc<T>(
  name: string,
  parameters: Record<string, unknown> = {},
): Promise<T> {
  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database.rpc(name, parameters);
  if (error) {
    throw new Error(error.message || `ไม่สามารถโหลดข้อมูลจาก ${name} ได้`);
  }
  if (!data || typeof data !== "object") {
    throw new Error(`ข้อมูลจาก ${name} ไม่ถูกต้อง`);
  }
  return data as T;
}

export function getMemberDashboard() {
  return callReportRpc<MemberDashboard>("get_member_dashboard");
}

export function getAdminOperationsDashboard() {
  return callReportRpc<AdminOperationsDashboard>(
    "get_admin_operations_dashboard",
  );
}

export function getExecutiveDashboard(dateFrom: string, dateTo: string) {
  return callReportRpc<ExecutiveDashboard>("get_executive_dashboard", {
    date_from_input: dateFrom,
    date_to_input: dateTo,
  });
}

export function getFixedReport(filters: FixedReportFilters) {
  return callReportRpc<FixedReport>("get_fixed_report", {
    report_type_input: filters.type,
    date_from_input: filters.dateFrom,
    date_to_input: filters.dateTo,
    status_filter_input: filters.status || null,
    row_limit_input: filters.limit ?? 500,
    row_offset_input: filters.offset ?? 0,
  });
}

export async function recordFixedReportExport(
  report: FixedReport,
): Promise<string> {
  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database.rpc(
    "record_fixed_report_export",
    {
      report_type_input: report.report_type,
      filters_input: report.filters,
      row_count_input: report.row_count,
    },
  );
  if (error || typeof data !== "string") {
    throw new Error(error?.message || "บันทึก Audit การ Export ไม่สำเร็จ");
  }
  return data;
}
