"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildDemoState,
  demoRoles,
  demoScenes,
  getDashboardSummary,
  getDispatchGateResults,
  getExecutiveSummary,
  getMemberView,
  type DemoDocument,
  type DemoRole,
} from "@/demo";

const STORAGE_KEY = "gisp-demo-story-v1";

const roleLabels: Record<DemoRole, string> = {
  MEMBER: "สมาชิก / Interior Designer",
  GISP_ADMIN: "GISP Admin",
  FINANCE: "ฝ่ายการเงิน",
  QC: "ทีมตรวจคุณภาพ",
  LOGISTICS: "ทีมขนส่ง",
  EXECUTIVE: "ผู้บริหาร",
};

const roleShortLabels: Record<DemoRole, string> = {
  MEMBER: "Member",
  GISP_ADMIN: "Admin",
  FINANCE: "Finance",
  QC: "QC",
  LOGISTICS: "Logistics",
  EXECUTIVE: "Executive",
};

const documentPaths: Record<string, string> = {
  "PS-PRJ-2026-000001:PRODUCT_SCHEDULE_PDF":
    "/demo-documents/product-schedule.pdf",
  "PS-PRJ-2026-000001:PRODUCT_SCHEDULE_XLSX":
    "/demo-documents/product-schedule.xlsx",
  "QT-2026-000001-V1:CUSTOM_QUOTATION":
    "/demo-documents/quotation-v1.pdf",
  "QT-2026-000001-V2:CUSTOM_QUOTATION":
    "/demo-documents/quotation-v2.pdf",
  "ORD-2026-000001:CUSTOMER_ORDER":
    "/demo-documents/customer-order.pdf",
  "INV-DEP-2026-000001:PAYMENT_NOTICE":
    "/demo-documents/deposit-notice.pdf",
  "QC-2026-000001:QC_REPORT": "/demo-documents/qc-report.pdf",
  "INV-BAL-2026-000001:PAYMENT_NOTICE":
    "/demo-documents/balance-notice.pdf",
  "PL-SHP-2026-000001:PACKING_LIST":
    "/demo-documents/packing-list.pdf",
  "POD-2026-000001:DELIVERY_PROOF":
    "/demo-documents/delivery-proof.pdf",
  "CLM-2026-000001:CLAIM_RESOLUTION":
    "/demo-documents/claim-resolution.pdf",
};

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function Status({
  children,
  tone = "jade",
}: {
  children: React.ReactNode;
  tone?: "jade" | "lacquer" | "brass" | "ink";
}) {
  const colors = {
    jade: "border-jade/20 bg-jade/10 text-jade",
    lacquer: "border-lacquer/20 bg-lacquer/10 text-lacquer",
    brass: "border-brass/25 bg-brass/10 text-[#78521a]",
    ink: "border-ink/15 bg-ink/5 text-ink/65",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${colors[tone]}`}
    >
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <article className="rounded-[22px] border border-ink/10 bg-white/70 p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40">
        {label}
      </p>
      <p className="mt-3 font-display text-2xl font-semibold tracking-tight">
        {value}
      </p>
      {detail ? <p className="mt-2 text-xs text-ink/50">{detail}</p> : null}
    </article>
  );
}

function Card({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-ink/10 bg-[#fbf8f0] p-5 shadow-paper sm:p-7 ${className}`}
    >
      {eyebrow ? (
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-lacquer">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DocumentShelf({
  documents,
  memberMode,
}: {
  documents: DemoDocument[];
  memberMode: boolean;
}) {
  const visibleDocuments = memberMode
    ? documents.filter((document) => document.visibility === "MEMBER")
    : documents;

  return (
    <Card title="เอกสารที่เกิดขึ้นใน Workflow" eyebrow="Document shelf">
      {visibleDocuments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 p-5 text-sm text-ink/45">
          เอกสารจะปรากฏเมื่อดำเนินเรื่องไปถึงขั้นที่เกี่ยวข้อง
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleDocuments.map((document) => {
            const path =
              documentPaths[`${document.documentNumber}:${document.type}`];
            const isSpreadsheet = document.type === "PRODUCT_SCHEDULE_XLSX";
            return (
              <a
                key={document.id}
                href={path ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-ink/10 bg-white/75 p-4 transition hover:-translate-y-0.5 hover:border-brass/40 hover:bg-white"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-porcelain">
                  {isSpreadsheet ? (
                    <FileSpreadsheet size={19} />
                  ) : (
                    <FileText size={19} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {document.title}
                  </span>
                  <span className="mt-1 block text-[10px] text-ink/45">
                    {document.documentNumber} · DEMO
                  </span>
                </span>
                <Download
                  size={16}
                  className="text-ink/30 transition group-hover:text-lacquer"
                />
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SceneContent({
  sceneIndex,
  role,
}: {
  sceneIndex: number;
  role: DemoRole;
}) {
  const state = useMemo(
    () => buildDemoState(sceneIndex, role),
    [sceneIndex, role],
  );
  const { dataset } = state;
  const summary = getDashboardSummary(state);
  const executive = getExecutiveSummary(state);
  const gates = getDispatchGateResults(state);
  const memberMode = role === "MEMBER";
  const memberView = getMemberView(state);
  const documents = memberMode ? memberView.documents : dataset.documents;

  if (state.sceneId === "WELCOME") {
    return (
      <div className="space-y-6">
        <section className="relative min-h-[540px] overflow-hidden rounded-[34px] bg-ink text-porcelain shadow-[0_32px_90px_rgba(23,32,28,.24)]">
          <Image
            src="/demo-assets/riverstone-lobby.png"
            alt="ภาพจำลองล็อบบี้ Riverstone Boutique Hotel"
            fill
            priority
            className="object-cover opacity-70"
            sizes="(max-width: 1024px) 100vw, 75vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-transparent" />
          <div className="relative flex min-h-[540px] max-w-2xl flex-col justify-end p-7 sm:p-12">
            <div className="mb-auto flex items-center gap-2">
              <Status tone="brass">INTERACTIVE DEMO</Status>
              <Status tone="ink">ข้อมูลจำลองทั้งหมด</Status>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-brass">
              Riverstone Boutique Hotel · Bangkok
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-6xl">
              เห็นภาพการสั่งซื้อ
              <span className="block italic text-brass">ตั้งแต่แบบจนส่งมอบ</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-porcelain/72 sm:text-base">
              เรื่องจำลองหนึ่งโครงการ ครบ Standard Product, Custom RFQ,
              ใบเสนอราคา, การจ่าย 50/50, QC, Partial Shipment และ Claim
            </p>
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Demo Story" value="10 ขั้น" detail="เล่า Workflow ต่อเนื่อง" />
          <Metric label="Role Views" value="6 บทบาท" detail="มุมมองข้อมูลตามหน้าที่" />
          <Metric label="Safety" value="Browser only" detail="ไม่บันทึกเข้าฐานข้อมูลจริง" />
        </div>
      </div>
    );
  }

  if (state.sceneId === "PROJECT_CATALOG") {
    return (
      <div className="space-y-6">
        <Card title={dataset.project?.name ?? ""} eyebrow={dataset.project?.code}>
          <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <Image
                src="/demo-assets/riverstone-product-board.png"
                alt="Product board จำลองของโครงการ Riverstone"
                width={1200}
                height={800}
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />
              <p className="mt-3 text-xs leading-5 text-ink/50">
                ภาพสินค้าเป็น Visual สำหรับ Demo ไม่ใช่รูปสินค้าจริง
              </p>
            </div>
            <div className="space-y-3">
              {dataset.projectItems.map((item) => {
                const product = dataset.catalog.find(
                  (candidate) => candidate.id === item.productId,
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white/75 p-4"
                  >
                    <div>
                      <p className="text-sm font-bold">{product?.nameTh}</p>
                      <p className="mt-1 text-xs text-ink/45">
                        {item.area} · {item.quantity} ชิ้น · {product?.sku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        {formatMoney(item.memberUnitPriceSnapshot ?? 0)}
                      </p>
                      <Status>READY TO ORDER</Status>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
        <DocumentShelf documents={documents} memberMode={memberMode} />
      </div>
    );
  }

  if (state.sceneId === "CUSTOM_RFQ") {
    const request = dataset.customRequests[0];
    return (
      <div className="space-y-6">
        <Card title={request.title} eyebrow={request.requestNumber}>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="md:col-span-2 rounded-2xl bg-white/75 p-5">
              <p className="text-xs font-bold text-ink/40">CONFIRMED BRIEF</p>
              <p className="mt-3 text-sm leading-7">{request.specification}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Status tone="lacquer">CUSTOM ONLY</Status>
                <Status tone="brass">2 ITEMS</Status>
                <Status>{request.status}</Status>
              </div>
            </div>
            <div className="rounded-2xl bg-ink p-5 text-porcelain">
              <LockKeyhole className="text-brass" size={22} />
              <p className="mt-5 font-display text-xl font-semibold">
                ยังสั่งซื้อไม่ได้
              </p>
              <p className="mt-3 text-xs leading-6 text-porcelain/60">
                สินค้า Custom ต้องผ่าน RFQ และ Accept ใบเสนอราคาของ GISP
                ก่อนเสมอ
              </p>
            </div>
          </div>
        </Card>
        <DocumentShelf documents={documents} memberMode={memberMode} />
      </div>
    );
  }

  if (state.sceneId === "QUOTATION") {
    return (
      <div className="space-y-6">
        <Card title="Quotation Revision Control" eyebrow="QT-2026-000001">
          <div className="grid gap-4 md:grid-cols-2">
            {dataset.quotations.map((quotation) => (
              <div
                key={quotation.id}
                className={`rounded-2xl border p-5 ${
                  quotation.status === "ACCEPTED"
                    ? "border-jade/25 bg-jade/[0.06]"
                    : "border-ink/10 bg-white/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-display text-2xl font-semibold">
                    Version {quotation.version}
                  </p>
                  <Status
                    tone={
                      quotation.status === "ACCEPTED" ? "jade" : "ink"
                    }
                  >
                    {quotation.status}
                  </Status>
                </div>
                <p className="mt-6 text-xs text-ink/45">ยอดรวม VAT</p>
                <p className="mt-1 text-2xl font-bold">
                  {formatMoney(quotation.grandTotal)}
                </p>
                <p className="mt-3 text-xs leading-5 text-ink/55">
                  VAT {quotation.vatRate}% · Lead time {quotation.leadTimeDays} วัน
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3 rounded-2xl border border-jade/20 bg-jade/10 p-4 text-sm text-jade">
            <ShieldCheck className="shrink-0" size={19} />
            V2 ที่ Accepted ล็อกราคา สเปก VAT และ Lead Time แล้ว
            การแก้ไขใหม่ต้องสร้าง Revision ถัดไป
          </div>
        </Card>
        <DocumentShelf documents={documents} memberMode={memberMode} />
      </div>
    );
  }

  if (state.sceneId === "ORDER_DEPOSIT") {
    const order = dataset.orders[0];
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Order Total incl. VAT" value={formatMoney(order.grandTotal)} />
          <Metric label="Deposit 50%" value={formatMoney("481500")} detail="Verified สะสม 2 ครั้ง" />
          <Metric label="Supplier POs" value={dataset.supplierOrders.length} detail="แยกตามโรงงานอัตโนมัติ" />
        </div>
        <Card title="Payment verification" eyebrow={order.orderNumber}>
          <div className="space-y-3">
            {dataset.paymentTransfers.map((transfer) => (
              <div
                key={transfer.id}
                className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/75 p-4"
              >
                <div>
                  <p className="text-sm font-bold">{transfer.reference}</p>
                  <p className="mt-1 text-xs text-ink/45">Finance verified</p>
                </div>
                <p className="font-bold text-jade">{formatMoney(transfer.amount)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink p-4 text-sm text-porcelain">
            <CheckCircle2 className="text-brass" size={20} />
            ยอดสะสมครบ 481,500 บาทแล้ว จึงออก PO ให้ 3 Supplier ได้
          </div>
        </Card>
        <DocumentShelf documents={documents} memberMode={memberMode} />
      </div>
    );
  }

  if (state.sceneId === "PRODUCTION_QC") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Production updates" value={dataset.productionEvents.length} />
          <Metric label="Delay" value="5 วัน" detail="Supplier แจ้งพร้อมเหตุผล" />
          <Metric label="QC inspections" value={dataset.qcInspections.length} />
        </div>
        <Card title="Dispatch Gate ยังไม่ผ่าน" eyebrow="Safety gate">
          <div className="grid gap-3 md:grid-cols-2">
            {gates.map((gate) => {
              const item = dataset.projectItems.find(
                (candidate) => candidate.id === gate.projectItemId,
              );
              const product = dataset.catalog.find(
                (candidate) => candidate.id === item?.productId,
              );
              return (
                <div
                  key={gate.projectItemId}
                  className="rounded-2xl border border-ink/10 bg-white/70 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-bold">{product?.nameTh}</p>
                    <Status tone={gate.allowed ? "jade" : "lacquer"}>
                      {gate.allowed ? "PASS" : "BLOCKED"}
                    </Status>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-ink/50">
                    {gate.allowed
                      ? "ครบทุกเงื่อนไข"
                      : gate.failures.join(" · ")}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-3 rounded-2xl border border-lacquer/20 bg-lacquer/8 p-4 text-sm text-lacquer">
            <CircleAlert size={20} className="shrink-0" />
            แม้ QC ผ่านแล้ว ระบบยัง Block หาก Custom ยังไม่ Approved,
            Customer Balance หรือ Supplier Balance ยังไม่ครบ
          </div>
        </Card>
        <DocumentShelf documents={documents} memberMode={memberMode} />
      </div>
    );
  }

  if (state.sceneId === "APPROVAL_BALANCE") {
    const passed = gates.filter((gate) => gate.allowed).length;
    return (
      <div className="space-y-6">
        <Card title="Factory Dispatch Gate" eyebrow="4 conditions">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["QC Passed", "ตรวจคุณภาพผ่าน"],
              ["Member Approved", "Custom ได้รับอนุมัติ"],
              ["Balance Verified", "ลูกค้าชำระยอดคงเหลือ"],
              ["Supplier Paid", "ชำระโรงงานครบ"],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-2xl bg-jade p-5 text-white">
                <CheckCircle2 size={21} className="text-white/75" />
                <p className="mt-5 text-sm font-bold">{title}</p>
                <p className="mt-2 text-xs text-white/65">{detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center font-display text-2xl font-semibold text-jade">
            {passed}/{gates.length} รายการพร้อมออกจากโรงงาน
          </p>
        </Card>
        <DocumentShelf documents={documents} memberMode={memberMode} />
      </div>
    );
  }

  if (state.sceneId === "PARTIAL_SHIPMENT") {
    return (
      <div className="space-y-6">
        <Card title="Partial Shipment Plan" eyebrow="Logistics">
          <div className="relative space-y-3 before:absolute before:bottom-6 before:left-[25px] before:top-6 before:w-px before:bg-ink/10">
            {dataset.shipments.map((shipment, index) => (
              <div
                key={shipment.id}
                className="relative flex gap-4 rounded-2xl border border-ink/10 bg-white/75 p-4"
              >
                <span className="z-10 grid size-12 shrink-0 place-items-center rounded-2xl bg-ink text-brass">
                  <Truck size={20} />
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold">{shipment.shipmentNumber}</p>
                    <Status tone="brass">เที่ยวที่ {index + 1}</Status>
                  </div>
                  <p className="mt-2 text-xs text-ink/50">
                    {shipment.projectItemIds.length} รายการ · ETD {shipment.etd} ·
                    ETA {shipment.eta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <DocumentShelf documents={documents} memberMode={memberMode} />
      </div>
    );
  }

  if (state.sceneId === "DELIVERY_CLAIM") {
    const claim = dataset.claims[0];
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Deliveries" value={summary.deliveries} detail="2 เที่ยวส่งถึงหน้างาน" />
          <Metric label="Delivery issue" value="1 รายการ" detail="Lounge Chair เสียหาย" />
          <Metric label="Claim status" value={claim.status} detail={claim.claimNumber} />
        </div>
        <Card title="Delivery with Issue → Claim" eyebrow={claim.claimNumber}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-2xl border border-lacquer/20 bg-lacquer/8 p-5">
              <CircleAlert className="text-lacquer" />
              <p className="mt-4 font-bold">พบความเสียหายระหว่างขนส่ง</p>
              <p className="mt-2 text-sm leading-6 text-ink/55">
                {claim.description}
              </p>
            </div>
            <ArrowRight className="hidden text-ink/25 md:block" />
            <div className="rounded-2xl border border-brass/25 bg-brass/10 p-5">
              <PackageCheck className="text-[#78521a]" />
              <p className="mt-4 font-bold">อนุมัติผลิตทดแทน</p>
              <p className="mt-2 text-sm leading-6 text-ink/55">
                Claim เชื่อมตรงกับสินค้าและ Shipment ที่มีปัญหา
              </p>
            </div>
          </div>
        </Card>
        <DocumentShelf documents={documents} memberMode={memberMode} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {memberMode ? (
          <>
            <Metric label="Order total incl. VAT" value={formatMoney(dataset.orders[0]?.grandTotal ?? 0)} />
            <Metric label="Delivery status" value="Completed" detail="ส่งมอบครบ 2 เที่ยว" />
            <Metric label="Claim" value="Closed" detail="ได้รับสินค้าทดแทนแล้ว" />
          </>
        ) : (
          <>
            <Metric label="Product sales before VAT" value={formatMoney(executive.grossSalesBeforeVat)} />
            <Metric label="Gross product margin" value={formatMoney(executive.grossProductMargin)} detail={`${executive.grossProductMarginPercent}%`} />
            <Metric label="Verified payments" value={formatMoney(executive.paymentVerified)} />
          </>
        )}
      </div>
      <Card
        title={memberMode ? "Project Completion Summary" : "Executive Summary"}
        eyebrow="Read only"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
          <div className="rounded-2xl bg-ink p-6 text-porcelain">
            <Sparkles className="text-brass" />
            <p className="mt-8 font-display text-3xl font-semibold">
              Riverstone
              <span className="block italic text-brass">Completed</span>
            </p>
            <p className="mt-4 text-sm leading-7 text-porcelain/60">
              Order, Freight และ Claim ปิดครบ พร้อมประวัติทุกเหตุการณ์
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {(memberMode
              ? [
                  ["Order", "ORD-2026-000001"],
                  ["Delivery", "2 Completed"],
                  ["Production delay", "5 วัน"],
                  ["Claim", "1 Closed"],
                ]
              : [
                  ["Factory cost", formatMoney(executive.factoryCost)],
                  ["Freight before VAT", formatMoney(executive.freightRevenueBeforeVat)],
                  ["Production delay", "5 วัน"],
                  ["Claim", "1 Closed"],
                ]
            ).map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-ink/10 bg-white/75 p-5">
                <dt className="text-xs text-ink/45">{label}</dt>
                <dd className="mt-2 text-lg font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>
      <DocumentShelf documents={documents} memberMode={memberMode} />
    </div>
  );
}

export function DemoExperience() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [role, setRole] = useState<DemoRole>("MEMBER");
  const [hydrated, setHydrated] = useState(false);
  const scene = demoScenes[sceneIndex];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as {
            sceneIndex?: number;
            role?: DemoRole;
          };
          if (
            Number.isInteger(parsed.sceneIndex) &&
            (parsed.sceneIndex ?? -1) >= 0 &&
            (parsed.sceneIndex ?? demoScenes.length) < demoScenes.length
          ) {
            setSceneIndex(parsed.sceneIndex ?? 0);
          }
          if (parsed.role && demoRoles.includes(parsed.role)) setRole(parsed.role);
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sceneIndex, role }),
    );
  }, [hydrated, role, sceneIndex]);

  function reset() {
    setSceneIndex(0);
    setRole("MEMBER");
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <main className="demo-canvas min-h-screen bg-porcelain text-ink">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-porcelain/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="GISP Demo">
            <span className="grid size-10 place-items-center rounded-xl bg-ink text-xs font-black tracking-[0.16em] text-porcelain">
              GI
            </span>
            <span className="hidden sm:block">
              <span className="block font-display text-lg font-semibold leading-none">
                GISP
              </span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.2em] text-ink/45">
                Interactive Demo
              </span>
            </span>
          </Link>
          <span className="demo-stamp ml-auto hidden rotate-[-2deg] border-2 border-lacquer px-3 py-1 text-[10px] font-black tracking-[0.2em] text-lacquer sm:block">
            DEMO DATA
          </span>
          <label className="ml-auto flex min-w-0 items-center gap-2 sm:ml-3">
            <UserRound size={16} className="hidden text-ink/45 sm:block" />
            <span className="sr-only">เลือกบทบาท</span>
            <select
              aria-label="เลือกบทบาทสำหรับ Demo"
              value={role}
              onChange={(event) => setRole(event.target.value as DemoRole)}
              className="max-w-[190px] rounded-xl border border-ink/12 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-brass"
              data-testid="demo-role-select"
            >
              {demoRoles.map((item) => (
                <option key={item} value={item}>
                  {roleLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={reset}
            className="grid size-9 place-items-center rounded-xl border border-ink/10 bg-white text-ink/55 transition hover:text-lacquer"
            aria-label="เริ่ม Demo ใหม่"
          >
            <RefreshCcw size={15} />
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[290px_minmax(0,1fr)] lg:px-8">
        <aside className="min-w-0 max-w-full lg:sticky lg:top-[86px] lg:h-[calc(100vh-110px)]">
          <div className="min-w-0 max-w-full overflow-hidden rounded-[26px] bg-ink p-3 text-porcelain shadow-xl">
            <div className="px-3 pb-3 pt-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-brass">
                Guided story
              </p>
              <p className="mt-2 text-sm font-bold">
                {sceneIndex + 1} / {demoScenes.length} · {roleShortLabels[role]}
              </p>
            </div>
            <nav
              aria-label="ลำดับ Demo"
              className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible"
            >
              {demoScenes.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSceneIndex(index)}
                  className={`min-w-[210px] rounded-2xl p-3 text-left transition lg:min-w-0 lg:w-full ${
                    index === sceneIndex
                      ? "bg-porcelain text-ink"
                      : index < sceneIndex
                        ? "text-porcelain/65 hover:bg-white/5"
                        : "text-porcelain/38 hover:bg-white/5"
                  }`}
                  data-testid={`demo-scene-${index}`}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                        index === sceneIndex
                          ? "bg-lacquer text-white"
                          : index < sceneIndex
                            ? "bg-jade text-white"
                            : "bg-white/8"
                      }`}
                    >
                      {index < sceneIndex ? <CheckCircle2 size={14} /> : index + 1}
                    </span>
                    <span>
                      <span className="block text-xs font-bold leading-5">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-[9px] uppercase tracking-wider opacity-60">
                        {roleShortLabels[item.actorRole]}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <section className="mb-5 flex flex-col gap-4 rounded-[24px] border border-ink/10 bg-white/55 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lacquer">
                Step {sceneIndex + 1} · {roleLabels[role]}
              </p>
              <h1
                className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl"
                data-testid="demo-scene-title"
              >
                {scene.title}
              </h1>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-ink/50 sm:text-sm">
                {scene.outcome}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setSceneIndex((value) => Math.max(0, value - 1))}
                disabled={sceneIndex === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-ink/12 bg-white px-4 py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowLeft size={15} /> ก่อนหน้า
              </button>
              <button
                type="button"
                onClick={() =>
                  setSceneIndex((value) =>
                    Math.min(demoScenes.length - 1, value + 1),
                  )
                }
                disabled={sceneIndex === demoScenes.length - 1}
                className="inline-flex items-center gap-2 rounded-xl bg-lacquer px-4 py-3 text-xs font-bold text-white shadow-lg shadow-lacquer/15 disabled:cursor-not-allowed disabled:opacity-30"
                data-testid="demo-next"
              >
                ขั้นต่อไป <ArrowRight size={15} />
              </button>
            </div>
          </section>

          <div key={`${sceneIndex}-${role}`} className="reveal">
            <SceneContent sceneIndex={sceneIndex} role={role} />
          </div>

          <footer className="mt-8 flex flex-col gap-2 border-t border-ink/10 py-6 text-[10px] text-ink/40 sm:flex-row sm:justify-between">
            <p>GISP MVP · Interactive Demo · ไม่มีข้อมูลลูกค้าจริง</p>
            <p>ข้อมูลถูกจำไว้เฉพาะ Browser เครื่องนี้และ Reset ได้ทุกเมื่อ</p>
          </footer>
        </div>
      </div>
    </main>
  );
}
