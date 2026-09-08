"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { ArrowLeft, ImageUp, LoaderCircle, PackagePlus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { sourcingStatusLabels } from "@/lib/sourcing/types";

type Option = {
  suppliers: Array<{ id: string; code: string; name: string }>;
  categories: Array<{ id: string; code: string; name_th: string }>;
  products: Array<{ id: string; sku: string; name_th: string }>;
};
type CandidateFile = { id: string; original_name: string; mime_type: string | null; size_bytes: number | null };
type Candidate = {
  id: string;
  name_th: string;
  member_price_before_vat: number;
  currency: string;
  status: string;
  product_id: string | null;
  proposed_sku: string | null;
  supplier_id: string | null;
  category_id: string | null;
  files: CandidateFile[];
};
type Data = {
  request: {
    id: string;
    request_number: string;
    item_name: string;
    description: string;
    status: string;
    match_preference: string;
    quantity: number;
    unit: string;
    budget_max: number | null;
    requested_material: string | null;
    requested_color: string | null;
  };
  files: Array<{ id: string; original_name: string }>;
  candidates: Candidate[];
  history: Array<{ id: string; action: string; message: string | null; visibility: string; created_at: string }>;
};

export function AdminSourcingDetail({ requestId }: { requestId: string }) {
  const [data, setData] = useState<Data>();
  const [options, setOptions] = useState<Option>({ suppliers: [], categories: [], products: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [detail, optionResponse] = await Promise.all([
      fetch(`/api/admin/sourcing-requests/${requestId}`),
      fetch("/api/admin/sourcing-requests/options"),
    ]);
    const [body, optionBody] = await Promise.all([detail.json(), optionResponse.json()]);
    if (detail.ok) setData(body.data);
    else setError(body.message ?? "โหลดไม่สำเร็จ");
    if (optionResponse.ok) setOptions(optionBody.data);
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(path: string, payload?: unknown, method = "POST") {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/sourcing-requests/${requestId}${path}`, {
      method,
      headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const body = await response.json();
    if (response.ok) {
      setMessage(body.message);
      await load();
    } else setError(body.message ?? "ทำรายการไม่สำเร็จ");
    setBusy(false);
  }

  async function uploadCandidateImage(candidateId: string, form: FormData) {
    setBusy(true);
    setError("");
    const response = await fetch(
      `/api/admin/sourcing-requests/${requestId}/candidates/${candidateId}/files`,
      { method: "POST", body: form },
    );
    const body = await response.json();
    if (response.ok) {
      setMessage(body.message);
      await load();
    } else setError(body.message ?? "แนบภาพไม่สำเร็จ");
    setBusy(false);
  }

  if (!data) {
    return <div className="v14-panel v14-empty">{error || <><LoaderCircle className="animate-spin" />กำลังโหลด…</>}</div>;
  }

  const selected = data.candidates.find((item) => item.status === "SELECTED");
  const requestEditable = ["SUBMITTED", "UNDER_REVIEW", "NEED_INFO"].includes(data.request.status);

  return <div className="member-catalog">
    <Link href="/admin/sourcing-requests" className="member-detail__back"><ArrowLeft />กลับคิว</Link>
    <section className="v14-hero">
      <div><p className="v14-eyebrow">{data.request.request_number}</p><h1>{data.request.item_name}</h1><p>{data.request.description}</p></div>
      <span className="v14-status v14-status--good">{sourcingStatusLabels[data.request.status] ?? data.request.status}</span>
    </section>
    {error ? <div className="v14-alert"><b>ทำรายการไม่สำเร็จ</b><span>{error}</span></div> : null}
    {message ? <div className="rounded-xl bg-emerald-50 p-4">{message}</div> : null}

    <section className="v14-panel">
      <h2>ภาพและความต้องการของ Member</h2>
      <p className="mt-2">{data.request.quantity} {data.request.unit} · วัสดุ {data.request.requested_material ?? "—"} · สี {data.request.requested_color ?? "—"} · งบ {data.request.budget_max ? Number(data.request.budget_max).toLocaleString("th-TH") : "ไม่ระบุ"}</p>
      <div className="mt-3 flex flex-wrap gap-3">{data.files.map((file) => <a key={file.id} href={`/api/admin/sourcing-requests/${requestId}/files/${file.id}`} target="_blank" rel="noreferrer" className="rounded-lg border p-3 underline">{file.original_name}</a>)}</div>
    </section>

    <section className="v14-panel">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Workflow</p><h2>เปลี่ยนสถานะ</h2></div></div>
      <div className="v14-actions">
        {data.request.status === "SUBMITTED" ? <button disabled={busy} onClick={() => void call("/action", { action: "START_REVIEW", message: "" })} className="v14-button v14-button--dark">เริ่มจัดหา</button> : null}
        {data.request.status === "UNDER_REVIEW" ? <>
          <button disabled={busy} onClick={() => { const text = window.prompt("ข้อมูลที่ต้องการเพิ่ม"); if (text) void call("/action", { action: "REQUEST_INFO", message: text }); }} className="v14-button v14-button--outline">ขอข้อมูลเพิ่ม</button>
          <button disabled={busy || !data.candidates.some((item) => item.status === "DRAFT")} onClick={() => void call("/action", { action: "PUBLISH_OPTIONS", message: "" })} className="v14-button v14-button--dark"><Send />ส่งตัวเลือกให้ Member</button>
          <button disabled={busy} onClick={() => { const text = window.prompt("เหตุผลที่หาไม่ได้"); if (text) void call("/action", { action: "MARK_UNAVAILABLE", message: text }); }} className="v14-button v14-button--outline">ระบุว่าหาไม่ได้</button>
        </> : null}
      </div>
    </section>

    {requestEditable ? <section className="v14-panel">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Candidate</p><h2>เพิ่มตัวเลือกสินค้า</h2></div></div>
      <form onSubmit={async (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        await call("/candidates", {
          candidateId: null, supplierId: form.get("supplierId") || null, categoryId: form.get("categoryId") || null,
          proposedSku: form.get("proposedSku"), factorySku: form.get("factorySku"), productType: "STANDARD", countryCode: "CN",
          nameTh: form.get("nameTh"), nameEn: "", description: form.get("description"), specificationSummary: form.get("specification"),
          materialSummary: form.get("material"), finishSummary: form.get("finish"), memberPrice: Number(form.get("memberPrice")),
          leadTimeDays: form.get("leadTime") ? Number(form.get("leadTime")) : null,
          factoryCost: form.get("factoryCost") ? Number(form.get("factoryCost")) : null,
          factoryCurrency: "CNY", internalNote: form.get("internalNote"),
        });
        formElement.reset();
      }} className="grid gap-3 md:grid-cols-2">
        <label>ชื่อสินค้า<input name="nameTh" required /></label><label>ราคาสมาชิกก่อน VAT<input name="memberPrice" type="number" min="0" step="0.01" required /></label>
        <label>Supplier<select name="supplierId"><option value="">ยังไม่ระบุ</option>{options.suppliers.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
        <label>หมวด<select name="categoryId"><option value="">ไม่ระบุ</option>{options.categories.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name_th}</option>)}</select></label>
        <label>SKU ที่เสนอ<input name="proposedSku" /></label><label>Factory SKU<input name="factorySku" /></label>
        <label className="md:col-span-2">คำอธิบาย<textarea name="description" /></label><label className="md:col-span-2">สเปก<textarea name="specification" /></label>
        <label>วัสดุ<input name="material" /></label><label>ผิว/สี<input name="finish" /></label><label>Lead time วัน<input name="leadTime" type="number" min="1" /></label>
        <label>ต้นทุนภายใน<input name="factoryCost" type="number" min="0" step="0.01" /></label><label className="md:col-span-2">หมายเหตุภายใน<textarea name="internalNote" /></label>
        <button disabled={busy} className="v14-button v14-button--dark md:col-span-2"><PackagePlus />บันทึกตัวเลือก</button>
      </form>
    </section> : null}

    <section className="v14-panel">
      <h2>ตัวเลือกทั้งหมด</h2>
      <div className="mt-3 grid gap-3">{data.candidates.map((candidate) => <div key={candidate.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <span><b>{candidate.name_th}</b><small className="block">{Number(candidate.member_price_before_vat).toLocaleString("th-TH")} {candidate.currency} · {candidate.status}</small></span>
          {candidate.status === "DRAFT" ? <div className="flex flex-wrap gap-2">
            <form onSubmit={async (event) => { event.preventDefault(); const formElement = event.currentTarget; await uploadCandidateImage(candidate.id, new FormData(formElement)); formElement.reset(); }} className="flex gap-2">
              <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
              <button disabled={busy || candidate.files.length >= 8} className="v14-button v14-button--outline"><ImageUp />ภาพ {candidate.files.length}/8</button>
            </form>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm("ลบตัวเลือกสินค้านี้ใช่หรือไม่?")) void call("/candidates", { candidateId: candidate.id }, "DELETE"); }} className="v14-button v14-button--outline"><Trash2 />ลบ</button>
          </div> : null}
        </div>
        {candidate.files.length ? <div className="mt-3 flex flex-wrap gap-2">{candidate.files.map((file) => <span key={file.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <a href={`/api/admin/sourcing-requests/${requestId}/candidates/${candidate.id}/files/${file.id}`} target="_blank" rel="noreferrer" className="underline">{file.original_name}</a>
          {candidate.status === "DRAFT" ? <button type="button" aria-label={`ลบ ${file.original_name}`} disabled={busy} onClick={() => { if (window.confirm("ลบภาพตัวเลือกนี้ใช่หรือไม่?")) void call(`/candidates/${candidate.id}/files/${file.id}`, undefined, "DELETE"); }}><Trash2 size={15} /></button> : null}
        </span>)}</div> : null}
      </div>)}</div>
    </section>

    {selected ? <section className="v14-panel">
      <h2>สินค้าที่ Member เลือก</h2>
      <div className="v14-actions mt-3">
        {data.request.status === "MEMBER_SELECTED" ? <button disabled={busy || !selected.supplier_id || !selected.proposed_sku} onClick={() => void call("/create-product", { candidateId: selected.id })} className="v14-button v14-button--dark">สร้าง Product Draft</button> : null}
        <select id="publishedProduct"><option value="">เลือกสินค้าที่ Publish แล้ว</option>{options.products.map((item) => <option key={item.id} value={item.id}>{item.sku} — {item.name_th}</option>)}</select>
        <button disabled={busy} onClick={() => { const productId = (document.getElementById("publishedProduct") as HTMLSelectElement)?.value; if (productId) void call("/link-product", { candidateId: selected.id, productId }); }} className="v14-button v14-button--outline">เชื่อม Product และปิดงาน</button>
      </div>
      {selected.product_id ? <Link href={`/admin/catalog/products/${selected.product_id}`} className="mt-3 inline-block underline">เปิด Product Detail</Link> : null}
    </section> : null}

    <section className="v14-panel"><h2>ประวัติ</h2><div className="mt-3 grid gap-2">{data.history.map((item) => <div key={item.id} className="rounded-lg border p-3"><b>{item.action}</b><small className="block">{item.visibility} · {item.message ?? "—"} · {new Date(item.created_at).toLocaleString("th-TH")}</small></div>)}</div></section>
  </div>;
}
