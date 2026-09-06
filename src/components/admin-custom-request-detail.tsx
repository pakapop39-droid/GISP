"use client";

import { ArrowLeft, CheckCircle2, File, LoaderCircle, Quote, UserCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { customRequestFileRoleLabels, customRequestStatusLabels, customRequestTypeLabels, type CustomRequestFileRole, type CustomRequestRow } from "@/lib/custom-rfq/types";

type OptionData = { suppliers: Array<{ id: string; code: string; name: string; status: string }>; users: Array<{ id: string; full_name: string }> };
type Detail = {
  request: CustomRequestRow & { selected_supplier_id?: string | null };
  project: { project_number: string; name: string; site_address: string; expected_need_date: string | null };
  area: { name: string } | null;
  member: { company_name: string; contact_name: string | null; contact_phone: string | null };
  candidates: Array<{ supplier_id: string; candidate_status: string; note: string | null; supplier: { code: string; name: string; status: string } | null }>;
  assignments: Array<{ id: string; assigned_to: string | null; assigned_name: string | null; due_at: string | null; action_required: string; status: string; created_at: string }>;
  history: Array<{ id: string; action: string; from_status: string | null; to_status: string | null; message: string | null; visibility: string; actor_name: string | null; created_at: string }>;
  files: Array<{ id: string; original_name: string; file_role: CustomRequestFileRole; size_bytes: number | null; version_number: number }>;
  options: OptionData;
};

export function AdminCustomRequestDetail({ requestId }: { requestId: string }) {
  const [data, setData] = useState<Detail>();
  const [options, setOptions] = useState<OptionData>({ suppliers: [], users: [] });
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    const detailResponse = await fetch(`/api/admin/custom-requests/${requestId}`);
    const detailBody = await detailResponse.json();
    if (!detailResponse.ok) setError(detailBody.message ?? "โหลดข้อมูลไม่สำเร็จ");
    else {
      setData(detailBody.data);
      setOptions(detailBody.data.options);
      setSelectedSuppliers(detailBody.data.candidates.map((item: { supplier_id: string }) => item.supplier_id));
    }
  }
  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const detailResponse = await fetch(`/api/admin/custom-requests/${requestId}`);
        const detailBody = await detailResponse.json();
        if (cancelled) return;

        if (!detailResponse.ok) setError(detailBody.message ?? "โหลดข้อมูลไม่สำเร็จ");
        else {
          setData(detailBody.data);
          setOptions(detailBody.data.options);
          setSelectedSuppliers(detailBody.data.candidates.map((item: { supplier_id: string }) => item.supplier_id));
        }
      } catch {
        if (!cancelled) setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
    }

    void loadInitialData();
    return () => { cancelled = true; };
  }, [requestId]);

  async function request(path: string, method: string, payload: unknown) {
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) setError(body.message ?? "ทำรายการไม่สำเร็จ"); else { setMessage(body.message ?? "บันทึกแล้ว"); await load(); }
    setBusy(false);
  }

  if (!data) return <div className="v14-empty">{error || <><LoaderCircle className="animate-spin"/>กำลังโหลด RFQ…</>}</div>;
  const row = data.request;
  const currentAssignment = data.assignments.find((item) => ["OPEN", "IN_PROGRESS"].includes(item.status));

  return <div className="catalog-workspace">
    <Link href="/admin/custom-requests" className="member-detail__back"><ArrowLeft size={16}/>กลับ RFQ Queue</Link>
    <section className="v14-hero custom-rfq-detail__hero"><div><p className="v14-eyebrow">{row.request_number} · {data.member.company_name}</p><h1>{row.item_name}</h1><p>{data.project.project_number} · {data.project.name} · {data.area?.name ?? "ไม่ระบุพื้นที่"}</p></div><span className={`v14-status custom-rfq-detail__status ${row.status === "NEED_INFO" ? "v14-status--warn" : row.status === "CANCELLED" ? "" : "v14-status--good"}`}><span className="custom-rfq-detail__status-label">สถานะปัจจุบัน</span>{customRequestStatusLabels[row.status] ?? row.status}</span></section>
    {error ? <div className="v14-alert" role="alert"><b>ทำรายการไม่สำเร็จ</b><span>{error}</span></div> : null}{message ? <div className="v14-alert custom-rfq-detail__success" role="status" aria-live="polite"><b>สำเร็จ</b><span>{message}</span></div> : null}
    {row.status === "READY_FOR_QUOTE" ? <section className="quotation-decision"><div><p className="v14-eyebrow">SLICE 5 HANDOFF</p><h2>ข้อมูลพร้อมสร้างใบเสนอราคา</h2><p>สเปกและ Supplier Candidate ผ่านการตรวจแล้ว สร้าง Draft หรือ Revision จาก Quotation Workspace</p></div><Link href={`/admin/custom-quotations?requestId=${requestId}`} className="v14-button v14-button--dark"><Quote size={15}/>เปิด Quotation Workspace</Link></section> : null}
    {row.status === "CONVERTED" ? <section className="quotation-success"><b>สร้าง Project Item แล้ว</b> · เปิดใบเสนอราคาที่สมาชิกยอมรับเพื่อดู Snapshot</section> : null}
    <section className="grid gap-4 lg:grid-cols-2"><article className="v14-panel"><p className="v14-eyebrow">Request summary</p><h2>สเปกจาก Member</h2><dl className="v14-totals"><div><dt>ประเภท</dt><dd>{customRequestTypeLabels[row.request_type]}</dd></div><div><dt>ขนาด</dt><dd>{row.width_mm ?? "—"} × {row.depth_mm ?? "—"} × {row.height_mm ?? "—"} มม.</dd></div><div><dt>จำนวน</dt><dd>{row.quantity} {row.unit}</dd></div><div><dt>วัสดุ</dt><dd>{row.requested_material ?? "—"}</dd></div><div><dt>สี</dt><dd>{row.requested_color ?? "—"}</dd></div><div><dt>ฟังก์ชัน</dt><dd>{row.requested_function ?? "—"}</dd></div></dl><p>{row.description ?? row.specification}</p><p><b>หมายเหตุ:</b> {row.member_note ?? "—"}</p></article><article className="v14-panel"><p className="v14-eyebrow">Member & project</p><h2>ข้อมูลประกอบ</h2><dl className="v14-totals"><div><dt>บริษัท</dt><dd>{data.member.company_name}</dd></div><div><dt>ผู้ติดต่อ</dt><dd>{data.member.contact_name ?? "—"}</dd></div><div><dt>โครงการ</dt><dd>{data.project.name}</dd></div><div><dt>ที่อยู่</dt><dd>{data.project.site_address}</dd></div><div><dt>วันที่ต้องการ</dt><dd>{data.project.expected_need_date ?? "—"}</dd></div></dl></article></section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Files</p><h2>ไฟล์อ้างอิง</h2></div></div><div className="v14-list">{data.files.length ? data.files.map((file) => <div key={file.id}><span><File size={16}/><b>{file.original_name}</b></span><span>{customRequestFileRoleLabels[file.file_role]} · v{file.version_number} · {file.size_bytes ? `${(file.size_bytes / 1024 / 1024).toFixed(2)} MB` : "—"}</span><a className="v14-button v14-button--outline" href={`/api/admin/custom-requests/${requestId}/files/${file.id}`} target="_blank" rel="noreferrer">เปิดไฟล์</a></div>) : <div><span>ไม่มีไฟล์แนบ</span></div>}</div></section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Internal note</p><h2>หมายเหตุภายในทีม</h2></div><small>Member จะไม่เห็นข้อความนี้</small></div><form key={row.admin_note ?? "empty-note"} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void request(`/api/admin/custom-requests/${requestId}`, "PATCH", { action: "SAVE_NOTE", message: form.get("adminNote"), assignedTo: null, dueAt: null }); }}><label>หมายเหตุ<textarea name="adminNote" rows={3} defaultValue={row.admin_note ?? ""} maxLength={4000}/></label><button disabled={busy} className="v14-button v14-button--outline">บันทึกหมายเหตุภายใน</button></form></section>
    {row.status === "SUBMITTED" ? <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Start review</p><h2>มอบหมายผู้ตรวจและ Due Date</h2></div></div><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void request(`/api/admin/custom-requests/${requestId}`, "PATCH", { action: "START_REVIEW", assignedTo: form.get("assignedTo"), dueAt: new Date(String(form.get("dueAt"))).toISOString(), message: "" }); }} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]"><label>ผู้รับผิดชอบ<select name="assignedTo" required><option value="">เลือกผู้รับผิดชอบ</option>{options.users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select></label><label>Due Date<input name="dueAt" type="datetime-local" required/></label><button disabled={busy} className="v14-button v14-button--dark"><UserCheck size={15}/>เริ่มตรวจสอบ</button></form></section> : null}
    {row.status === "UNDER_REVIEW" ? <><section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Supplier sourcing</p><h2>Supplier Candidate</h2></div><small>ข้อมูลส่วนนี้ไม่แสดงต่อ Member</small></div><div className="grid gap-2 md:grid-cols-2">{options.suppliers.map((supplier) => <label key={supplier.id} className="flex !grid-cols-none items-center gap-2 rounded-lg border p-3"><input className="!w-auto" type="checkbox" checked={selectedSuppliers.includes(supplier.id)} onChange={(event) => setSelectedSuppliers((current) => event.target.checked ? [...current, supplier.id] : current.filter((id) => id !== supplier.id))}/><span><b>{supplier.code}</b> — {supplier.name}</span></label>)}</div><button disabled={busy} onClick={() => void request(`/api/admin/custom-requests/${requestId}/candidates`, "PUT", { supplierIds: selectedSuppliers })} className="v14-button v14-button--outline">บันทึก Candidate</button></section><section className="grid gap-4 lg:grid-cols-2"><article className="v14-panel"><p className="v14-eyebrow">Need information</p><h2>ขอข้อมูลเพิ่ม</h2><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void request(`/api/admin/custom-requests/${requestId}`, "PATCH", { action: "REQUEST_INFO", message: form.get("message"), assignedTo: null, dueAt: null }); }}><label>ข้อความถึง Member<textarea name="message" required rows={4}/></label><button disabled={busy} className="v14-button v14-button--outline">ส่งคำขอข้อมูลเพิ่ม</button></form></article><article className="v14-panel"><p className="v14-eyebrow">Ready for quote</p><h2>ส่งต่อเพื่อทำใบเสนอราคา</h2><p>ต้องบันทึก Supplier Candidate อย่างน้อย 1 รายก่อน</p><button disabled={busy || !data.candidates.length} onClick={() => void request(`/api/admin/custom-requests/${requestId}`, "PATCH", { action: "READY_FOR_QUOTE", message: "ข้อมูลพร้อมจัดทำใบเสนอราคา", assignedTo: null, dueAt: null })} className="v14-button v14-button--dark"><CheckCircle2 size={15}/>พร้อมทำใบเสนอราคา</button></article></section></> : null}
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Assignment & due date</p><h2>งานที่มอบหมาย</h2></div></div>{currentAssignment ? <div className="v14-summary-row"><span><b>{currentAssignment.assigned_name ?? "Member"}</b><p>{currentAssignment.action_required}</p></span><span className={currentAssignment.due_at && new Date(currentAssignment.due_at) < new Date() ? "v14-status v14-status--warn" : "v14-status v14-status--good"}>{currentAssignment.due_at ? new Date(currentAssignment.due_at).toLocaleString("th-TH") : "รอข้อมูลจาก Member"}</span></div> : <div className="v14-empty">ไม่มีงานที่เปิดอยู่</div>}</section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Request history</p><h2>ประวัติทั้งหมด</h2></div></div><div className="v14-list">{data.history.map((item) => <div key={item.id}><span><b>{item.action}</b><small className="block">{item.actor_name ?? "ผู้ใช้งาน"} · {new Date(item.created_at).toLocaleString("th-TH")}</small></span><span>{item.message ?? "—"}</span><span className="v14-status">{item.visibility}</span></div>)}</div></section>
    {["DRAFT", "SUBMITTED", "UNDER_REVIEW", "NEED_INFO", "READY_FOR_QUOTE"].includes(row.status) ? <section className="v14-panel"><p className="v14-eyebrow">Cancel before convert</p><h2>ยกเลิกคำขอ</h2><button disabled={busy} onClick={() => { const reason = window.prompt("เหตุผลที่ยกเลิก"); if (reason) void request(`/api/admin/custom-requests/${requestId}`, "PATCH", { action: "CANCEL", message: reason, assignedTo: null, dueAt: null }); }} className="v14-button v14-button--outline">ยกเลิก Custom Request</button></section> : null}
  </div>;
}
