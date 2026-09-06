"use client";

import { ArrowLeft, File, LoaderCircle, Quote, Send, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { customRequestFileRoleLabels, customRequestFileRoles, customRequestStatusLabels, customRequestTypeLabels, customRequestTypes, type CustomRequestFile, type CustomRequestHistory, type CustomRequestRow } from "@/lib/custom-rfq/types";

type Detail = {
  request: CustomRequestRow;
  project: { id: string; project_number: string; name: string; site_address: string; expected_need_date: string | null };
  area: { id: string; name: string } | null;
  areas: Array<{ id: string; name: string }>;
  history: CustomRequestHistory[];
  files: CustomRequestFile[];
};

const value = (input: FormDataEntryValue | null) => input ? Number(input) : null;

export function MemberCustomRequestDetail({ requestId }: { requestId: string }) {
  const [data, setData] = useState<Detail>();
  const [areas, setAreas] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    const response = await fetch(`/api/member/custom-requests/${requestId}`);
    const body = await response.json();
    if (!response.ok) setError(body.message ?? "โหลดข้อมูลไม่สำเร็จ");
    else {
      setData(body.data);
      setAreas(body.data.areas ?? []);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const response = await fetch(`/api/member/custom-requests/${requestId}`);
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(body.message ?? "โหลดข้อมูลไม่สำเร็จ");
          return;
        }

        setData(body.data);
        setAreas(body.data.areas ?? []);
      } catch {
        if (!cancelled) setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
    }

    void loadInitialData();
    return () => { cancelled = true; };
  }, [requestId]);

  async function jsonAction(path: string, method: string, payload: unknown) {
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) setError(body.message ?? "ทำรายการไม่สำเร็จ");
    else { setMessage(body.message ?? "บันทึกแล้ว"); await load(); }
    setBusy(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    await jsonAction(`/api/member/custom-requests/${requestId}`, "PATCH", {
      projectId: data.request.project_id, areaId: form.get("areaId") || null, baseProductId: data.request.base_product_id,
      requestType: form.get("requestType"), itemName: form.get("itemName"), description: form.get("description"),
      widthMm: value(form.get("widthMm")), depthMm: value(form.get("depthMm")), heightMm: value(form.get("heightMm")),
      quantity: Number(form.get("quantity")), unit: form.get("unit"), requestedMaterial: form.get("requestedMaterial"),
      requestedColor: form.get("requestedColor"), requestedFunction: form.get("requestedFunction"), memberNote: form.get("memberNote"),
    });
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/member/custom-requests/${requestId}/files`, { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok) setError(body.message ?? "อัปโหลดไม่สำเร็จ");
    else { setMessage("แนบไฟล์แล้ว"); event.currentTarget.reset(); await load(); }
    setBusy(false);
  }

  if (!data) return <div className="v14-empty">{error || <><LoaderCircle className="animate-spin"/>กำลังโหลด Custom Request…</>}</div>;
  const row = data.request;
  const editable = ["DRAFT", "NEED_INFO"].includes(row.status);
  const cancellable = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "NEED_INFO", "READY_FOR_QUOTE"].includes(row.status);

  return <div className="member-catalog">
    <Link href="/member/custom-requests" className="member-detail__back"><ArrowLeft size={16}/>กลับรายการ</Link>
    <section className="v14-hero"><div><p className="v14-eyebrow">{row.request_number} · {customRequestTypeLabels[row.request_type]}</p><h1>{row.item_name}</h1><p>{data.project.project_number} · {data.project.name}</p></div><span className={`v14-status ${row.status === "NEED_INFO" ? "v14-status--warn" : row.status === "CANCELLED" ? "" : "v14-status--good"}`}>{customRequestStatusLabels[row.status] ?? row.status}</span></section>
    {error ? <div className="v14-alert"><b>ทำรายการไม่สำเร็จ</b><span>{error}</span></div> : null}
    {message ? <div className="v14-alert"><b>สำเร็จ</b><span>{message}</span></div> : null}
    {row.status === "NEED_INFO" ? <section className="v14-panel"><p className="v14-eyebrow">Action required</p><h2>GISP ขอข้อมูลเพิ่มเติม</h2><p>{[...data.history].reverse().find((item) => item.action === "REQUEST_INFO")?.message}</p></section> : null}
    {["READY_FOR_QUOTE", "CONVERTED"].includes(row.status) ? <section className="quotation-decision"><div><p className="v14-eyebrow">LINKED QUOTATION</p><h2>{row.status === "CONVERTED" ? "ยอมรับใบเสนอราคาแล้ว" : "ติดตามใบเสนอราคา"}</h2><p>ดูทุก Revision ดาวน์โหลด PDF และตอบรับใบเสนอราคาที่ GISP ส่งมา</p></div><Link href={`/member/custom-quotations?requestId=${requestId}`} className="v14-button v14-button--dark"><Quote size={15}/>เปิดใบเสนอราคา</Link></section> : null}
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Request details</p><h2>ข้อมูลคำขอ</h2></div><small>{editable ? "แก้ไขและบันทึกได้" : "ข้อมูลถูกล็อกระหว่างการตรวจ"}</small></div>
      <form onSubmit={save} className="grid gap-3 md:grid-cols-2"><fieldset disabled={!editable || busy} className="contents"><label>ประเภท<select name="requestType" defaultValue={row.request_type}>{customRequestTypes.map((type) => <option key={type} value={type}>{customRequestTypeLabels[type]}</option>)}</select></label><label>พื้นที่<select name="areaId" defaultValue={row.area_id ?? ""}><option value="">ไม่ระบุพื้นที่</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label className="md:col-span-2">ชื่อรายการ<input name="itemName" defaultValue={row.item_name} required/></label><label className="md:col-span-2">รายละเอียด<textarea name="description" rows={5} defaultValue={row.description ?? row.specification} required/></label><label>กว้าง (มม.)<input name="widthMm" type="number" step="0.01" defaultValue={row.width_mm ?? ""}/></label><label>ลึก (มม.)<input name="depthMm" type="number" step="0.01" defaultValue={row.depth_mm ?? ""}/></label><label>สูง (มม.)<input name="heightMm" type="number" step="0.01" defaultValue={row.height_mm ?? ""}/></label><label>จำนวนและหน่วย<span className="grid grid-cols-2 gap-2"><input name="quantity" type="number" step="0.001" defaultValue={row.quantity}/><select name="unit" defaultValue={row.unit}><option value="EA">ชิ้น</option><option value="SET">ชุด</option><option value="SQM">ตารางเมตร</option><option value="M">เมตรยาว</option></select></span></label><label>วัสดุ<input name="requestedMaterial" defaultValue={row.requested_material ?? ""}/></label><label>สี<input name="requestedColor" defaultValue={row.requested_color ?? ""}/></label><label>ฟังก์ชัน<input name="requestedFunction" defaultValue={row.requested_function ?? ""}/></label><label>หมายเหตุ<input name="memberNote" defaultValue={row.member_note ?? ""}/></label>{editable ? <button className="v14-button v14-button--outline md:col-span-2">บันทึกการแก้ไข</button> : null}</fieldset></form>
    </section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Reference files</p><h2>ไฟล์อ้างอิง</h2></div><small>สูงสุด 10 ไฟล์ ไฟล์ละไม่เกิน 25 MB</small></div>
      {editable ? <form onSubmit={upload} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]"><label>บทบาทไฟล์<select name="fileRole">{customRequestFileRoles.map((role) => <option key={role} value={role}>{customRequestFileRoleLabels[role]}</option>)}</select></label><label>เลือกไฟล์<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf" required/></label><button disabled={busy} className="v14-button v14-button--dark"><Upload size={15}/>อัปโหลด</button></form> : null}
      <div className="v14-list">{data.files.map((file) => <div key={file.id}><span><File size={16}/><b>{file.original_name}</b></span><span>{customRequestFileRoleLabels[file.file_role]} · v{file.version_number} · {file.size_bytes ? `${(file.size_bytes / 1024 / 1024).toFixed(2)} MB` : "—"}</span><span className="v14-actions"><a className="v14-button v14-button--outline" href={`/api/member/custom-requests/${requestId}/files/${file.id}`} target="_blank" rel="noreferrer">เปิด</a>{editable ? <button type="button" onClick={() => void jsonAction(`/api/member/custom-requests/${requestId}/files/${file.id}`, "DELETE", {})} className="v14-button v14-button--outline"><Trash2 size={14}/></button> : null}</span></div>)}</div>
    </section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Request timeline</p><h2>ประวัติคำขอ</h2></div></div><div className="v14-list">{data.history.map((item) => <div key={item.id}><span><b>{customRequestStatusLabels[item.to_status ?? ""] ?? item.action}</b><small className="block">{new Date(item.created_at).toLocaleString("th-TH")}</small></span><span>{item.message ?? "—"}</span><span>{item.action}</span></div>)}</div></section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Next action</p><h2>ดำเนินการ</h2></div></div><div className="v14-actions">{editable ? <button disabled={busy} type="button" onClick={() => void jsonAction(`/api/member/custom-requests/${requestId}/submit`, "POST", {})} className="v14-button v14-button--dark"><Send size={15}/>{row.status === "NEED_INFO" ? "ส่งข้อมูลเพิ่มเติม" : "ส่งคำขอให้ GISP"}</button> : null}{cancellable ? <button disabled={busy} type="button" onClick={() => { const reason = window.prompt("เหตุผลที่ยกเลิก"); if (reason) void jsonAction(`/api/member/custom-requests/${requestId}/cancel`, "POST", { reason }); }} className="v14-button v14-button--outline">ยกเลิกคำขอ</button> : null}</div></section>
  </div>;
}
