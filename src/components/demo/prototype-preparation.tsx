"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  LockKeyhole,
  PackageSearch,
  Printer,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import {
  mvpPreparationProgress,
  paymentSummary,
  roleActionItems,
  selectMemberCatalog,
  selectMemberSafeState,
  uatSummary,
  type DemoFileMeta,
  type DemoRole,
} from "@/demo";
import { usePrototype } from "./prototype-context";

const roleLabels: Record<DemoRole, string> = {
  MEMBER: "Member",
  GISP_ADMIN: "GISP Admin",
  FINANCE: "Finance",
  QC: "QC Inspector",
  LOGISTICS: "Logistics",
  EXECUTIVE: "Executive",
};

function filesOf(list: FileList | null): DemoFileMeta[] {
  return Array.from(list ?? []).map((file) => ({ name: file.name, type: file.type || "application/octet-stream", size: file.size }));
}

function baht(value: string | number) {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const styles = { neutral: "bg-ink/6 text-ink/55", good: "bg-jade/10 text-jade", warn: "bg-brass/15 text-[#79571f]", bad: "bg-lacquer/10 text-lacquer" };
  return <span className={`inline-flex rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider ${styles[tone]}`}>{children}</span>;
}

function PrepPanel({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-[26px] border border-ink/10 bg-white/72 p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.24em] text-lacquer">{eyebrow}</p><h2 className="mt-2 font-display text-2xl font-semibold">{title}</h2></div>{action}</div>{children}</section>;
}

