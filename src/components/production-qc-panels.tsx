"use client";

import { BadgeCheck, CircleAlert, ExternalLink, Factory, RotateCcw, ShieldCheck, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  latestProductionProgress,
  latestProductionStatus,
  suggestedProductionProgress,
  type ProductionStatus,
} from "@/lib/orders/production-progress";
import {
  deriveQcOverallResult,
  type QcChecklistResult,
  type QcFailedDisposition,
} from "@/lib/orders/qc-result";
import {
  additionalReviewReasons,
  buildAdditionalReviewNote,
  type AdditionalReviewReasonId,
} from "@/lib/orders/qc-review-request";
import {
  isMemberReviewEvent,
  qcHistoryTitle,
  qcReworkNoteLabel,
} from "@/lib/orders/qc-history-presentation";
import { allAdminOrderCapabilities } from "@/lib/orders/admin-access";
import type { AdminOrderCapabilities, DispatchGate, OrderDetail, OrderItem, QcInspection, SupplierOrder } from "@/lib/orders/types";

const productionLabels: Record<string, string> = {
  ACKNOWLEDGED: "โรงงานยืนยันแล้ว", MATERIAL_PREPARATION: "เตรียมวัสดุ",
  IN_PRODUCTION: "กำลังผลิต", ASSEMBLY: "ประกอบ", FINISHING: "เก็บงาน",
  PRODUCTION_COMPLETED: "ผลิตเสร็จ", DELAYED: "ล่าช้า",
};
const qcLabels: Record<string, string> = {
  PENDING: "รอ QC", IN_PROGRESS: "กำลังตรวจ", PASSED: "ผ่าน QC", FAILED: "ไม่ผ่าน QC",
  REWORK_REQUIRED: "ต้องแก้ไข", WAITING_MEMBER_APPROVAL: "รอ Member อนุมัติ",
  MEMBER_APPROVED: "Member อนุมัติแล้ว", ADDITIONAL_REVIEW_REQUESTED: "ขอตรวจเพิ่มเติม",
};
const qcChecklistLabels = ["ขนาดและสเปก", "วัสดุและสี", "งานประกอบและผิวสำเร็จ"] as const;
const newQcChecklistResults = (): QcChecklistResult[] => qcChecklistLabels.map(() => "NOT_INSPECTED");

async function uploadOperationFile(file: File, kind: "PRODUCTION_MEDIA" | "QC_EVIDENCE", entityId: string) {
  const form = new FormData(); form.set("file", file); form.set("kind", kind); form.set("entityId", entityId);
  const response = await fetch("/api/admin/operations-media", { method: "POST", body: form });
  const body = await response.json() as { data?: { id: string }; message?: string };
  if (!response.ok || !body.data?.id) throw new Error(body.message ?? "อัปโหลดหลักฐานไม่สำเร็จ");
  return body.data.id;
}

function GateChecklist({ gate, itemName, itemType }: { gate?: DispatchGate; itemName: string; itemType: OrderItem["item_type"] }) {
  const rows = [
    ["QC ผ่านแล้ว", gate?.qc_passed],
    [itemType === "CUSTOM" ? "Member อนุมัติสินค้า Custom" : "ไม่ต้องรอ Member อนุมัติ", itemType === "CUSTOM" ? gate?.member_approved : true],
    ["Finance ตรวจยอดคงเหลือลูกค้า", gate?.customer_balance_verified],
    ["ชำระยอดคงเหลือ Supplier", gate?.supplier_balance_paid],
  ] as const;
  return <div className="dispatch-gate"><header><span className="dispatch-gate__identity"><ShieldCheck size={18}/><span><b>Dispatch Gate</b><small>ของสินค้า: {itemName}</small></span></span><strong className={gate?.can_dispatch ? "gate-ready" : "gate-blocked"}>{gate?.can_dispatch ? "พร้อมจัดส่ง" : "ยังจัดส่งไม่ได้"}</strong></header>{rows.map(([label, passed]) => <div key={label} className={passed ? "passed" : "blocked"}><span>{passed ? "✓" : "○"}</span><b>{label}</b></div>)}</div>;
}

