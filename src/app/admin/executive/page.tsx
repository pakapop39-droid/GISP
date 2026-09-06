import { BarChart3 } from "lucide-react";
import Link from "next/link";
import {
  CurrencyAmounts,
  DashboardMetricGrid,
  type DashboardMetric,
} from "@/components/dashboard-panels";
import { requireAppAccess } from "@/lib/auth/session";
import { getExecutiveDashboard } from "@/modules/reports/repository";

function currentBangkokDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireAppAccess({ permissions: ["reports.executive.read"] });
  const params = await searchParams;
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "")
    ? String(params.to)
    : currentBangkokDate();
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "")
    ? String(params.from)
    : `${dateTo.slice(0, 4)}-01-01`;
  const dashboard = await getExecutiveDashboard(dateFrom, dateTo);
  const operational: DashboardMetric[] = [
    ["active_orders", "Order กำลังดำเนินการ", dashboard.operational.active_orders, "ไม่รวมเสร็จสิ้นและยกเลิก", "order"],
    ["production", "Order กำลังผลิต", dashboard.operational.orders_in_production, "สถานะ Order ปัจจุบัน", "production"],
    ["delay", "Production ล่าช้า", dashboard.operational.production_delayed, "สถานะล่าสุดต่อ Supplier Order", "time"],
    ["qc", "QC มีปัญหา", dashboard.operational.qc_issues, "Failed, Rework หรือขอตรวจเพิ่ม", "action"],
    ["shipment", "สินค้าอยู่ระหว่างทาง", dashboard.operational.goods_in_transit, "Shipment ที่ยังไม่ถึงปลายทาง", "shipment"],
    ["delivery", "Delivery ใกล้ถึงกำหนด", dashboard.operational.deliveries_due, "รายการค้างภายใน 7 วัน", "delivery"],
    ["claim", "Claim ที่เปิดอยู่", dashboard.operational.open_claims, "ไม่รวมปิดและไม่รับ Claim", "claim"],
  ].map(([key, label, value, note, icon]) => ({
    key: String(key),
    label: String(label),
    value: Number(value),
    note: String(note),
    icon: icon as DashboardMetric["icon"],
  }));

  const financial = [
    ["มูลค่า Order", dashboard.financial.order_value],
    ["รับชำระแล้ว", dashboard.financial.collected],
    ["ลูกหนี้คงค้าง", dashboard.financial.customer_outstanding],
    ["ยอดค้างชำระ Partner", dashboard.financial.supplier_payable],
    ["ค่าขนส่งคงค้าง", dashboard.financial.freight_outstanding],
  ] as const;

  return (
    <div className="slice10-dashboard">
      <section className="v14-hero slice10-dashboard-hero">
        <div>
          <p className="v14-eyebrow">Executive read-only summary</p>
          <h1>ภาพรวมผู้บริหาร</h1>
          <p>ยอดทางการเงินแยกตาม Currency และสถานะปฏิบัติการปัจจุบัน</p>
        </div>
        <Link className="v14-button" href="/admin/reports">
          <BarChart3 size={16} />
          Fixed Reports
        </Link>
      </section>

      <form method="get" className="v14-panel slice10-executive-filter">
        <label>
          <span>วันที่เริ่ม</span>
          <input type="date" name="from" defaultValue={dateFrom} />
        </label>
        <label>
          <span>วันที่สิ้นสุด</span>
          <input type="date" name="to" defaultValue={dateTo} />
        </label>
        <button className="v14-button v14-button--primary" type="submit">
          อัปเดตสรุป
        </button>
      </form>

      <section className="slice10-financial-grid" aria-label="สรุปการเงิน">
        {financial.map(([label, amounts]) => (
          <article key={label} className="v14-panel">
            <span>{label}</span>
            <CurrencyAmounts items={amounts} emptyLabel="ไม่มียอดในช่วงนี้" />
          </article>
        ))}
      </section>

      <section className="ui-section">
        <div className="ui-section__heading">
          <div>
            <p className="v14-eyebrow">Operational status</p>
            <h2>สถานะการดำเนินงาน</h2>
          </div>
        </div>
        <DashboardMetricGrid metrics={operational} />
      </section>

      <section className="v14-panel slice10-business">
        <div><span>สมาชิก Active</span><strong>{dashboard.business.active_members}</strong></div>
        <div><span>สมาชิกที่มี Order</span><strong>{dashboard.business.members_with_orders}</strong></div>
        <div><span>Partner Active</span><strong>{dashboard.business.active_suppliers}</strong></div>
        <div><span>สินค้า Published</span><strong>{dashboard.business.active_products}</strong></div>
      </section>

      <p className="slice10-generated">
        Generate{" "}
        {new Intl.DateTimeFormat("th-TH", {
          timeZone: "Asia/Bangkok",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(dashboard.generated_at))}
      </p>
    </div>
  );
}
