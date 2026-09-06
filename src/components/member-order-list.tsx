"use client";

import { CreditCard, RefreshCw, Search, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { filterOrderRows } from "@/lib/orders/order-list-filter";
import { formatOrderMoney, orderStatusLabels, orderStatusTone, type OrderListRow } from "@/lib/orders/types";

export function MemberOrderList() {
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    setError(undefined);
    const response = await fetch("/api/member/orders", { cache: "no-store" });
    const body = await response.json() as { data?: OrderListRow[]; message?: string };
    if (!response.ok) setError(body.message ?? "โหลด Order ไม่สำเร็จ");
    else setRows(body.data ?? []);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const waiting = useMemo(() => rows.filter((row) => ["PENDING_DEPOSIT", "CANCELLATION_REQUESTED"].includes(row.status)).length, [rows]);
  const filtered = useMemo(() => filterOrderRows(rows, deferredQuery, status), [rows, deferredQuery, status]);
  const hasFilters = Boolean(query.trim() || status);
  return <main className="order-workspace">
    <section className="v14-hero order-hero"><div><p className="v14-eyebrow">SLICE 6 · MY ORDERS</p><h1>ออเดอร์และการชำระเงิน</h1><p>ติดตามยอด 50/50 ส่งสลิปหลายครั้ง และดูผลตรวจจาก Finance โดยไม่เปิดเผยข้อมูลต้นทุน Supplier</p></div><span className={`quotation-hero__seal ${waiting ? "is-action" : ""}`}><CreditCard size={18}/><span>{waiting ? `${waiting} รายการต้องติดตาม` : "ไม่มีรายการค้าง"}<small>Member-safe view</small></span></span></section>
    {error ? <p className="v14-alert">{error}</p> : null}
    <section className="v14-panel order-register"><div className="v14-panel__head"><div><p className="v14-eyebrow">Order register</p><h2>รายการทั้งหมด</h2></div><button className="v14-button v14-button--outline v14-button--small" onClick={() => void load()}><RefreshCw size={14}/>โหลดใหม่</button></div>
      {rows.length ? <div className="order-list-toolbar"><div className="order-list-search" role="search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="ค้นหา Order หรือโครงการ" placeholder="ค้นหาเลข Order หรือชื่อโครงการ…" value={query} onChange={(event) => setQuery(event.target.value)}/></div><select className="order-list-status" aria-label="กรองตามสถานะ Order" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{hasFilters ? <button type="button" className="order-list-clear" onClick={() => { setQuery(""); setStatus(""); }}><X size={14}/>ล้าง</button> : null}<small className="order-list-count">แสดง {filtered.length} จาก {rows.length} รายการ</small></div> : null}
      <div className="order-list">{filtered.length ? filtered.map((row) => <Link key={row.id} href={`/member/orders/${row.id}`}><span><b>{row.order_number}</b><small>{row.project?.project_number} · {row.project?.name}</small><small>{new Date(row.created_at).toLocaleString("th-TH")}</small></span><span><strong>{formatOrderMoney(row.grand_total, row.currency)}</strong><small>มัดจำ {formatOrderMoney(row.deposit_amount, row.currency)}</small></span><span className={`v14-status v14-status--${orderStatusTone(row.status)}`}>{orderStatusLabels[row.status] ?? row.status}</span></Link>) : rows.length ? <div className="v14-empty"><Search/><b>ไม่พบ Order ที่ตรงกับคำค้น</b><span>ลองเปลี่ยนคำค้นหรือสถานะที่เลือก</span><button type="button" className="v14-button v14-button--outline" onClick={() => { setQuery(""); setStatus(""); }}>ล้างการค้นหา</button></div> : <div className="v14-empty"><ShoppingCart/><b>ยังไม่มี Order</b><span>เข้าโครงการ เลือกรายการที่ “พร้อมสั่ง” แล้วสร้าง Order ได้ทันที</span><Link href="/member/projects" className="v14-button v14-button--dark">ไปโครงการของฉัน</Link></div>}</div>
    </section>
  </main>;
}