function ProductionForm({ supplierOrder, busy, post }: { supplierOrder: SupplierOrder; busy: boolean; post: (path: string, payload: Record<string, unknown>) => Promise<boolean> }) {
  const [error, setError] = useState<string>();
  const latestProgress = useMemo(() => latestProductionProgress(supplierOrder.productionUpdates), [supplierOrder.productionUpdates]);
  const latestStatus = useMemo(() => latestProductionStatus(supplierOrder.productionUpdates), [supplierOrder.productionUpdates]);
  const [status, setStatus] = useState<ProductionStatus>(latestStatus);
  const [progress, setProgress] = useState(() => suggestedProductionProgress(latestStatus, latestProgress));

  return <form className="operation-form" onSubmit={async (event) => {
    event.preventDefault(); setError(undefined); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      const file = form.get("file"); const fileIds: string[] = [];
      if (file instanceof File && file.size) fileIds.push(await uploadOperationFile(file, "PRODUCTION_MEDIA", supplierOrder.id));
      const saved = await post("/api/admin/production-updates", {
        supplier_order_id: supplierOrder.id, status, note: form.get("note") || undefined,
        progress_percent: progress,
        estimated_completion_at: form.get("eta") ? new Date(String(form.get("eta"))).toISOString() : undefined,
        delay_reason: status === "DELAYED" ? form.get("delayReason") : undefined, file_ids: fileIds,
      });
      if (saved) formElement.reset();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "บันทึก Production ไม่สำเร็จ"); }
  }}>
    <div className="operation-form__grid"><label>สถานะ<select name="status" required value={status} onChange={(event) => { const nextStatus = event.target.value as ProductionStatus; setStatus(nextStatus); setProgress(suggestedProductionProgress(nextStatus, latestProgress)); }}><option value="ACKNOWLEDGED">โรงงานยืนยัน</option><option value="MATERIAL_PREPARATION">เตรียมวัสดุ</option><option value="IN_PRODUCTION">กำลังผลิต</option><option value="ASSEMBLY">ประกอบ</option><option value="FINISHING">เก็บงาน</option><option value="DELAYED">ล่าช้า</option><option value="PRODUCTION_COMPLETED">ผลิตเสร็จ</option></select></label><label>ความคืบหน้ารวมของงาน %<input name="progress" type="number" min={latestProgress} max="100" step="1" value={progress} readOnly={status === "DELAYED" || status === "PRODUCTION_COMPLETED"} onChange={(event) => setProgress(Number(event.target.value))}/><small className="operation-form__hint">ระบบใส่ค่าแนะนำตามสถานะอัตโนมัติ และปรับเพิ่มได้ตามงานจริง</small></label><label>ETA<input name="eta" type="datetime-local"/></label><label>รูป/วิดีโอ/PDF<input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"/></label></div><label>หมายเหตุ<textarea name="note" rows={2}/></label><label>เหตุผลล่าช้า (กรอกเมื่อเลือก “ล่าช้า”)<input name="delayReason"/></label>{error ? <p className="v14-alert">{error}</p> : null}<button disabled={busy} className="v14-button v14-button--dark"><Factory size={15}/>บันทึกอัปเดตการผลิต</button>
  </form>;
}