export function FoundationPermissionDemo() {
  const { state, act } = usePrototype();
  const [email, setEmail] = useState("nara@atelier-demo.example");
  const [password, setPassword] = useState("DemoOnly#2569");
  const [companyName, setCompanyName] = useState(state.memberApplication.companyName);
  const [taxId, setTaxId] = useState(state.memberApplication.taxId);
  const [inviteEmail, setInviteEmail] = useState("coordinator@atelier-demo.example");
  const [inviteName, setInviteName] = useState("ปวีณ์ ผู้ประสานงาน");
  const statusTone = state.memberApplication.status === "APPROVED" ? "good" : state.memberApplication.status === "REJECTED" ? "bad" : "warn";

  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <PrepPanel eyebrow="Preparation 01 · Member" title="สมัครและส่งข้อมูลบริษัท" action={<Badge tone={statusTone}>{state.memberApplication.status}</Badge>}>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Email จำลอง<input aria-label="อีเมลสมัคร Demo" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs" /></label><label className="text-xs font-bold">Password จำลอง<input aria-label="รหัสผ่านจำลอง" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs" /></label></div>
        <p className="mt-2 flex items-center gap-2 text-[10px] text-ink/45"><LockKeyhole size={12} /> Password ใช้แสดงหน้าจอเท่านั้นและไม่ถูกเก็บใน State</p>
        {!state.memberApplication.registered ? <button type="button" disabled={state.activeRole !== "MEMBER"} onClick={() => act({ type: "REGISTER_DEMO_ACCOUNT", email })} className="mt-4 w-full rounded-xl bg-ink px-4 py-3 text-xs font-bold text-white disabled:opacity-30">สมัครบัญชี Demo</button> : <div className="mt-4 grid gap-3"><label className="text-xs font-bold">ชื่อบริษัท<input aria-label="ชื่อบริษัท" value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs" /></label><label className="text-xs font-bold">เลขผู้เสียภาษีจำลอง<input aria-label="เลขประจำตัวผู้เสียภาษีจำลอง" value={taxId} onChange={(event) => setTaxId(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs" /></label>{state.memberApplication.status === "NOT_STARTED" || state.memberApplication.status === "REJECTED" ? <button type="button" disabled={state.activeRole !== "MEMBER"} onClick={() => act({ type: "SUBMIT_MEMBER_APPLICATION", companyName, taxId })} className="rounded-xl bg-lacquer px-4 py-3 text-xs font-bold text-white disabled:opacity-30">ส่งข้อมูลบริษัท</button> : null}</div>}
        {state.memberApplication.reviewNote ? <p className="mt-4 rounded-xl bg-ink/[.04] p-3 text-xs text-ink/55">ผลตรวจ: {state.memberApplication.reviewNote}</p> : null}
        {state.memberApplication.status === "PENDING" && state.activeRole === "MEMBER" ? <button type="button" onClick={() => act({ type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "FOUNDATION" })} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-ink/15 px-4 py-2.5 text-xs font-bold">ส่งต่อ Admin <ArrowRight size={14} /></button> : null}
      </PrepPanel>

      <PrepPanel eyebrow="Permission control" title="อนุมัติ ผู้ใช้ และหลาย Role" action={<ShieldCheck size={20} className="text-jade" />}>
        {state.activeRole === "GISP_ADMIN" && state.memberApplication.status === "PENDING" ? <div className="rounded-2xl bg-ink p-5 text-porcelain"><p className="text-xs font-bold">{state.memberApplication.companyName}</p><p className="mt-1 text-[10px] text-porcelain/45">Tax ID {state.memberApplication.taxId} · {state.memberApplication.email}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => act({ type: "REVIEW_MEMBER_APPLICATION", decision: "APPROVE", note: "ข้อมูลบริษัทครบถ้วนสำหรับ Demo" })} className="rounded-lg bg-jade px-4 py-2.5 text-xs font-bold text-white">อนุมัติบริษัท</button><button type="button" onClick={() => act({ type: "REVIEW_MEMBER_APPLICATION", decision: "REJECT", note: "เอกสารจดทะเบียนยังไม่ครบ" })} className="rounded-lg border border-lacquer/50 px-4 py-2.5 text-xs font-bold text-[#ff9f93]">ปฏิเสธพร้อมเหตุผล</button></div></div> : null}
        {state.memberApplication.status === "APPROVED" ? <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input aria-label="ชื่อผู้ใช้ที่เชิญ" value={inviteName} onChange={(event) => setInviteName(event.target.value)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs" /><input aria-label="อีเมลผู้ใช้ที่เชิญ" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs" /><button type="button" disabled={state.activeRole !== "GISP_ADMIN"} onClick={() => act({ type: "INVITE_ORGANIZATION_USER", email: inviteEmail, fullName: inviteName })} className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-30"><UserPlus size={14} /> เชิญ</button></div><div className="space-y-2">{state.organizationUsers.map((user) => <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/10 bg-white p-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold">{user.fullName}</p><p className="mt-1 text-[10px] text-ink/40">{user.email} · {user.roles.join(" + ")}</p></div>{user.status === "INVITED" ? <button type="button" disabled={state.activeRole !== "GISP_ADMIN"} onClick={() => act({ type: "SET_ORGANIZATION_USER_ROLES", userId: user.id, roles: ["MEMBER", "LOGISTICS"] })} className="rounded-lg border border-brass/40 px-3 py-2 text-[10px] font-bold disabled:opacity-30">กำหนด 2 Roles</button> : null}</div>)}</div></div> : <p className="rounded-xl bg-brass/10 p-4 text-xs leading-6 text-[#79571f]">บริษัทต้องได้รับอนุมัติก่อนเชิญผู้ใช้และกำหนด Role</p>}
      </PrepPanel>
    </div>

    <PrepPanel eyebrow="Simulated access control" title="Permission Test Cases" action={<Badge tone={state.permissionCases.every((item) => item.result === "DENIED") ? "good" : "neutral"}>{state.permissionCases.filter((item) => item.result === "DENIED").length}/{state.permissionCases.length} checked</Badge>}>
      <div className="grid gap-3 md:grid-cols-3">{state.permissionCases.map((permissionCase) => <div key={permissionCase.id} className="rounded-2xl border border-ink/10 bg-white p-4"><div className="flex items-start justify-between gap-2"><LockKeyhole size={17} className="text-lacquer" /><Badge tone={permissionCase.result === "DENIED" ? "good" : "neutral"}>{permissionCase.result}</Badge></div><p className="mt-4 text-xs font-bold">{permissionCase.label}</p><p className="mt-1 text-[10px] leading-5 text-ink/45">{permissionCase.detail}</p><button type="button" onClick={() => act({ type: "RUN_PERMISSION_CASE", caseId: permissionCase.id })} className="mt-3 w-full rounded-lg border border-ink/10 px-3 py-2 text-[10px] font-bold">ทดลองเข้าถึง</button></div>)}</div>
    </PrepPanel>
  </div>;
}

