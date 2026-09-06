import type { Metadata } from "next";
import { SaleLanding } from "@/components/sale-landing";
export const metadata: Metadata = {
  title: "ซื้อสินค้าจากจีน มีทีมดูแล มีระบบรองรับ",
  robots: { index: false, follow: false },
};
export default function SalePage() { return <SaleLanding preview />; }
