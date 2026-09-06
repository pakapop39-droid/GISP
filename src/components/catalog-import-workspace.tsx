"use client";

import { AlertTriangle, Check, Download, FileSpreadsheet, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Supplier = { id: string; code: string; name: string; status: string };
type ImportJob = { id: string; file_name: string; source_type: string; status: string; total_rows: number; valid_rows: number; invalid_rows: number; created_at: string };
type ImportError = { field_name: string | null; error_code: string; error_message: string };
type ImportRow = { id: string; row_number: number; source_data: Record<string, string | null>; validation_status: "PENDING" | "VALID" | "INVALID" | "IMPORTED"; product_id: string | null; errors: ImportError[] };
type Detail = { job: ImportJob; rows: ImportRow[] };

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "ระบบไม่สามารถดำเนินการได้");
  return body.data as T;
}

export function CatalogImportWorkspace({ canImport, canManage }: { canImport: boolean; canManage: boolean }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"upload" | "confirm" | "load" | null>(null);
  const [notice, setNotice] = useState<{ kind: "good" | "bad"; text: string } | null>(null);

  const loadJobs = useCallback(async () => {
    const [jobRows, supplierRows] = await Promise.all([
      json<ImportJob[]>(await fetch("/api/admin/catalog/imports", { cache: "no-store" })),
      json<Supplier[]>(await fetch("/api/admin/suppliers", { cache: "no-store" })),
    ]);
    setJobs(jobRows);
    const usable = supplierRows.filter((supplier) => ["ACTIVE", "PROSPECT"].includes(supplier.status));
    setSuppliers(usable);
    setSupplierId((current) => current || usable[0]?.id || "");
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setBusy("load");
    try { setDetail(await json<Detail>(await fetch(`/api/admin/catalog/imports/${id}`, { cache: "no-store" }))); }
    catch (error) { setNotice({ kind: "bad", text: error instanceof Error ? error.message : "เปิดผลตรวจไม่ได้" }); }
    finally { setBusy(null); }
  }, []);

  useEffect(() => { void loadJobs().catch((error) => setNotice({ kind: "bad", text: error instanceof Error ? error.message : "โหลดข้อมูลไม่ได้" })); }, [loadJobs]);

  async function uploadFile() {
    if (!file || !supplierId) return;
    setBusy("upload"); setNotice(null);
    const form = new FormData(); form.set("file", file); form.set("supplierId", supplierId);
    try {
      const response = await fetch("/api/admin/catalog/imports", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "ตรวจไฟล์ไม่สำเร็จ");
      setNotice({ kind: "good", text: body.message }); setFile(null);
      await loadJobs(); await loadDetail(body.data.id);
    } catch (error) { setNotice({ kind: "bad", text: error instanceof Error ? error.message : "ตรวจไฟล์ไม่สำเร็จ" }); }
    finally { setBusy(null); }
  }

  async function confirmImport() {
    if (!detail || !window.confirm(`ยืนยันสร้าง Product Draft ${detail.job.valid_rows} รายการ?\nรายการที่มีข้อผิดพลาดจะไม่ถูกนำเข้า`)) return;
    setBusy("confirm"); setNotice(null);
    try {
      const response = await fetch(`/api/admin/catalog/imports/${detail.job.id}/confirm`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "ยืนยัน Import ไม่สำเร็จ");
      setNotice({ kind: "good", text: body.message }); await loadJobs(); await loadDetail(detail.job.id);
    } catch (error) { setNotice({ kind: "bad", text: error instanceof Error ? error.message : "ยืนยัน Import ไม่สำเร็จ" }); }
    finally { setBusy(null); }
  }

  function downloadErrors() {
    if (!detail) return;
    const lines = [["row", "sku", "field", "error_code", "message"], ...detail.rows.flatMap((row) => row.errors.map((error) => [String(row.row_number), String(row.source_data.sku ?? ""), error.field_name ?? "", error.error_code, error.error_message]))];
    const csv = `\uFEFF${lines.map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `gisp-import-errors-${detail.job.id}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const mappedColumns = useMemo(() => [["sku", "SKU"], ["factory_sku", "รหัสโรงงาน"], ["name_th", "ชื่อสินค้า"], ["product_type", "ประเภท"], ["category_code", "หมวด"], ["country_code", "ประเทศ"], ["lead_time_days", "Lead time"], ["width/depth/height", "มิติ"], ["material_summary", "วัสดุ"]], []);

  return <div className="space-y-5">
    <section className="v14-hero"><div><p className="v14-eyebrow">Excel / CSV import</p><h1>นำเข้าสินค้าเป็น Draft</h1><p>ใช้ Template ของระบบ ตรวจทุกแถวก่อน และยังไม่เผยแพร่สินค้าให้สมาชิกจนกว่าจะผ่าน Review</p></div><a href="/api/admin/catalog/imports/template" className="v14-button v14-button--outline"><Download size={14}/> ดาวน์โหลด Template CSV</a></section>
    <div className="grid gap-3 md:grid-cols-4">{[["01","เลือกไฟล์","Excel/CSV ไม่เกิน 10 MB"],["02","ตรวจข้อมูล","SKU หมวด และรูปแบบ"],["03","ดู Preview","แยกพร้อม/ต้องแก้"],["04","ยืนยัน Draft","ยังไม่ Publish"]].map(([number,title,note])=><article key={number} className="v14-panel !p-4"><small className="v14-eyebrow">{number}</small><strong className="mt-1 block">{title}</strong><span className="text-xs text-black/55">{note}</span></article>)}</div>
    {notice ? <div className={`catalog-notice catalog-notice--${notice.kind}`} role="status">{notice.kind === "good" ? <Check size={15}/> : <AlertTriangle size={15}/>}<span>{notice.text}</span></div> : null}
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Step 1</p><h2>เลือก Supplier และไฟล์สินค้า</h2></div><FileSpreadsheet size={20}/></div><div className="grid gap-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end"><label>Supplier<select value={supplierId} onChange={(event)=>setSupplierId(event.target.value)} disabled={!canImport || !!busy}>{suppliers.map((supplier)=><option key={supplier.id} value={supplier.id}>{supplier.code} — {supplier.name}</option>)}</select></label><label>ไฟล์สินค้า<input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" disabled={!canImport || !!busy} onChange={(event)=>setFile(event.target.files?.[0] ?? null)}/></label><button className="v14-button v14-button--dark" type="button" disabled={!canImport || !file || !supplierId || !!busy} onClick={()=>void uploadFile()}>{busy === "upload" ? <LoaderCircle className="animate-spin" size={14}/> : <Upload size={14}/>} ตรวจไฟล์</button></div><p className="mt-4 text-xs text-black/55">คอลัมน์บังคับ: <strong>sku, name_th, product_type</strong> · รองรับสูงสุด 1,000 รายการต่อไฟล์</p></section>
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Column mapping</p><h2>คอลัมน์ใน Template ไปที่ข้อมูลใด</h2></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{mappedColumns.map(([column,label])=><div key={column} className="flex items-center justify-between border border-black/10 px-3 py-2 text-xs"><code>{column}</code><span>→ {label}</span></div>)}</div></section>
    {detail ? <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Preview</p><h2>ผลตรวจไฟล์ก่อน Import</h2></div><span className={`v14-status ${detail.job.status === "COMPLETED" ? "v14-status--good" : ""}`}>{detail.job.status}</span></div><div className="grid gap-3 sm:grid-cols-3"><Summary label="ทั้งหมด" value={detail.job.total_rows}/><Summary label="พร้อมนำเข้า" value={detail.job.valid_rows} good/><Summary label="ต้องแก้" value={detail.job.invalid_rows} bad={detail.job.invalid_rows > 0}/></div><div className="mt-4 max-h-[520px] overflow-auto border border-black/10"><table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#f3f0e9]"><tr><th className="p-3">แถว</th><th className="p-3">SKU</th><th className="p-3">ชื่อสินค้า</th><th className="p-3">ประเภท/หมวด</th><th className="p-3">ผลตรวจ</th></tr></thead><tbody>{detail.rows.map((row)=><tr key={row.id} className="border-t border-black/10 align-top"><td className="p-3">{row.row_number}</td><td className="p-3 font-bold">{row.source_data.sku}</td><td className="p-3">{row.source_data.name_th}</td><td className="p-3">{row.source_data.product_type}<br/><span className="text-black/50">{row.source_data.category_code || "ไม่ระบุหมวด"}</span></td><td className="p-3">{row.errors.length ? <div className="space-y-1 text-[#a83226]">{row.errors.map((error,index)=><div key={`${error.error_code}-${index}`}>{error.error_message}</div>)}</div> : <span className="inline-flex items-center gap-1 text-[#356b52]"><Check size={12}/>{row.validation_status === "IMPORTED" ? "สร้าง Draft แล้ว" : "พร้อม"}</span>}</td></tr>)}</tbody></table></div><div className="mt-4 flex flex-wrap gap-2">{detail.job.invalid_rows > 0 ? <button type="button" className="v14-button v14-button--outline" onClick={downloadErrors}><Download size={14}/> ดาวน์โหลด Error Report</button> : null}<button type="button" className="v14-button v14-button--dark" disabled={!canManage || detail.job.status !== "READY_FOR_REVIEW" || detail.job.valid_rows < 1 || !!busy} onClick={()=>void confirmImport()}>{busy === "confirm" ? <LoaderCircle className="animate-spin" size={14}/> : <Check size={14}/>} ยืนยัน Import {detail.job.valid_rows} รายการเป็น Draft</button></div></section> : null}
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Import history</p><h2>รายการ Import ล่าสุด</h2></div><button className="v14-button v14-button--outline" onClick={()=>void loadJobs()} disabled={!!busy}><RefreshCw size={14}/> โหลดใหม่</button></div><div className="space-y-2">{jobs.map((job)=><button key={job.id} type="button" onClick={()=>void loadDetail(job.id)} className="grid w-full grid-cols-[1fr_auto] gap-3 border border-black/10 p-3 text-left hover:bg-black/[.025] md:grid-cols-[1.5fr_.6fr_.8fr_auto]"><span><strong className="block">{job.file_name}</strong><small>{new Date(job.created_at).toLocaleString("th-TH")}</small></span><span>{job.source_type}</span><span>พร้อม {job.valid_rows} · ต้องแก้ {job.invalid_rows}</span><strong>{job.status}</strong></button>)}{!jobs.length ? <p className="py-6 text-center text-sm text-black/50">ยังไม่มีประวัติ Import</p> : null}</div></section>
  </div>;
}

function Summary({ label, value, good, bad }: { label: string; value: number; good?: boolean; bad?: boolean }) {
  return <article className={`border p-4 ${good ? "border-[#356b52]/40 bg-[#356b52]/5" : bad ? "border-[#a83226]/40 bg-[#a83226]/5" : "border-black/10"}`}><span className="text-xs text-black/55">{label}</span><strong className="mt-1 block font-serif text-3xl">{value.toLocaleString("th-TH")}</strong></article>;
}
