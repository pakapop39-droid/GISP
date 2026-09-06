"use client";

import {
  ArrowRight,
  Calculator,
  Check,
  CircleAlert,
  Clock3,
  Coins,
  ExternalLink,
  Layers3,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CatalogBatchRow,
  CatalogIssueCode,
} from "@/lib/catalog/batch-status";

type Supplier = {
  id: string;
  code: string;
  name: string;
  status: string;
  default_currency: string;
};
type BatchRun = {
  id: string;
  action: string;
  requested_count: number;
  succeeded_count: number;
  skipped_count: number;
  failed_count: number;
  status: string;
  created_at: string;
};
type BatchData = {
  suppliers: Supplier[];
  selectedSupplierId: string | null;
  rows: CatalogBatchRow[];
  summary: {
    total: number;
    readyForReview: number;
    issueCounts: Record<CatalogIssueCode, number>;
  };
  runs: BatchRun[];
};
type BatchAction =
  | "FILL_LEAD_TIME"
  | "FILL_MATERIAL"
  | "CREATE_DEFAULT_VARIANTS"
  | "PREPARE_COSTS"
  | "ACTIVATE_MEMBER_PRICES";
type ApiBody<T> = { data: T; message?: string };

const issueLabels: Record<CatalogIssueCode, string> = {
  SUPPLIER_NOT_ACTIVE: "Supplier ยังไม่ Active",
  CATEGORY_REQUIRED: "ไม่มีหมวด",
  DESCRIPTION_REQUIRED: "ไม่มีรายละเอียด",
  SPECIFICATION_REQUIRED: "ไม่มีสเปก",
  LEAD_TIME_REQUIRED: "ไม่มี Lead time",
  MATERIAL_REQUIRED: "ไม่มีวัสดุ",
  DIMENSIONS_REQUIRED: "มิติไม่ครบ",
  ACTIVE_VARIANT_REQUIRED: "ไม่มี Variant",
  PRIMARY_IMAGE_REQUIRED: "ไม่มีรูปหลัก",
  ACTIVE_COST_REQUIRED: "ไม่มีต้นทุน Active",
  ACTIVE_PRICE_REQUIRED: "ไม่มีราคาสมาชิก",
};

const actionLabels: Record<BatchAction, string> = {
  FILL_LEAD_TIME: "เติม Lead time",
  FILL_MATERIAL: "เติมวัสดุ",
  CREATE_DEFAULT_VARIANTS: "สร้าง Default Variant",
  PREPARE_COSTS: "เตรียมต้นทุน",
  ACTIVATE_MEMBER_PRICES: "เปิดใช้ราคาสมาชิก",
};

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as Partial<
    ApiBody<T>
  > & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "ระบบไม่สามารถทำรายการได้");
  return body as ApiBody<T>;
}

