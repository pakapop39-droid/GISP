"use client";

import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Check, ExternalLink, LoaderCircle, RotateCcw, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CatalogEnrichmentPanel } from "@/components/catalog-enrichment-panel";

export type PdfImportRow = {
  id: string; row_number: number; validation_status: string; review_status?: string; product_id: string | null; updated_at?: string;
  source_page_number?: number; sku?: string | null; factory_sku?: string | null; name_zh?: string | null;
  name_en?: string | null; name_th_draft?: string | null; product_type?: string | null; country_code?: string | null;
  category_id?: string | null; lead_time_days?: number | null; width_mm?: number | null; depth_mm?: number | null;
  height_mm?: number | null; weight_kg?: number | null; cbm?: number | null; moq?: number | null;
  material_summary?: string | null; finish_summary?: string | null; specification_summary?: string | null;
  description_th?: string | null;
  warning_codes?: string[]; existing_product_id?: string | null; selected_image_file_id?: string | null;
};
export type PdfImportDetail = {
  job: { id: string; status: string; total_rows: number; valid_rows: number; invalid_rows: number; page_count?: number; processed_pages?: number; ai_cost_usd?: number; compute_cost_usd?: number; security_status?: string; security_verified_at?: string | null };
  rows: PdfImportRow[]; sourceUrl?: string | null;
  pages?: { page_number: number; status: string; failure_message?: string | null; rendered_file_id?: string | null }[];
  candidateImages?: { import_row_id: string; file_id: string; confidence?: number | null }[];
  categories?: { id: string; code: string; name_th: string; name_en?: string | null }[];
  countries?: { code: string; name_th?: string | null; name_en?: string | null }[];
  computeBudget?: { reserved_usd: number | string; actual_usd: number | string; limitUsd: number; warning80Percent: boolean };
  enrichmentBatch?:{id:string;status:string;updated_at:string}|null;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
};

type Notice = { kind: "good" | "bad"; text: string };

function draftFrom(row?: PdfImportRow) {
  return { sku: row?.sku ?? "", factorySku: row?.factory_sku ?? "", nameZh: row?.name_zh ?? "", nameEn: row?.name_en ?? "", nameThDraft: row?.name_th_draft ?? "", productType: row?.product_type ?? "", categoryId: row?.category_id ?? "", countryCode: row?.country_code ?? "", leadTimeDays: String(row?.lead_time_days ?? ""), widthMm: String(row?.width_mm ?? ""), depthMm: String(row?.depth_mm ?? ""), heightMm: String(row?.height_mm ?? ""), weightKg: String(row?.weight_kg ?? ""), cbm: String(row?.cbm ?? ""), moq: String(row?.moq ?? ""), materialSummary: row?.material_summary ?? "", finishSummary: row?.finish_summary ?? "", descriptionTh: row?.description_th ?? "", specificationSummary: row?.specification_summary ?? "", selectedImageFileId: row?.selected_image_file_id ?? "" };
}

function patchFromDraft(draft: Record<string, string>) {
  const numberOrNull = (value: string) => value.trim() ? Number(value) : null;
  return { ...draft, productType: draft.productType || null, countryCode: draft.countryCode || null, categoryId: draft.categoryId || null, selectedImageFileId: draft.selectedImageFileId || null,
    leadTimeDays: numberOrNull(draft.leadTimeDays), widthMm: numberOrNull(draft.widthMm), depthMm: numberOrNull(draft.depthMm),
    heightMm: numberOrNull(draft.heightMm), weightKg: numberOrNull(draft.weightKg), cbm: numberOrNull(draft.cbm), moq: numberOrNull(draft.moq) };
}