function QcForm({ item, inspections, busy, canInspect, blockedReason, post }: { item: OrderItem; inspections: QcInspection[]; busy: boolean; canInspect: boolean; blockedReason?: string; post: (path: string, payload: Record<string, unknown>) => Promise<boolean> }) {
  const [error, setError] = useState<string>();
  const [checkResults, setCheckResults] = useState<QcChecklistResult[]>(newQcChecklistResults);
  const [failedDisposition, setFailedDisposition] = useState<QcFailedDisposition>("FAILED");
  const latestInspection = inspections.at(-1);
  const failed = latestInspection?.result !== "PASSED" ? latestInspection : undefined;
  const [isEditing, setIsEditing] = useState(() => !latestInspection);
  const overallResult = deriveQcOverallResult(checkResults, failedDisposition);

  if (!isEditing && latestInspection) {
    const passed = latestInspection.result === "PASSED";
    return <div className={`qc-next-action qc-next-action--${passed ? "passed" : "failed"}`}>
      <span>
        <b>{passed ? "บันทึกผลผ่าน QC แล้ว" : "บันทึกผลรอบนี้แล้ว — ยังไม่ผ่าน QC"}</b>
        <small>{passed
          ? item.item_type === "CUSTOM"
            ? "ผลถูกส่งให้ Member ตรวจรายงานและอนุมัติก่อนจัดส่งแล้ว"
            : "ผล QC ผ่านแล้วและถูกเก็บไว้ในประวัติด้านบน"
          : "ผลที่บันทึกอยู่ในประวัติด้านบน เมื่อแก้ไขสินค้าเสร็จจึงเริ่มตรวจซ้ำ"}</small>
        {!passed && latestInspection.rework_note ? <small className="qc-next-action__request"><b>รายละเอียดที่ต้องตรวจเพิ่ม:</b>{latestInspection.rework_note}</small> : null}
      </span>
      {!passed ? <button type="button" disabled={busy || !canInspect} onClick={() => { setError(undefined); setIsEditing(true); }} className="v14-button v14-button--outline"><RotateCcw size={14}/>เริ่มตรวจซ้ำ</button> : null}
      {!canInspect ? <p className="v14-alert">{blockedReason}</p> : null}
    </div>;
  }

  return <form className="operation-form" onSubmit={async (event) => {
    event.preventDefault(); setError(undefined); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      if (!overallResult) throw new Error("กรุณาตรวจ Checklist ให้ครบทุกข้อก่อนบันทึกผล QC");
      const file = form.get("file"); const fileIds: string[] = [];
      if (file instanceof File && file.size) fileIds.push(await uploadOperationFile(file, "QC_EVIDENCE", item.id));
      const checklist = qcChecklistLabels.map((label, index) => ({ code: `QC-${index + 1}`, label, result: checkResults[index], note: form.get(`note-${index}`) || undefined }));
      const saved = await post("/api/admin/qc-inspections", {
        order_item_id: item.id, result: overallResult, checklist, note: form.get("note") || undefined,
        defect_note: overallResult === "PASSED" ? undefined : form.get("defectNote"),
        rework_note: overallResult === "PASSED" ? undefined : form.get("reworkNote"),
        inspection_type: failed ? "REINSPECTION" : "INITIAL",
        parent_inspection_id: failed?.id, file_ids: fileIds,
      });
      if (!saved) return;
      formElement.reset(); setCheckResults(newQcChecklistResults()); setFailedDisposition("FAILED"); setIsEditing(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "บันทึก QC ไม่สำเร็จ"); }
  }}>
    <div className="qc-form-title"><span><b>{item.item_name_snapshot}</b><small>{item.item_type} · {qcLabels[item.qc_status] ?? item.qc_status}</small></span><span className="v14-status v14-status--pending">{failed ? <><RotateCcw size={13}/>ตรวจซ้ำ</> : "ตรวจครั้งแรก"}</span></div>
    {qcChecklistLabels.map((label, index) => <div className="qc-check-row" key={label}><b>{label}</b><select name={`check-${index}`} required value={checkResults[index]} onChange={(event) => { const next = [...checkResults]; next[index] = event.target.value as QcChecklistResult; setCheckResults(next); }}><option value="NOT_INSPECTED">ยังไม่ตรวจ</option><option value="PASSED">ผ่าน</option><option value="FAILED">ไม่ผ่าน</option></select><input name={`note-${index}`} placeholder="หมายเหตุรายการ"/></div>)}
    <div className="operation-form__grid"><label>ผลรวม<select name="result" value={overallResult ?? ""} disabled={!overallResult || overallResult === "PASSED"} onChange={(event) => setFailedDisposition(event.target.value as QcFailedDisposition)}><option value="">รอตรวจให้ครบ</option><option value="PASSED">ผ่าน QC อัตโนมัติ</option><option value="FAILED">ไม่ผ่าน QC</option><option value="REWORK_REQUIRED">ต้องแก้ไข</option></select><small className="operation-form__hint">ระบบสรุป “ผ่าน QC” ให้อัตโนมัติเมื่อ Checklist ผ่านครบทุกข้อ</small></label><label>หลักฐาน<input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"/></label></div><label>สรุปผล<textarea name="note" rows={2}/></label><label>ข้อบกพร่อง<input name="defectNote"/></label><label>คำสั่งแก้ไข<input name="reworkNote"/></label>{!canInspect ? <p className="v14-alert">{blockedReason}</p> : null}{error ? <p className="v14-alert">{error}</p> : null}<button disabled={busy || !canInspect || !overallResult} className="v14-button v14-button--dark"><BadgeCheck size={15}/>บันทึกผล QC</button>
  </form>;
}

