import Link from "next/link";
import { Boxes, FileCheck2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return <main className="ui-auth grid min-h-screen bg-porcelain lg:grid-cols-[.9fr_1.1fr]">
    <section className="relative hidden overflow-hidden bg-ink p-12 text-porcelain lg:flex lg:flex-col"><div className="paper-grid absolute inset-0 opacity-[.08]" /><div className="relative z-10"><BrandMark inverse /></div><div className="relative z-10 my-auto max-w-xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-brass">GISP · เข้าสู่ระบบ</p><h2 className="mt-5 font-display text-5xl font-semibold leading-[1.1]">ความน่าเชื่อถือ<br />เริ่มที่สิทธิ์เข้าถึง</h2><p className="mt-6 text-sm leading-7 text-porcelain/70">เข้าใช้งานข้อมูลบริษัท โครงการ และรายการสินค้าของคุณอย่างปลอดภัย</p><div className="mt-9 grid gap-3 sm:grid-cols-3">{[[ShieldCheck,"Session Guard"],[Boxes,"One Profile"],[FileCheck2,"Audit Trail"]].map(([Icon,label])=>{const I=Icon as typeof ShieldCheck;return <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><I size={17} className="text-brass"/><p className="mt-3 text-xs font-bold">{String(label)}</p></div>})}</div></div></section>
    <section className="flex min-h-screen flex-col px-6 py-6 sm:px-10 lg:px-16"><div className="flex items-center justify-between"><div className="lg:hidden"><BrandMark /></div><Link href="/" className="ml-auto text-xs font-bold text-ink/60">กลับหน้าหลัก</Link></div><div className="flex flex-1 items-center justify-center py-12">{children}</div></section>
  </main>;
}

