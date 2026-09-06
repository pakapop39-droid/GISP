import type { Metadata } from "next";
import { DemoPortal } from "@/components/demo/demo-portal";
import { DemoVersionLanding } from "@/components/demo-v14/landing";
import { SaleLanding } from "@/components/sale-landing";

export const metadata: Metadata = {
  title: "ซื้อสินค้าจากจีน มีทีมดูแล มีระบบรองรับ",
  description: "GISP ช่วยจัดซื้อเฟอร์นิเจอร์และวัสดุตกแต่งจากจีน ผ่านโรงงานและซัพพลายเออร์ที่คัดเลือก พร้อมทีมประสาน QC ติดตามจัดส่ง และจัดรายการสินค้าตามโครงการ",
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (process.env.APP_MODE === "demo") {
    const { mode } = await searchParams;
    return mode === "overview" || mode === "prototype" ? <DemoPortal /> : <DemoVersionLanding />;
  }
  return <SaleLanding />;
}
