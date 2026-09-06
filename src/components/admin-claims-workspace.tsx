"use client";

import { AlertTriangle, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { claimIssueLabels, claimStatusLabels, claimTone, type ClaimRow } from "@/lib/claims/types";

export function AdminClaimsWorkspace() {
  const [rows, setRows] = useState<ClaimRow[]>([]); const [query, setQuery] = useState(""); const [status, setStatus] = useState(""); const [error, setError] = useState<string>();
  const load = useCallback(async () => { const response = await fetch("/api/admin/claims", { cache: "no-store" }); const body = await response.json() as { data?: ClaimRow[]; message?: string }; if (!response.ok) setError(body.message ?? "โหลด Claim Queue ไม่สำเร็จ"); else setRows(body.data ?? []); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const filtered = useMemo(() => rows.filter((row) => (!status || row.status === status) && (!query || `${row.claim_number} ${row.subject} ${row.company_name} ${row.order_number}`.toLowerCase().includes(query.toLowerCase()))), [rows, query, status]);
  const actionCount = rows.filter((row) => ["SUBMITTED", "WAITING_INFORMATION", "RESOLVED"].includes(row.status)).length;
  return <main className="claims-workspace"><section className="quotation-detail__hero"><div><p className="v14-eyebrow">Order Admin · After delivery</p><h1>Claim Queue</h1><p>ตรวจหลักฐาน ยืนยันผู้รับผิดชอบ และควบคุม Resolution โดยไม่มีการชดเชยอัตโนมัติ</p></div><span className="claim-metric"><small>ต้องดำเนินการ</small><b>{actionCount}</b></span></section>{error ? <p className="v14-alert">{error}</p> : null}<section className="v14-panel"><div className="claim-toolbar"><div className="claim-toolbar__search" role="search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="ค้นหา Claim บริษัท หรือ Order" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหา Claim, บริษัท หรือ Order"/></div><select className="claim-toolbar__status" aria-label="กรองตามสถานะ Claim" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(claimStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="claim-list claim-list--admin">{filtered.length ? filtered.map((row) => <Link href={`/admin/claims/${row.id}`} key={row.id}><span className="claim-list__icon"><AlertTriangle size={18}/></span><span><b>{row.claim_number} · {row.subject}</b><small>{row.company_name} · {row.order_number} · {row.item_name}</small><small>{claimIssueLabels[row.issue_type] ?? row.issue_type} · ระดับ {row.severity}</small></span><span className={`v14-status v14-status--${claimTone(row.status)}`}>{claimStatusLabels[row.status] ?? row.status}</span></Link>) : <div className="v14-empty"><AlertTriangle/><b>ไม่มี Claim ใน Queue</b></div>}</div></section></main>;
}