async function action(url: string, body?: unknown) {
  const response = await fetch(url, { method: body === undefined ? "POST" : "PATCH", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? "ดำเนินการไม่สำเร็จ");
  return result;
}

export function PdfCatalogReview({ detail, canManage, canReadCosts=false, canManageCosts=false, excelRoundtripEnabled=false, onReload, onPage, onNotice }: { detail: PdfImportDetail; canManage: boolean; canReadCosts?:boolean; canManageCosts?:boolean; excelRoundtripEnabled?:boolean; onReload: () => Promise<void>; onPage: (page: number) => Promise<void>; onNotice: (notice: Notice) => void }) {
  const [selectedId, setSelectedId] = useState(detail.rows[0]?.id ?? "");
  const [checked, setChecked] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>(()=>draftFrom(detail.rows[0]));
  const [busy, setBusy] = useState(false);
  const selected = detail.rows.find((row) => row.id === selectedId) ?? detail.rows[0];
  const selectedPage = detail.pages?.find((page) => page.page_number === selected?.source_page_number);
  const canViewArtifacts = detail.job.security_status === "VERIFIED" && Boolean(detail.job.security_verified_at);
  const sourcePageUrl = canViewArtifacts && selectedPage?.rendered_file_id
    ? `/api/admin/catalog/imports/${detail.job.id}/artifacts/${selectedPage.rendered_file_id}`
    : null;
  const selectedCandidateImages = detail.candidateImages?.filter((image) => image.import_row_id === selected?.id) ?? [];
  const [sourcePreviewAttempt, setSourcePreviewAttempt] = useState(0);
  const [loadedSourcePreview, setLoadedSourcePreview] = useState<string | null>(null);
  const [failedSourcePreview, setFailedSourcePreview] = useState<string | null>(null);
  const sourcePreviewUrl = sourcePageUrl ? `${sourcePageUrl}?preview=${sourcePreviewAttempt}` : null;
  const sourcePreviewState = !sourcePreviewUrl ? "empty" : failedSourcePreview === sourcePreviewUrl ? "error" : loadedSourcePreview === sourcePreviewUrl ? "loaded" : "loading";
  const approvable = useMemo(() => detail.rows.filter((row) => row.validation_status === "VALID" && row.review_status === "APPROVED" && !row.product_id), [detail.rows]);
  const progress = detail.job.page_count ? Math.round(((detail.job.processed_pages ?? 0) / detail.job.page_count) * 100) : 0;

  async function run(callback: () => Promise<unknown>, success: string) {
    setBusy(true);
    try { await callback(); onNotice({ kind: "good", text: success }); await onReload(); }
    catch (error) { onNotice({ kind: "bad", text: error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ" }); }
    finally { setBusy(false); }
  }

  async function decide(decision: "APPROVE" | "REJECT") {
    if (!selected) return;
    await run(async () => {
      const response = await fetch(`/api/admin/catalog/imports/${detail.job.id}/rows/${selected.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, warningCodes: [] }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "บันทึกผลตรวจไม่สำเร็จ");
    }, decision === "APPROVE" ? "ตรวจและอนุมัติ Candidate แล้ว" : "ปฏิเสธ Candidate แล้ว");
  }

  async function confirmSelected() {
    if (!checked.length || !window.confirm(`ยืนยันสร้าง Product Draft ${checked.length} รายการ?`)) return;
    await run(async () => {
      const response = await fetch(`/api/admin/catalog/imports/${detail.job.id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowIds: checked }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "สร้าง Product Draft ไม่สำเร็จ");
      setChecked([]);
    }, "สร้าง Product Draft จากรายการที่เลือกแล้ว");
  }

  return <section className="v14-panel space-y-4">
    <div className="v14-panel__head"><div><p className="v14-eyebrow">PDF review</p><h2>ตรวจ PDF เทียบกับ Product Candidate</h2></div><span className="v14-status">{detail.job.status}</span></div>
    <div className="grid gap-3 sm:grid-cols-4"><Metric label="หน้า" value={`${detail.job.processed_pages ?? 0}/${detail.job.page_count ?? 0}`}/><Metric label="ความคืบหน้า" value={`${progress}%`}/><Metric label="ผ่านการตรวจ" value={String(approvable.length)}/><Metric label="AI cost" value={`$${Number(detail.job.ai_cost_usd ?? 0).toFixed(4)}`}/></div>
    {detail.computeBudget?.warning80Percent?<p className="flex items-center gap-2 text-sm text-[#a83226]"><AlertTriangle size={15}/>ค่า Compute เดือนนี้ถึง 80% แล้ว (${(Number(detail.computeBudget.actual_usd)+Number(detail.computeBudget.reserved_usd)).toFixed(2)} / ${detail.computeBudget.limitUsd.toFixed(2)}) ระบบจะไม่ปลุก Worker เมื่อถึงเพดาน</p>:null}
    {detail.job.status !== "READY_FOR_REVIEW" && !["COMPLETED","COMPLETED_WITH_ISSUES"].includes(detail.job.status) ? <p className="flex items-center gap-2 text-sm"><LoaderCircle className="animate-spin" size={15}/>Worker กำลังประมวลผล กรุณากดโหลดใหม่เพื่อติดตามสถานะ</p> : null}
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="min-h-[620px] border border-black/10 bg-black/[.02]">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3"><strong className="text-sm">ภาพต้นฉบับหน้า {selected?.source_page_number ?? "—"}</strong><span className="text-xs text-black/50">{selectedPage?.status ?? "ยังไม่มีสถานะหน้า"}</span></div>
        <div className="relative h-[550px] overflow-hidden bg-white">
          {sourcePreviewUrl ? <>
            <Image unoptimized fill sizes="(min-width: 1280px) 50vw, 100vw" priority={false} alt={`ภาพ Render หน้า ${selected?.source_page_number ?? ""}`} src={sourcePreviewUrl} onLoad={()=>{setLoadedSourcePreview(sourcePreviewUrl);setFailedSourcePreview(null);}} onError={()=>setFailedSourcePreview(sourcePreviewUrl)} className={`object-contain ${sourcePreviewState === "loaded" ? "opacity-100" : "opacity-0"}`}/>
            {sourcePreviewState === "loading" ? <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-black/55"><span className="flex items-center gap-2"><LoaderCircle className="animate-spin" size={16}/>กำลังโหลดภาพหน้าต้นฉบับ…</span></div> : null}
            {sourcePreviewState === "error" ? <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[#a83226]"><span>ไม่สามารถโหลดภาพ Render ของหน้านี้ได้<br/><button type="button" className="mt-3 underline" onClick={()=>setSourcePreviewAttempt((attempt)=>attempt+1)}>ลองโหลดภาพอีกครั้ง</button></span></div> : null}
          </> : <div className="grid h-full place-items-center px-6 text-center text-sm text-black/50">{detail.job.security_status === "PENDING" ? "รอตรวจความปลอดภัยด้วย qpdf และ ClamAV ก่อนเปิดเอกสาร" : detail.job.security_status === "REJECTED" ? "เอกสารถูกกักกันเนื่องจากไม่ผ่านการตรวจความปลอดภัย" : selectedPage?.status === "FAILED" ? "หน้านี้ประมวลผลไม่สำเร็จ จึงยังไม่มีภาพ Render" : "ยังไม่มีภาพ Render ของหน้าที่เลือก"}</div>}
        </div>
        <div className="border-t border-black/10 p-3">{detail.sourceUrl ? <a className="v14-button v14-button--outline w-full justify-center" href={detail.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>เปิด PDF ต้นฉบับทั้งไฟล์ในแท็บใหม่</a> : <p className="text-center text-xs text-black/50">ลิงก์ PDF ต้นฉบับจะพร้อมหลังเอกสารผ่านการตรวจความปลอดภัย</p>}</div>
      </div>
      <div className="space-y-3">
        <div className="max-h-48 overflow-auto border border-black/10">{detail.rows.map((row)=><button type="button" key={row.id} onClick={()=>{setSelectedId(row.id);setDraft(draftFrom(row));}} className={`grid w-full grid-cols-[auto_1fr_auto] gap-2 border-b border-black/10 p-3 text-left text-xs ${selected?.id===row.id?"bg-black/[.05]":""}`}><span>หน้า {row.source_page_number ?? "—"}</span><strong>{row.sku || "ไม่มี SKU"} · {row.name_th_draft || row.name_en || row.name_zh || "ไม่มีชื่อ"}</strong><span>{row.validation_status}</span></button>)}</div>
        {selected ? <div className="space-y-3 border border-black/10 p-4">
          {selected.existing_product_id ? <p className="flex items-center gap-2 text-sm text-[#a83226]"><AlertTriangle size={15}/>SKU ซ้ำ — <Link className="underline" href={`/admin/catalog/products/${selected.existing_product_id}`}>เปิดสินค้าที่มีอยู่</Link></p> : null}
          {selected.warning_codes?.length ? <div className="text-xs text-[#8a5b16]">คำเตือน: {selected.warning_codes.join(", ")}</div> : null}
          <section aria-label="รูป Candidate ของรายการนี้" className="rounded border border-black/10 bg-black/[.02] p-3"><div className="mb-2 flex items-center justify-between gap-2"><strong className="text-sm">รูป Candidate ของรายการนี้</strong><span className="text-xs text-black/50">เลือก 1 รูปก่อนอนุมัติ</span></div>{selectedCandidateImages.length ? <div className="flex gap-3 overflow-auto pb-1">{selectedCandidateImages.map((image,index)=><button type="button" aria-label={`เลือกรูป Candidate ${index+1}`} key={image.file_id} onClick={()=>setDraft({...draft,selectedImageFileId:image.file_id})} className={`shrink-0 border-2 p-1 ${draft.selectedImageFileId===image.file_id?"border-black bg-white":"border-transparent bg-white"}`}><Image unoptimized width={144} height={144} alt={`รูป Candidate ${index+1}`} className="h-36 w-36 object-contain" src={`/api/admin/catalog/imports/${detail.job.id}/rows/${selected.id}/images/${image.file_id}`}/><span className="mt-1 block text-center text-[11px] text-black/55">ความมั่นใจ {image.confidence == null ? "—" : `${Math.round(Number(image.confidence)*100)}%`}</span></button>)}</div> : <p className="py-5 text-center text-sm text-black/50">ไม่พบรูป Candidate สำหรับสินค้านี้</p>}</section>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="SKU" value={draft.sku} onChange={(value)=>setDraft({...draft,sku:value})}/><Field label="Factory SKU" value={draft.factorySku} onChange={(value)=>setDraft({...draft,factorySku:value})}/>
            <Field label="ชื่อไทย (ร่าง ต้องตรวจ)" value={draft.nameThDraft} onChange={(value)=>setDraft({...draft,nameThDraft:value})}/><Field label="ชื่ออังกฤษ" value={draft.nameEn} onChange={(value)=>setDraft({...draft,nameEn:value})}/><Field label="ชื่อจีน" value={draft.nameZh} onChange={(value)=>setDraft({...draft,nameZh:value})}/>
            <Choice label="ประเภท" value={draft.productType} options={[["","ต้องเลือก"],["STANDARD","Standard"],["CUSTOM_TEMPLATE","Custom template"],["READY_TO_ORDER","Ready to order"],["BUILT_IN","Built-in"],["MATERIAL","Material"],["EQUIPMENT","Equipment"],["DECORATIVE","Decorative"]]} onChange={(value)=>setDraft({...draft,productType:value})}/>
            <Choice label="หมวดสินค้า" value={draft.categoryId} options={[["","ยังไม่ระบุ"],...(detail.categories??[]).map((category)=>[category.id,`${category.code} — ${category.name_th||category.name_en||"ไม่ระบุชื่อ"}`])]} onChange={(value)=>setDraft({...draft,categoryId:value})}/>
            <Choice label="ประเทศ" value={draft.countryCode} options={[["","ต้องเลือก"],...(detail.countries??[]).map((country)=>[country.code,country.name_th||country.name_en||country.code])]} onChange={(value)=>setDraft({...draft,countryCode:value})}/>
            <Field label="Lead time (วัน)" type="number" value={draft.leadTimeDays} onChange={(value)=>setDraft({...draft,leadTimeDays:value})}/><Field label="MOQ" type="number" value={draft.moq} onChange={(value)=>setDraft({...draft,moq:value})}/>
            <Field label="กว้าง (มม.)" type="number" value={draft.widthMm} onChange={(value)=>setDraft({...draft,widthMm:value})}/><Field label="ลึก (มม.)" type="number" value={draft.depthMm} onChange={(value)=>setDraft({...draft,depthMm:value})}/><Field label="สูง (มม.)" type="number" value={draft.heightMm} onChange={(value)=>setDraft({...draft,heightMm:value})}/><Field label="น้ำหนัก (กก.)" type="number" value={draft.weightKg} onChange={(value)=>setDraft({...draft,weightKg:value})}/><Field label="CBM" type="number" value={draft.cbm} onChange={(value)=>setDraft({...draft,cbm:value})}/>
            <Field label="วัสดุ" value={draft.materialSummary} onChange={(value)=>setDraft({...draft,materialSummary:value})}/><Field label="ผิวสำเร็จ" value={draft.finishSummary} onChange={(value)=>setDraft({...draft,finishSummary:value})}/><Field label="คำอธิบาย" value={draft.descriptionTh} onChange={(value)=>setDraft({...draft,descriptionTh:value})}/><Field label="Specification" value={draft.specificationSummary} onChange={(value)=>setDraft({...draft,specificationSummary:value})}/>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" className="v14-button v14-button--outline" disabled={busy||selected.validation_status==="IMPORTED"} onClick={()=>void run(()=>action(`/api/admin/catalog/imports/${detail.job.id}/rows/${selected.id}`,patchFromDraft(draft)),"บันทึกร่างแล้ว") }><Save size={14}/>บันทึก</button><button type="button" className="v14-button v14-button--dark" disabled={busy||!!selected.existing_product_id||selected.validation_status==="IMPORTED"} onClick={()=>void decide("APPROVE")}><Check size={14}/>ตรวจแล้วและอนุมัติ</button><button type="button" className="v14-button v14-button--outline" disabled={busy||selected.validation_status==="IMPORTED"} onClick={()=>void decide("REJECT")}><X size={14}/>ปฏิเสธ</button>{selected.product_id?<Link className="v14-button v14-button--outline" href={`/admin/catalog/products/${selected.product_id}`}><ExternalLink size={14}/>เปิด Draft</Link>:null}</div>
        </div> : <p className="text-sm text-black/50">ยังไม่มี Candidate</p>}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2"><label className="text-sm"><input type="checkbox" checked={approvable.length>0&&checked.length===approvable.length} onChange={(event)=>setChecked(event.target.checked?approvable.map((row)=>row.id):[])}/> เลือกรายการที่ผ่านการตรวจทั้งหมดในหน้านี้ ({approvable.length})</label><button type="button" className="v14-button v14-button--dark" disabled={!canManage||!checked.length||busy||detail.job.status!=="READY_FOR_REVIEW"} onClick={()=>void confirmSelected()}><Check size={14}/>สร้าง Draft {checked.length} รายการ</button>{["FAILED","READY_FOR_REVIEW"].includes(detail.job.status)&&detail.pages?.some((page)=>page.status==="FAILED")?<button type="button" className="v14-button v14-button--outline" disabled={busy} onClick={()=>void run(()=>action(`/api/admin/catalog/imports/${detail.job.id}/retry`),"ส่งหน้าที่ล้มเหลวกลับเข้าคิวแล้ว")}><RotateCcw size={14}/>Retry หน้าที่ล้มเหลว</button>:null}{["QUEUED","EXTRACTING","NORMALIZING","READY_FOR_REVIEW"].includes(detail.job.status)?<button type="button" className="v14-button v14-button--outline" disabled={busy} onClick={()=>void run(()=>action(`/api/admin/catalog/imports/${detail.job.id}/cancel`),"ยกเลิกงาน PDF แล้ว")}><X size={14}/>ยกเลิกงาน</button>:null}</div>
    {detail.pagination&&detail.pagination.totalPages>1?<div className="flex items-center justify-end gap-2"><button type="button" className="v14-button v14-button--outline" disabled={busy||detail.pagination.page<=1} onClick={()=>void onPage(detail.pagination!.page-1)}>ก่อนหน้า</button><span className="text-sm">หน้า {detail.pagination.page}/{detail.pagination.totalPages}</span><button type="button" className="v14-button v14-button--outline" disabled={busy||detail.pagination.page>=detail.pagination.totalPages} onClick={()=>void onPage(detail.pagination!.page+1)}>ถัดไป</button></div>:null}
    {excelRoundtripEnabled&&["READY_FOR_REVIEW","COMPLETED","COMPLETED_WITH_ISSUES"].includes(detail.job.status)?<CatalogEnrichmentPanel jobId={detail.job.id} initialBatchId={detail.enrichmentBatch?.id??null} canManage={canManage} canReadCosts={canReadCosts} canManageCosts={canManageCosts} onNotice={onNotice}/>:null}
  </section>;
}

function Field({label,value,onChange,type="text"}:{label:string;value:string;onChange:(value:string)=>void;type?:"text"|"number"}) { return <label className="text-sm">{label}<input type={type} min={type==="number"?0:undefined} step={type==="number"?"any":undefined} value={value} onChange={(event)=>onChange(event.target.value)}/></label>; }
function Choice({label,value,options,onChange}:{label:string;value:string;options:string[][];onChange:(value:string)=>void}) { return <label className="text-sm">{label}<select value={value} onChange={(event)=>onChange(event.target.value)}>{options.map(([key,text])=><option key={key||"empty"} value={key}>{text}</option>)}</select></label>; }
function Metric({label,value}:{label:string;value:string}) { return <article className="border border-black/10 p-3"><span className="block text-xs text-black/55">{label}</span><strong>{value}</strong></article>; }
