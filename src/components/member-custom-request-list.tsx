"use client";

import { ClipboardList, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { customRequestStatusLabels, customRequestStatuses, customRequestTypeLabels, type CustomRequestRow } from "@/lib/custom-rfq/types";

type ListRow = CustomRequestRow & { project: { id: string; project_number: string; name: string } | null };

export function MemberCustomRequestList() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const response = await fetch(`/api/member/custom-requests${status ? `?status=${status}` : ""}`);
    const body = await response.json();
    if (!response.ok) setError(body.message ?? "โหลด Custom Request ไม่สำเร็จ");
    else setRows(body.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadForStatus() {
      try {
        const response = await fetch(`/api/member/custom-requests${status ? `?status=${status}` : ""}`);
        const body = await response.json();
        if (cancelled) return;

        if (!response.ok) setError(body.message ?? "โหลด Custom Request ไม่สำเร็จ");
        else setRows(body.data ?? []);
      } catch {
        if (!cancelled) setError("โหลด Custom Request ไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadForStatus();
    return () => { cancelled = true; };
  }, [status]);

  return <div className="member-catalog">
    <section className="v14-hero">
      <div><p className="v14-eyebrow">Slice 4 · Custom RFQ</p><h1>คำขอสินค้าสั่งทำ</h1><p>บันทึกร่าง แนบไฟล์ ส่งคำขอ และติดตามคำตอบจากทีม GISP ในที่เดียว</p></div>
      <Link href="/member/custom-requests/new" className="v14-button v14-button--dark"><Plus size={16}/>สร้างคำขอ</Link>
    </section>
    <section className="v14-panel">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">My requests</p><h2>รายการ Custom Request</h2></div><button type="button" onClick={() => void load()} className="v14-button v14-button--outline"><RefreshCw size={14}/>รีเฟรช</button></div>
      <label className="max-w-xs">สถานะ<select value={status} onChange={(event) => { setLoading(true); setError(""); setStatus(event.target.value); }}><option value="">ทุกสถานะ</option>{customRequestStatuses.map((item) => <option key={item} value={item}>{customRequestStatusLabels[item]}</option>)}</select></label>
      {error ? <div className="v14-alert"><b>โหลดข้อมูลไม่สำเร็จ</b><span>{error}</span></div> : null}
      {loading ? <div className="v14-empty">กำลังโหลด…</div> : rows.length ? <div className="v14-list">{rows.map((row) => <div key={row.id}>
        <span><b>{row.request_number}</b><small className="block">{row.project?.project_number} · {row.project?.name}</small></span>
        <span><b>{row.item_name}</b><small className="block">{customRequestTypeLabels[row.request_type]} · {row.quantity} {row.unit}</small></span>
        <span className="v14-actions"><span className={`v14-status ${row.status === "NEED_INFO" ? "v14-status--warn" : row.status === "CANCELLED" ? "" : "v14-status--good"}`}>{customRequestStatusLabels[row.status] ?? row.status}</span><Link href={`/member/custom-requests/${row.id}`} className="v14-button v14-button--outline">เปิด</Link></span>
      </div>)}</div> : <div className="v14-empty"><ClipboardList/><b>ยังไม่มี Custom Request</b><span>เริ่มจากปุ่ม “สร้างคำขอ” ด้านบน</span></div>}
    </section>
  </div>;
}
