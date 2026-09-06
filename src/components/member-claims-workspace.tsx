"use client";

import { AlertTriangle, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { claimIssueLabels, claimStatusLabels, claimTone, type ClaimRow } from "@/lib/claims/types";

export function MemberClaimsWorkspace() {
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    const response = await fetch("/api/member/claims", { cache: "no-store" });
    const body = await response.json() as { data?: ClaimRow[]; message?: string };
    if (!response.ok) setError(body.message ?? "โหลด Claim ไม่สำเร็จ"); else setRows(body.data ?? []);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const filtered = useMemo(() => rows.filter((row) => (!status || row.status === status) && (!query || `${row.claim_number} ${row.subject} ${row.order_number} ${row.item_name}`.toLowerCase().includes(query.toLowerCase()))), [rows, query, status]);
  return <main className="claims-workspace">
    <section className="quotation-detail__hero"><div><p className="v14-eyebrow">บริการหลังการส่งมอบ</p><h1>Claim ของฉัน</h1><p>แจ้งปัญหาจากสินค้าที่ส่งมอบแล้ว ติดตามการตรวจสอบและผลแก้ไขในที่เดียว</p></div><Link href="/member/claims/new" className="v14-button v14-button--dark"><Plus size={16}/>เปิด Claim ใหม่</Link></section>
    {error ? <p className="v14-alert">{error}</p> : null}
    <section className="v14-panel"><div className="claim-toolbar"><div className="claim-toolbar__search" role="search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="ค้นหาเลข Claim, Order หรือสินค้า" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลข Claim, Order หรือสินค้า"/></div><select className="claim-toolbar__status" aria-label="กรองตามสถานะ Claim" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(claimStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="claim-list">{filtered.length ? filtered.map((row) => <Link href={`/member/claims/${row.id}`} key={row.id}><span className="claim-list__icon"><AlertTriangle size={18}/></span><span><b>{row.claim_number} · {row.subject}</b><small>{row.order_number} · {row.item_name}</small><small>{claimIssueLabels[row.issue_type] ?? row.issue_type} · {new Date(row.created_at).toLocaleString("th-TH")}</small></span><span className={`v14-status v14-status--${claimTone(row.status)}`}>{claimStatusLabels[row.status] ?? row.status}</span></Link>) : <div className="v14-empty"><AlertTriangle/><b>ยังไม่มี Claim ที่ตรงกับเงื่อนไข</b><span>เปิด Claim ได้จากสินค้าที่ส่งมอบแล้ว</span></div>}</div>
    </section>
  </main>;
}
