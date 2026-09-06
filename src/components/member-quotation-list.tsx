"use client";

import { FileText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatQuotationMoney, quotationStatusLabels, quotationStatusTone, type QuotationListRow, type QuotationStatus } from "@/lib/custom-quotation/types";

export function MemberQuotationList() {
  const [rows, setRows] = useState<QuotationListRow[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    setError(undefined);
    const response = await fetch(`/api/member/custom-quotations${status ? `?status=${status}` : ""}`, { cache: "no-store" });
    const body = await response.json() as { data?: QuotationListRow[]; message?: string };
    if (!response.ok) setError(body.message ?? "โหลดใบเสนอราคาไม่สำเร็จ"); else setRows(body.data ?? []);
  }, [status]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const actionCount = useMemo(() => rows.filter((row) => row.status === "SENT").length, [rows]);
  return <main className="quotation-workspace member-quotation-workspace">
    <section className="v14-hero quotation-hero"><div><p className="v14-eyebrow">MY GISP QUOTATIONS</p><h1>ใบเสนอราคาของฉัน</h1><p>ตรวจราคา VAT สเปกยืนยัน Lead Time และดาวน์โหลด PDF ก่อนตอบรับ</p></div><span className={`quotation-hero__seal ${actionCount ? "is-action" : ""}`}><FileText size={18}/><span>{actionCount ? `${actionCount} รายการรอตอบรับ` : "ไม่มีรายการค้าง"}<small>Controlled snapshot</small></span></span></section>
    {error ? <p className="v14-alert">{error}</p> : null}
    <section className="v14-panel quotation-queue"><div className="v14-panel__head"><div><p className="v14-eyebrow">Version register</p><h2>รายการทั้งหมด</h2></div><button type="button" onClick={() => void load()} className="v14-button v14-button--outline v14-button--small"><RefreshCw size={14}/>โหลดใหม่</button></div><div className="quotation-filters"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(quotationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="quotation-list">{rows.length ? rows.map((row) => <Link key={row.id} href={`/member/custom-quotations/${row.id}`}><span><b>{row.quotation_number} · R{row.version}</b><small>{row.request?.request_number} · {row.request?.item_name}</small><small>{row.project?.project_number} · {row.project?.name}</small></span><span><strong>{formatQuotationMoney(row.grand_total, row.currency)}</strong><small>ใช้ได้ถึง {new Date(`${row.valid_until}T00:00:00`).toLocaleDateString("th-TH")}</small></span><span className={`v14-status v14-status--${quotationStatusTone(row.status as QuotationStatus)}`}>{quotationStatusLabels[row.status as QuotationStatus]}</span></Link>) : <div className="v14-empty"><FileText/><b>ยังไม่มีใบเสนอราคา</b><span>ใบเสนอราคาที่ GISP ส่งมาจะปรากฏที่นี่</span></div>}</div></section>
  </main>;
}
