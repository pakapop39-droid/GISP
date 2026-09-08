import { ArrowUpRight, BarChart3, Building2, FolderKanban, Link2, ScanSearch, ShoppingBag } from "lucide-react";
import Link from "next/link";
import {
  ActionRequiredList,
  CurrencyAmounts,
  DashboardErrorState,
  DashboardMetricGrid,
  type DashboardMetric,
} from "@/components/dashboard-panels";
import { requireAppAccess } from "@/lib/auth/session";
import { getMemberDashboard } from "@/modules/reports/repository";
import type { MemberDashboard as MemberDashboardData } from "@/modules/reports/types";

export default async function MemberDashboard() {
  const context = await requireAppAccess({ active: true });
  if (process.env.RELEASE_STAGE === "B") {
    const sharedCatalogEnabled = process.env.NEXT_PUBLIC_ENABLE_SHARED_CATALOGS === "true";
    const productSourcingEnabled = process.env.NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING === "true";
    const actions = [
      { href: "/member/catalog", label: "เลือกสินค้าจาก Catalog", note: "ค้นหาสินค้าและดูรายละเอียดสำหรับงานของคุณ", icon: ShoppingBag, enabled: true },
      { href: "/member/projects", label: "จัดสินค้าเข้าโครงการ", note: "แยกพื้นที่ จำนวน และตัวเลือกสินค้าของแต่ละโครงการ", icon: FolderKanban, enabled: true },
      { href: "/member/shared-catalogs", label: "ส่ง Catalog ให้ลูกค้า", note: "สร้างลิงก์สินค้ารายชิ้น โครงการ หรือสินค้าทั้งหมดโดยไม่แสดงราคา", icon: Link2, enabled: sharedCatalogEnabled },
      { href: "/member/sourcing-requests", label: "ส่งภาพให้ช่วยจัดหา", note: "แนบภาพสินค้าที่ไม่มีในแอปและติดตามตัวเลือกจากทีม GISP", icon: ScanSearch, enabled: productSourcingEnabled },
      { href: "/member/profile", label: "ตรวจข้อมูลบริษัท", note: "อัปเดตข้อมูลติดต่อที่ใช้กับบัญชี Member", icon: Building2, enabled: true },
    ].filter((item) => item.enabled);

    return <div className="member-catalog">
      <section className="v14-hero ui-dashboard-hero">
        <div>
          <p className="v14-eyebrow">Member pilot</p>
          <h1>สวัสดี, {context.displayName ?? context.companyName ?? "สมาชิก GISP"}</h1>
          <p>เลือกสินค้า วางโครงการ ส่ง Catalog ให้ลูกค้า หรือส่งภาพให้ทีม GISP ช่วยจัดหา</p>
        </div>
        <span className="v14-status v14-status--good">PILOT ACTIVE</span>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {actions.map(({ href, label, note, icon: Icon }) => <Link key={href} href={href} className="v14-panel block">
          <Icon size={24} />
          <h2 className="mt-3">{label}</h2>
          <p className="mt-2">{note}</p>
          <span className="mt-4 inline-flex items-center gap-2 font-semibold">เปิดใช้งาน <ArrowUpRight size={15} /></span>
        </Link>)}
      </section>
      <section className="v14-panel">
        <p className="v14-eyebrow">ขอบเขตช่วงทดลองใช้</p>
        <h2>ยังไม่เปิดการสั่งซื้อและชำระเงินผ่านระบบ</h2>
        <p className="mt-2">หากต้องการสอบถามราคา สั่งซื้อ หรือดำเนินการต่อ กรุณาติดต่อทีม GISP ตามช่องทางที่ได้รับ</p>
      </section>
    </div>;
  }
  let dashboard: MemberDashboardData | null = null;
  try {
    dashboard = await getMemberDashboard();
  } catch {
    dashboard = null;
  }

  const metrics: DashboardMetric[] = dashboard
    ? [
        {
          key: "action",
          label: "ต้องดำเนินการ",
          value: dashboard.metrics.action_required,
          note: "เรียงตามความเร่งด่วน",
          icon: "action",
          tone: dashboard.metrics.action_required ? "warning" : "good",
        },
        {
          key: "orders",
          label: "Order กำลังดำเนินการ",
          value: dashboard.metrics.active_orders,
          note: `${dashboard.metrics.orders_in_production} Order อยู่ระหว่างผลิต`,
          icon: "order",
        },
        {
          key: "shipment",
          label: "Shipment ระหว่างขนส่ง",
          value: dashboard.metrics.shipments_in_transit,
          note: "ออกจากต้นทางถึงพิธีการนำเข้า",
          icon: "shipment",
        },
        {
          key: "delivery",
          label: "นัดส่ง 7 วันข้างหน้า",
          value: dashboard.metrics.upcoming_deliveries,
          note: "ไม่นับรายการส่งเสร็จหรือส่งไม่สำเร็จ",
          icon: "delivery",
        },
        {
          key: "claim",
          label: "Claim ที่เปิดอยู่",
          value: dashboard.metrics.open_claims,
          note: "รวมเคสที่แก้ไขแล้วแต่ยังไม่ปิด",
          icon: "claim",
        },
      ]
    : [];

  return (
    <div className="slice10-dashboard">
      <section className="v14-hero ui-dashboard-hero slice10-dashboard-hero">
        <div>
          <p className="v14-eyebrow">Member dashboard</p>
          <h1>สวัสดี, {context.displayName ?? context.companyName ?? "สมาชิก GISP"}</h1>
          <p>งานที่ต้องทำ สถานะ Order และยอดคงค้างของบริษัทคุณ</p>
        </div>
        <div className="slice10-hero-actions">
          <Link className="v14-button" href="/member/reports">
            <BarChart3 size={16} />
            ดูรายงาน
          </Link>
          <span className="v14-status v14-status--good">ข้อมูลธุรกรรมจริง</span>
        </div>
      </section>

      {dashboard ? (
        <>
          <DashboardMetricGrid metrics={metrics} />
          <section className="v14-panel slice10-outstanding">
            <div>
              <p className="v14-eyebrow">Customer outstanding</p>
              <h2>ยอดที่ยังต้องชำระ</h2>
              <span>คำนวณจากยอดตาม Schedule ลบยอดที่ Finance ตรวจรับแล้ว</span>
            </div>
            <CurrencyAmounts items={dashboard.metrics.outstanding_by_currency} />
          </section>
          <ActionRequiredList actions={dashboard.actions} portal="member" />
          <div className="slice10-dashboard-links">
            <Link href="/member/orders">
              ดู Order ทั้งหมด <ArrowUpRight size={15} />
            </Link>
            <Link href="/member/claims">
              ดู Claim ทั้งหมด <ArrowUpRight size={15} />
            </Link>
          </div>
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