export function ProductSupplierAdminDemo() {
  const { state, act } = usePrototype();
  const [supplierName, setSupplierName] = useState("Dongguan Demo Contract Furniture");
  const [supplierFiles, setSupplierFiles] = useState<DemoFileMeta[]>([]);
  const [nameTh, setNameTh] = useState("เก้าอี้รับแขก รุ่น Demo Reserve");
  const [sku, setSku] = useState("CHR-DEM-101");
  const [memberPrice, setMemberPrice] = useState("12800.00");
  const [factoryCost, setFactoryCost] = useState("7600.00");
  const [productFiles, setProductFiles] = useState<DemoFileMeta[]>([]);
  const draft = [...state.catalog].reverse().find((product) => product.id.startsWith("product-prototype"));
  const memberCatalog = selectMemberCatalog(state);
  const memberSafeSerialized = JSON.stringify(selectMemberSafeState(state));

  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
      <PrepPanel eyebrow="Preparation 02 · Supplier" title="Supplier Master" action={<Badge>{state.suppliers.length} suppliers</Badge>}>
        <div className="space-y-3"><input aria-label="ชื่อ Supplier ใหม่" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs" /><input aria-label="ชื่อผู้ติดต่อ Supplier" defaultValue="Lina Demo" className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs" /><label className="block rounded-xl border border-dashed border-ink/20 bg-white p-3 text-[10px] font-bold">เลือกเอกสาร Supplier จำลอง<input aria-label="เอกสาร Supplier จำลอง" type="file" className="mt-2 block w-full" onChange={(event) => setSupplierFiles(filesOf(event.target.files))} /></label><button type="button" disabled={state.activeRole !== "GISP_ADMIN"} onClick={() => act({ type: "CREATE_SUPPLIER", name: supplierName, city: "Dongguan", contactName: "Lina Demo", files: supplierFiles })} className="w-full rounded-xl bg-ink px-4 py-3 text-xs font-bold text-white disabled:opacity-30">สร้าง Supplier Demo</button></div>
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{state.suppliers.map((supplier) => <div key={supplier.id} className="rounded-xl border border-ink/10 bg-white p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold">{supplier.name}</p><Badge tone={supplier.status === "ACTIVE" ? "good" : "neutral"}>{supplier.status}</Badge></div><p className="mt-1 text-[10px] text-ink/40">{supplier.code} · {supplier.city} · เอกสาร {supplier.documents.length}</p></div>)}</div>
      </PrepPanel>

      <PrepPanel eyebrow="Product lifecycle" title="Draft → Published → Discontinued" action={draft ? <Badge tone={draft.lifecycleStatus === "PUBLISHED" ? "good" : draft.lifecycleStatus === "DISCONTINUED" ? "bad" : "warn"}>{draft.lifecycleStatus}</Badge> : null}>
        {!draft ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">ชื่อสินค้า<input aria-label="ชื่อ Product Draft" value={nameTh} onChange={(event) => setNameTh(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-xs" /></label><label className="text-xs font-bold">SKU<input aria-label="SKU Product Draft" value={sku} onChange={(event) => setSku(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-xs" /></label><label className="text-xs font-bold">Member Price<input aria-label="Member Price" value={memberPrice} onChange={(event) => setMemberPrice(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-xs" /></label><label className="text-xs font-bold">Factory Cost · Internal<input aria-label="Factory Cost" value={factoryCost} onChange={(event) => setFactoryCost(event.target.value)} className="mt-2 w-full rounded-xl border border-lacquer/15 bg-lacquer/[.025] px-3 py-2.5 text-xs" /></label><select aria-label="Supplier ของ Product Draft" className="rounded-xl border border-ink/10 px-3 py-2.5 text-xs" defaultValue={state.suppliers[0]?.id}>{state.suppliers.filter((supplier) => supplier.status === "ACTIVE").map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select><button type="button" disabled={state.activeRole !== "GISP_ADMIN"} onClick={() => act({ type: "CREATE_PRODUCT_DRAFT", nameTh, sku, supplierId: state.suppliers[0].id, memberUnitPrice: memberPrice, factoryUnitCost: factoryCost })} className="rounded-xl bg-lacquer px-4 py-3 text-xs font-bold text-white disabled:opacity-30">สร้าง Product Draft</button></div> : <div className="grid gap-5 md:grid-cols-[1fr_220px]"><div><p className="text-lg font-bold">{draft.nameTh}</p><p className="mt-1 text-[10px] text-ink/40">{draft.sku} · Variant {draft.variants.join(", ")} · Option {draft.options.join(", ")}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Member Price<input aria-label="แก้ Member Price" value={memberPrice} onChange={(event) => setMemberPrice(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-xs" /></label><label className="text-xs font-bold">Factory Cost · Internal<input aria-label="แก้ Factory Cost" value={factoryCost} onChange={(event) => setFactoryCost(event.target.value)} className="mt-2 w-full rounded-xl border border-lacquer/15 bg-lacquer/[.025] px-3 py-2.5 text-xs" /></label></div><label className="mt-3 block rounded-xl border border-dashed border-ink/20 bg-white p-3 text-[10px] font-bold">รูปสินค้า Demo · เก็บเฉพาะ Metadata<input aria-label="รูป Product Demo" type="file" className="mt-2 block w-full" onChange={(event) => setProductFiles(filesOf(event.target.files))} /></label><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={state.activeRole !== "GISP_ADMIN"} onClick={() => act({ type: "UPDATE_PRODUCT_MASTER", productId: draft.id, memberUnitPrice: memberPrice, factoryUnitCost: factoryCost, variants: ["Standard", "Wide"], options: ["Ivory", "Walnut"], media: productFiles })} className="rounded-lg border border-ink/15 px-3 py-2 text-[10px] font-bold disabled:opacity-30">บันทึก Master</button>{draft.lifecycleStatus === "DRAFT" ? <button type="button" disabled={state.activeRole !== "GISP_ADMIN"} onClick={() => act({ type: "PUBLISH_PRODUCT", productId: draft.id })} className="rounded-lg bg-jade px-3 py-2 text-[10px] font-bold text-white disabled:opacity-30">Publish</button> : null}{draft.lifecycleStatus === "PUBLISHED" ? <button type="button" disabled={state.activeRole !== "GISP_ADMIN"} onClick={() => act({ type: "DISCONTINUE_PRODUCT", productId: draft.id })} className="rounded-lg bg-lacquer px-3 py-2 text-[10px] font-bold text-white disabled:opacity-30">Discontinue</button> : null}</div></div><div className="rounded-2xl bg-ink p-4 text-porcelain"><p className="text-[9px] font-black uppercase tracking-widest text-brass">Internal only</p><p className="mt-4 text-[10px] text-porcelain/45">Factory Cost</p><p className="font-display text-2xl font-semibold">฿{baht(draft.factoryUnitCost)}</p><p className="mt-4 text-[10px] leading-5 text-porcelain/45">{draft.internalNote}</p></div></div>}
      </PrepPanel>
    </div>

    <PrepPanel eyebrow="Member-safe preview" title="สิ่งที่ Member เห็นจริง" action={<Badge tone={memberSafeSerialized.includes("factoryUnitCost") || memberSafeSerialized.includes("internalNote") ? "bad" : "good"}>Internal fields hidden</Badge>}>
      <div className="grid gap-3 md:grid-cols-3">{memberCatalog.slice(-6).map((product) => <div key={product.id} className="rounded-2xl border border-ink/10 bg-white p-4"><PackageSearch size={17} className="text-brass" /><p className="mt-3 text-xs font-bold">{product.nameTh}</p><p className="mt-1 text-[10px] text-ink/40">{product.sku} · {product.lifecycleStatus}</p><p className="mt-4 font-display text-xl font-semibold">฿{baht(product.memberUnitPrice)}</p></div>)}</div>
      <div className="mt-5 rounded-xl bg-jade/8 p-4 text-xs leading-6 text-jade">Snapshot เดิมใน Project/Quotation/Order จะไม่เปลี่ยนเมื่อ Admin แก้ Member Price ปัจจุบัน</div>
    </PrepPanel>
  </div>;
}

function dashboardMetrics(state: ReturnType<typeof usePrototype>["state"]) {
  const deposit = state.paymentSchedules.find((item) => item.type === "DEPOSIT");
  const balance = state.paymentSchedules.find((item) => item.type === "BALANCE");
  const delayed = state.productionUpdates.filter((item) => item.delayed).length;
  const delivered = state.shipments.filter((item) => item.status === "DELIVERED").length;
  const openClaim = state.claim && !["CLOSED", "REJECTED"].includes(state.claim.status) ? 1 : 0;
  const roleMetrics: Record<DemoRole, Array<[string, string]>> = {
    MEMBER: [["Payment ค้าง", String([deposit, balance].filter((item) => item && item.status !== "VERIFIED").length)], ["Custom Approval", String(state.order?.lines.filter((line) => state.projectItems.find((item) => item.id === line.projectItemId)?.kind === "CUSTOM" && !state.memberApprovedItemIds.includes(line.projectItemId)).length ?? 0)], ["Claim เปิด", String(openClaim)]],
    GISP_ADMIN: [["Member Pending", state.memberApplication.status === "PENDING" ? "1" : "0"], ["RFQ รอตรวจ", state.rfq?.status === "SUBMITTED" ? "1" : "0"], ["PO รอออก", state.order && !state.supplierOrders.length ? "1" : "0"]],
    FINANCE: [["ยอดรอตรวจ", String(state.transfers.filter((item) => item.status === "SUBMITTED").length)], ["Overpayment", String(state.paymentSchedules.filter((item) => paymentSummary(state, item.id).isOverpaid).length)], ["Supplier Balance", String(state.supplierOrders.filter((item) => !item.supplierBalancePaid).length)]],
    QC: [["รอตรวจ", String(state.order?.lines.filter((line) => !state.qcInspections.some((item) => item.projectItemId === line.projectItemId && item.result === "PASSED")).length ?? 0)], ["Rework", String(state.qcInspections.filter((item) => item.result === "REWORK_REQUIRED").length)], ["Passed", String(state.qcInspections.filter((item) => item.result === "PASSED").length)]],
    LOGISTICS: [["Shipment", String(state.shipments.length)], ["Delivered", String(delivered)], ["รอ Dispatch", String(state.order?.lines.length ?? 0)]],
    EXECUTIVE: [["Order", state.order ? "1" : "0"], ["Delay", String(delayed)], ["Delivery / Claim", `${delivered} / ${openClaim}`]],
  };
  return roleMetrics[state.activeRole];
}

export function RoleDashboardDemo() {
  const { state, act } = usePrototype();
  const items = roleActionItems(state);
  const metrics = dashboardMetrics(state);
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[30px] bg-ink p-7 text-porcelain sm:p-9"><div className="absolute -right-16 -top-20 size-64 rounded-full bg-brass/15 blur-3xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.25em] text-brass">Preparation 03 · Role dashboard</p><h2 className="mt-3 font-display text-4xl font-semibold">{roleLabels[state.activeRole]}</h2><p className="mt-3 text-xs text-porcelain/50">ข้อมูลพื้นฐานตาม Permission · ไม่ใช่ Advanced BI</p></div><Badge tone="good">Read from prototype state</Badge></div></section>
    <div className="grid gap-3 sm:grid-cols-3">{metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-ink/10 bg-white/75 p-5"><p className="text-[10px] font-bold text-ink/40">{label}</p><p className="mt-3 font-display text-3xl font-semibold">{value}</p></div>)}</div>
    <PrepPanel eyebrow="Assigned to this role" title="Action Required" action={<Badge tone={items.some((item) => item.status === "OPEN") ? "warn" : "good"}>{items.filter((item) => item.status === "OPEN").length} open</Badge>}>
      <div className="space-y-3">{items.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 sm:flex-row sm:items-center"><span className={`grid size-9 shrink-0 place-items-center rounded-full ${item.status === "DONE" ? "bg-jade text-white" : "bg-brass/15 text-[#79571f]"}`}>{item.status === "DONE" ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold">{item.title}</p><p className="mt-1 text-[10px] text-ink/45">{item.detail} · Due {item.dueDate}</p></div><div className="flex gap-2"><button type="button" onClick={() => act({ type: "SET_MODULE", module: item.sourceModule })} className="rounded-lg border border-ink/10 px-3 py-2 text-[10px] font-bold">เปิดรายการ</button>{item.status === "OPEN" ? <button type="button" onClick={() => act({ type: "COMPLETE_ACTION_ITEM", actionItemId: item.id })} className="rounded-lg bg-ink px-3 py-2 text-[10px] font-bold text-white">ทำเสร็จ</button> : null}</div></div>)}</div>
    </PrepPanel>
  </div>;
}

export function UatSignOffDemo() {
  const { state, act } = usePrototype();
  const sortedResults = state.uatResults;
  const summary = uatSummary(state);
  const progress = mvpPreparationProgress(state);
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(state.uatResults.map((item) => [item.id, item.note])));
  const readinessTone = state.buildReadiness === "APPROVED_FOR_MVP_BUILD" ? "good" : "warn";

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[30px] border border-ink/10 bg-white/75 p-7 sm:p-9"><div className="absolute right-7 top-7"><Badge tone={readinessTone}>{state.buildReadiness.replaceAll("_", " ")}</Badge></div><p className="text-[9px] font-black uppercase tracking-[.25em] text-lacquer">Preparation 05–08 · UAT & Sign-off</p><h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-tight">ผ่านครบ 8 Scenario จึงพร้อมเริ่ม MVP Build</h2><div className="mt-7 grid gap-3 sm:grid-cols-4"><div><p className="text-[10px] text-ink/40">PASS</p><p className="font-display text-2xl font-semibold text-jade">{summary.passed}</p></div><div><p className="text-[10px] text-ink/40">NEEDS FIX</p><p className="font-display text-2xl font-semibold text-lacquer">{summary.needsFix}</p></div><div><p className="text-[10px] text-ink/40">NOT TESTED</p><p className="font-display text-2xl font-semibold">{summary.untested}</p></div><div><p className="text-[10px] text-ink/40">PREPARATION</p><p className="font-display text-2xl font-semibold text-brass">{progress.complete}/{progress.total}</p></div></div></section>

    <PrepPanel eyebrow="Human acceptance" title="UAT Scenarios" action={<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white"><Printer size={14} /> Print Summary</button>}>
      <div className="prototype-print space-y-3">{sortedResults.map((result, index) => <div key={result.id} className="grid gap-3 rounded-2xl border border-ink/10 bg-white p-4 md:grid-cols-[44px_1fr_160px]"><span className={`grid size-9 place-items-center rounded-full text-xs font-bold ${result.status === "PASS" ? "bg-jade text-white" : result.status === "NEEDS_FIX" ? "bg-lacquer text-white" : "bg-ink/5 text-ink/45"}`}>{index + 1}</span><div><p className="text-xs font-bold">{result.title}</p><textarea aria-label={`หมายเหตุ ${result.title}`} value={notes[result.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [result.id]: event.target.value }))} placeholder="บันทึกหมายเหตุ UAT" rows={2} className="mt-2 w-full rounded-lg border border-ink/10 px-3 py-2 text-xs" /></div><div className="flex gap-2 md:flex-col"><button type="button" onClick={() => act({ type: "UPDATE_UAT_RESULT", resultId: result.id, status: "PASS", note: notes[result.id] ?? "" })} className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-bold ${result.status === "PASS" ? "bg-jade text-white" : "border border-jade/20 text-jade"}`}>ผ่าน</button><button type="button" onClick={() => act({ type: "UPDATE_UAT_RESULT", resultId: result.id, status: "NEEDS_FIX", note: notes[result.id] || "ต้องทบทวนก่อนอนุมัติ" })} className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-bold ${result.status === "NEEDS_FIX" ? "bg-lacquer text-white" : "border border-lacquer/20 text-lacquer"}`}>ต้องแก้</button></div></div>)}</div>
      <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-ink p-5 text-porcelain sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold">MVP Build Readiness Gate</p><p className="mt-1 text-[10px] text-porcelain/45">เฉพาะ GISP Admin และต้อง PASS 8/8 โดยไม่มี NEEDS FIX</p></div><button type="button" disabled={state.activeRole !== "GISP_ADMIN" || summary.passed !== summary.total || summary.needsFix > 0} onClick={() => act({ type: "SIGN_OFF_UAT" })} className="rounded-xl bg-brass px-5 py-3 text-xs font-black text-ink disabled:cursor-not-allowed disabled:opacity-30">Sign-off UAT</button></div>
    </PrepPanel>

    {state.buildReadiness === "APPROVED_FOR_MVP_BUILD" ? <div className="flex items-start gap-3 rounded-2xl border border-jade/20 bg-jade/8 p-5 text-jade"><FileCheck2 size={20} className="shrink-0" /><div><p className="text-sm font-bold">APPROVED FOR MVP BUILD</p><p className="mt-1 text-xs leading-6">Demo Gate ผ่านใน Browser นี้ พร้อมส่งต่อข้อกำหนดเพื่อเริ่ม Vertical Slice 1 โดยยังไม่ได้สร้าง App จริง</p></div></div> : <div className="flex items-start gap-3 rounded-2xl border border-brass/25 bg-brass/8 p-5 text-[#79571f]"><AlertTriangle size={20} className="shrink-0" /><div><p className="text-sm font-bold">ยังอยู่ระหว่าง UAT</p><p className="mt-1 text-xs leading-6">รายการที่เป็น “ต้องแก้” จะไม่ถูกนับเป็น Approved Decision</p></div></div>}
  </div>;
}
