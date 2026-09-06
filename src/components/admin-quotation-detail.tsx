"use client";

import { ArrowLeft, Ban, Download, RefreshCw, Save, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatQuotationMoney, quotationStatusLabels, quotationStatusTone, type QuotationDetail } from "@/lib/custom-quotation/types";

const historyVisibilityLabels = {
  MEMBER: "สมาชิกเห็นได้",
  INTERNAL: "ภายใน GISP",
} as const;

function validDaysUntil(date: string) {
  return Math.max(1, Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000));
}

export function AdminQuotationDetail({ quotationId }: { quotationId: string }) {
  const [data, setData] = useState<QuotationDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/custom-quotations/${quotationId}`, { cache: "no-store" });
    const body = await response.json() as { data?: QuotationDetail; message?: string };
    if (!response.ok) setError(body.message ?? "โหลดใบเสนอราคาไม่สำเร็จ"); else setData(body.data);
  }, [quotationId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function action(url: string, body: Record<string, unknown>) {
    setBusy(true); setError(undefined); setMessage(undefined);
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { message?: string };
    setBusy(false);
    if (!response.ok) { setError(result.message ?? "ทำรายการไม่สำเร็จ"); return; }
    setMessage(result.message); await load();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(undefined); setMessage(undefined);
    const response = await fetch(`/api/admin/custom-quotations/${quotationId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        subtotal: form.get("subtotal"), lead_time_days: form.get("leadTimeDays"), valid_days: form.get("validDays"),
        supplier_id: form.get("supplierId"), supplier_cost_total: form.get("supplierCostTotal"),
        quote_note: form.get("quoteNote"), confirmed_specification: form.get("confirmedSpecification"),
      }),
    });
    const result = await response.json() as { message?: string };
    setBusy(false);
    if (!response.ok) setError(result.message ?? "บันทึกไม่สำเร็จ"); else { setMessage(result.message); await load(); }
  }

  if (!data) return <main className="quotation-detail"><Link href="/admin/custom-quotations" className="member-detail__back"><ArrowLeft size={16}/>กลับรายการ</Link><div className="v14-empty">{error ?? "กำลังโหลดใบเสนอราคา..."}</div></main>;
  const { quotation: row } = data;
  const expired = row.status === "SENT" && row.valid_until < new Date().toISOString().slice(0, 10);
  return <main className="quotation-detail">
    <Link href="/admin/custom-quotations" className="member-detail__back"><ArrowLeft size={16}/>กลับรายการใบเสนอราคา</Link>
    <section className="v14-hero quotation-detail__hero"><div><p className="v14-eyebrow">{row.quotation_number} · REVISION {row.version}</p><h1>{data.request?.item_name ?? "Custom Quotation"}</h1><p>{data.member?.company_name} · {data.project?.project_number} · {data.project?.name}</p></div><span className={`v14-status v14-status--${quotationStatusTone(row.status)}`}><small>สถานะปัจจุบัน</small>{quotationStatusLabels[row.status]}</span></section>
    {error ? <p className="v14-alert">{error}</p> : null}{message ? <p className="quotation-success" role="status">{message}</p> : null}
    <section className="quotation-command"><a href={`/api/custom-quotations/${row.id}/pdf`} className="v14-button v14-button--outline"><Download size={15}/>ดาวน์โหลด PDF</a>{row.status === "DRAFT" ? <button disabled={busy} onClick={() => void action(`/api/admin/custom-quotations/${row.id}/send`, {})} className="v14-button v14-button--dark"><Send size={15}/>ส่งให้สมาชิก</button> : null}{["DRAFT", "SENT"].includes(row.status) ? <button disabled={busy} onClick={() => { const reason = window.prompt("เหตุผลที่ยกเลิกใบเสนอราคา"); if (reason) void action(`/api/admin/custom-quotations/${row.id}/action`, { action: "CANCEL", reason }); }} className="v14-button v14-button--outline"><Ban size={15}/>ยกเลิก</button> : null}{expired ? <button disabled={busy} onClick={() => void action(`/api/admin/custom-quotations/${row.id}/action`, { action: "EXPIRE", reason: "" })} className="v14-button v14-button--outline">บันทึกหมดอายุ</button> : null}<button type="button" onClick={() => void load()} className="v14-icon-button" aria-label="โหลดใหม่"><RefreshCw size={15}/></button></section>
    <section className="quotation-detail__grid">
      <article className="v14-panel quotation-document"><div className="v14-panel__head"><div><p className="v14-eyebrow">Member document</p><h2>รายละเอียดที่สมาชิกเห็น</h2></div><span>ใช้ได้ถึง {new Date(`${row.valid_until}T00:00:00`).toLocaleDateString("th-TH")}</span></div>
        <div className="quotation-document__item">{data.items.map((item) => <div key={item.id}><span><b>{item.item_name}</b><small>{item.specification_snapshot}</small></span><span>{item.quantity} {item.unit}</span><strong>{formatQuotationMoney(item.line_subtotal, row.currency)}</strong></div>)}</div>
        <dl className="quotation-totals"><div><dt>ยอดก่อน VAT</dt><dd>{formatQuotationMoney(row.subtotal, row.currency)}</dd></div><div><dt>VAT {row.vat_rate}%</dt><dd>{formatQuotationMoney(row.vat_amount, row.currency)}</dd></div><div className="grand"><dt>ยอดรวมสุทธิ</dt><dd>{formatQuotationMoney(row.grand_total, row.currency)}</dd></div><div><dt>Lead Time</dt><dd>{row.lead_time_days} วัน</dd></div></dl>
        {row.quote_note ? <p className="quotation-note"><b>หมายเหตุ</b>{row.quote_note}</p> : null}{row.decision_reason ? <p className="quotation-note"><b>เหตุผลการตัดสินใจ</b>{row.decision_reason}</p> : null}
      </article>
      <aside className="quotation-detail__side">
        <article className="v14-panel quotation-internal"><p className="v14-eyebrow">Internal only</p><h2>ต้นทุนภายใน</h2><dl><div><dt>Supplier</dt><dd>{data.cost?.supplier?.code} · {data.cost?.supplier?.name ?? "—"}</dd></div><div><dt>ต้นทุนรวม</dt><dd>{data.cost ? formatQuotationMoney(data.cost.supplier_cost_total, data.cost.supplier_currency) : "—"}</dd></div></dl></article>
        <article className="v14-panel"><p className="v14-eyebrow">Version chain</p><h2>Revision</h2><p>ฉบับนี้ Revision {row.version}{row.revision_of_id ? " และแทนฉบับก่อนหน้า" : " เป็นฉบับแรก"}</p><Link className="v14-button v14-button--outline" href={`/admin/custom-quotations?requestId=${row.custom_request_id}`}>ดูทุก Revision</Link></article>
      </aside>
    </section>
    {row.status === "DRAFT" ? <section className="v14-panel quotation-edit"><div className="v14-panel__head"><div><p className="v14-eyebrow">Editable draft</p><h2>แก้ไขก่อนส่ง</h2></div><small>หลังส่งแล้ว ราคาและสเปกจะถูกล็อก</small></div><form key={row.updated_at} onSubmit={save} className="quotation-form"><label>ราคาก่อน VAT<input name="subtotal" type="number" step="0.01" min="0.01" defaultValue={row.subtotal} required/></label><label>Lead Time (วัน)<input name="leadTimeDays" type="number" min="1" defaultValue={row.lead_time_days} required/></label><label>Validity นับจากวันนี้<input name="validDays" type="number" min="1" max="365" defaultValue={validDaysUntil(row.valid_until)} required/></label><label>Supplier Candidate<select name="supplierId" defaultValue={data.cost?.supplier_id} required>{data.candidates?.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.name}</option>)}</select></label><label>ต้นทุน Supplier (ภายใน)<input name="supplierCostTotal" type="number" step="0.01" min="0.01" defaultValue={data.cost?.supplier_cost_total} required/></label><label className="quotation-form__wide">สเปกยืนยัน<textarea name="confirmedSpecification" rows={5} defaultValue={row.confirmed_specification} required/></label><label className="quotation-form__wide">หมายเหตุ<textarea name="quoteNote" rows={3} defaultValue={row.quote_note ?? ""}/></label><button disabled={busy} className="v14-button v14-button--dark"><Save size={15}/>บันทึกร่าง</button></form></section> : null}
    <section className="v14-panel quotation-timeline"><div className="v14-panel__head"><div><p className="v14-eyebrow">Audit timeline</p><h2>ประวัติใบเสนอราคา</h2></div></div><div>{data.history.map((entry) => <article key={entry.id}><span/><div><b>{entry.action}</b><p>{entry.message ?? `${entry.from_status ?? "เริ่มต้น"} → ${entry.to_status}`}</p><small>{new Date(entry.created_at).toLocaleString("th-TH")} · {historyVisibilityLabels[entry.visibility]}</small></div></article>)}</div></section>
  </main>;
}
