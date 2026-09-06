"use client";

import { ArrowRight, Boxes, Film, RotateCcw } from "lucide-react";

export function DemoLauncher({ onSelect }: { onSelect: (mode: "overview" | "prototype") => void }) {
  return (
    <main className="demo-canvas relative min-h-screen overflow-hidden bg-porcelain text-ink">
      <div className="absolute -right-28 -top-36 size-[520px] rounded-full bg-brass/15 blur-3xl" />
      <div className="relative mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="flex items-center justify-between border-b border-ink/10 pb-6">
          <div className="flex items-center gap-4">
            <span className="grid size-11 place-items-center rounded-xl bg-ink text-xs font-black tracking-[.16em] text-porcelain">GI</span>
            <div><p className="font-display text-xl font-semibold">GISP Demo</p><p className="text-[10px] font-bold uppercase tracking-[.22em] text-ink/40">Riverstone dossier</p></div>
          </div>
          <span className="demo-stamp rotate-[-2deg] border-2 border-lacquer px-3 py-1 text-[10px] font-black tracking-[.2em] text-lacquer">DEMO DATA</span>
        </header>

        <section className="grid min-h-[78vh] items-center gap-12 py-12 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.26em] text-lacquer">Choose your route</p>
            <h1 className="mt-5 max-w-[11ch] font-display text-5xl font-semibold leading-[1.05] tracking-[-.045em] sm:text-6xl">เห็นภาพรวม หรือทดลองทำงานจริง</h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-ink/55">ใช้ข้อมูลจำลองโครงการ Riverstone ชุดเดียวกัน เลือกชมเรื่องราว 10 ขั้น หรือทดลองกรอก อนุมัติ ส่งต่องาน และแก้เหตุการณ์ใน 5 Workflow</p>
            <p className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-jade"><RotateCcw size={14} /> ข้อมูล Prototype บันทึกเฉพาะ Browser และ Reset ได้</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <button type="button" onClick={() => onSelect("overview")} className="group min-h-[390px] rounded-[34px] border border-ink/10 bg-white/75 p-7 text-left shadow-paper transition hover:-translate-y-1 hover:border-brass/50" data-testid="mode-overview">
              <span className="grid size-12 place-items-center rounded-2xl bg-ink text-porcelain"><Film size={21} /></span>
              <p className="mt-14 text-[10px] font-black uppercase tracking-[.22em] text-brass">Route 01 · 10 scenes</p>
              <h2 className="mt-3 font-display text-3xl font-semibold">Overview Demo</h2>
              <p className="mt-4 text-sm leading-7 text-ink/50">เหมาะสำหรับแนะนำธุรกิจและดู Workflow ตั้งแต่ Project ถึง Claim แบบ Guided Story</p>
              <span className="mt-9 inline-flex items-center gap-2 text-xs font-black text-lacquer">เริ่มชมภาพรวม <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
            </button>
            <button type="button" onClick={() => onSelect("prototype")} className="group min-h-[390px] rounded-[34px] bg-ink p-7 text-left text-porcelain shadow-[0_28px_80px_rgba(23,32,28,.22)] transition hover:-translate-y-1" data-testid="mode-prototype">
              <span className="grid size-12 place-items-center rounded-2xl bg-lacquer text-white"><Boxes size={21} /></span>
              <p className="mt-14 text-[10px] font-black uppercase tracking-[.22em] text-brass">Route 02 · Hands-on</p>
              <h2 className="mt-3 font-display text-3xl font-semibold">Functional Prototype</h2>
              <p className="mt-4 text-sm leading-7 text-porcelain/55">ทดลองเพิ่มสินค้า ออกใบเสนอราคา แบ่งจ่าย ตรวจ QC จัด Partial Shipment และปิด Claim</p>
              <span className="mt-9 inline-flex items-center gap-2 text-xs font-black text-brass">เปิดพื้นที่ทดลอง <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

