"use client";

import { ArrowLeft, CheckCircle2, Download, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatQuotationMoney, quotationStatusLabels, quotationStatusTone, type QuotationDetail } from "@/lib/custom-quotation/types";

export function MemberQuotationDetail({ quotationId }: { quotationId: string }) {
  const [data, setData] = useState<QuotationDetail>();
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED">();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    const response = await fetch(`/api/member/custom-quotations/${quotationId}`, { cache: "no-store" });
    const body = await response.json() as { data?: QuotationDetail; message?: string };
    if (!response.ok) setError(body.message ?? "โหลดใบเสนอราคาไม่สำเร็จ"); else setData(body.data);
  }, [quotationId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function respond() {
    if (!decision || (decision === "REJECTED" && !reason.trim())) return;
    setBusy(true); setError(undefined); setMessage(undefined);
    const response = await fetch(`/api/member/custom-quotations/${quotationId}/respond`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: decision, reason }),
    });
    const body = await response.json() as { message?: string };
    setBusy(false);
    if (!response.ok) { setError(body.message ?? "บันทึกคำตอบไม่สำเร็จ"); return; }
    setMessage(body.message); setDecision(undefined); setReason(""); await load();
  }

  if (!data) return <main className="quotation-detail"><Link href="/member/custom-quotations" className="member-detail__back"><ArrowLeft size={16}/>กลับรายการ</Link><div className="v14-empty">{error ?? "กำลังโหลดใบเสนอราคา..."}</div></main>;
  const { quotation: row } = data;
  return <main className="quotation-detail member-quotation-detail">
    <Link href="/member/custom-quotations" className="member-detail__back"><ArrowLeft size={16}/>กลับรายการใบเสนอราคา</Link>
    <section className="v14-hero quotation-detail__hero"><div><p className="v14-eyebrow">{row.quotation_number} · REVISION {row.version}</p><h1>{data.request?.item_name ?? "Custom Quotation"}</h1><p>{data.project?.project_number} · {data.project?.name}</p></div><span className={`v14-status v14-status--${quotationStatusTone(row.status)}`}><small>สถานะปัจจุบัน</small>{quotationStatusLabels[row.status]}</span></section>
    {error ? <p className="v14-alert">{error}</p> : null}{message ? <p className="quotation-success" role="status">{message}</p> : null}
    <section className="quotation-command"><a href={`/api/custom-quotations/${row.id}/pdf`} className="v14-button v14-button--outline"><Download size={15}/>ดาวน์โหลด PDF</a><span><ShieldCheck size={14}/>ราคาและสเปกถูกล็อกตาม Revision นี้</span></section>
    {row.status === "SENT" ? <section className="quotation-decision"><div><p className="v14-eyebrow">ACTION REQUIRED</p><h2>ตรวจสอบก่อนตอบรับ</h2><p>เมื่อยอมรับแล้ว ระบบจะสร้างรายการ Custom ในโครงการด้วยราคา VAT สเปก และ Lead Time ตามเอกสารนี้ และไม่สามารถแก้ Revision ที่ยอมรับแล้วได้</p></div><div className="v14-actions"><button onClick={() => setDecision("ACCEPTED")} className="v14-button v14-button--dark"><CheckCircle2 size={15}/>ยอมรับใบเสนอราคา</button><button onClick={() => setDecision("REJECTED")} className="v14-button v14-button--outline"><XCircle size={15}/>ปฏิเสธ</button></div></section> : null}
    <section className="v14-panel quotation-document"><div className="v14-panel__head"><div><p className="v14-eyebrow">GISP issued document</p><h2>รายละเอียดใบเสนอราคา</h2></div><span>ใช้ได้ถึง {new Date(`${row.valid_until}T00:00:00`).toLocaleDateString("th-TH")}</span></div><div className="quotation-document__item">{data.items.map((item) => <div key={item.id}><span><b>{item.item_name}</b><small>{item.specification_snapshot}</small></span><span>{item.quantity} {item.unit}</span><strong>{formatQuotationMoney(item.line_subtotal, row.currency)}</strong></div>)}</div><dl className="quotation-totals"><div><dt>ยอดก่อน VAT</dt><dd>{formatQuotationMoney(row.subtotal, row.currency)}</dd></div><div><dt>VAT {row.vat_rate}%</dt><dd>{formatQuotationMoney(row.vat_amount, row.currency)}</dd></div><div className="grand"><dt>ยอดรวมสุทธิ</dt><dd>{formatQuotationMoney(row.grand_total, row.currency)}</dd></div><div><dt>Lead Time</dt><dd>{row.lead_time_days} วัน</dd></div></dl>{row.quote_note ? <p className="quotation-note"><b>หมายเหตุ</b>{row.quote_note}</p> : null}{row.decision_reason ? <p className="quotation-note"><b>เหตุผล</b>{row.decision_reason}</p> : null}</section>
    <section className="v14-panel quotation-timeline"><div className="v14-panel__head"><div><p className="v14-eyebrow">Timeline</p><h2>ประวัติ Revision นี้</h2></div></div><div>{data.history.map((entry) => <article key={entry.id}><span/><div><b>{entry.action}</b><p>{entry.message ?? `${entry.from_status ?? "เริ่มต้น"} → ${entry.to_status}`}</p><small>{new Date(entry.created_at).toLocaleString("th-TH")}</small></div></article>)}</div></section>
    {decision ? <div className="quotation-modal" role="dialog" aria-modal="true" aria-labelledby="quotation-decision-title"><div><p className="v14-eyebrow">CONFIRM DECISION</p><h2 id="quotation-decision-title">{decision === "ACCEPTED" ? "ยืนยันรับใบเสนอราคา" : "ปฏิเสธใบเสนอราคา"}</h2><p>{decision === "ACCEPTED" ? "ระบบจะล็อก Revision นี้และสร้างรายการพร้อมสั่งซื้อในโครงการทันที" : "กรุณาระบุเหตุผลเพื่อให้ GISP จัดทำ Revision ใหม่ได้ถูกต้อง"}</p>{decision === "REJECTED" ? <label>เหตุผล<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} autoFocus required/></label> : null}<div className="v14-actions"><button disabled={busy || (decision === "REJECTED" && !reason.trim())} onClick={() => void respond()} className="v14-button v14-button--dark">{busy ? "กำลังบันทึก..." : "ยืนยัน"}</button><button disabled={busy} onClick={() => setDecision(undefined)} className="v14-button v14-button--outline">กลับไปตรวจสอบ</button></div></div></div> : null}
  </main>;
}
