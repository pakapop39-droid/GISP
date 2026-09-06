"use client";

import { Landmark, RefreshCw, Search, ShieldCheck, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { filterOrderRows } from "@/lib/orders/order-list-filter";
import { formatOrderMoney, orderStatusLabels, orderStatusTone, type AdminOrderCapabilities, type AdminOrderListData, type OrderListRow } from "@/lib/orders/types";

export function AdminOrderWorkspace() {
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [capabilities, setCapabilities] = useState<AdminOrderCapabilities>();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    setError(undefined);
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    const body = await response.json() as { data?: AdminOrderListData; message?: string };
    if (!response.ok || !body.data) setError(body.message ?? "โหลด Order ไม่สำเร็จ"); else {
      setRows(body.data.orders);
      setCapabilities(body.data.capabilities);
    }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const filtered = useMemo(() => filterOrderRows(rows, deferredQuery, status), [rows, deferredQuery, status]);
  const hasFilters = Boolean(query.trim() || status);
  const metrics = useMemo(() => ({
    deposit: rows.filter((row) => row.status === "PENDING_DEPOSIT").length,
    po: rows.filter((row) => row.status === "DEPOSIT_VERIFIED").length,
    cancellation: rows.filter((row) => row.status === "CANCELLATION_REQUESTED").length,
    active: rows.filter((row) => !["CANCELLED", "COMPLETED"].includes(row.status)).length,
  }), [rows]);
  return <main className="order-workspace">
    <section className="v14-hero order-hero"><div><p className="v14-eyebrow">SLICE 6 · ORDER & PAYMENT CONTROL</p><h1>Order, Finance และ Supplier PO</h1><p>ตรวจยอดสะสม 50/50, บังคับ PO Gate, อนุมัติการจ่าย Supplier และจัดการคำขอยกเลิกแบบมี Audit</p></div><span className="quotation-hero__seal"><ShieldCheck size={18}/><span>Controlled workflow<small>Database enforced</small></span></span></section>
    <section className="quotation-metrics"><div><small>รอตรวจมัดจำ</small><strong>{metrics.deposit}</strong><span>Finance queue</span></div><div><small>พร้อมออก PO</small><strong>{metrics.po}</strong><span>Deposit verified</span></div><div><small>คำขอยกเลิก</small><strong>{metrics.cancellation}</strong><span>Admin decision</span></div><div><small>Order ที่เดินอยู่</small><strong>{metrics.active}</strong><span>ไม่รวมปิด/ยกเลิก</span></div></section>
    {error ? <p className="v14-alert">{error}</p> : null}
    <section className="v14-panel order-register"><div className="v14-panel__head"><div><p className="v14-eyebrow">Operations register</p><h2>รายการ Order</h2></div><button className="v14-button v14-button--outline v14-button--small" onClick={() => void load()}><RefreshCw size={14}/>โหลดใหม่</button></div>{rows.length ? <div className="order-list-toolbar"><div className="order-list-search" role="search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="ค้นหา Order โครงการ หรือ Member" placeholder="ค้นหา Order, โครงการ หรือบริษัท…" value={query} onChange={(event) => setQuery(event.target.value)}/></div><select className="order-list-status" aria-label="กรองตามสถานะ Order" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{hasFilters ? <button type="button" className="order-list-clear" onClick={() => { setQuery(""); setStatus(""); }}><X size={14}/>ล้าง</button> : null}<small className="order-list-count">แสดง {filtered.length} จาก {rows.length} รายการ</small></div> : null}<div className="order-list">{filtered.length ? filtered.map((row) => <Link key={row.id} href={`/admin/orders/${row.id}`}><span><b>{row.order_number}</b><small>{row.member?.company_name} · {row.project?.name}</small><small>{row.project?.project_number}</small></span><span>{capabilities?.viewSalesAmounts ? <strong>{formatOrderMoney(row.grand_total, row.currency)}</strong> : <strong>ข้อมูลจัดส่ง</strong>}<small>{new Date(row.created_at).toLocaleDateString("th-TH")}</small></span><span className={`v14-status v14-status--${orderStatusTone(row.status)}`}>{orderStatusLabels[row.status] ?? row.status}</span></Link>) : rows.length ? <div className="v14-empty"><Search/><b>ไม่พบ Order ที่ตรงกับคำค้น</b><span>ลองเปลี่ยนคำค้นหรือสถานะที่เลือก</span><button type="button" className="v14-button v14-button--outline" onClick={() => { setQuery(""); setStatus(""); }}>ล้างการค้นหา</button></div> : <div className="v14-empty"><ShoppingCart/><b>ยังไม่มี Order</b></div>}</div></section>
    <section className="order-security-note"><Landmark size={18}/><span><b>ข้อมูล Supplier ถูกจำกัดสิทธิ์</b><small>ต้นทุน โรงงาน และประวัติการจ่ายไม่ถูกส่งไปยัง Member API</small></span></section>
  </main>;
}
