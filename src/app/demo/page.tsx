import type { Metadata } from "next";
import { DemoPortal } from "@/components/demo/demo-portal";

export const metadata: Metadata = {
  title: "Interactive Demo",
  description:
    "Demo ภาพรวม GISP ตั้งแต่ Project, RFQ, Quotation, Order, QC จนถึง Delivery และ Claim",
};

export default function DemoPage() {
  return <DemoPortal />;
}
