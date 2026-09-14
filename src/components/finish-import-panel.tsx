"use client";

import Link from "next/link";
import { AlertTriangle, Check, Download, FileSpreadsheet, LoaderCircle, Settings2, Upload } from "lucide-react";
import { useEffect, useState } from "react";

type Supplier = { id: string; code: string; name: string; status: string };
type PreviewRow = {
  rowNumber: number;
  source: Record<string, string>;
  errors: Array<{ code: string; message: string }>;
};
type ImportPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: PreviewRow[];
  dryRun: true;
  previewToken?: string;
  expiresAt?: number;
};

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as { data?: T; message?: string };
  if (!response.ok) throw new Error(body.message ?? "ระบบไม่สามารถทำรายการได้");
  return body as { data: T; message?: string };
}

export function FinishImportPanel({ canImport, canManage }: { canImport: boolean; canManage: boolean }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] = useState<ImportPreview>();
  const [busy, setBusy] = useState<"load" | "dry-run" | "confirm" | null>("load");
  const [notice, setNotice] = useState<{ kind: "good" | "bad"; text: string }>();

  useEffect(() => {
    let active = true;
    void requestJson<Supplier[]>("/api/admin/suppliers", { cache: "no-store" })
      .then(({ data }) => {
        if (!active) return;
        const usable = data.filter((supplier) => ["ACTIVE", "PROSPECT"].includes(supplier.status));
        setSuppliers(usable);
        setSupplierId(usable[0]?.id ?? "");
      })
      .catch((error) => active && setNotice({ kind: "bad", text: error instanceof Error ? error.message : "โหลด Supplier ไม่สำเร็จ" }))
      .finally(() => active && setBusy(null));
    return () => { active = false; };
  }, []);

  function resetSelection(nextSupplierId = supplierId) {
    setSupplierId(nextSupplierId);
    setFile(null);
    setPreview(undefined);
    setNotice(undefined);
    setFileInputKey((current) => current + 1);
  }

  async function inspectManifest(confirmed: boolean) {
    if (!file || !supplierId) return;
    setBusy(confirmed ? "confirm" : "dry-run");
    setNotice(undefined);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("supplierId", supplierId);
      form.set("confirmed", String(confirmed));
      if (confirmed && preview?.previewToken) form.set("previewToken", preview.previewToken);
      const response = await requestJson<ImportPreview | { imported: number; status: "DRAFT" }>(
        "/api/admin/catalog/finishes/import",
        { method: "POST", body: form },
      );
      if ("dryRun" in response.data) setPreview(response.data);
      else {
        setPreview(undefined);
        setFile(null);
        setFileInputKey((current) => current + 1);
      }
      setNotice({ kind: "good", text: response.message ?? "ตรวจไฟล์คลังสีแล้ว" });
    } catch (error) {
      setNotice({ kind: "bad", text: error instanceof Error ? error.message : "ตรวจไฟล์คลังสีไม่สำเร็จ" });
    } finally {
      setBusy(null);
    }
  }

  return <div className="space-y-5">
    {notice ? <div className={`catalog-notice catalog-notice--${notice.kind}`} role="status">{notice.kind === "good" ? <Check size={15}/> : <AlertTriangle size={15}/>}<span>{notice.text}</span></div> : null}
    {!canManage ? <div className="catalog-notice catalog-notice--bad"><AlertTriangle size={15}/><span>บัญชีนี้ดูหน้า Import ได้ แต่ต้องมีสิทธิ์จัดการ Catalog จึงจะนำเข้าคลังสีได้</span></div> : null}
    <section className="v14-panel catalog-form">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Finish / color manifest</p><h2>นำเข้าคลังสีเป็น Draft</h2></div><FileSpreadsheet size={20}/></div>
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr_auto_auto] md:items-end">
        <label>Supplier<select value={supplierId} onChange={(event) => resetSelection(event.target.value)} disabled={!canImport || !canManage || !!busy}>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.code} — {supplier.name}</option>)}</select></label>
        <label>ไฟล์คลังสี<input key={fileInputKey} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={!canImport || !canManage || !!busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(undefined); setNotice(undefined); }}/></label>
        <Link className="v14-button v14-button--outline" href="/api/admin/catalog/finishes/template"><Download size={14}/>Template สี</Link>
        <button className="v14-button v14-button--dark" type="button" disabled={!canImport || !canManage || !file || !supplierId || !!busy} onClick={() => void inspectManifest(false)}>{busy === "dry-run" ? <LoaderCircle className="animate-spin" size={14}/> : <Upload size={14}/>}Dry-run</button>
      </div>
      <p className="mt-4 text-xs text-black/55">ระบบตรวจไฟล์ก่อนทุกครั้ง และสร้างเฉพาะข้อมูลสีสถานะ Draft เท่านั้น ไม่มีการอ่าน PDF อัตโนมัติ</p>
    </section>
    {preview ? <section className="v14-panel">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Preview</p><h2>ผลตรวจไฟล์คลังสี</h2></div><span className="v14-status">DRY-RUN</span></div>
      <div className="grid gap-3 sm:grid-cols-3"><Summary label="ทั้งหมด" value={preview.totalRows}/><Summary label="พร้อมนำเข้า" value={preview.validRows} good/><Summary label="ต้องแก้" value={preview.invalidRows} bad={preview.invalidRows > 0}/></div>
      <div className="mt-4 max-h-72 overflow-auto border border-black/10"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-[#f3f0e9]"><tr><th className="p-2">แถว</th><th className="p-2">Collection</th><th className="p-2">รหัสสี</th><th className="p-2">ต้นทาง</th><th className="p-2">ผลตรวจ</th></tr></thead><tbody>{preview.rows.map((row) => <tr className="border-t border-black/10" key={row.rowNumber}><td className="p-2">{row.rowNumber}</td><td className="p-2">{row.source.collection_code}</td><td className="p-2">{row.source.finish_code}</td><td className="p-2">{row.source.source_document} / {row.source.source_page}</td><td className="p-2">{row.errors.length ? row.errors.map((error) => error.message).join("; ") : "พร้อมสร้าง Draft"}</td></tr>)}</tbody></table></div>
      <button type="button" className="v14-button v14-button--dark mt-4" disabled={preview.invalidRows > 0 || !preview.previewToken || !file || !!busy} onClick={() => window.confirm(`ยืนยัน Import ${preview.validRows} สีเป็น Draft?`) && void inspectManifest(true)}>{busy === "confirm" ? <LoaderCircle className="animate-spin" size={14}/> : <Check size={14}/>}ยืนยัน Import สีเป็น Draft</button>
    </section> : null}
    <section className="v14-panel !p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="block">ต้องแก้ชื่อสี รูปสวอตช์ หรือการผูกกับ Option?</strong><span className="text-xs text-black/55">ไปที่คลังสีขั้นสูงหลังนำเข้าข้อมูล Draft แล้ว</span></div><Link className="v14-button v14-button--outline" href="/admin/catalog/finishes"><Settings2 size={14}/>จัดการคลังสีขั้นสูง</Link></div></section>
  </div>;
}

function Summary({ label, value, good, bad }: { label: string; value: number; good?: boolean; bad?: boolean }) {
  return <article className={`border p-4 ${good ? "border-[#356b52]/40 bg-[#356b52]/5" : bad ? "border-[#a83226]/40 bg-[#a83226]/5" : "border-black/10"}`}><span className="text-xs text-black/55">{label}</span><strong className="mt-1 block font-serif text-3xl">{value.toLocaleString("th-TH")}</strong></article>;
}