export function AdminProductionQcPanel({ data, busy, post, capabilities = allAdminOrderCapabilities }: { data: OrderDetail; busy: boolean; post: (path: string, payload: Record<string, unknown>) => Promise<boolean>; capabilities?: AdminOrderCapabilities }) {
  return <>
    {capabilities.manageProduction ? <section className="v14-panel operation-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Production control</p><h2>Timeline การผลิต</h2></div><small>ทุกอัปเดตถูกเก็บเป็นประวัติถาวร</small></div>{data.supplierOrders?.map((supplierOrder) => <article key={supplierOrder.id} className="operation-card"><header><span><b>{supplierOrder.supplier_order_number}</b><small>{supplierOrder.po_number ?? "ยังไม่ออก PO"} · {supplierOrder.status}</small></span></header><div className="production-timeline">{supplierOrder.productionUpdates.map((update) => <div key={update.id} className={update.status === "DELAYED" ? "delayed" : ""}><span/><section><b>{productionLabels[update.status] ?? update.status}{update.progress_percent !== null ? ` · ${update.progress_percent}%` : ""}</b><p>{update.delay_reason ?? update.note ?? "อัปเดตสถานะการผลิต"}</p><small>{new Date(update.created_at).toLocaleString("th-TH")}{update.estimated_completion_at ? ` · ETA ${new Date(update.estimated_completion_at).toLocaleDateString("th-TH")}` : ""}</small>{update.files.map((file) => <a key={file.id} href={`/api/files/${file.id}/download?redirect=1`} target="_blank" rel="noreferrer"><ExternalLink size={12}/>{file.original_name}</a>)}</section></div>)}</div><ProductionForm key={supplierOrder.productionUpdates.at(-1)?.id ?? "new"} supplierOrder={supplierOrder} busy={busy} post={post}/></article>)}</section> : null}
    {capabilities.manageQc ? <section className="v14-panel operation-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Quality control</p><h2>Checklist, Rework และ Reinspection</h2></div><small>สินค้า Custom ต้องรอ Member อนุมัติ</small></div>{data.items.map((item) => {
      const supplierOrder = data.supplierOrders?.find((candidate) => candidate.orderItemIds.includes(item.id));
      const productionStatus = supplierOrder ? latestProductionStatus(supplierOrder.productionUpdates) : undefined;
      const canInspect = productionStatus === "PRODUCTION_COMPLETED";
      const blockedReason = supplierOrder
        ? `ยังบันทึก QC ไม่ได้: สถานะการผลิตปัจจุบันคือ “${productionLabels[productionStatus ?? ""] ?? "ยังไม่มีข้อมูล"}” กรุณาบันทึก “ผลิตเสร็จ 100%” ก่อน`
        : "ยังบันทึก QC ไม่ได้: ไม่พบ Supplier Order ของสินค้านี้";
      return <article key={item.id} className="operation-card"><GateChecklist gate={data.dispatchGates.find((gate) => gate.order_item_id === item.id)} itemName={item.item_name_snapshot} itemType={item.item_type}/><QcHistory item={item} inspections={data.qcInspections.filter((inspection) => inspection.order_item_id === item.id)}/><QcForm item={item} inspections={data.qcInspections.filter((inspection) => inspection.order_item_id === item.id)} busy={busy} canInspect={canInspect} blockedReason={blockedReason} post={post}/></article>;
    })}</section> : null}
  </>;
}

