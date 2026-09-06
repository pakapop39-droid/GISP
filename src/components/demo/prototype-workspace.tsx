"use client";

import Decimal from "decimal.js";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Menu,
  Printer,
  RefreshCcw,
  Search,
  ShoppingBag,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  demoRoles,
  dispatchGateForItem,
  mvpPreparationProgress,
  paymentSummary,
  projectItemTotal,
  selectMemberCatalog,
  type DemoFileMeta,
  type DemoRole,
  type PrototypeModule,
} from "@/demo";
import { usePrototype } from "./prototype-context";
import {
  FoundationPermissionDemo,
  ProductSupplierAdminDemo,
  RoleDashboardDemo,
  UatSignOffDemo,
} from "./prototype-preparation";

const roleLabels: Record<DemoRole, string> = {
  MEMBER: "Member · Atelier Nara",
  GISP_ADMIN: "GISP Admin",
  FINANCE: "Finance",
  QC: "QC Inspector",
  LOGISTICS: "Logistics",
  EXECUTIVE: "Executive Viewer",
};

const modules: Array<{ id: PrototypeModule; label: string; short: string; icon: typeof LayoutDashboard }> = [
  { id: "FOUNDATION", label: "Foundation & Permission", short: "Foundation", icon: UserRound },
  { id: "ACTION_CENTER", label: "Action Required", short: "Action", icon: LayoutDashboard },
  { id: "PRODUCT_ADMIN", label: "Product & Supplier Admin", short: "Master", icon: ShoppingBag },
  { id: "DASHBOARDS", label: "Role Dashboards", short: "Dashboard", icon: LayoutDashboard },
  { id: "CATALOG", label: "Catalog & Project", short: "Project", icon: ShoppingBag },
  { id: "RFQ", label: "RFQ & Quotation", short: "RFQ", icon: FileText },
  { id: "ORDER", label: "Order & Payment", short: "Order", icon: BookOpenCheck },
  { id: "QC", label: "Production & QC", short: "QC", icon: ClipboardCheck },
  { id: "SHIPMENT", label: "Shipment & Claim", short: "Shipment", icon: Truck },
  { id: "DOCUMENTS", label: "Documents & Audit", short: "Docs", icon: FileText },
  { id: "UAT", label: "UAT & Sign-off", short: "UAT", icon: CheckCircle2 },
];

const roleForNext: Record<PrototypeModule, DemoRole> = {
  FOUNDATION: "GISP_ADMIN",
  ACTION_CENTER: "MEMBER",
  PRODUCT_ADMIN: "GISP_ADMIN",
  DASHBOARDS: "GISP_ADMIN",
  CATALOG: "MEMBER",
  RFQ: "GISP_ADMIN",
  ORDER: "FINANCE",
  QC: "QC",
  SHIPMENT: "LOGISTICS",
  DOCUMENTS: "MEMBER",
  UAT: "GISP_ADMIN",
};

function baht(value: string | number) {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const styles = { neutral: "bg-ink/6 text-ink/55", good: "bg-jade/10 text-jade", warn: "bg-brass/15 text-[#79571f]", bad: "bg-lacquer/10 text-lacquer" };
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${styles[tone]}`}>{children}</span>;
}

function Panel({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-[26px] border border-ink/10 bg-white/70 p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.24em] text-lacquer">{eyebrow}</p><h2 className="mt-2 font-display text-2xl font-semibold">{title}</h2></div>{action}</div>{children}</section>;
}

function ProductImage({ index, className = "" }: { index: number; className?: string }) {
  const x = index % 3;
  const y = Math.floor(index / 3);
  return <div role="img" aria-label="ภาพสินค้าจำลอง" className={`bg-cover bg-no-repeat ${className}`} style={{ backgroundImage: "url('/demo-assets/prototype-product-sheet.png')", backgroundSize: "300% 200%", backgroundPosition: `${x * 50}% ${y * 100}%` }} />;
}

function EvidenceImage({ index, className = "" }: { index: number; className?: string }) {
  return <div role="img" aria-label="ภาพหลักฐานจำลอง" className={`bg-cover bg-no-repeat ${className}`} style={{ backgroundImage: "url('/demo-assets/prototype-evidence-sheet.png')", backgroundSize: "300% 100%", backgroundPosition: `${index * 50}% 0%` }} />;
}

function fileMeta(fileList: FileList | null): DemoFileMeta[] {
  return Array.from(fileList ?? []).map((file) => ({ name: file.name, type: file.type || "application/octet-stream", size: file.size }));
}

function Handoff({ role, module, label }: { role: DemoRole; module: PrototypeModule; label?: string }) {
  const { act } = usePrototype();
  return <button type="button" onClick={() => act({ type: "SWITCH_ROLE", role, module })} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white">{label ?? `ส่งต่อให้ ${roleLabels[role].split(" · ")[0]}`} <ArrowRight size={14} /></button>;
}

function ActionCenter() {
  const { state, act } = usePrototype();
  const progress = mvpPreparationProgress(state);
  const cards = [
    { title: "อนุมัติสมาชิก", done: progress.missions[0], module: "FOUNDATION" as const, detail: "สมัคร บริษัท และ Admin Approval" },
    { title: "ตรวจ Permission", done: progress.missions[1], module: "FOUNDATION" as const, detail: "Pending, Cross-org และ Member-safe" },
    { title: "Publish Product Draft", done: progress.missions[2], module: "PRODUCT_ADMIN" as const, detail: "Supplier, ราคา และ Member Preview" },
    { title: "ยืนยัน Custom Quotation", done: progress.missions[3], module: "RFQ" as const, detail: "Version, Expiry และ Snapshot" },
    { title: "ชำระ Deposit", done: progress.missions[4], module: "ORDER" as const, detail: "แบ่งโอนและ Finance Verify" },
    { title: "ผ่าน QC", done: progress.missions[5], module: "QC" as const, detail: "Rework, Reinspection และ Correction" },
    { title: "บันทึก Delivery", done: progress.missions[6], module: "SHIPMENT" as const, detail: "Partial Shipment, Proof และ Claim" },
    { title: "UAT Sign-off", done: progress.missions[7], module: "UAT" as const, detail: "ผ่านครบ 8 Scenario ก่อน MVP Build" },
  ];
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[30px] bg-ink p-7 text-porcelain sm:p-9"><div className="absolute -right-20 -top-24 size-72 rounded-full bg-brass/15 blur-3xl" /><div className="relative grid gap-7 lg:grid-cols-[1fr_auto]"><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-brass">Mission control</p><h1 className="mt-3 max-w-[15ch] font-display text-4xl font-semibold leading-tight">Riverstone พร้อมไปขั้นไหนแล้ว</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-porcelain/55">ทำทีละ Workflow แล้วส่งต่องานระหว่าง Member, Admin, Finance, QC และ Logistics</p></div><div className="grid size-36 place-items-center rounded-full border border-white/15 bg-white/5"><div className="text-center"><p className="font-display text-4xl font-semibold text-brass">{progress.complete}/{progress.total}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-porcelain/45">missions</p></div></div></div></section>
    <div className="grid gap-3">{cards.map((card, index) => <button type="button" key={card.title} onClick={() => act({ type: "SET_MODULE", module: card.module })} className="group flex items-center gap-4 rounded-2xl border border-ink/10 bg-white/70 p-4 text-left transition hover:border-brass/50"><span className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-black ${card.done ? "bg-jade text-white" : "bg-ink/6 text-ink/45"}`}>{card.done ? <CheckCircle2 size={18} /> : index + 1}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{card.title}</span><span className="mt-1 block text-xs text-ink/45">{card.detail}</span></span><ArrowRight size={16} className="text-ink/25 transition group-hover:translate-x-1" /></button>)}</div>
  </div>;
}

