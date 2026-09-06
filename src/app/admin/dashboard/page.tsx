import { BarChart3, LineChart } from "lucide-react";
import Link from "next/link";
import {
  ActionRequiredList,
  DashboardErrorState,
  DashboardMetricGrid,
  type DashboardMetric,
} from "@/components/dashboard-panels";
import { requireAppAccess } from "@/lib/auth/session";
import { getAdminOperationsDashboard } from "@/modules/reports/repository";
import type { AdminOperationsDashboard } from "@/modules/reports/types";

export default async function AdminDashboardPage() {
  const context = await requireAppAccess({
    permissions: ["reports.fixed.read"],
  });
  let dashboard: AdminOperationsDashboard | null = null;
  try {
    dashboard = await getAdminOperationsDashboard();
  } catch {
    dashboard = null;
  }

  const metricDefinitions: Array<{
    key: keyof NonNullable<AdminOperationsDashboard["metrics"]>;
    label: string;
    note: string;
    icon: DashboardMetric["icon"];
    tone?: DashboardMetric["tone"];
  }> = [
    {
      key: "action_required",
      label: "ต้องดำเนินการ",
      note: "รวมเฉพาะ Workflow ที่คุณมีสิทธิ์",
      icon: "action",
      tone: "warning",
    },
    {
      key: "active_orders",
      label: "Order กำลังดำเนินการ",
      note: "ไม่รวมเสร็จสิ้นและยกเลิก",
      icon: "order",
    },
    {
      key: "payment_reviews",
      label: "Payment รอตรวจ",
      note: "หลักฐานที่ Member ส่งแล้ว",
      icon: "payment",
    },
    {
      key: "production_delays",
      label: "Production ล่าช้า",
      note: "อ้างอิงสถานะล่าสุดต่อ Supplier Order",
      icon: "production",
      tone: "bad",
    },
    {
      key: "qc_actions",
      label: "QC ต้องดำเนินการ",
      note: "Rework หรือรอ Member อนุมัติ",
      icon: "time",
    },
    {
      key: "shipments_in_transit",
      label: "Shipment ระหว่างทาง",
      note: "ตั้งแต่ออกจากต้นทางถึงพิธีการนำเข้า",
      icon: "shipment",
    },
    {
      key: "deliveries_due",
      label: "Delivery ใกล้ถึงกำหนด",
      note: "ภายใน 7 วันและรายการค้าง",
      icon: "delivery",
    },
    {
      key: "open_claims",
      label: "Claim ที่เปิดอยู่",
      note: "ไม่รวมปิดและไม่รับ Claim",
      icon: "claim",
    },
  ];
  const metrics: DashboardMetric[] = dashboard
    ? metricDefinitions
        .filter(({ key }) => dashboard?.metrics[key] !== null)
        .map(({ key, ...definition }) => ({
          ...definition,
          key,
          value: dashboard?.metrics[key] ?? 0,
        }))
    : [];

  return (
    <div className="slice10-dashboard">
      <section className="v14-hero slice10-dashboard-hero">
        <div>
          <p className="v14-eyebrow">Operations dashboard</p>
          <h1>งานที่ต้องดำเนินการ</h1>
          <p>
            Queue จากข้อมูลธุรกรรมจริง แสดงเฉพาะ Workflow ที่{" "}
            {context.displayName} มีสิทธิ์
          </p>
        </div>
        <div className="slice10-hero-actions">
          {dashboard?.permissions.reports ? (
            <Link className="v14-button" href="/admin/reports">
              <BarChart3 size={16} />
              Fixed Reports
            </Link>
          ) : null}
          {dashboard?.permissions.executive ? (
            <Link className="v14-button" href="/admin/executive">
              <LineChart size={16} />
              Executive
            </Link>
          ) : null}
        </div>
      </section>
      {dashboard ? (
        <>
          <DashboardMetricGrid metrics={metrics} />
          <ActionRequiredList actions={dashboard.actions} portal="admin" />
          <p className="slice10-generated">
            อัปเดต{" "}
            {new Intl.DateTimeFormat("th-TH", {
              timeZone: "Asia/Bangkok",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(dashboard.generated_at))}
          </p>
        </>
      ) : (
        <DashboardErrorState />
      )}
    </div>
  );
}