function QcHistory({ item, inspections, showItemName = true }: { item: OrderItem; inspections: QcInspection[]; showItemName?: boolean }) {
  return <div className="qc-history">{showItemName ? <h3>{item.item_name_snapshot}</h3> : null}{inspections.length ? inspections.map((inspection) => <article key={inspection.id}><header><span className={`v14-status v14-status--${inspection.result === "PASSED" ? "good" : "bad"}`}>{qcHistoryTitle(inspection)}</span><small>{new Date(inspection.inspected_at).toLocaleString("th-TH")}</small></header>{!isMemberReviewEvent(inspection) ? <div className="qc-result-grid">{inspection.checklist.map((check) => <div key={check.id} className={check.result === "PASSED" ? "passed" : check.result === "FAILED" ? "failed" : "pending"}><span>{check.result === "PASSED" ? "✓" : check.result === "FAILED" ? "×" : "○"}</span><b>{check.label}</b><small>{check.note}</small></div>)}</div> : null}{inspection.defect_note ? <p><b>ข้อบกพร่อง:</b> {inspection.defect_note}</p> : null}{inspection.rework_note ? <p><b>{qcReworkNoteLabel(inspection)}</b> {inspection.rework_note}</p> : null}<div className="operation-files">{inspection.files.map((file) => <a key={file.id} href={`/api/files/${file.id}/download?redirect=1`} target="_blank" rel="noreferrer"><ExternalLink size={12}/>{file.original_name}</a>)}</div></article>) : <p className="v14-empty">ยังไม่มีผล QC</p>}</div>;
}

function MemberQcDecision({ item, busy, post }: { item: OrderItem; busy: boolean; post: (path: string, payload: Record<string, unknown>) => Promise<boolean> }) {
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<AdditionalReviewReasonId[]>([]);
  const [detail, setDetail] = useState("");
  const requestNote = buildAdditionalReviewNote(selectedReasons, detail);

  return <>
    <div className="member-qc-decision"><p><CircleAlert size={17}/>QC ผ่านแล้ว กรุณาตรวจ Checklist และหลักฐานก่อนตัดสินใจ ระบบจะไม่อนุมัติให้อัตโนมัติ</p><button disabled={busy} onClick={() => void post(`/api/member/order-items/${item.id}/qc-decision`, { decision: "APPROVED", note: "ตรวจรายงานและหลักฐานแล้ว" })} className="v14-button v14-button--dark"><ShieldCheck size={15}/>อนุมัติให้จัดส่ง</button><button disabled={busy} onClick={() => setShowReviewRequest(true)} className="v14-button v14-button--outline"><Upload size={15}/>ขอตรวจเพิ่มเติม</button></div>
    {showReviewRequest ? <div className="qc-review-modal" role="dialog" aria-modal="true" aria-labelledby={`qc-review-title-${item.id}`} aria-describedby={`qc-review-description-${item.id}`} onKeyDown={(event) => { if (event.key === "Escape" && !busy) setShowReviewRequest(false); }}><form className="qc-review-modal__dialog" onSubmit={async (event) => {
      event.preventDefault();
      if (!requestNote) return;
      const saved = await post(`/api/member/order-items/${item.id}/qc-decision`, { decision: "ADDITIONAL_REVIEW_REQUESTED", note: requestNote });
      if (saved) setShowReviewRequest(false);
    }}>
      <header><span><p className="v14-eyebrow">ADDITIONAL QC REVIEW</p><h2 id={`qc-review-title-${item.id}`}>ต้องการให้ตรวจอะไรเพิ่ม?</h2></span><button type="button" aria-label="ปิดหน้าต่าง" disabled={busy} onClick={() => setShowReviewRequest(false)}><X size={19}/></button></header>
      <p id={`qc-review-description-${item.id}`} className="qc-review-modal__intro"><CircleAlert size={18}/><span><b>ผล QC ปัจจุบันผ่านแล้ว</b> คำขอนี้ไม่ได้เปลี่ยนผลเป็น “ไม่ผ่าน” แต่จะพักการอนุมัติจัดส่งไว้จนกว่า GISP จะตรวจและส่งผลรอบใหม่</span></p>
      <fieldset><legend>เลือกอย่างน้อย 1 รายการ</legend><div className="qc-review-reasons">{additionalReviewReasons.map((reason, index) => <label key={reason.id}><input type="checkbox" checked={selectedReasons.includes(reason.id)} autoFocus={index === 0} onChange={(event) => setSelectedReasons((current) => event.target.checked ? [...current, reason.id] : current.filter((id) => id !== reason.id))}/><span><b>{reason.label}</b><small>{reason.description}</small></span></label>)}</div></fieldset>
      <label className="qc-review-detail">รายละเอียดเพิ่มเติม {selectedReasons.includes("OTHER") ? <b>(จำเป็น)</b> : <small>(ไม่บังคับ)</small>}<textarea rows={3} maxLength={1200} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="เช่น ขอภาพรอยต่อด้านในและภาพขณะวัดความกว้างจริง" required={selectedReasons.includes("OTHER")}/></label>
      <div className="qc-review-modal__actions"><button type="submit" disabled={busy || !requestNote} className="v14-button v14-button--dark">{busy ? "กำลังส่ง…" : "ส่งคำขอตรวจเพิ่มเติม"}</button><button type="button" disabled={busy} onClick={() => setShowReviewRequest(false)} className="v14-button v14-button--outline">กลับไปตรวจรายงาน</button></div>
    </form></div> : null}
  </>;
}

