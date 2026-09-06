import { Download, ExternalLink, FileBarChart2 } from "lucide-react";
import Link from "next/link";
import {
  formatReportValue,
  reportColumns,
  reportLabels,
  reportStatusOptions,
  translateStatus,
} from "@/modules/reports/presentation";
import type {
  FixedReport,
  FixedReportFilters,
  FixedReportRow,
  FixedReportType,
} from "@/modules/reports/types";
import { fixedReportTypes } from "@/modules/reports/types";

function detailHref(
  portal: "member" | "admin",
  type: FixedReportType,
  row: FixedReportRow,
) {
  if (type === "claim" && row.id) return `/${portal}/claims/${row.id}`;
  const orderId = type === "order" ? row.id : row.order_id;
  return orderId ? `/${portal}/orders/${orderId}` : null;
}

export function FixedReportWorkspace({
  portal,
  filters,
  report,
  error,
}: {
  portal: "member" | "admin";
  filters: FixedReportFilters;
  report: FixedReport | null;
  error?: string;
}) {
  const query = new URLSearchParams({
    type: filters.type,
    from: filters.dateFrom,
    to: filters.dateTo,
    ...(filters.status ? { status: filters.status } : {}),
    format: "csv",
  });
  const exportHref = `/api/${portal}/reports?${query.toString()}`;
  const columns = reportColumns[filters.type];

  return (
    <div className="slice10-reports">
      <section className="v14-hero slice10-report-hero">
        <div>
          <p className="v14-eyebrow">Fixed reports</p>
          <h1>ศูนย์รายงาน</h1>
          <p>
            รายงานจากข้อมูลธุรกรรมจริง จำกัดตามสิทธิ์และช่วงเวลาที่เลือก
          </p>
        </div>
        <span className="v14-status v14-status--good">ข้อมูลตามสิทธิ์</span>
      </section>

      <nav className="slice10-report-tabs" aria-label="ประเภทรายงาน">
        {fixedReportTypes.map((type) => (
          <Link
            key={type}
            className={type === filters.type ? "active" : ""}
            href={`?type=${type}&from=${filters.dateFrom}&to=${filters.dateTo}`}
          >
            {reportLabels[type]}
          </Link>
        ))}
      </nav>

      <section className="v14-panel slice10-report-panel">
        <form method="get" className="slice10-report-filters">
          <input type="hidden" name="type" value={filters.type} />
          <label>
            <span>วันที่เริ่ม</span>
            <input type="date" name="from" defaultValue={filters.dateFrom} />
          </label>
          <label>
            <span>วันที่สิ้นสุด</span>
            <input type="date" name="to" defaultValue={filters.dateTo} />
          </label>
          <label>
            <span>สถานะ</span>
            <select name="status" defaultValue={filters.status}>
              <option value="">ทุกสถานะ</option>
              {reportStatusOptions[filters.type].map((status) => (
                <option key={status} value={status}>
                  {translateStatus(status)}
                </option>
              ))}
            </select>
          </label>
          <button className="v14-button v14-button--primary" type="submit">
            แสดงรายงาน
          </button>
          {report && !error ? (
            <Link className="v14-button" href={exportHref}>
              <Download size={15} />
              Export CSV
            </Link>
          ) : null}
        </form>

        <div className="slice10-report-meta">
          <div>
            <strong>{reportLabels[filters.type]}</strong>
            <span>
              ช่วง {filters.dateFrom} ถึง {filters.dateTo}
              {filters.status ? ` · ${translateStatus(filters.status)}` : ""}
            </span>
          </div>
          <div>
            <span>{report?.row_count ?? 0} แถว</span>
            <span>
              Generate{" "}
              {report
                ? new Intl.DateTimeFormat("th-TH", {
                    timeZone: "Asia/Bangkok",
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(report.generated_at))
                : "—"}
            </span>
          </div>
        </div>

        {error ? (
          <div className="slice10-error" role="alert">
            <FileBarChart2 size={22} />
            <div>
              <strong>โหลดรายงานไม่สำเร็จ</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : report?.rows.length ? (
          <div className="slice10-table-wrap">
            <table className="slice10-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  <th>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => {
                  const href = detailHref(portal, filters.type, row);
                  return (
                    <tr key={String(row.id ?? `${filters.type}-${index}`)}>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={
                            column.kind === "money" ? "slice10-number" : undefined
                          }
                        >
                          {formatReportValue(row, column)}
                        </td>
                      ))}
                      <td>
                        {href ? (
                          <Link href={href} aria-label="เปิดรายการต้นทาง">
                            เปิด <ExternalLink size={14} />
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="slice10-empty">
            <FileBarChart2 size={22} />
            <strong>ไม่พบข้อมูลในช่วงที่เลือก</strong>
            <span>ลองเปลี่ยนช่วงวันที่หรือเลือกทุกสถานะ</span>
          </div>
        )}
      </section>
    </div>
  );
}
