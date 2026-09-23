"use client";

import { ArrowLeft, BadgeCheck, Banknote, ExternalLink, FileCheck2, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminLogisticsPanel } from "@/components/logistics-panels";
import { AdminProductionQcPanel } from "@/components/production-qc-panels";
import { formatOrderMoney, orderStatusLabels, orderStatusTone, paymentScheduleLabels, paymentStatusLabels, type OrderDetail } from "@/lib/orders/types";

export function AdminOrderDetail({ orderId, showProductionQc = true, showLogistics = true }: { orderId: string; showProductionQc?: boolean; showLogistics?: boolean }) {
  const [data, setData] = useState<OrderDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
    const body = await response.json() as { data?: OrderDetail; message?: string };
    if (!response.ok || !body.data) setError(body.message ?? "โหลด Order ไม่สำเร็จ"); else setData(body.data);
  }, [orderId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function post(path: string, payload: Record<string, unknown>) {
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "ทำรายการไม่สำเร็จ");
      setMessage(body.message); await load(); return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ทำรายการไม่สำเร็จ"); return false; }
    finally { setBusy(false); }
  }
  if (!data) return <div className="v14-panel v14-empty">{error ?? "กำลังโหลด Order…"}</div>;
  if (!data.capabilities) return <div className="v14-panel v14-empty">ไม่พบข้อมูลสิทธิ์สำหรับ Order นี้</div>;
  const { order } = data;
  const capabilities = data.capabilities;
  const pendingCancellation = data.cancellations.find((item) => item.status === "SUBMITTED");
  return <main className="order-detail admin-order-detail">
    <Link href="/admin/orders" className="member-detail__back"><ArrowLeft/>กลับ Order Queue</Link>
    <section className="quotation-detail__hero"><div><p className="v14-eyebrow">{order.order_number} · {order.project?.project_number}</p><h1>{order.project?.name}</h1><p>{order.member?.company_name} · {order.member?.contact_name}</p></div><span className={`v14-status v14-status--${orderStatusTone(order.status)}`}><small>สถานะปัจจุบัน</small>{orderStatusLabels[order.status] ?? order.status}</span></section>
    {error ? <p className="v14-alert">{error}</p> : null}{message ? <p className="quotation-success">{message}</p> : null}
    <div className="quotation-command">{capabilities.manageOrder ? <button disabled={busy || order.status !== "DEPOSIT_VERIFIED"} onClick={() => void post(`/api/admin/orders/${order.id}/issue-po`, {})} className="v14-button v14-button--dark"><FileCheck2 size={15}/>ออก PO</button> : null}<button onClick={() => void load()} className="v14-button v14-button--outline"><RefreshCw size={14}/>โหลดใหม่</button></div>
    <section className="order-detail__grid"><article className="v14-panel"><div className="v14-panel__head"><h2>สินค้าและยอดขาย</h2><small>Member-safe snapshot</small></div><div className="order-items">{data.items.map((item) => <div key={item.id}><span><b>{item.item_name_snapshot}</b><small>{item.specification_snapshot ?? "—"}</small></span><span>{item.quantity} {item.unit}</span>{capabilities.viewSalesAmounts ? <strong>{formatOrderMoney(item.line_total, order.currency)}</strong> : null}</div>)}</div>{capabilities.viewSalesAmounts ? <dl className="quotation-totals"><div><dt>ก่อน VAT</dt><dd>{formatOrderMoney(order.subtotal, order.currency)}</dd></div><div><dt>VAT</dt><dd>{formatOrderMoney(order.vat_amount, order.currency)}</dd></div><div className="grand"><dt>ยอดรวม</dt><dd>{formatOrderMoney(order.grand_total, order.currency)}</dd></div></dl> : null}</article>
      {capabilities.viewCustomerPaymentStatus ? <aside><article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Finance queue</p><h2>สถานะ Customer Payment</h2></div><Banknote size={18}/></div><div className="payment-schedules">{data.schedules.map((schedule) => <div key={schedule.id}><span><b>{paymentScheduleLabels[schedule.schedule_type]}</b><small>{paymentStatusLabels[schedule.status] ?? schedule.status}</small></span><span><strong>{formatOrderMoney(schedule.verified_amount, order.currency)}</strong><small>/ {formatOrderMoney(schedule.due_amount, order.currency)}</small></span></div>)}</div></article></aside> : null}
    </section>
    {capabilities.manageCustomerPayments ? <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Transfer review</p><h2>ตรวจสลิป Customer Payment</h2></div></div><div className="finance-transfer-list">{data.schedules.flatMap((schedule) => schedule.transfers.map((transfer) => <article key={transfer.id}><span><b>{transfer.transfer_number}</b><small>{paymentScheduleLabels[schedule.schedule_type]}</small></span><strong>{formatOrderMoney(transfer.amount, order.currency)}</strong><div><a href={`/api/admin/payment-transfers/${transfer.id}/evidence`} target="_blank" rel="noreferrer" className="v14-button v14-button--outline v14-button--small"><ExternalLink size={14}/>ดูสลิป</a>{transfer.status === "SUBMITTED" ? <><button disabled={busy} onClick={() => void post(`/api/admin/payment-transfers/${transfer.id}/verify`, { approve: true, evidence_confirmed: true, finance_note: "ตรวจสลิปและยอดตรงกัน" })} className="v14-button v14-button--dark v14-button--small"><BadgeCheck size={14}/>ยืนยันรับเงิน</button><button disabled={busy} onClick={() => { const reason = window.prompt("เหตุผลที่ไม่ผ่าน") ?? ""; if (reason.trim()) void post(`/api/admin/payment-transfers/${transfer.id}/verify`, { approve: false, finance_note: reason }); }} className="v14-button v14-button--outline v14-button--small">ไม่ผ่าน</button></> : <small>{transfer.finance_note}</small>}</div></article>))}</div></section> : null}
    {capabilities.manageOrder && pendingCancellation ? <section className="v14-panel order-cancellation-decision"><div className="v14-panel__head"><div><p className="v14-eyebrow">Action required</p><h2>พิจารณาคำขอยกเลิก</h2></div><ShieldAlert size={20}/></div><p>{pendingCancellation.reason}</p><p>ยอดมัดจำที่ตรวจแล้วตอนส่งคำขอ: <b>{formatOrderMoney(pendingCancellation.deposit_verified_amount_snapshot, order.currency)}</b> — ระบบจะไม่คืนเงินอัตโนมัติ</p><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void post(`/api/admin/cancellations/${pendingCancellation.id}/decision`, { approve: form.get("decision") === "APPROVE", decision_note: form.get("note"), approved_refund_amount: form.get("refund"), approved_deduction_amount: form.get("deduction") }); }} className="order-form order-form--decision"><label>ผลพิจารณา<select name="decision"><option value="APPROVE">อนุมัติยกเลิก</option><option value="REJECT">ไม่อนุมัติ</option></select></label><label>ยอดคืนที่อนุมัติ (บันทึกเท่านั้น)<input name="refund" type="number" min="0" step="0.01" defaultValue="0"/></label><label>ยอดหักที่อนุมัติ<input name="deduction" type="number" min="0" step="0.01" defaultValue="0"/></label><label>เหตุผลการตัดสินใจ<textarea name="note" minLength={3} required/></label><button disabled={busy} className="v14-button v14-button--dark">บันทึกผลพิจารณา</button></form></section> : null}
    {capabilities.manageOrder && data.supplierOrders?.length ? <section className="v14-panel supplier-control"><div className="v14-panel__head"><div><p className="v14-eyebrow">Internal operations</p><h2>Supplier Order และ PO</h2></div><small>PURCHASING ตรวจการจ่าย Supplier นอกระบบ</small></div>{data.supplierOrders.map((supplierOrder) => <article key={supplierOrder.id} className="supplier-order-card"><header><span><b>{supplierOrder.supplier_order_number}</b><small>{supplierOrder.supplier?.code} · {supplierOrder.supplier?.name}</small></span><span><b>{supplierOrder.po_number ?? "ยังไม่ออก PO"}</b><small>{supplierOrder.status}</small></span><strong>{formatOrderMoney(supplierOrder.total_factory_cost, supplierOrder.supplier_currency)}</strong></header></article>)}</section> : null}
    {showProductionQc && (capabilities.manageProduction || capabilities.manageQc) ? <AdminProductionQcPanel data={data} busy={busy} post={post} capabilities={capabilities}/> : null}
    {showLogistics && (capabilities.manageLogistics || capabilities.manageFreight) ? <AdminLogisticsPanel data={data} busy={busy} post={post} capabilities={capabilities}/> : null}
  </main>;
}