export function MemberProductionQcPanel({ data, busy, post }: { data: OrderDetail; busy: boolean; post: (path: string, payload: Record<string, unknown>) => Promise<boolean> }) {
  return <section className="member-operation-grid"><article className="v14-panel operation-panel member-production-summary"><div className="v14-panel__head"><div><p className="v14-eyebrow">Production stepper</p><h2>ความคืบหน้าการผลิต</h2></div></div><div className="production-timeline">{data.productionUpdates.map((update) => <div key={update.id} className={update.status === "DELAYED" ? "delayed" : ""}><span/><section><b>{productionLabels[update.status] ?? update.status}{update.progress_percent !== null ? ` · ${update.progress_percent}%` : ""}</b><p>{update.delay_reason ?? update.note ?? "อัปเดตสถานะการผลิต"}</p><small>{new Date(update.created_at).toLocaleString("th-TH")}{update.estimated_completion_at ? ` · ETA ${new Date(update.estimated_completion_at).toLocaleDateString("th-TH")}` : ""}</small>{update.files.map((file) => <a key={file.id} href={`/api/files/${file.id}/download?redirect=1`} target="_blank" rel="noreferrer"><ExternalLink size={12}/>{file.original_name}</a>)}</section></div>)}</div>{!data.productionUpdates.length ? <p className="v14-empty">ยังไม่มีอัปเดตการผลิต</p> : null}</article>
    <article className="v14-panel operation-panel member-qc-report"><div className="v14-panel__head"><div><p className="v14-eyebrow">QC report</p><h2>ผลตรวจคุณภาพ</h2></div></div>{data.items.map((item, index) => <section key={item.id} className="member-qc-item"><header className="member-qc-item__header"><span><small>สินค้ารายการที่ {index + 1}</small><h3>{item.item_name_snapshot}</h3></span><span className="v14-status v14-status--neutral">{item.item_type === "CUSTOM" ? "สินค้า Custom" : "สินค้ามาตรฐาน"}</span></header><GateChecklist gate={data.dispatchGates.find((gate) => gate.order_item_id === item.id)} itemName={item.item_name_snapshot} itemType={item.item_type}/><QcHistory item={item} inspections={data.qcInspections.filter((inspection) => inspection.order_item_id === item.id)} showItemName={false}/>{item.item_type === "CUSTOM" && item.qc_status === "WAITING_MEMBER_APPROVAL" ? <MemberQcDecision item={item} busy={busy} post={post}/> : null}</section>)}</article></section>;
}
