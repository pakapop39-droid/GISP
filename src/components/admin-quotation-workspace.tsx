"use client";

import { FilePlus2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatQuotationMoney, quotationStatusLabels, quotationStatusTone, type QuotationListRow, type QuotationStatus } from "@/lib/custom-quotation/types";

type QuoteOption = {
  id: string;
  request_number: string;
  item_name: string;
  specification: string;
  quantity: number;
  unit: string;
  member: { company_name: string } | null;
  project: { project_number: string; name: string } | null;
  candidates: Array<{ id: string; code: string; name: string }>;
};

export function AdminQuotationWorkspace() {
  const router = useRouter();
  const [rows, setRows] = useState<QuotationListRow[]>([]);
  const [options, setOptions] = useState<QuoteOption[]>([]);
  const [requestId, setRequestId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    const [listResponse, optionsResponse] = await Promise.all([
      fetch(`/api/admin/custom-quotations${status ? `?status=${status}` : ""}`, { cache: "no-store" }),
      fetch("/api/admin/custom-quotations/options", { cache: "no-store" }),
    ]);
    const [listBody, optionsBody] = await Promise.all([listResponse.json(), optionsResponse.json()]) as [{ data?: QuotationListRow[]; message?: string }, { data?: QuoteOption[]; message?: string }];
    if (!listResponse.ok || !optionsResponse.ok) {
      setError(listBody.message ?? optionsBody.message ?? "โหลดข้อมูลใบเสนอราคาไม่สำเร็จ");
      return;
    }
    setRows(listBody.data ?? []);
    setOptions(optionsBody.data ?? []);
    setRequestId((current) => current || optionsBody.data?.[0]?.id || "");
  }, [status]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const selected = useMemo(() => options.find((option) => option.id === requestId) ?? null, [options, requestId]);
  const metrics = useMemo(() => ({
    draft: rows.filter((row) => row.status === "DRAFT").length,
    sent: rows.filter((row) => row.status === "SENT").length,
    accepted: rows.filter((row) => row.status === "ACCEPTED").length,
  }), [rows]);

  async function createQuotation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(undefined); setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/custom-quotations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        custom_request_id: requestId,
        subtotal: form.get("subtotal"),
        lead_time_days: form.get("leadTimeDays"),
        valid_days: form.get("validDays"),
        supplier_id: form.get("supplierId"),
        supplier_cost_total: form.get("supplierCostTotal"),
        quote_note: form.get("quoteNote"),
        confirmed_specification: form.get("confirmedSpecification"),
      }),
    });
    const body = await response.json() as { data?: { id: string }; message?: string };
    setBusy(false);
    if (!response.ok || !body.data?.id) { setError(body.message ?? "สร้างใบเสนอราคาไม่สำเร็จ"); return; }
    setMessage(body.message);
    router.push(`/admin/custom-quotations/${body.data.id}`);
  }

  return <main className="quotation-workspace">
    <section className="v14-hero quotation-hero"><div><p className="v14-eyebrow">SLICE 5 · GISP QUOTATION CONTROL</p><h1>ใบเสนอราคา Custom</h1><p>สร้าง Revision, ล็อก VAT/สเปก/Lead Time และติดตามคำตอบจากสมาชิกในที่เดียว</p></div><span className="quotation-hero__seal"><ShieldCheck size={18}/><span>Controlled snapshot<small>GISP issued</small></span></span></section>
    <section className="quotation-metrics"><div><small>ร่าง</small><strong>{metrics.draft}</strong><span>แก้ไขก่อนส่ง</span></div><div><small>รอคำตอบ</small><strong>{metrics.sent}</strong><span>Action required</span></div><div><small>ยอมรับแล้ว</small><strong>{metrics.accepted}</strong><span>พร้อมสร้าง Order</span></div><div><small>RFQ พร้อมเสนอราคา</small><strong>{options.length}</strong><span>สร้าง Draft ได้</span></div></section>
    {error ? <p className="v14-alert">{error}</p> : null}{message ? <p className="quotation-success" role="status">{message}</p> : null}
    <section className="quotation-layout">
      <article className="v14-panel quotation-builder"><div className="v14-panel__head"><div><p className="v14-eyebrow">New revision</p><h2>สร้างใบเสนอราคา</h2></div><small>เฉพาะ RFQ สถานะพร้อมทำใบเสนอราคา</small></div>
        {options.length ? <form key={selected?.id} onSubmit={createQuotation} className="quotation-form">
          <label className="quotation-form__wide">Custom Request<select value={requestId} onChange={(event) => setRequestId(event.target.value)} required>{options.map((option) => <option key={option.id} value={option.id}>{option.request_number} · {option.item_name} · {option.member?.company_name ?? "—"}</option>)}</select></label>
          <div className="quotation-source quotation-form__wide"><span><b>{selected?.project?.project_number}</b> · {selected?.project?.name}</span><span>จำนวน {selected?.quantity} {selected?.unit}</span></div>
          <label>ราคาก่อน VAT<input name="subtotal" type="number" min="0.01" step="0.01" required placeholder="95000.00"/></label>
          <label>Lead Time (วัน)<input name="leadTimeDays" type="number" min="1" max="730" defaultValue="45" required/></label>
          <label>Validity (วัน)<input name="validDays" type="number" min="1" max="365" defaultValue="30" required/></label>
          <label>Supplier Candidate<select name="supplierId" required><option value="">เลือก Supplier</option>{selected?.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.code} · {candidate.name}</option>)}</select></label>
          <label>ต้นทุน Supplier (ภายใน)<input name="supplierCostTotal" type="number" min="0.01" step="0.01" required/></label>
          <label className="quotation-form__wide">สเปกที่ยืนยัน<textarea name="confirmedSpecification" rows={5} defaultValue={selected?.specification} required minLength={10}/></label>
          <label className="quotation-form__wide">หมายเหตุในใบเสนอราคา<textarea name="quoteNote" rows={3} placeholder="เงื่อนไขหรือรายละเอียดเพิ่มเติม"/></label>
          <button disabled={busy || !selected?.candidates.length} className="v14-button v14-button--dark quotation-form__submit"><FilePlus2 size={15}/>{busy ? "กำลังสร้าง..." : "สร้าง Draft / Revision"}</button>
          {!selected?.candidates.length ? <small className="quotation-form__warning">RFQ นี้ยังไม่มี Supplier Candidate ที่ Active</small> : null}
        </form> : <div className="v14-empty"><FilePlus2/><b>ยังไม่มี RFQ ที่พร้อมทำใบเสนอราคา</b><span>ให้ทีม RFQ ตรวจสเปกและเลือก Supplier Candidate ก่อน</span><Link className="v14-button v14-button--outline" href="/admin/custom-requests">ไป RFQ Queue</Link></div>}
      </article>
      <article className="v14-panel quotation-queue"><div className="v14-panel__head"><div><p className="v14-eyebrow">Version register</p><h2>รายการใบเสนอราคา</h2></div><button type="button" onClick={() => void load()} className="v14-button v14-button--outline v14-button--small"><RefreshCw size={14}/>โหลดใหม่</button></div>
        <div className="quotation-filters"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(quotationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="quotation-list">{rows.length ? rows.map((row) => <Link key={row.id} href={`/admin/custom-quotations/${row.id}`}><span><b>{row.quotation_number} · R{row.version}</b><small>{row.request?.request_number} · {row.request?.item_name}</small><small>{row.member?.company_name} · {row.project?.name}</small></span><span><strong>{formatQuotationMoney(row.grand_total, row.currency)}</strong><small>ใช้ได้ถึง {new Date(`${row.valid_until}T00:00:00`).toLocaleDateString("th-TH")}</small></span><span className={`v14-status v14-status--${quotationStatusTone(row.status as QuotationStatus)}`}>{row.status === "SENT" ? <Send size={12}/> : null}{quotationStatusLabels[row.status as QuotationStatus]}</span></Link>) : <div className="v14-empty"><span>ยังไม่มีใบเสนอราคาในตัวกรองนี้</span></div>}</div>
      </article>
    </section>
  </main>;
}