export function BatchCatalogWorkspace({
  canManage,
  canManageCost,
  canManageFormula,
}: {
  canManage: boolean;
  canManageCost: boolean;
  canManageFormula: boolean;
}) {
  const [data, setData] = useState<BatchData>();
  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");
  const [issue, setIssue] = useState<"ALL" | CatalogIssueCode>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BatchAction>();
  const [notice, setNotice] = useState<{ kind: "good" | "bad"; text: string }>();
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [materialSummary, setMaterialSummary] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");

  const load = useCallback(async (requestedSupplier?: string) => {
    setLoading(true);
    try {
      const query = requestedSupplier
        ? `?supplierId=${encodeURIComponent(requestedSupplier)}`
        : "";
      const body = await requestJson<BatchData>(`/api/admin/catalog/batch${query}`);
      setData(body.data);
      setSupplierId(body.data.selectedSupplierId ?? "");
      setSelected(new Set());
    } catch (error) {
      setNotice({
        kind: "bad",
        text: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("th");
    return (data?.rows ?? []).filter((row) => {
      if (issue !== "ALL" && !row.issues.includes(issue)) return false;
      if (!term) return true;
      return `${row.sku} ${row.name_th} ${row.name_en ?? ""}`
        .toLocaleLowerCase("th")
        .includes(term);
    });
  }, [data?.rows, issue, search]);

  const selectedRows = useMemo(
    () => (data?.rows ?? []).filter((row) => selected.has(row.id)),
    [data?.rows, selected],
  );

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFiltered() {
    const allSelected = filteredRows.every((row) => selected.has(row.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const row of filteredRows) {
        if (allSelected) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  }

  async function runAction(action: BatchAction) {
    if (!selectedRows.length) {
      setNotice({ kind: "bad", text: "กรุณาเลือกรายการสินค้าก่อน" });
      return;
    }
    const payload: Record<string, unknown> = {
      action,
      productIds: selectedRows.map((row) => row.id),
      confirmed: true,
    };
    if (action === "FILL_LEAD_TIME") {
      const days = Number(leadTimeDays);
      if (!Number.isInteger(days) || days <= 0) {
        setNotice({ kind: "bad", text: "กรุณาระบุ Lead time เป็นจำนวนวันที่มากกว่า 0" });
        return;
      }
      payload.leadTimeDays = days;
    }
    if (action === "FILL_MATERIAL") {
      if (!materialSummary.trim()) {
        setNotice({ kind: "bad", text: "กรุณาระบุข้อความวัสดุที่จะใช้กับรายการที่เลือก" });
        return;
      }
      payload.materialSummary = materialSummary.trim();
    }
    if (action === "PREPARE_COSTS") {
      const rate = Number(exchangeRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        setNotice({ kind: "bad", text: "กรุณาระบุอัตราแลกเปลี่ยนเป็น THB ที่อนุมัติแล้ว" });
        return;
      }
      payload.exchangeRateToThb = rate;
    }

    const warning =
      action === "PREPARE_COSTS"
        ? `ยืนยันสร้างต้นทุนเวอร์ชันให้ ${selectedRows.length} รายการ โดยใช้อัตรา ${exchangeRate} THB?`
        : action === "ACTIVATE_MEMBER_PRICES"
          ? `ยืนยันคำนวณและเปิดใช้ราคาสมาชิก ${selectedRows.length} รายการจากต้นทุนและสูตร Active ปัจจุบัน?`
          : `ยืนยัน “${actionLabels[action]}” กับสินค้าที่เลือก ${selectedRows.length} รายการ? ระบบจะไม่เขียนทับข้อมูลที่มีอยู่แล้ว`;
    if (!window.confirm(warning)) return;

    setBusy(action);
    setNotice(undefined);
    try {
      const body = await requestJson<{
        requested: number;
        succeeded: number;
        skipped: number;
        failed: number;
      }>("/api/admin/catalog/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNotice({
        kind: body.data.failed ? "bad" : "good",
        text: `${body.message} สำเร็จ ${body.data.succeeded}, ข้าม ${body.data.skipped}, ไม่สำเร็จ ${body.data.failed} รายการ ขั้นต่อไป: ตรวจตัวเลขคงเหลือด้านบน`,
      });
      await load(supplierId);
    } catch (error) {
      setNotice({
        kind: "bad",
        text: error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ",
      });
    } finally {
      setBusy(undefined);
    }
  }

  const summary = data?.summary;
  const selectedCurrency = data?.suppliers.find(
    (item) => item.id === supplierId,
  )?.default_currency;

  return (
    <div className="batch-workspace">
      <section className="v14-hero batch-hero">
        <div>
          <p className="v14-eyebrow">Batch enrichment & validation</p>
          <h1>เติมข้อมูลและเตรียมราคาเป็นชุด</h1>
          <p>
            จัดการเฉพาะสินค้าที่เลือก ระบบไม่เดา Lead time วัสดุ หรืออัตราแลกเปลี่ยน
            และทุกครั้งจะบันทึกผลแยกว่าสำเร็จ ข้าม หรือยังติดปัญหา
          </p>
        </div>
        <Link href="/admin/catalog" className="v14-button v14-button--outline">
          กลับ Catalog <ArrowRight size={14} />
        </Link>
      </section>

      <div className="batch-flow" aria-label="ลำดับการเตรียม Catalog">
        <FlowStep icon={CircleAlert} number="01" label="Validation" note="เห็นข้อมูลที่ขาด" />
        <FlowStep icon={Layers3} number="02" label="Enrichment" note="เติมค่าที่อนุมัติ" />
        <FlowStep icon={Coins} number="03" label="Cost Version" note="ล็อก Exchange Rate" />
        <FlowStep icon={PackageCheck} number="04" label="Member Price" note="คำนวณด้วยสูตร Active" />
      </div>

      <section className="batch-metrics" aria-label="สรุปสถานะ">
        <Metric label="สินค้าทั้งหมด" value={summary?.total ?? 0} tone="neutral" />
        <Metric label="Lead time ที่ขาด" value={summary?.issueCounts.LEAD_TIME_REQUIRED ?? 0} tone="warn" />
        <Metric label="วัสดุที่ขาด" value={summary?.issueCounts.MATERIAL_REQUIRED ?? 0} tone="warn" />
        <Metric label="มิติที่ขาด" value={summary?.issueCounts.DIMENSIONS_REQUIRED ?? 0} tone="bad" />
        <Metric label="ไม่มีต้นทุน" value={summary?.issueCounts.ACTIVE_COST_REQUIRED ?? 0} tone="bad" />
        <Metric label="พร้อม Review" value={summary?.readyForReview ?? 0} tone="good" />
      </section>

      {notice ? (
        <div className={`catalog-notice catalog-notice--${notice.kind}`} role="status">
          {notice.kind === "good" ? <Check size={15} /> : <CircleAlert size={15} />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <section className="v14-panel batch-command">
        <div className="batch-command__filter">
          <label>
            Supplier
            <select
              value={supplierId}
              onChange={(event) => void load(event.target.value)}
              disabled={loading}
            >
              {(data?.suppliers ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.code} — {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            ปัญหาที่ต้องจัดการ
            <select value={issue} onChange={(event) => setIssue(event.target.value as typeof issue)}>
              <option value="ALL">ทั้งหมด</option>
              {Object.entries(issueLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label} ({summary?.issueCounts[code as CatalogIssueCode] ?? 0})
                </option>
              ))}
            </select>
          </label>
          <label className="batch-search">
            ค้นหา SKU หรือชื่อสินค้า
            <span><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="เช่น CN01-0001" /></span>
          </label>
          <button className="v14-button v14-button--outline" onClick={() => void load(supplierId)} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> โหลดใหม่
          </button>
        </div>
        <div className="batch-selection">
          <strong>เลือกแล้ว {selected.size} รายการ</strong>
          <span>ผลกรอง {filteredRows.length} รายการ</span>
          <button type="button" onClick={toggleFiltered} disabled={!filteredRows.length}>
            {filteredRows.every((row) => selected.has(row.id)) && filteredRows.length
              ? "ยกเลิกเลือกผลกรอง"
              : "เลือกผลกรองทั้งหมด"}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} disabled={!selected.size}>ล้างที่เลือก</button>
        </div>
      </section>

      <div className="batch-layout">
        <section className="v14-panel batch-table-panel">
          <div className="v14-panel__head">
            <div><p className="v14-eyebrow">Validation queue</p><h2>รายการสินค้า</h2></div>
            <small>แสดงข้อมูลจริงสูงสุด 1,000 รายการต่อ Supplier</small>
          </div>
          {loading ? <div className="v14-empty"><LoaderCircle className="animate-spin" /> กำลังตรวจข้อมูล…</div> : (
            <div className="batch-table" role="table" aria-label="รายการ Validation สินค้า">
              <div className="batch-table__head" role="row">
                <span>เลือก</span><span>สินค้า</span><span>ข้อมูลที่ยังขาด</span><span>สถานะ</span>
              </div>
              {filteredRows.map((row) => (
                <div className="batch-table__row" role="row" key={row.id}>
                  <span><input type="checkbox" aria-label={`เลือก ${row.sku}`} checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} /></span>
                  <span className="batch-product"><strong>{row.sku}</strong><small>{row.name_th}</small><Link href={`/admin/catalog/products/${row.id}`}>แก้รายสินค้า <ExternalLink size={11} /></Link></span>
                  <span className="batch-issues">{row.issues.length ? row.issues.map((code) => <em key={code}>{issueLabels[code]}</em>) : <em className="ready"><Check size={11} /> ข้อมูลครบ</em>}</span>
                  <span className="batch-state"><b>{row.status}</b><small>{row.activeCost ? "มีต้นทุน" : "รอต้นทุน"} · {row.activePrice ? "มีราคา" : "รอราคา"}</small></span>
                </div>
              ))}
              {!filteredRows.length ? <div className="v14-empty">ไม่พบรายการตามตัวกรองนี้</div> : null}
            </div>
          )}
        </section>

        <aside className="batch-actions">
          <ActionCard icon={Clock3} eyebrow="Step 1" title="เติม Lead time" note="ใช้ค่าที่ระบุกับรายการที่ยังว่างเท่านั้น">
            <label>จำนวนวัน<input type="number" min="1" max="3650" value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value)} placeholder="เช่น 45" /></label>
            <ActionButton label="เติม Lead time" disabled={!canManage || !!busy} busy={busy === "FILL_LEAD_TIME"} onClick={() => void runAction("FILL_LEAD_TIME")} />
          </ActionCard>

          <ActionCard icon={Layers3} eyebrow="Step 2" title="เติมวัสดุ" note="เลือกเฉพาะสินค้าที่ใช้ข้อความวัสดุเดียวกัน">
            <label>สรุปวัสดุ<textarea value={materialSummary} onChange={(event) => setMaterialSummary(event.target.value)} placeholder="เช่น โครงไม้จริง หุ้มผ้า" rows={3} /></label>
            <ActionButton label="เติมข้อมูลวัสดุ" disabled={!canManage || !!busy} busy={busy === "FILL_MATERIAL"} onClick={() => void runAction("FILL_MATERIAL")} />
          </ActionCard>

          <ActionCard icon={PackageCheck} eyebrow="Step 3" title="สร้าง Default Variant" note="สร้างจากข้อมูลหลักเฉพาะรายการที่มิติครบ">
            <ActionButton label="สร้าง Variant" disabled={!canManage || !!busy} busy={busy === "CREATE_DEFAULT_VARIANTS"} onClick={() => void runAction("CREATE_DEFAULT_VARIANTS")} />
          </ActionCard>

          <ActionCard icon={Calculator} eyebrow="Pricing Engine" title="สร้างต้นทุนเวอร์ชัน" note={`Factory Cost ใช้ ${selectedCurrency ?? "สกุลเงินต้นทาง"}; ต้องกรอกอัตราที่อนุมัติแล้ว`} confidential>
            <label>1 {selectedCurrency ?? "Currency"} เท่ากับกี่ THB<input type="number" min="0.00000001" step="0.00000001" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} placeholder="กรอกอัตราแลกเปลี่ยน" /></label>
            <ActionButton label="สร้าง Cost Version" disabled={!canManageCost || !!busy} busy={busy === "PREPARE_COSTS"} onClick={() => void runAction("PREPARE_COSTS")} />
          </ActionCard>

          <ActionCard icon={Sparkles} eyebrow="Pricing Engine" title="คำนวณราคาสมาชิก" note="ใช้ Cost Version และ Formula Active ปัจจุบัน" confidential>
            <ActionButton label="เปิดใช้ราคาสมาชิก" disabled={!canManageFormula || !!busy} busy={busy === "ACTIVATE_MEMBER_PRICES"} onClick={() => void runAction("ACTIVATE_MEMBER_PRICES")} />
          </ActionCard>
        </aside>
      </div>

      <section className="v14-panel batch-history">
        <div className="v14-panel__head"><div><p className="v14-eyebrow">Audit trail</p><h2>ประวัติ Batch ล่าสุด</h2></div><ShieldCheck size={18} /></div>
        <div className="batch-history__list">
          {(data?.runs ?? []).map((run) => <div key={run.id}><span><strong>{actionLabels[run.action as BatchAction] ?? run.action}</strong><small>{new Date(run.created_at).toLocaleString("th-TH")}</small></span><span>เลือก {run.requested_count}</span><span className="good">สำเร็จ {run.succeeded_count}</span><span>ข้าม {run.skipped_count}</span><span className={run.failed_count ? "bad" : ""}>ไม่สำเร็จ {run.failed_count}</span></div>)}
          {!data?.runs.length ? <div className="v14-empty">ยังไม่มีประวัติ Batch</div> : null}
        </div>
      </section>
    </div>
  );
}

function FlowStep({ icon: Icon, number, label, note }: { icon: typeof CircleAlert; number: string; label: string; note: string }) {
  return <div><span><Icon size={15} /></span><small>{number}</small><strong>{label}</strong><em>{note}</em></div>;
}
function Metric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "warn" | "bad" | "good" }) {
  return <article className={`batch-metric batch-metric--${tone}`}><span>{label}</span><strong>{value.toLocaleString("th-TH")}</strong></article>;
}
function ActionCard({ icon: Icon, eyebrow, title, note, confidential = false, children }: { icon: typeof CircleAlert; eyebrow: string; title: string; note: string; confidential?: boolean; children: React.ReactNode }) {
  return <section className="v14-panel batch-action-card"><div className="batch-action-card__head"><span><Icon size={16} /></span><div><p className="v14-eyebrow">{eyebrow}</p><h3>{title}</h3></div></div><p>{note}</p>{confidential ? <small className="batch-confidential">ข้อมูลภายใน — สมาชิกไม่สามารถมองเห็น</small> : null}{children}</section>;
}
function ActionButton({ label, disabled, busy, onClick }: { label: string; disabled: boolean; busy: boolean; onClick: () => void }) {
  return <button type="button" className="v14-button v14-button--dark" disabled={disabled} onClick={onClick}>{busy ? <LoaderCircle className="animate-spin" size={14} /> : <ArrowRight size={14} />}{label}</button>;
}
