"use client";

import { ArrowLeft, FileUp, RefreshCw, ShieldAlert, WalletCards } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatOrderMoney, orderStatusLabels, orderStatusTone, paymentScheduleLabels, paymentStatusLabels, type OrderDetail } from "@/lib/orders/types";
import { MemberProductionQcPanel } from "@/components/production-qc-panels";
import { MemberLogisticsPanel } from "@/components/logistics-panels";

export function MemberOrderDetail({ orderId }: { orderId: string }) {
  const [data, setData] = useState<OrderDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const load = useCallback(async () => {
    const response = await fetch(`/api/member/orders/${orderId}`, { cache: "no-store" });
    const body = await response.json() as { data?: OrderDetail; message?: string };
    if (!response.ok || !body.data) setError(body.message ?? "โหลด Order ไม่สำเร็จ"); else setData(body.data);
  }, [orderId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(undefined); setMessage(undefined);
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) throw new Error("กรุณาเลือกไฟล์สลิป");
      const uploadForm = new FormData(); uploadForm.set("file", file); uploadForm.set("purpose", "CUSTOMER");
      const uploadResponse = await fetch("/api/payment-evidence", { method: "POST", body: uploadForm });
      const uploadBody = await uploadResponse.json() as { data?: { id: string }; message?: string };
      if (!uploadResponse.ok || !uploadBody.data?.id) throw new Error(uploadBody.message ?? "อัปโหลดสลิปไม่สำเร็จ");
      const response = await fetch("/api/member/payment-transfers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_schedule_id: form.get("scheduleId"), amount: form.get("amount"), transferred_at: new Date(String(form.get("transferredAt"))).toISOString(), evidence_file_id: uploadBody.data.id }) });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "ส่งสลิปไม่สำเร็จ");
      setMessage(body.message); formElement.reset(); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ส่งสลิปไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function cancelOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(undefined); setMessage(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/member/orders/${orderId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: form.get("reason") }) });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "ส่งคำขอยกเลิกไม่สำเร็จ");
      setMessage(body.message); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ส่งคำขอยกเลิกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function post(path: string, payload: Record<string, unknown>) {
    setBusy(true); setError(undefined); setMessage(undefined);
    try { const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json() as { message?: string }; if (!response.ok) throw new Error(body.message ?? "ทำรายการไม่สำเร็จ"); setMessage(body.message); await load(); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "ทำรายการไม่สำเร็จ"); return false; }
    finally { setBusy(false); }
  }

  if (!data) return <div className="v14-panel v14-empty">{error ?? "กำลังโหลด Order…"}</div>;
  const { order } = data;
  const payableSchedules = data.schedules.filter((schedule) => ["PENDING", "PARTIALLY_VERIFIED"].includes(schedule.status));
  const canCancel = !["CANCELLED", "COMPLETED", "CANCELLATION_REQUESTED"].includes(order.status);
  return <main className="order-detail">
    <Link href="/member/orders" className="member-detail__back"><ArrowLeft/>กลับรายการ Order</Link>
    <section className="quotation-detail__hero"><div><p className="v14-eyebrow">{order.order_number} · {order.project?.project_number}</p><h1>{order.project?.name ?? "Order"}</h1><p>{order.project?.site_address}</p></div><span className={`v14-status v14-status--${orderStatusTone(order.status)}`}><small>สถานะปัจจุบัน</small>{orderStatusLabels[order.status] ?? order.status}</span></section>
    {error ? <p className="v14-alert">{error}</p> : null}{message ? <p className="quotation-success">{message}</p> : null}
    <section className="order-detail__grid member-split-layout member-split-layout--aside-first"><article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Order snapshot</p><h2>รายการสินค้า</h2></div><small>ราคาและสเปกถูก Snapshot เมื่อสร้าง Order</small></div><div className="order-items">{data.items.map((item) => <div key={item.id}><span><b>{item.item_name_snapshot}</b><small>{item.specification_snapshot ?? "—"}</small><small>{item.options_snapshot.map((option) => option.label).filter(Boolean).join(" · ") || "ไม่มี Option"}</small></span><span>{item.quantity} {item.unit}</span><strong>{formatOrderMoney(item.line_total, order.currency)}</strong></div>)}</div><dl className="quotation-totals"><div><dt>ก่อน VAT</dt><dd>{formatOrderMoney(order.subtotal, order.currency)}</dd></div><div><dt>VAT</dt><dd>{formatOrderMoney(order.vat_amount, order.currency)}</dd></div><div className="grand"><dt>ยอดรวม</dt><dd>{formatOrderMoney(order.grand_total, order.currency)}</dd></div></dl></article>
      <aside><article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Payment 50/50</p><h2>สถานะการชำระ</h2></div></div><div className="payment-schedules">{data.schedules.map((schedule) => <div key={schedule.id}><span><b>{paymentScheduleLabels[schedule.schedule_type]}</b><small>{paymentStatusLabels[schedule.status] ?? schedule.status}</small></span><span><strong>{formatOrderMoney(schedule.verified_amount, order.currency)}</strong><small>จาก {formatOrderMoney(schedule.due_amount, order.currency)}</small></span></div>)}</div></article>
      {payableSchedules.length ? <article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Submit transfer</p><h2>ส่งหลักฐานการโอน</h2></div><FileUp size={18}/></div><form onSubmit={submitPayment} className="order-form"><label>งวด<select name="scheduleId" required>{payableSchedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{paymentScheduleLabels[schedule.schedule_type]} · คงเหลือ {formatOrderMoney(Number(schedule.due_amount) - Number(schedule.verified_amount), order.currency)}</option>)}</select></label><label>ยอดโอน<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>วันเวลาโอน<input name="transferredAt" type="datetime-local" required/></label><label>สลิป PDF/JPG/PNG<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" required/></label><button disabled={busy} className="v14-button v14-button--dark"><WalletCards size={15}/>{busy ? "กำลังส่ง…" : "ส่งให้ Finance ตรวจ"}</button></form></article> : null}</aside>
    </section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Transfer history</p><h2>ประวัติสลิปและผลตรวจ</h2></div><button onClick={() => void load()} className="v14-button v14-button--outline v14-button--small"><RefreshCw size={14}/>โหลดใหม่</button></div><div className="order-history">{data.schedules.flatMap((schedule) => schedule.transfers.map((transfer) => <div key={transfer.id}><span><b>{transfer.transfer_number}</b><small>{paymentScheduleLabels[schedule.schedule_type]} · {new Date(transfer.transferred_at).toLocaleString("th-TH")}</small></span><strong>{formatOrderMoney(transfer.amount, order.currency)}</strong><span className={`v14-status v14-status--${orderStatusTone(transfer.status)}`}>{paymentStatusLabels[transfer.status] ?? transfer.status}</span>{transfer.finance_note ? <small>{transfer.finance_note}</small> : null}</div>))}</div></section>
    <MemberProductionQcPanel data={data} busy={busy} post={post}/>
    <MemberLogisticsPanel data={data} busy={busy} post={post}/>
    <section className="order-detail__grid member-split-layout"><article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Order timeline</p><h2>ประวัติสถานะ</h2></div></div><div className="quotation-timeline">{data.events.map((event) => <article key={event.id}><span/><div><b>{orderStatusLabels[event.to_status] ?? event.to_status}</b><p>{event.reason ?? "อัปเดตสถานะ"}</p><small>{new Date(event.created_at).toLocaleString("th-TH")}</small></div></article>)}</div></article>
      {canCancel ? <article className="v14-panel order-cancel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Cancellation</p><h2>ขอยกเลิก Order</h2></div><ShieldAlert size={18}/></div><p>ก่อนตรวจมัดจำ ระบบยกเลิกได้ทันที หลังตรวจมัดจำแล้วจะส่งให้ Admin พิจารณา และระบบไม่คืนเงินอัตโนมัติ</p><form onSubmit={cancelOrder} className="order-form"><label>เหตุผล<textarea name="reason" minLength={5} rows={4} required/></label><button disabled={busy} className="v14-button v14-button--outline">ส่งคำขอยกเลิก</button></form></article> : <article className="v14-panel"><p className="v14-eyebrow">Cancellation</p><h2>สถานะคำขอยกเลิก</h2>{data.cancellations.map((request) => <div key={request.id} className="order-cancellation-record"><b>{request.status}</b><span>{request.reason}</span><small>{request.decision_note ?? "รอผลพิจารณา"}</small></div>)}</article>}
    </section>
  </main>;
}