function CatalogProject() {
  const { state, act } = usePrototype();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [area, setArea] = useState("Lobby");
  const [quantity, setQuantity] = useState(1);
  const memberCatalogIds = new Set(selectMemberCatalog(state).map((item) => item.id));
  const shown = state.catalog.filter((item) => memberCatalogIds.has(item.id) && (category === "ALL" || item.category === category) && `${item.nameTh} ${item.nameEn} ${item.sku}`.toLowerCase().includes(query.toLowerCase()));
  const total = state.projectItems.reduce((sum, item) => sum.add(projectItemTotal(state, item)), new Decimal(0)).toFixed(2);
  return <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
    <Panel eyebrow="Mission 01" title="Catalog · Member Price" action={<StatusPill>{shown.length} products</StatusPill>}>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px]"><label className="relative"><Search size={15} className="absolute left-3 top-3.5 text-ink/35" /><span className="sr-only">ค้นหาสินค้า</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อหรือ SKU" className="w-full rounded-xl border border-ink/10 bg-white py-3 pl-9 pr-3 text-xs outline-none focus:border-brass" /></label><select aria-label="กรองหมวดสินค้า" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-ink/10 bg-white px-3 text-xs"><option value="ALL">ทุกหมวด</option>{[...new Set(state.catalog.map((item) => item.category))].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="grid gap-4 md:grid-cols-2">{shown.map((product) => { const index = state.catalog.findIndex((item) => item.id === product.id); return <article key={product.id} className="overflow-hidden rounded-2xl border border-ink/10 bg-white"><ProductImage index={index} className="h-44 border-b border-ink/8" /><div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-wider text-ink/40">{product.sku} · {product.category}</p><h3 className="mt-1 text-sm font-bold">{product.nameTh}</h3></div><StatusPill tone={product.kind === "CUSTOM" ? "warn" : "good"}>{product.kind}</StatusPill></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-ink/48">{product.specification}</p><p className="mt-4 font-display text-xl font-semibold">฿{baht(product.memberUnitPrice)}</p><div className="mt-4 grid grid-cols-[1fr_74px_auto] gap-2"><select aria-label={`พื้นที่สำหรับ ${product.nameTh}`} value={area} onChange={(e) => setArea(e.target.value)} className="min-w-0 rounded-lg border border-ink/10 px-2 text-[10px]">{state.project.areas.map((item) => <option key={item}>{item}</option>)}</select><input aria-label={`จำนวน ${product.nameTh}`} type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="rounded-lg border border-ink/10 px-2 text-xs" /><button type="button" disabled={state.activeRole !== "MEMBER"} onClick={() => act({ type: "ADD_PROJECT_ITEM", productId: product.id, quantity, area })} className="rounded-lg bg-lacquer px-3 py-2 text-[10px] font-bold text-white disabled:opacity-30">เพิ่ม</button></div></div></article>; })}</div>
    </Panel>
    <Panel eyebrow={state.project.code} title="Project Builder" action={<span className="font-display text-xl font-semibold">฿{baht(total)}</span>}>
      <p className="mb-4 text-xs text-ink/45">{state.project.name} · คำนวณราคาก่อน VAT แบบสด</p>
      <div className="space-y-3">{state.projectItems.map((item) => { const product = state.catalog.find((entry) => entry.id === item.productId); return <div key={item.id} className="rounded-xl border border-ink/10 bg-white p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold">{product?.nameTh}</p><p className="mt-1 text-[10px] text-ink/40">{item.area} · {item.kind}</p></div><StatusPill tone={item.status === "READY_TO_ORDER" ? "good" : "warn"}>{item.status === "READY_TO_ORDER" ? "Ready" : "Blocked"}</StatusPill></div><div className="mt-3 flex items-center justify-between gap-2"><input aria-label={`แก้จำนวน ${product?.nameTh}`} type="number" min="1" value={item.quantity} disabled={state.activeRole !== "MEMBER" || item.status === "ORDERED"} onChange={(e) => act({ type: "UPDATE_PROJECT_ITEM", itemId: item.id, quantity: Number(e.target.value) })} className="w-20 rounded-lg border border-ink/10 px-2 py-1.5 text-xs disabled:opacity-45" /><p className="text-xs font-bold">฿{baht(projectItemTotal(state, item))}</p></div></div>; })}</div>
      <div className="mt-5 flex justify-end"><Handoff role="MEMBER" module="RFQ" label="ไปกรอก RFQ" /></div>
    </Panel>
  </div>;
}

