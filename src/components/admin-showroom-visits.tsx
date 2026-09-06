"use client";

import { CalendarCheck, RefreshCw, ShieldOff, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Visit = {
  id: string; project_number: string; project_name: string; member_company: string;
  product_name: string; supplier_name: string; preferred_at: string; attendee_count: number;
  note: string | null; status: string; visit_instruction: string | null; review_note: string | null;
  grant_id: string | null; grant_status: string | null;
};

const labels: Record<string, string> = { SUBMITTED: "รอตรวจ", APPROVED: "อนุมัติแล้ว", COMPLETED: "เสร็จสิ้น", REJECTED: "ไม่อนุมัติ", CANCELLED: "ยกเลิก" };

export function AdminShowroomVisits({ canRevoke }: { canRevoke: boolean }) {
  const [rows, setRows] = useState<Visit[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/showroom-visits");
      const body = await response.json();
      if (!response.ok) setError(body.message ?? "โหลดคำขอไม่สำเร็จ"); else setRows(body.data ?? []);
    } catch { setError("โหลดคำขอไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/showroom-visits").then(response => Promise.all([response, response.json()])).then(([response, body]) => {
      if (cancelled) return;
      if (!response.ok) setError(body.message ?? "โหลดคำขอไม่สำเร็จ"); else setRows(body.data ?? []);
    }).catch(() => { if (!cancelled) setError("โหลดคำขอไม่สำเร็จ กรุณาลองใหม่"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function act(row: Visit, action: "APPROVE" | "REJECT" | "COMPLETE") {
    const message = action === "APPROVE" ? "ระบุวัน เวลา สถานที่ และผู้ประสานงาน" : action === "REJECT" ? "ระบุเหตุผลที่ไม่อนุมัติ" : "หมายเหตุหลังการเยี่ยมชม (ถ้ามี)";
    const note = window.prompt(message, action === "COMPLETE" ? "เยี่ยมชมเรียบร้อย" : "") ?? "";
    if ((action === "APPROVE" || action === "REJECT") && note.trim().length < 3) return;
    setBusy(row.id); setError("");
    const response = await fetch(`/api/admin/showroom-visits/${row.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    const body = await response.json();
    if (!response.ok) setError(body.message ?? "อัปเดตคำขอไม่สำเร็จ"); else await load();
    setBusy("");
  }

  async function revoke(row: Visit) {
    if (!row.grant_id) return;
    const reason = window.prompt("เหตุผลในการถอนสิทธิ์เปิดเผย Supplier") ?? "";
    if (reason.trim().length < 5) return;
    setBusy(row.id); setError("");
    const response = await fetch(`/api/admin/supplier-disclosures/${row.grant_id}/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const body = await response.json();
    if (!response.ok) setError(body.message ?? "ถอนสิทธิ์ไม่สำเร็จ"); else await load();
    setBusy("");
  }

  const visible = useMemo(() => rows.filter(row => !filter || row.status === filter), [rows, filter]);
  return <div className="catalog-workspace">
    <section className="v14-hero"><div><p className="v14-eyebrow">Slice 3 · Project service</p><h1>Showroom Visit</h1><p>ตรวจคำขอ นัดหมาย และปิดการเยี่ยมชมเพื่อเปิดเผย Supplier ตามสิทธิ์</p></div><div className="member-catalog__promise"><Store/><strong>{rows.length} คำขอ</strong><span>{rows.filter(row => row.status === "SUBMITTED").length} รายการรอตรวจ</span></div></section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Visit queue</p><h2>รายการเยี่ยมชม</h2></div><button type="button" onClick={() => void load()} className="v14-button v14-button--outline"><RefreshCw size={14}/>รีเฟรช</button></div>
      <label className="max-w-xs">สถานะ<select value={filter} onChange={event => setFilter(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {error ? <div className="v14-alert"><b>ทำรายการไม่สำเร็จ</b><span>{error}</span></div> : null}
      {loading ? <div className="v14-empty">กำลังโหลด…</div> : visible.length ? <div className="v14-list">{visible.map(row => <div key={row.id}>
        <span><b>{row.project_number}</b><small className="block">{row.member_company} · {row.project_name}</small></span>
        <span><b>{row.product_name}</b><small className="block"><CalendarCheck size={12} className="inline"/> {new Date(row.preferred_at).toLocaleString("th-TH")} · {row.attendee_count} คน</small><small className="block">Supplier: {row.supplier_name}</small>{row.visit_instruction ? <small className="block">นัดหมาย: {row.visit_instruction}</small> : null}</span>
        <span className="v14-actions"><span className="v14-status v14-status--good">{labels[row.status] ?? row.status}</span>{row.status === "SUBMITTED" ? <><button disabled={busy === row.id} onClick={() => void act(row, "APPROVE")} className="v14-button v14-button--dark">อนุมัติ</button><button disabled={busy === row.id} onClick={() => void act(row, "REJECT")} className="v14-button v14-button--outline">ไม่อนุมัติ</button></> : null}{row.status === "APPROVED" ? <button disabled={busy === row.id} onClick={() => void act(row, "COMPLETE")} className="v14-button v14-button--dark">เสร็จสิ้น</button> : null}{canRevoke && row.grant_status === "ACTIVE" ? <button disabled={busy === row.id} onClick={() => void revoke(row)} className="v14-button v14-button--outline"><ShieldOff size={14}/>ถอนสิทธิ์</button> : null}</span>
      </div>)}</div> : <div className="v14-empty">ไม่มีคำขอในสถานะนี้</div>}
    </section>
  </div>;
}
