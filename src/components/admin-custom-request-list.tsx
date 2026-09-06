"use client";

import { AlertTriangle, ClipboardCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { customRequestStatusLabels, customRequestStatuses, customRequestTypeLabels, type CustomRequestType } from "@/lib/custom-rfq/types";

type Row = {
  id: string; request_number: string; request_type: CustomRequestType; item_name: string; quantity: number; unit: string;
  status: string; submitted_at: string | null; updated_at: string;
  project: { project_number: string; name: string } | null;
  member: { company_name: string } | null;
  assignment: { assigned_name: string | null; due_at: string | null; action_required: string; status: string } | null;
};

export function AdminCustomRequestList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const response = await fetch(`/api/admin/custom-requests${status ? `?status=${status}` : ""}`);
    const body = await response.json();
    if (!response.ok) setError(body.message ?? "โหลด RFQ Queue ไม่สำเร็จ"); else setRows(body.data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    let cancelled = false;

    async function loadForStatus() {
      try {
        const response = await fetch(`/api/admin/custom-requests${status ? `?status=${status}` : ""}`);
        const body = await response.json();
        if (cancelled) return;

        if (!response.ok) setError(body.message ?? "โหลด RFQ Queue ไม่สำเร็จ");
        else setRows(body.data ?? []);
      } catch {
        if (!cancelled) setError("โหลด RFQ Queue ไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadForStatus();
    return () => { cancelled = true; };
  }, [status]);

  const overdue = rows.filter((row) => row.assignment?.due_at && new Date(row.assignment.due_at) < new Date()).length;
  return <div className="catalog-workspace">
    <section className="v14-hero"><div><p className="v14-eyebrow">Slice 4 · Sourcing operations</p><h1>Custom RFQ Queue</h1><p>ตรวจคำขอ มอบหมายผู้รับผิดชอบ กำหนด Due Date ขอข้อมูลเพิ่ม และส่งต่อไปขั้น Ready for Quote</p></div><div className="member-catalog__promise"><ClipboardCheck/><strong>{rows.length} รายการ</strong><span>{overdue} รายการเกินกำหนด</span></div></section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Action required</p><h2>รายการรอตรวจสอบ</h2></div><button type="button" onClick={() => void load()} className="v14-button v14-button--outline"><RefreshCw size={14}/>รีเฟรช</button></div>
      <label className="max-w-xs">สถานะ<select value={status} onChange={(event) => { setLoading(true); setError(""); setStatus(event.target.value); }}><option value="">ทุกสถานะ</option>{customRequestStatuses.map((item) => <option key={item} value={item}>{customRequestStatusLabels[item]}</option>)}</select></label>
      {error ? <div className="v14-alert"><b>โหลดข้อมูลไม่สำเร็จ</b><span>{error}</span></div> : null}
      {loading ? <div className="v14-empty">กำลังโหลด…</div> : rows.length ? <div className="v14-list">{rows.map((row) => {
        const isOverdue = Boolean(row.assignment?.due_at && new Date(row.assignment.due_at) < new Date());
        return <div key={row.id}><span><b>{row.request_number}</b><small className="block">{row.member?.company_name ?? "—"} · {row.project?.project_number}</small></span><span><b>{row.item_name}</b><small className="block">{customRequestTypeLabels[row.request_type]} · {row.project?.name}</small>{row.assignment ? <small className="block">ผู้รับผิดชอบ {row.assignment.assigned_name ?? "—"} · Due {row.assignment.due_at ? new Date(row.assignment.due_at).toLocaleString("th-TH") : "—"}</small> : null}</span><span className="v14-actions">{isOverdue ? <span className="v14-status v14-status--warn"><AlertTriangle size={12}/>เกินกำหนด</span> : <span className="v14-status v14-status--good">{customRequestStatusLabels[row.status] ?? row.status}</span>}<Link href={`/admin/custom-requests/${row.id}`} className="v14-button v14-button--outline">เปิดตรวจ</Link></span></div>;
      })}</div> : <div className="v14-empty">ไม่มี Custom Request ในตัวกรองนี้</div>}
    </section>
  </div>;
}