function RfqQuotation() {
  const { state, act } = usePrototype();
  const customItems = state.projectItems.filter((item) => item.kind === "CUSTOM");
  const [spec, setSpec] = useState("เคาน์เตอร์วีเนียร์ Walnut ตาม Shop Drawing พร้อม Cable Management และไฟ LED");
  const [files, setFiles] = useState<DemoFileMeta[]>([]);
  const [price, setPrice] = useState("165000.00");
  const latest = state.quotations.at(-1);
  const isAdmin = state.activeRole === "GISP_ADMIN";
  return <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
    <Panel eyebrow="Mission 02 · RFQ" title="Custom Request" action={<StatusPill tone={state.rfq ? "good" : "warn"}>{state.rfq?.status ?? "NOT SENT"}</StatusPill>}>
      {!customItems.length ? <p className="rounded-xl bg-brass/10 p-4 text-xs leading-6 text-[#79571f]">กลับไป Catalog แล้วเพิ่มสินค้า Custom ก่อนครับ</p> : <><label className="block text-xs font-bold">Confirmed specification<textarea value={state.rfq?.specification ?? spec} onChange={(e) => setSpec(e.target.value)} disabled={Boolean(state.rfq && state.rfq.status !== "NEEDS_INFO")} rows={6} className="mt-2 w-full rounded-xl border border-ink/10 bg-white p-3 text-xs leading-6 disabled:bg-ink/[.03]" /></label><label className="mt-4 block text-xs font-bold">ไฟล์จำลอง<input aria-label="เลือกไฟล์ Shop Drawing จำลอง" type="file" multiple onChange={(e) => setFiles(fileMeta(e.target.files))} className="mt-2 block w-full rounded-xl border border-dashed border-ink/20 bg-white p-3 text-[10px]" /></label>{files.map((file) => <p key={file.name} className="mt-2 text-[10px] text-ink/45">{file.name} · {(file.size / 1024).toFixed(1)} KB · ไม่อัปโหลดจริง</p>)}
      {!state.rfq && <button type="button" disabled={state.activeRole !== "MEMBER"} onClick={() => act({ type: "SUBMIT_RFQ", itemIds: customItems.map((item) => item.id), title: "Riverstone Custom Lobby Package", specification: spec, files })} className="mt-5 w-full rounded-xl bg-lacquer px-4 py-3 text-xs font-bold text-white disabled:opacity-30">ส่ง RFQ</button>}
      {state.rfq?.status === "NEEDS_INFO" && <div className="mt-4 rounded-xl bg-brass/10 p-4"><p className="text-xs font-bold">Admin ขอข้อมูลเพิ่ม</p><p className="mt-1 text-xs text-ink/55">{state.rfq.adminMessage}</p><button type="button" disabled={state.activeRole !== "MEMBER"} onClick={() => act({ type: "RESUBMIT_RFQ", specification: spec })} className="mt-3 rounded-lg bg-ink px-3 py-2 text-[10px] font-bold text-white disabled:opacity-30">ส่งข้อมูลเพิ่ม</button></div>}
      {state.rfq && isAdmin && ["SUBMITTED", "READY_TO_QUOTE"].includes(state.rfq.status) && <button type="button" onClick={() => act({ type: "REQUEST_RFQ_INFO", message: "กรุณายืนยันตัวอย่างสีวีเนียร์และตำแหน่งปลั๊กไฟ" })} className="mt-4 w-full rounded-xl border border-ink/15 px-4 py-3 text-xs font-bold">ขอข้อมูลเพิ่ม</button>}</>}
    </Panel>
    <Panel eyebrow="GISP quotation" title="Version & Snapshot" action={latest && <StatusPill tone={latest.status === "ACCEPTED" ? "good" : "neutral"}>V{latest.version} · {latest.status}</StatusPill>}>
      {state.quotations.length > 0 && <div className="mb-5 grid gap-3 sm:grid-cols-2">{state.quotations.map((quote) => <div key={quote.id} className={`rounded-xl border p-4 ${quote.status === "SUPERSEDED" ? "border-ink/8 bg-ink/[.025] opacity-60" : "border-brass/40 bg-white"}`}><div className="flex justify-between"><p className="text-xs font-bold">{quote.number} · V{quote.version}</p><StatusPill tone={quote.status === "ACCEPTED" ? "good" : quote.status === "SUPERSEDED" ? "neutral" : "warn"}>{quote.status}</StatusPill></div><p className="mt-3 font-display text-xl font-semibold">฿{baht(quote.grandTotal)}</p><p className="mt-1 text-[10px] text-ink/45">ก่อน VAT {baht(quote.subtotal)} · VAT {quote.vatRate}%</p></div>)}</div>}
      {state.rfq && isAdmin && <div className="rounded-2xl bg-ink p-5 text-porcelain"><p className="text-[10px] font-bold uppercase tracking-widest text-brass">Quotation editor</p>{customItems.map((item) => <label key={item.id} className="mt-4 block text-xs">ราคาต่อหน่วย · {state.catalog.find((p) => p.id === item.productId)?.nameTh}<input value={price} onChange={(e) => setPrice(e.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2.5 text-white" /></label>)}<button type="button" onClick={() => act({ type: "SEND_QUOTATION", unitPrices: Object.fromEntries(customItems.map((item) => [item.id, price])), specification: spec, leadTimeDays: 60, validityDays: 30 })} className="mt-5 w-full rounded-xl bg-brass px-4 py-3 text-xs font-black text-ink">{latest ? "ออก Revision ใหม่" : "ส่ง Quotation"}</button></div>}
      {latest?.status === "SENT" && isAdmin && <button type="button" onClick={() => act({ type: "EXPIRE_QUOTATION", quotationId: latest.id })} className="mt-3 w-full rounded-xl border border-lacquer/30 px-4 py-3 text-xs font-bold text-lacquer">จำลอง Quotation หมดอายุ</button>}
      {latest?.status === "SENT" && state.activeRole === "MEMBER" && <div className="rounded-2xl border border-brass/30 bg-white p-5"><p className="text-sm font-bold">ใบเสนอราคา Active · V{latest.version}</p><p className="mt-2 text-xs leading-6 text-ink/50">เมื่อ Accept ระบบจะล็อกราคา สเปก VAT และ Lead Time แล้วปลด Block รายการ Custom</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => act({ type: "RESPOND_QUOTATION", quotationId: latest.id, response: "ACCEPT" })} className="rounded-xl bg-jade px-4 py-3 text-xs font-bold text-white">Accept & Snapshot</button><button type="button" onClick={() => act({ type: "RESPOND_QUOTATION", quotationId: latest.id, response: "REJECT" })} className="rounded-xl border border-lacquer/30 px-4 py-3 text-xs font-bold text-lacquer">Reject</button></div></div>}
      <div className="mt-5 flex justify-end">{isAdmin ? <Handoff role="MEMBER" module="RFQ" label="ส่งใบเสนอราคาให้ Member" /> : latest?.status === "ACCEPTED" ? <Handoff role="MEMBER" module="ORDER" label="ไปสร้าง Order" /> : state.rfq && ["SUBMITTED", "READY_TO_QUOTE", "QUOTED"].includes(state.rfq.status) ? <Handoff role="GISP_ADMIN" module="RFQ" label="ส่ง RFQ ให้ Admin" /> : null}</div>
    </Panel>
  </div>;
}

function OrderPayment() {
  const { state, act } = usePrototype();
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(state.projectItems.filter((item) => item.status === "READY_TO_ORDER").map((item) => [item.id, item.quantity])));
  const [amount, setAmount] = useState("100000.00");
  const [scheduleId, setScheduleId] = useState("schedule-deposit");
  const submitted = state.transfers.filter((item) => item.status === "SUBMITTED");
  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel eyebrow="Mission 03 · Order" title="เลือกบางรายการ / บางจำนวน" action={state.order && <StatusPill tone="good">{state.order.number}</StatusPill>}>
      {!state.order ? <><div className="space-y-3">{state.projectItems.map((item) => { const product = state.catalog.find((entry) => entry.id === item.productId); const ready = item.status === "READY_TO_ORDER"; return <label key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 ${ready ? "border-ink/10 bg-white" : "border-brass/30 bg-brass/5"}`}><input type="checkbox" checked={(quantities[item.id] ?? 0) > 0} disabled={!ready} onChange={(e) => setQuantities((value) => ({ ...value, [item.id]: e.target.checked ? item.quantity : 0 }))} /><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{product?.nameTh}</span><span className="mt-1 block text-[10px] text-ink/45">{ready ? `พร้อมสั่ง · สูงสุด ${item.quantity}` : "Blocked จนกว่า Accepted Quotation"}</span></span><input aria-label={`จำนวนสั่ง ${product?.nameTh}`} type="number" min="0" max={item.quantity} disabled={!ready} value={quantities[item.id] ?? 0} onChange={(e) => setQuantities((value) => ({ ...value, [item.id]: Number(e.target.value) }))} className="w-20 rounded-lg border border-ink/10 px-2 py-2 text-xs" /></label>; })}</div><button type="button" disabled={state.activeRole !== "MEMBER"} onClick={() => act({ type: "CREATE_ORDER", quantities })} className="mt-5 w-full rounded-xl bg-lacquer px-4 py-3 text-xs font-bold text-white disabled:opacity-30">สร้าง Customer Order</button></> : <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-ink/[.04] p-4"><p className="text-[10px] text-ink/45">ฐานราคาก่อน VAT</p><p className="mt-1 font-display text-xl font-semibold">฿{baht(state.order.subtotal)}</p></div><div className="rounded-xl bg-ink/[.04] p-4"><p className="text-[10px] text-ink/45">VAT Snapshot {state.order.vatRate}%</p><p className="mt-1 font-display text-xl font-semibold">฿{baht(state.order.vatAmount)}</p></div><div className="rounded-xl bg-brass/10 p-4"><p className="text-[10px] text-ink/45">Deposit 50%</p><p className="mt-1 font-display text-xl font-semibold">฿{baht(state.order.deposit)}</p></div><div className="rounded-xl bg-jade/10 p-4"><p className="text-[10px] text-ink/45">Balance · Total - Deposit</p><p className="mt-1 font-display text-xl font-semibold">฿{baht(state.order.balance)}</p></div></div>}
    </Panel><Panel eyebrow="Payment schedule" title="Partial Payment"><div className="space-y-3">{state.paymentSchedules.map((schedule) => { const summary = paymentSummary(state, schedule.id); return <div key={schedule.id} className="rounded-xl border border-ink/10 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold">{schedule.type}</p><StatusPill tone={schedule.status === "VERIFIED" ? "good" : "warn"}>{schedule.status}</StatusPill></div><p className="mt-3 font-display text-xl font-semibold">฿{baht(summary.verifiedAmount)} / {baht(schedule.dueAmount)}</p><p className="mt-1 text-[10px] text-ink/45">คงเหลือ ฿{baht(summary.outstandingAmount)}</p>{summary.isOverpaid && <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-lacquer"><AlertTriangle size={12} /> Overpayment — Finance ต้องตรวจ</p>}</div>; })}</div>{state.order && state.activeRole === "MEMBER" && <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><select aria-label="เลือกรอบชำระ" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs">{state.paymentSchedules.map((item) => <option key={item.id} value={item.id}>{item.type}</option>)}</select><input aria-label="ยอดโอน" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs" /><button type="button" onClick={() => act({ type: "SUBMIT_PAYMENT", scheduleId, amount, reference: `DEMO-${state.transfers.length + 1}` })} className="rounded-lg bg-lacquer px-3 py-2 text-xs font-bold text-white">ส่งยอด</button></div>}</Panel></div>
    {state.activeRole === "FINANCE" && <Panel eyebrow="Finance queue" title="ตรวจยอดที่ Member ส่ง"><div className="grid gap-3 md:grid-cols-2">{submitted.length ? submitted.map((transfer) => <div key={transfer.id} className="rounded-xl border border-ink/10 bg-white p-4"><p className="text-xs font-bold">{transfer.reference} · ฿{baht(transfer.amount)}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => act({ type: "VERIFY_PAYMENT", transferId: transfer.id })} className="rounded-lg bg-jade px-3 py-2 text-[10px] font-bold text-white">Verify</button><button type="button" onClick={() => act({ type: "REJECT_PAYMENT", transferId: transfer.id, reason: "ยอดในสลิปไม่ตรงกับรายการเดินบัญชี" })} className="rounded-lg border border-lacquer/20 px-3 py-2 text-[10px] font-bold text-lacquer">Reject / Resubmit</button></div></div>) : <p className="text-xs text-ink/45">ไม่มีรายการรอตรวจ</p>}</div>{state.transfers.some((item) => item.status === "VERIFIED") && <button type="button" onClick={() => act({ type: "VERIFY_PAYMENT", transferId: state.transfers.find((item) => item.status === "VERIFIED")!.id })} className="mt-4 rounded-lg border border-lacquer/20 px-3 py-2 text-[10px] font-bold text-lacquer">ทดลอง Verify รายการเดิมซ้ำ</button>}<div className="mt-5 flex justify-end"><Handoff role="GISP_ADMIN" module="ORDER" label="ส่งต่อ Admin เพื่อออก PO" /></div></Panel>}
    {state.activeRole === "GISP_ADMIN" && state.order && <Panel eyebrow="Purchase order gate" title="Deposit Verified ก่อนออก PO" action={<StatusPill tone={state.paymentSchedules.find((item) => item.type === "DEPOSIT")?.status === "VERIFIED" ? "good" : "bad"}>Deposit {state.paymentSchedules.find((item) => item.type === "DEPOSIT")?.status}</StatusPill>}><button type="button" onClick={() => act({ type: "ISSUE_PO" })} className="rounded-xl bg-ink px-4 py-3 text-xs font-bold text-white">ออก PO แยกตาม Supplier</button><div className="mt-5 flex justify-end"><Handoff role="GISP_ADMIN" module="QC" label="ไปอัปเดตการผลิต" /></div></Panel>}
    <div className="flex justify-end">{state.activeRole === "MEMBER" && <Handoff role="FINANCE" module="ORDER" label="ส่งยอดให้ Finance ตรวจ" />}</div>
  </div>;
}

function ProductionQc() {
  const { state, act } = usePrototype();
  const [selected, setSelected] = useState(state.order?.lines[0]?.projectItemId ?? "");
  const [result, setResult] = useState<"FAILED" | "REWORK_REQUIRED" | "PASSED">("FAILED");
  const latestProduction = state.productionUpdates.at(-1);
  return <div className="space-y-5"><div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><Panel eyebrow="Mission 04 · Production" title="Progress & ETA" action={latestProduction && <StatusPill tone={latestProduction.delayed ? "bad" : "good"}>{latestProduction.progress}%</StatusPill>}>
    <div className="overflow-hidden rounded-2xl"><EvidenceImage index={0} className="h-52" /></div>{latestProduction ? <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-ink/8"><div className="h-full bg-jade" style={{ width: `${latestProduction.progress}%` }} /></div><p className="mt-3 text-xs font-bold">ETA {latestProduction.eta}</p><p className="mt-1 text-xs text-ink/48">{latestProduction.note}</p></div> : <p className="mt-4 text-xs text-ink/45">ออก PO แล้วจึงเริ่ม Timeline การผลิต</p>}
    {state.activeRole === "GISP_ADMIN" && state.supplierOrders.length > 0 && <button type="button" onClick={() => act({ type: "RECORD_PRODUCTION_UPDATE", progress: latestProduction ? 100 : 75, eta: "2026-10-25", note: latestProduction ? "แก้ไขงานและผลิตเสร็จแล้ว" : "วัตถุดิบ Brass ล่าช้า 5 วัน", delayed: !latestProduction })} className="mt-4 w-full rounded-xl bg-ink px-4 py-3 text-xs font-bold text-white">{latestProduction ? "บันทึกผลิตเสร็จ" : "บันทึก Progress + Delay"}</button>}
  </Panel><Panel eyebrow="QC checklist" title="Fail → Rework → Reinspection"><div className="grid gap-4 md:grid-cols-[220px_1fr]"><EvidenceImage index={state.qcInspections.some((item) => item.result === "PASSED") ? 1 : 0} className="h-48 rounded-2xl" /><div><div className="space-y-2">{state.qcInspections.map((inspection) => { const product = state.catalog.find((p) => p.id === state.projectItems.find((i) => i.id === inspection.projectItemId)?.productId); return <div key={inspection.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3"><StatusPill tone={inspection.result === "PASSED" ? "good" : "bad"}>{inspection.result}</StatusPill><span className="min-w-0 flex-1 text-xs">{product?.nameTh} · {inspection.note}</span>{state.activeRole === "QC" && inspection.result === "PASSED" && <button type="button" onClick={() => act({ type: "CORRECT_QC", inspectionId: inspection.id, note: "พบข้อมูลคลาดเคลื่อนภายหลัง จึงเปิด Rework และ Reinspection ใหม่" })} className="rounded-lg border border-lacquer/20 px-2 py-1.5 text-[9px] font-bold text-lacquer">เพิ่ม Correction</button>}</div>; })}</div>{state.activeRole === "QC" && state.order && <div className="mt-4 grid gap-2"><select aria-label="เลือกรายการตรวจ QC" value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs">{state.order.lines.map((line) => <option key={line.projectItemId} value={line.projectItemId}>{state.catalog.find((p) => p.id === state.projectItems.find((i) => i.id === line.projectItemId)?.productId)?.nameTh}</option>)}</select><select aria-label="ผลตรวจ QC" value={result} onChange={(e) => setResult(e.target.value as typeof result)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs"><option>FAILED</option><option>REWORK_REQUIRED</option><option>PASSED</option></select><button type="button" onClick={() => act({ type: "RECORD_QC", projectItemId: selected, result, note: result === "PASSED" ? "สี ขนาด และงานประกอบผ่าน Checklist" : result === "FAILED" ? "เฉดสีเข้มกว่า Approved Sample" : "ส่งกลับแก้ผิวและตรวจใหม่" })} className="rounded-lg bg-lacquer px-3 py-2.5 text-xs font-bold text-white">บันทึกผลตรวจ</button></div>}</div></div></Panel></div>
    {state.order && <Panel eyebrow="Live business guard" title="Dispatch Gate · 4 เงื่อนไข"><div className="grid gap-3 md:grid-cols-2">{state.order.lines.map((line) => { const item = state.projectItems.find((entry) => entry.id === line.projectItemId)!; const product = state.catalog.find((entry) => entry.id === item.productId); const gate = dispatchGateForItem(state, item.id); return <div key={item.id} className="rounded-xl border border-ink/10 bg-white p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold">{product?.nameTh}</p><StatusPill tone={gate.allowed ? "good" : "bad"}>{gate.allowed ? "Ready to dispatch" : `${gate.failures.length} blocked`}</StatusPill></div><div className="mt-3 flex flex-wrap gap-1.5">{["QC", ...(item.kind === "CUSTOM" ? ["Member approval"] : []), "Customer balance", "Supplier balance"].map((name, index) => <span key={name} className="rounded-md bg-ink/5 px-2 py-1 text-[9px] text-ink/55">{index + 1}. {name}</span>)}</div>{item.kind === "CUSTOM" && state.activeRole === "MEMBER" && <button type="button" onClick={() => act({ type: "APPROVE_CUSTOM_QC", projectItemId: item.id })} className="mt-3 rounded-lg bg-jade px-3 py-2 text-[10px] font-bold text-white">Member Approve Custom</button>}</div>; })}</div>
    {state.activeRole === "FINANCE" && <div className="mt-4 flex flex-wrap gap-2">{state.supplierOrders.filter((item) => !item.supplierBalancePaid).map((order) => <button type="button" key={order.id} onClick={() => act({ type: "MARK_SUPPLIER_BALANCE_PAID", supplierOrderId: order.id })} className="rounded-lg bg-ink px-3 py-2 text-[10px] font-bold text-white">ยืนยัน Supplier Balance · {order.number}</button>)}</div>}
    <div className="mt-5 flex flex-wrap justify-end gap-2">{state.activeRole === "QC" && <Handoff role="MEMBER" module="QC" label="ส่ง Custom ให้ Member อนุมัติ" />}{state.activeRole === "MEMBER" && <Handoff role="FINANCE" module="QC" label="ส่งต่อ Finance ปิด Balance" />}{state.activeRole === "FINANCE" && <Handoff role="LOGISTICS" module="SHIPMENT" label="ส่งต่อ Logistics" />}{state.activeRole === "GISP_ADMIN" && <Handoff role="QC" module="QC" label="ส่งต่อ QC" />}</div></Panel>}
  </div>;
}

function ShipmentClaim() {
  const { state, act } = usePrototype();
  const [allocations, setAllocations] = useState<Record<string, number>>(() => Object.fromEntries((state.order?.lines ?? []).map((line) => [line.projectItemId, Math.max(1, Math.floor(line.quantity / 2))])));
  const [deliveryShipment, setDeliveryShipment] = useState("");
  const deliveredIssue = state.shipments.find((item) => item.deliveryResult === "WITH_ISSUE");
  return <div className="space-y-5"><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel eyebrow="Mission 05 · Logistics" title="Partial Shipment"><div className="space-y-3">{state.order?.lines.map((line) => { const item = state.projectItems.find((entry) => entry.id === line.projectItemId)!; const product = state.catalog.find((entry) => entry.id === item.productId); const gate = dispatchGateForItem(state, item.id); return <label key={item.id} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white p-3"><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{product?.nameTh}</span><span className="mt-1 block text-[10px] text-ink/45">Order {line.quantity} · Gate {gate.allowed ? "ผ่าน" : "ยังไม่ครบ"}</span></span><input aria-label={`จำนวนจัดส่ง ${product?.nameTh}`} type="number" min="0" max={line.quantity} value={allocations[item.id] ?? 0} onChange={(e) => setAllocations((value) => ({ ...value, [item.id]: Number(e.target.value) }))} className="w-20 rounded-lg border border-ink/10 px-2 py-2 text-xs" /></label>; })}</div>{state.activeRole === "LOGISTICS" && state.order && <button type="button" onClick={() => act({ type: "CREATE_SHIPMENT", allocations: Object.entries(allocations).filter(([, quantity]) => quantity > 0).map(([projectItemId, quantity]) => ({ projectItemId, quantity })), tracking: `GISP-DEMO-${state.shipments.length + 1}` })} className="mt-4 w-full rounded-xl bg-lacquer px-4 py-3 text-xs font-bold text-white">สร้าง Partial Shipment</button>}</Panel>
    <Panel eyebrow="Tracking & proof" title="Delivery with Issue"><div className="overflow-hidden rounded-2xl"><EvidenceImage index={2} className="h-48" /></div><div className="mt-4 space-y-2">{state.shipments.map((shipment) => <div key={shipment.id} className="rounded-xl border border-ink/10 bg-white p-3"><div className="flex items-center justify-between"><p className="text-xs font-bold">{shipment.number}</p><StatusPill tone={shipment.status === "DELIVERED" ? "good" : "warn"}>{shipment.status}</StatusPill></div><p className="mt-1 text-[10px] text-ink/45">{shipment.tracking} · {shipment.allocations.length} รายการ</p></div>)}</div>{state.activeRole === "LOGISTICS" && state.shipments.some((item) => item.status === "IN_TRANSIT") && <div className="mt-4 grid gap-2"><select aria-label="เลือก Shipment ส่งมอบ" value={deliveryShipment} onChange={(e) => setDeliveryShipment(e.target.value)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs"><option value="">เลือก Shipment</option>{state.shipments.filter((item) => item.status === "IN_TRANSIT").map((item) => <option key={item.id} value={item.id}>{item.number}</option>)}</select><button type="button" onClick={() => deliveryShipment && act({ type: "RECORD_DELIVERY", shipmentId: deliveryShipment, recipient: "", result: "WITH_ISSUE", evidence: [] })} className="rounded-lg border border-lacquer/20 px-3 py-2.5 text-xs font-bold text-lacquer">ทดลองส่งมอบโดยไม่มีผู้รับ/หลักฐาน</button><button type="button" onClick={() => deliveryShipment && act({ type: "RECORD_DELIVERY", shipmentId: deliveryShipment, recipient: "ธนา · Site Manager", result: "WITH_ISSUE", evidence: [{ name: "delivery-damage-demo.jpg", type: "image/jpeg", size: 245000 }] })} className="rounded-lg bg-ink px-3 py-2.5 text-xs font-bold text-white">บันทึก Delivered with Issue</button></div>}</Panel></div>
    <Panel eyebrow="Claim timeline" title="Resolution ต้องให้ Member ยืนยันก่อนปิด" action={state.claim && <StatusPill tone={state.claim.status === "CLOSED" ? "good" : "warn"}>{state.claim.status}</StatusPill>}>
      {!state.claim && deliveredIssue && state.activeRole === "MEMBER" && <button type="button" onClick={() => act({ type: "OPEN_CLAIM", shipmentId: deliveredIssue.id, projectItemId: deliveredIssue.allocations[0].projectItemId, description: "พบรอยกระแทกที่ผิวด้านข้างสินค้า 1 ชิ้น พร้อมแนบหลักฐาน Demo" })} className="rounded-xl bg-lacquer px-4 py-3 text-xs font-bold text-white">เปิด Claim จาก Delivered Item</button>}
      {state.claim && <div className="grid gap-3 sm:grid-cols-3">{[{ label: "Member เปิดเคลม", done: true }, { label: "Admin ระบุ Resolution", done: state.claim.status !== "SUBMITTED" }, { label: "Member ยืนยันปิด", done: state.claim.status === "CLOSED" }].map((item, index) => <div key={item.label} className={`rounded-xl p-4 ${item.done ? "bg-jade/10" : "bg-ink/5"}`}><span className={`grid size-7 place-items-center rounded-full text-[10px] font-bold ${item.done ? "bg-jade text-white" : "bg-white"}`}>{item.done ? <CheckCircle2 size={14} /> : index + 1}</span><p className="mt-3 text-xs font-bold">{item.label}</p></div>)}</div>}
      {state.claim?.status === "SUBMITTED" && state.activeRole === "GISP_ADMIN" && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => act({ type: "RESOLVE_CLAIM", resolution: "เปลี่ยนสินค้าใหม่ 1 ชิ้นและจัดส่งรอบถัดไปโดยไม่มีค่าใช้จ่าย" })} className="rounded-xl bg-ink px-4 py-3 text-xs font-bold text-white">บันทึก Resolution</button><button type="button" onClick={() => act({ type: "REJECT_CLAIM", reason: "หลักฐานแสดงว่าเป็นรอยเดิมที่บันทึกไว้ก่อนส่งมอบ" })} className="rounded-xl border border-lacquer/30 px-4 py-3 text-xs font-bold text-lacquer">ปฏิเสธ Claim พร้อมเหตุผล</button></div>}
      {state.claim?.status === "RESOLVED" && state.activeRole === "MEMBER" && <button type="button" onClick={() => act({ type: "CONFIRM_CLAIM" })} className="mt-4 rounded-xl bg-jade px-4 py-3 text-xs font-bold text-white">ยืนยัน Resolution และปิด Claim</button>}
      <div className="mt-5 flex justify-end">{state.activeRole === "LOGISTICS" && deliveredIssue && <Handoff role="MEMBER" module="SHIPMENT" label="ส่งเหตุการณ์ให้ Member" />}{state.claim?.status === "SUBMITTED" && state.activeRole === "MEMBER" && <Handoff role="GISP_ADMIN" module="SHIPMENT" label="ส่ง Claim ให้ Admin" />}{state.claim?.status === "RESOLVED" && state.activeRole === "GISP_ADMIN" && <Handoff role="MEMBER" module="SHIPMENT" label="ส่ง Resolution ให้ Member" />}</div>
    </Panel></div>;
}

function DocumentsAudit() {
  const { state } = usePrototype();
  const [doc, setDoc] = useState("PRODUCT SCHEDULE");
  const documents = ["PRODUCT SCHEDULE", "QUOTATION", "CUSTOMER ORDER", "PAYMENT NOTICE", "QC REPORT", "PACKING LIST", "CLAIM RESOLUTION"];
  return <div className="grid gap-5 xl:grid-cols-[1fr_360px]"><Panel eyebrow="Dynamic document" title="Preview จากข้อมูลล่าสุด" action={<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white"><Printer size={14} /> Print / Save PDF</button>}>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-2">{documents.map((item) => <button type="button" key={item} onClick={() => setDoc(item)} className={`shrink-0 rounded-full px-3 py-2 text-[9px] font-bold ${doc === item ? "bg-lacquer text-white" : "bg-white text-ink/50"}`}>{item}</button>)}</div>
    <article className="prototype-print relative mx-auto max-w-3xl overflow-hidden border border-ink/10 bg-white p-6 shadow-paper sm:p-10"><span className="absolute right-5 top-5 rotate-[-3deg] border-2 border-lacquer px-3 py-1 text-[9px] font-black tracking-[.2em] text-lacquer">DEMO</span><p className="text-[10px] font-black uppercase tracking-[.25em] text-brass">Global Interior Supply Platform</p><h2 className="mt-8 font-display text-3xl font-semibold">{doc}</h2><p className="mt-2 text-xs text-ink/45">Riverstone Boutique Hotel Bangkok · ข้อมูล ณ ตอนที่เปิด Preview</p><div className="mt-8 border-y border-ink/10 py-4"><div className="grid grid-cols-[1fr_auto] gap-3 text-xs font-bold"><span>รายการ</span><span>ยอด / สถานะ</span></div>{doc === "PRODUCT SCHEDULE" && state.projectItems.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-ink/7 py-3 text-xs"><span>{state.catalog.find((p) => p.id === item.productId)?.nameTh} · {item.area} × {item.quantity}</span><span>฿{baht(projectItemTotal(state, item))}</span></div>)}{doc === "QUOTATION" && state.quotations.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-ink/7 py-3 text-xs"><span>{item.number} · Version {item.version}</span><span>{item.status} · ฿{baht(item.grandTotal)}</span></div>)}{doc === "CUSTOMER ORDER" && <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 text-xs"><span>{state.order?.number ?? "ยังไม่ได้สร้าง Order"}</span><span>{state.order ? `฿${baht(state.order.grandTotal)}` : "—"}</span></div>}{doc === "PAYMENT NOTICE" && state.paymentSchedules.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-ink/7 py-3 text-xs"><span>{item.type}</span><span>{item.status} · ฿{baht(item.dueAmount)}</span></div>)}{doc === "QC REPORT" && state.qcInspections.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-ink/7 py-3 text-xs"><span>{state.catalog.find((p) => p.id === state.projectItems.find((i) => i.id === item.projectItemId)?.productId)?.nameTh}</span><span>{item.result}</span></div>)}{doc === "PACKING LIST" && state.shipments.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-ink/7 py-3 text-xs"><span>{item.number} · {item.tracking}</span><span>{item.status}</span></div>)}{doc === "CLAIM RESOLUTION" && <div className="mt-3 text-xs leading-6"><strong>{state.claim?.number ?? "ยังไม่มี Claim"}</strong><br />{state.claim?.resolution ?? state.claim?.description ?? "—"}</div>}</div>{state.order && <div className="ml-auto mt-6 max-w-xs space-y-2 text-xs"><div className="flex justify-between"><span>Subtotal</span><strong>฿{baht(state.order.subtotal)}</strong></div><div className="flex justify-between"><span>VAT Snapshot {state.order.vatRate}%</span><strong>฿{baht(state.order.vatAmount)}</strong></div><div className="flex justify-between border-t border-ink/10 pt-2 text-sm"><span>Grand Total</span><strong>฿{baht(state.order.grandTotal)}</strong></div></div>}</article>
    <div className="mt-5 flex flex-wrap gap-2 text-[10px]"><a href="/demo-documents/product-schedule.pdf" target="_blank" className="rounded-lg border border-ink/10 bg-white px-3 py-2 font-bold">เปิด PDF Baseline</a><a href="/demo-documents/product-schedule.xlsx" className="rounded-lg border border-ink/10 bg-white px-3 py-2 font-bold">ดาวน์โหลด Excel Baseline</a></div>
  </Panel><Panel eyebrow="Browser-local audit" title="ประวัติทุก Action"><div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">{[...state.audit].reverse().map((event) => <div key={event.id} className="border-l-2 border-brass/40 pl-3"><p className="text-[9px] font-bold uppercase tracking-wider text-ink/35">{roleLabels[event.actor].split(" · ")[0]} · {event.action}</p><p className="mt-1 text-xs leading-5">{event.detail}</p></div>)}</div></Panel></div>;
}

export function PrototypeWorkspace({ onExit }: { onExit: () => void }) {
  const { state, act } = usePrototype();
  const [navOpen, setNavOpen] = useState(false);
  const progress = useMemo(() => mvpPreparationProgress(state), [state]);
  const active = modules.find((item) => item.id === state.activeModule)!;
  const screens: Record<PrototypeModule, React.ComponentType> = {
    FOUNDATION: FoundationPermissionDemo,
    ACTION_CENTER: ActionCenter,
    PRODUCT_ADMIN: ProductSupplierAdminDemo,
    DASHBOARDS: RoleDashboardDemo,
    CATALOG: CatalogProject,
    RFQ: RfqQuotation,
    ORDER: OrderPayment,
    QC: ProductionQc,
    SHIPMENT: ShipmentClaim,
    DOCUMENTS: DocumentsAudit,
    UAT: UatSignOffDemo,
  };
  const Screen = screens[state.activeModule];
  return <main className="prototype-shell demo-canvas min-h-screen bg-porcelain text-ink">
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-porcelain/92 backdrop-blur-xl"><div className="mx-auto flex max-w-[1720px] items-center gap-3 px-4 py-3 sm:px-6"><button type="button" onClick={() => setNavOpen(!navOpen)} className="grid size-10 place-items-center rounded-xl border border-ink/10 bg-white lg:hidden" aria-label="เปิดเมนู"><Menu size={18} /></button><button type="button" onClick={onExit} className="flex items-center gap-3" aria-label="กลับหน้าเลือก Demo"><span className="grid size-10 place-items-center rounded-xl bg-ink text-[11px] font-black tracking-widest text-white">GI</span><span className="hidden text-left sm:block"><span className="block font-display text-base font-semibold">GISP Prototype</span><span className="block text-[8px] font-bold uppercase tracking-[.2em] text-ink/40">Riverstone · browser local · v3</span></span></button><span className="demo-stamp ml-auto hidden rotate-[-2deg] border-2 border-lacquer px-3 py-1 text-[9px] font-black tracking-[.18em] text-lacquer md:block">MVP READINESS DEMO</span><label className="ml-auto flex items-center gap-2 md:ml-3"><UserRound size={15} className="hidden text-ink/40 sm:block" /><span className="sr-only">สลับบทบาท</span><select aria-label="สลับบทบาทผู้ทดลอง" value={state.activeRole} onChange={(e) => act({ type: "SWITCH_ROLE", role: e.target.value as DemoRole })} className="max-w-[180px] rounded-xl border border-ink/10 bg-white px-3 py-2 text-[10px] font-bold sm:text-xs">{demoRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label><button type="button" onClick={() => window.confirm("Reset Functional Prototype Version 3? Overview จะไม่ถูกลบ") && act({ type: "RESET_PROTOTYPE" })} className="grid size-9 place-items-center rounded-xl border border-ink/10 bg-white text-ink/50" aria-label="Reset Functional Prototype"><RefreshCcw size={15} /></button></div></header>
    <div className="mx-auto grid max-w-[1720px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)]"><aside className={`${navOpen ? "fixed inset-0 z-40 bg-ink/35 p-4 pt-20" : "hidden"} lg:sticky lg:top-[78px] lg:block lg:h-[calc(100vh-100px)] lg:bg-transparent lg:p-0`}><div className="h-full max-w-[280px] overflow-y-auto rounded-[26px] bg-ink p-3 text-porcelain shadow-2xl lg:max-w-none"><div className="flex items-center justify-between px-3 pb-3 pt-2"><div><p className="text-[9px] font-bold uppercase tracking-[.22em] text-brass">Mission progress</p><p className="mt-1 font-display text-xl font-semibold">{progress.complete} / {progress.total}</p></div><button type="button" onClick={() => setNavOpen(false)} className="grid size-8 place-items-center rounded-lg bg-white/5 lg:hidden" aria-label="ปิดเมนู"><X size={15} /></button></div><nav aria-label="โมดูล Functional Prototype" className="space-y-1">{modules.map((item) => { const Icon = item.icon; const selected = item.id === state.activeModule; return <button type="button" key={item.id} onClick={() => { act({ type: "SET_MODULE", module: item.id }); setNavOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold transition ${selected ? "bg-porcelain text-ink" : "text-porcelain/55 hover:bg-white/5 hover:text-white"}`}><Icon size={16} className={selected ? "text-lacquer" : "text-brass"} /><span className="flex-1">{item.label}</span></button>; })}</nav><div className="mx-3 mt-5 border-t border-white/10 pt-5"><p className="text-[9px] uppercase tracking-wider text-porcelain/35">กำลังทำงานในบทบาท</p><p className="mt-2 text-xs font-bold text-brass">{roleLabels[state.activeRole]}</p></div></div></aside>
      <div className="min-w-0"><section className="mb-5 flex flex-col gap-4 rounded-[24px] border border-ink/10 bg-white/50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.22em] text-lacquer">Functional Prototype · {active.short}</p><h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{active.label}</h1><p className="mt-1 text-xs text-ink/45">Riverstone Boutique Hotel · ทุก Action มี Guard และ Audit ใน Browser</p></div>{state.activeModule !== "ACTION_CENTER" && <Handoff role={roleForNext[state.activeModule]} module={state.activeModule} label={`สลับเป็น ${roleLabels[roleForNext[state.activeModule]].split(" · ")[0]}`} />}</section>{state.lastError && <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-lacquer/20 bg-lacquer/8 p-4 text-xs font-bold text-lacquer"><AlertTriangle size={17} className="shrink-0" />{state.lastError}</div>}<div className="reveal" key={`${state.activeModule}-${state.activeRole}`}><Screen /></div><footer className="mt-8 flex flex-col gap-2 border-t border-ink/10 py-6 text-[10px] text-ink/40 sm:flex-row sm:justify-between"><p>GISP Functional Prototype · ไม่มีข้อมูลลูกค้าจริง</p><p>ไม่เชื่อม Auth, API, Database, Storage หรือ Payment Gateway</p></footer></div>
    </div>
  </main>;
}
