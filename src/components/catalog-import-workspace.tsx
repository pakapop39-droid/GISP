"use client";

import Link from "next/link";
import { AlertTriangle, Check, Download, FileSpreadsheet, FileText, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogImportCurrentJob, CatalogImportHistoryButton, revealCatalogImportDetail, type CatalogImportHistoryJob } from "@/components/catalog-import-history";
import { PdfCatalogReview, type PdfImportDetail, type PdfImportRow } from "@/components/pdf-catalog-review";

type Supplier = { id: string; code: string; name: string; status: string };
type ImportJob = CatalogImportHistoryJob;
type ImportError = { field_name: string | null; error_code: string; error_message: string };
type ImportRow = PdfImportRow & { source_data: Record<string, string | null>; errors: ImportError[] };
type Detail = Omit<PdfImportDetail, "job" | "rows"> & { job: ImportJob; rows: ImportRow[] };

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "ระบบไม่สามารถดำเนินการได้");
  return body.data as T;
}

export function CatalogImportWorkspace({ canImport, canManage, canReadCosts=false, canManageCosts=false, pdfEnabled = false, excelRoundtripEnabled=false }: { canImport: boolean; canManage: boolean; canReadCosts?:boolean; canManageCosts?:boolean; pdfEnabled?: boolean; excelRoundtripEnabled?:boolean }) {
  const [productSource, setProductSource] = useState<"spreadsheet" | "pdf">("spreadsheet");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [busy, setBusy] = useState<"upload" | "confirm" | "load" | null>(null);
  const [notice, setNotice] = useState<{ kind: "good" | "bad"; text: string } | null>(null);
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const [detailRevealRequest, setDetailRevealRequest] = useState(0);

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

  const loadDetail = useCallback(async (id: string, page = 1, revealAfterLoad = false) => {
    setBusy("load");
    try { const loaded=await json<Detail>(await fetch(`/api/admin/catalog/imports/${id}?page=${page}&pageSize=50`, { cache: "no-store" })); setDetail(loaded); if(loaded.job.source_type==="PDF")setProductSource("pdf"); if(revealAfterLoad)setDetailRevealRequest((current)=>current+1); }
    catch (error) { setNotice({ kind: "bad", text: error instanceof Error ? error.message : "เปิดผลตรวจไม่ได้" }); }
    finally { setBusy(null); }
  }, []);

  useEffect(() => {
    void loadJobs().catch((error) => setNotice({ kind: "bad", text: error instanceof Error ? error.message : "โหลดข้อมูลไม่ได้" }));
  }, [loadJobs]);

  useEffect(() => {
    if (!detailRevealRequest) return;
    const frame = window.requestAnimationFrame(() => revealCatalogImportDetail(detailSectionRef.current));
    return () => window.cancelAnimationFrame(frame);
  }, [detailRevealRequest]);

  function selectProductSource(source: "spreadsheet" | "pdf") {
    setProductSource(source); setFile(null); setDetail(null); setNotice(null); setFileInputKey((current)=>current+1);
  }

  async function uploadFile() {
    if (!file || !supplierId) return;
    setBusy("upload"); setNotice(null);
    const form = new FormData(); form.set("file", file); form.set("supplierId", supplierId);
    try {
      const response = await fetch("/api/admin/catalog/imports", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "ตรวจไฟล์ไม่สำเร็จ");
      setNotice({ kind: "good", text: body.message }); setFile(null); setFileInputKey((current) => current + 1);
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
    <section className="v14-hero"><div><p className="v14-eyebrow">Product catalog import</p><h1>นำเข้าสินค้าเป็น Draft</h1><p>เลือก Excel/CSV หรือ PDF Catalog ที่ตรวจแล้ว ระบบจะไม่สร้างราคาและไม่เผยแพร่สินค้าอัตโนมัติ</p></div></section>
    <section className={`grid gap-3 ${pdfEnabled?"md:grid-cols-2":""}`} aria-label="เลือกรูปแบบไฟล์สินค้า"><button type="button" aria-pressed={productSource==="spreadsheet"} onClick={()=>selectProductSource("spreadsheet")} className={`v14-panel flex items-start gap-3 text-left ${productSource==="spreadsheet"?"border-black bg-black/[.035]":""}`}><FileSpreadsheet size={20}/><span><strong className="block">Excel / CSV</strong><small className="text-black/55">ใช้ Template และตรวจข้อมูลทันที</small></span></button>{pdfEnabled?<button type="button" aria-pressed={productSource==="pdf"} onClick={()=>selectProductSource("pdf")} className={`v14-panel flex items-start gap-3 text-left ${productSource==="pdf"?"border-black bg-black/[.035]":""}`}><FileText size={20}/><span><strong className="block">PDF Catalog</strong><small className="text-black/55">จีน/อังกฤษ ทั้งข้อความและไฟล์สแกน</small></span></button>:null}</section>
    {productSource==="spreadsheet"?<section className="v14-panel !p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="block">Template สำหรับข้อมูลสินค้า</strong><span className="text-xs text-black/55">ใช้กับการนำเข้า Product Draft ด้านล่าง</span></div><a href="/api/admin/catalog/imports/template" className="v14-button v14-button--outline"><Download size={14}/>ดาวน์โหลด Template สินค้า</a></div></section>:null}
    <div className="grid gap-3 md:grid-cols-4">{(productSource==="pdf"?[["01","อัปโหลด PDF","ไม่เกิน 25 MB / 100 หน้า"],["02","ระบบอ่านข้อมูล","Native text / OCR / AI"],["03","เจ้าหน้าที่ตรวจ","เทียบ PDF และเคลียร์คำเตือน"],["04","ยืนยัน Draft","ไม่สร้างราคาและไม่ Publish"]]:[["01","เลือกไฟล์","Excel/CSV ไม่เกิน 10 MB"],["02","ตรวจข้อมูล","SKU หมวด และรูปแบบ"],["03","ดู Preview","แยกพร้อม/ต้องแก้"],["04","ยืนยัน Draft","ยังไม่ Publish"]]).map(([number,title,note])=><article key={number} className="v14-panel !p-4"><small className="v14-eyebrow">{number}</small><strong className="mt-1 block">{title}</strong><span className="text-xs text-black/55">{note}</span></article>)}</div>
    {notice ? <div className={`catalog-notice catalog-notice--${notice.kind}`} role="status">{notice.kind === "good" ? <Check size={15}/> : <AlertTriangle size={15}/>}<span>{notice.text}</span></div> : null}
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Step 1</p><h2>เลือก Supplier และไฟล์สินค้า</h2></div>{productSource==="pdf"?<FileText size={20}/>:<FileSpreadsheet size={20}/>}</div><div className="grid gap-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end"><label>Supplier<select value={supplierId} onChange={(event)=>{ setSupplierId(event.target.value); setFile(null); setDetail(null); setNotice(null); setFileInputKey((current) => current + 1); }} disabled={!canImport || !!busy}>{suppliers.map((supplier)=><option key={supplier.id} value={supplier.id}>{supplier.code} — {supplier.name}</option>)}</select></label><label>ไฟล์สินค้า<input key={fileInputKey} type="file" accept={productSource==="pdf"?".pdf,application/pdf":".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"} disabled={!canImport || !!busy} onChange={(event)=>{ setFile(event.target.files?.[0] ?? null); setDetail(null); setNotice(null); }}/></label><button className="v14-button v14-button--dark" type="button" disabled={!canImport || !file || !supplierId || !!busy} onClick={()=>void uploadFile()}>{busy === "upload" ? <LoaderCircle className="animate-spin" size={14}/> : <Upload size={14}/>} {productSource==="pdf"?"อัปโหลดและเข้าคิว":"ตรวจไฟล์"}</button></div><p className="mt-4 text-xs text-black/55">{productSource==="pdf"?"PDF ภาษาจีน/อังกฤษ · สูงสุด 25 MB และ 100 หน้า · เจ้าหน้าที่ต้องตรวจทุก Candidate":"คอลัมน์บังคับ: sku, name_th, product_type · รองรับสูงสุด 1,000 รายการต่อไฟล์"}</p></section>
    {productSource==="spreadsheet"?<section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Column mapping</p><h2>คอลัมน์ใน Template ไปที่ข้อมูลใด</h2></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{mappedColumns.map(([column,label])=><div key={column} className="flex items-center justify-between border border-black/10 px-3 py-2 text-xs"><code>{column}</code><span>→ {label}</span></div>)}</div></section>:null}
    {detail ? <div ref={detailSectionRef} tabIndex={-1} aria-labelledby="catalog-import-current-job" className="space-y-4 scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-[#356b52]/50">
      <CatalogImportCurrentJob fileName={detail.job.file_name} status={detail.job.status}/>
      {detail.job.source_type==="PDF"?<PdfCatalogReview key={`${detail.job.id}-${detail.pagination?.page??1}-${detail.rows.map((row)=>`${row.id}:${row.updated_at??""}:${row.validation_status}:${row.review_status??""}`).join("|")}`} detail={detail} canManage={canManage} canReadCosts={canReadCosts} canManageCosts={canManageCosts} excelRoundtripEnabled={excelRoundtripEnabled} onReload={()=>loadDetail(detail.job.id,detail.pagination?.page??1)} onPage={(page)=>loadDetail(detail.job.id,page)} onNotice={setNotice}/>:<section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Preview</p><h2>ผลตรวจไฟล์สินค้าก่อน Import</h2></div><span className={`v14-status ${detail.job.status === "COMPLETED" ? "v14-status--good" : ""}`}>{detail.job.status}</span></div><div className="grid gap-3 sm:grid-cols-3"><Summary label="ทั้งหมด" value={detail.job.total_rows}/><Summary label="พร้อมนำเข้า" value={detail.job.valid_rows} good/><Summary label="ต้องแก้" value={detail.job.invalid_rows} bad={detail.job.invalid_rows > 0}/></div><div className="mt-4 max-h-[520px] overflow-auto border border-black/10"><table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#f3f0e9]"><tr><th className="p-3">แถว</th><th className="p-3">SKU</th><th className="p-3">ชื่อสินค้า</th><th className="p-3">ประเภท/หมวด</th><th className="p-3">ผลตรวจ</th></tr></thead><tbody>{detail.rows.map((row)=><tr key={row.id} className="border-t border-black/10 align-top"><td className="p-3">{row.row_number}</td><td className="p-3 font-bold">{row.source_data.sku}</td><td className="p-3">{row.source_data.name_th}</td><td className="p-3">{row.source_data.product_type}<br/><span className="text-black/50">{row.source_data.category_code || "ไม่ระบุหมวด"}</span></td><td className="p-3">{row.errors.length ? <div className="space-y-1 text-[#a83226]">{row.errors.map((error,index)=><div key={`${error.error_code}-${index}`}>{error.error_message}</div>)}</div> : <span className="inline-flex flex-wrap items-center gap-1 text-[#356b52]"><Check size={12}/>{row.validation_status === "IMPORTED" ? "สร้าง Draft แล้ว" : "พร้อม"}{row.validation_status === "IMPORTED" && row.product_id ? <Link className="ml-2 underline" href={`/admin/catalog/products/${row.product_id}`}>เปิด Product Draft</Link> : null}</span>}</td></tr>)}</tbody></table></div><div className="mt-4 flex flex-wrap gap-2">{detail.job.invalid_rows > 0 ? <button type="button" className="v14-button v14-button--outline" onClick={downloadErrors}><Download size={14}/> ดาวน์โหลด Error Report</button> : null}<button type="button" className="v14-button v14-button--dark" disabled={!canManage || detail.job.status !== "READY_FOR_REVIEW" || detail.job.valid_rows < 1 || !!busy} onClick={()=>void confirmImport()}>{busy === "confirm" ? <LoaderCircle className="animate-spin" size={14}/> : <Check size={14}/>} ยืนยัน Import {detail.job.valid_rows} รายการเป็น Draft</button></div></section>}
    </div> : null}
    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Product import history</p><h2>ประวัติ Import สินค้าล่าสุด</h2></div><button className="v14-button v14-button--outline" onClick={()=>void loadJobs()} disabled={!!busy}><RefreshCw size={14}/> โหลดใหม่</button></div><div className="space-y-2">{jobs.map((job)=><CatalogImportHistoryButton key={job.id} job={job} selected={detail?.job.id===job.id} onSelect={()=>{if(job.source_type==="PDF"&&!pdfEnabled){setNotice({kind:"bad",text:"PDF Catalog Import ถูกปิดด้วย Feature Flag"});return;}void loadDetail(job.id,1,true);}}/>)}{!jobs.length ? <p className="py-6 text-center text-sm text-black/50">ยังไม่มีประวัติ Import สินค้า</p> : null}</div></section>
  </div>;
}

function Summary({ label, value, good, bad }: { label: string; value: number; good?: boolean; bad?: boolean }) {
  return <article className={`border p-4 ${good ? "border-[#356b52]/40 bg-[#356b52]/5" : bad ? "border-[#a83226]/40 bg-[#a83226]/5" : "border-black/10"}`}><span className="text-xs text-black/55">{label}</span><strong className="mt-1 block font-serif text-3xl">{value.toLocaleString("th-TH")}</strong></article>;
}
