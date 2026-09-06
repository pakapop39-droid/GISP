/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import {
  ArrowLeft, BadgeCheck, Check, CircleAlert, ExternalLink, FileText, ImagePlus,
  LoaderCircle, PackageCheck, Plus, RefreshCw, Save, Send, ShieldCheck, Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Product = Record<string, unknown> & {
  id: string; supplier_id: string; category_id?: string | null; sku: string; factory_sku?: string | null;
  name_th: string; name_en?: string | null; name_zh?: string | null; product_type: string; country_code: string;
  description_th?: string | null; specification_summary?: string | null; default_lead_time_days?: number | null;
  width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null; weight_kg?: number | null;
  cbm?: number | null; material_summary?: string | null; finish_summary?: string | null; moq?: number | null;
  source_catalog_page?: string | null; ordering_note?: string | null; status: string; qa_status: string;
  supplier_product_code?: string | null; source_row_number?: number | null; source_specification_raw?: string | null;
  review_note?: string | null; updated_at: string;
};
type Variant = { id: string; sku: string; factory_sku?: string | null; name: string; specification_summary?: string | null; width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null; weight_kg?: number | null; cbm?: number | null; material_summary?: string | null; finish_summary?: string | null; moq?: number | null; status: string };
type OptionValue = { id: string; option_id: string; label: string; member_price_delta: number; factory_cost_delta: number; status: string; sort_order: number };
type ProductOption = { id: string; name: string; is_required: boolean; sort_order: number; values: OptionValue[] };
type FileMeta = { id: string; original_name: string; mime_type?: string | null; size_bytes?: number | null };
type Media = { id: string; file_id: string; is_primary: boolean; previewUrl?: string | null; file?: FileMeta | null };
type Document = { id: string; file_id: string; document_type: string; source_page?: string | null; is_member_visible: boolean; file?: FileMeta | null };
type Detail = { product: Product; supplier: { id: string; code: string; name: string; status: string; default_currency: string } | null; category: { id: string; code: string; name_th: string } | null; variants: Variant[]; options: ProductOption[]; media: Media[]; documents: Document[] };
type ValidationIssue = { code: string; field: string; message: string; section: "MASTER" | "VARIANT" | "MEDIA" | "PRICE" };
type Validation = { blockingCount: number; readyForReview: boolean; readyForPublish: boolean; status: string; qaStatus: string; issues: ValidationIssue[] };
type Supplier = { id: string; code: string; name: string; status: string };
type Options = { countries: Array<{ code: string; name_th: string }>; categories: Array<{ id: string; code: string; name_th: string }> };
type Tab = "detail" | "variants" | "files" | "review";
type ApiBody<T> = { data: T; message?: string };

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiBody<T>> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as { data?: T; message?: string };
  if (!response.ok) throw new Error(body.message ?? "ระบบไม่สามารถทำรายการได้");
  return body as ApiBody<T>;
}
const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const nullable = (form: FormData, name: string) => value(form, name) || null;
const numberOrNull = (form: FormData, name: string) => value(form, name) ? Number(value(form, name)) : null;
const bytes = (size?: number | null) => size ? `${(size / 1024 / 1024).toFixed(2)} MB` : "—";
const moneyValue = (amount: number) => `${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount))} THB`;

export function ProductDetailWorkspace({ productId, canManage, canPublish }: { productId: string; canManage: boolean; canPublish: boolean }) {
  const [detail, setDetail] = useState<Detail>();
  const [validation, setValidation] = useState<Validation>();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [options, setOptions] = useState<Options>({ countries: [], categories: [] });
  const [tab, setTab] = useState<Tab>("detail");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ kind: "good" | "bad"; text: string }>();
  const [editingVariant, setEditingVariant] = useState<Variant>();
  const [editingOption, setEditingOption] = useState<ProductOption>();
  const [editingOptionValue, setEditingOptionValue] = useState<{ optionId: string; value: OptionValue }>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (keepNotice = false) => {
    setLoading(true);
    if (!keepNotice) setNotice(undefined);
    try {
      const [detailBody, validationBody, supplierBody, optionBody] = await Promise.all([
        requestJson<Detail>(`/api/admin/products/${productId}`),
        requestJson<Validation>(`/api/admin/products/${productId}/validation`),
        requestJson<Supplier[]>("/api/admin/suppliers"),
        requestJson<Options>("/api/admin/catalog-options"),
      ]);
      setDetail(detailBody.data); setValidation(validationBody.data); setSuppliers(supplierBody.data); setOptions(optionBody.data);
    } catch (error) { setNotice({ kind: "bad", text: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ" }); }
    finally { setLoading(false); }
  }, [productId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const editable = canManage && detail?.product.status !== "PUBLISHED";
  const issueCounts = useMemo(() => new Map(["MASTER", "VARIANT", "MEDIA", "PRICE"].map(section => [section, validation?.issues.filter(issue => issue.section === section).length ?? 0])), [validation]);

  async function run(name: string, url: string, init: RequestInit, successTab?: Tab) {
    setBusy(name); setNotice(undefined);
    try {
      const body = await requestJson<unknown>(url, init);
      setNotice({ kind: "good", text: body.message ?? "บันทึกแล้ว" });
      if (successTab) setTab(successTab);
      await load(true);
    } catch (error) { setNotice({ kind: "bad", text: error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ" }); }
    finally { setBusy(""); }
  }

  async function saveDetail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run("detail", `/api/admin/products/${productId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      supplierId: value(form, "supplierId"), categoryId: nullable(form, "categoryId"), sku: value(form, "sku"), factorySku: nullable(form, "factorySku"),
      nameTh: value(form, "nameTh"), nameEn: nullable(form, "nameEn"), nameZh: nullable(form, "nameZh"), productType: value(form, "productType"),
      countryCode: value(form, "countryCode"), descriptionTh: nullable(form, "descriptionTh"), specificationSummary: nullable(form, "specificationSummary"),
      defaultLeadTimeDays: numberOrNull(form, "leadDays"), widthMm: numberOrNull(form, "widthMm"), depthMm: numberOrNull(form, "depthMm"),
      heightMm: numberOrNull(form, "heightMm"), weightKg: numberOrNull(form, "weightKg"), cbm: numberOrNull(form, "cbm"),
      materialSummary: nullable(form, "materialSummary"), finishSummary: nullable(form, "finishSummary"), moq: numberOrNull(form, "moq"),
      sourceCatalogPage: nullable(form, "sourceCatalogPage"), orderingNote: nullable(form, "orderingNote"),
    }) }, "variants");
  }

  async function saveVariant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run("variant", `/api/admin/products/${productId}/variants`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      variantId: editingVariant?.id ?? null, sku: value(form, "sku"), factorySku: nullable(form, "factorySku"), name: value(form, "name"),
      specificationSummary: nullable(form, "specificationSummary"), widthMm: numberOrNull(form, "widthMm"), depthMm: numberOrNull(form, "depthMm"),
      heightMm: numberOrNull(form, "heightMm"), weightKg: numberOrNull(form, "weightKg"), cbm: numberOrNull(form, "cbm"),
      materialSummary: nullable(form, "materialSummary"), finishSummary: nullable(form, "finishSummary"), moq: numberOrNull(form, "moq"),
    }) });
    setEditingVariant(undefined);
  }

  async function saveSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run("source", `/api/admin/products/${productId}/source`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      supplierProductCode: nullable(form, "supplierProductCode"), sourceRowNumber: numberOrNull(form, "sourceRowNumber"),
      sourceSpecificationRaw: nullable(form, "sourceSpecificationRaw"),
    }) });
  }

  async function saveOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run("option", `/api/admin/products/${productId}/options`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      optionId: editingOption?.id ?? null, name: value(form, "name"), isRequired: form.get("isRequired") === "true",
    }) });
    setEditingOption(undefined);
  }

  async function saveOptionValue(event: React.FormEvent<HTMLFormElement>, optionId: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const current = editingOptionValue?.optionId === optionId ? editingOptionValue.value : undefined;
    await run("option-value", `/api/admin/products/${productId}/options/${optionId}/values`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      optionValueId: current?.id ?? null, label: value(form, "label"), memberPriceDelta: Number(value(form, "memberPriceDelta") || 0),
      factoryCostDelta: Number(value(form, "factoryCostDelta") || 0),
    }) });
    setEditingOptionValue(undefined);
  }

  async function uploadFile(event: React.FormEvent<HTMLFormElement>, kind: "IMAGE" | "DOCUMENT") {
    event.preventDefault(); const form = new FormData(event.currentTarget); form.set("kind", kind);
    setBusy(`file-${kind}`); setNotice(undefined);
    try {
      const response = await fetch(`/api/admin/products/${productId}/files`, { method: "POST", body: form });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "อัปโหลดไม่สำเร็จ");
      event.currentTarget.reset(); setNotice({ kind: "good", text: body.message ?? "อัปโหลดแล้ว" }); await load(true);
    } catch (error) { setNotice({ kind: "bad", text: error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ" }); }
    finally { setBusy(""); }
  }

  if (loading && !detail) return <div className="catalog-loading"><LoaderCircle className="animate-spin" size={18}/>กำลังโหลด Product Detail</div>;
  if (!detail) return <div className="v14-empty">{notice?.text ?? "ไม่พบสินค้า"}</div>;
  const p = detail.product;

  return <div className="product-detail">
    <header className="product-detail__hero">
      <div><Link href="/admin/catalog" className="product-detail__back"><ArrowLeft size={13}/>Catalog</Link><p className="v14-eyebrow">Product Operations</p><h1>{p.name_th}</h1><p>{p.sku} · {detail.supplier?.name ?? "ไม่พบ Supplier"}</p></div>
      <div className="product-detail__state"><Status value={p.status}/><Status value={p.qa_status}/><button className="v14-button v14-button--outline" onClick={() => void load()} disabled={loading}><RefreshCw size={13}/>โหลดใหม่</button></div>
    </header>
    {notice && <div className={`catalog-notice catalog-notice--${notice.kind}`}>{notice.kind === "good" ? <Check size={14}/> : <CircleAlert size={14}/>} {notice.text}</div>}
    <div className="product-readiness">
      <Readiness label="ข้อมูลหลัก" count={issueCounts.get("MASTER") ?? 0}/><Readiness label="Variant" count={issueCounts.get("VARIANT") ?? 0}/>
      <Readiness label="รูปภาพ" count={issueCounts.get("MEDIA") ?? 0}/><Readiness label="ต้นทุนและราคา" count={issueCounts.get("PRICE") ?? 0}/>
      <div className={validation?.blockingCount === 0 ? "ready" : "pending"}><small>พร้อมส่งตรวจ</small><strong>{validation?.blockingCount === 0 ? "พร้อม" : `ขาด ${validation?.blockingCount} จุด`}</strong></div>
    </div>
    <nav className="catalog-tabs product-tabs">
      <button className={tab === "detail" ? "active" : ""} onClick={() => setTab("detail")}>01 Product Detail</button>
      <button className={tab === "variants" ? "active" : ""} onClick={() => setTab("variants")}>02 Variant & Option ({detail.variants.length + detail.options.length})</button>
      <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>03 รูปและเอกสาร ({detail.media.length + detail.documents.length})</button>
      <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>04 Review / Publish</button>
    </nav>

    {tab === "detail" && <div className="product-master-layout"><form className="v14-panel catalog-form" key={`master-${p.updated_at}`} onSubmit={saveDetail}>
      <PanelHead eyebrow="Master data" title="รายละเอียดสินค้า" note="* คือข้อมูลสำคัญก่อนส่งตรวจ"/>
      <fieldset disabled={!editable || busy === "detail"}>
        <div className="v14-grid v14-grid--2"><Select name="supplierId" label="Supplier *" defaultValue={p.supplier_id} options={suppliers.map(item => [item.id, `${item.code} — ${item.name} (${item.status})`])}/><Select name="categoryId" label="หมวดสินค้า *" defaultValue={p.category_id ?? ""} options={[["", "เลือกหมวดสินค้า"], ...options.categories.map(item => [item.id, `${item.code} — ${item.name_th}`])]}/></div>
        {detail.supplier?.status !== "ACTIVE" && editable && <div className="product-inline-warning"><CircleAlert size={14}/><span>Supplier ยังเป็น {detail.supplier?.status ?? "UNKNOWN"} ต้องเปิดใช้ก่อนส่งตรวจ</span><button type="button" className="v14-button v14-button--small" onClick={() => void run("supplier", `/api/admin/suppliers/${p.supplier_id}/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) })}>เปิดใช้ Supplier</button></div>}
        <div className="v14-grid v14-grid--2"><Field name="sku" label="SKU *" defaultValue={p.sku}/><Field name="factorySku" label="Factory SKU" defaultValue={p.factory_sku}/></div>
        <div className="v14-grid v14-grid--2"><Field name="nameTh" label="ชื่อไทย *" defaultValue={p.name_th}/><Field name="nameEn" label="ชื่ออังกฤษ" defaultValue={p.name_en}/></div>
        <div className="v14-grid v14-grid--2"><Field name="nameZh" label="ชื่อจีน" defaultValue={p.name_zh}/><Select name="productType" label="ประเภทสินค้า *" defaultValue={p.product_type} options={[["STANDARD","Standard"],["CUSTOM_TEMPLATE","Custom Template"],["READY_TO_ORDER","Ready to Order"],["BUILT_IN","Built-in"],["MATERIAL","Material"],["EQUIPMENT","Equipment"],["DECORATIVE","Decorative"]]}/></div>
        <div className="v14-grid v14-grid--2"><Select name="countryCode" label="ประเทศต้นทาง *" defaultValue={p.country_code} options={options.countries.map(item => [item.code, `${item.code} — ${item.name_th}`])}/><Field name="leadDays" type="number" min="1" label="Lead time (วัน) *" defaultValue={p.default_lead_time_days}/></div>
        <Area name="descriptionTh" label="รายละเอียดสินค้า *" defaultValue={p.description_th}/><Area name="specificationSummary" label="สเปกสินค้า *" defaultValue={p.specification_summary}/>
        <div className="product-measurements"><Field name="widthMm" type="number" min="0" step="0.01" label="กว้าง (mm)" defaultValue={p.width_mm}/><Field name="depthMm" type="number" min="0" step="0.01" label="ลึก (mm)" defaultValue={p.depth_mm}/><Field name="heightMm" type="number" min="0" step="0.01" label="สูง (mm)" defaultValue={p.height_mm}/><Field name="weightKg" type="number" min="0" step="0.001" label="น้ำหนัก (kg)" defaultValue={p.weight_kg}/><Field name="cbm" type="number" min="0" step="0.0001" label="CBM" defaultValue={p.cbm}/><Field name="moq" type="number" min="0" step="0.01" label="MOQ" defaultValue={p.moq}/></div>
        <div className="v14-grid v14-grid--2"><Area name="materialSummary" label="วัสดุหลัก *" defaultValue={p.material_summary}/><Area name="finishSummary" label="สี / Finish" defaultValue={p.finish_summary}/></div>
        <div className="v14-grid v14-grid--2"><Field name="sourceCatalogPage" label="หน้าอ้างอิง Catalog" defaultValue={p.source_catalog_page}/><Field name="orderingNote" label="หมายเหตุสั่งซื้อ" defaultValue={p.ordering_note}/></div>
        <button className="v14-button v14-button--dark" disabled={!editable || busy === "detail"}>{busy === "detail" ? <LoaderCircle className="animate-spin" size={14}/> : <Save size={14}/>}บันทึกและไป Variant</button>
      </fieldset>{!editable && <PermissionNote text={p.status === "PUBLISHED" ? "สินค้าที่ Publish แล้วต้องถอน Publish ก่อนแก้ไข" : "บัญชีนี้ไม่มีสิทธิ์แก้ Product"} />}
    </form>
    <form className="v14-panel catalog-form product-source-card" key={`source-${p.updated_at}`} onSubmit={saveSource}>
      <PanelHead eyebrow="Supplier source" title="ข้อมูลอ้างอิงจาก Supplier" note="รองรับตาราง CN01 และใช้ตรวจรายการซ้ำ"/>
      <fieldset disabled={!editable || busy === "source"}>
        <div className="v14-grid v14-grid--2"><Field name="supplierProductCode" label="รหัสสินค้าจาก Supplier" defaultValue={p.supplier_product_code}/><Field name="sourceRowNumber" type="number" min="1" label="แถวต้นทาง" defaultValue={p.source_row_number}/></div>
        <Area name="sourceSpecificationRaw" label="สเปกต้นฉบับจาก Supplier" defaultValue={p.source_specification_raw}/>
        <p className="product-source-help">ข้อมูลส่วนนี้เก็บข้อความต้นฉบับไว้ตรวจสอบ ส่วนชื่อไทย สเปก และ Variant ด้านบนสามารถปรับก่อน Publish ได้</p>
        <button className="v14-button v14-button--outline" disabled={!editable || busy === "source"}>{busy === "source" ? <LoaderCircle className="animate-spin" size={14}/> : <Save size={14}/>}บันทึกข้อมูลต้นทาง</button>
      </fieldset>
    </form></div>}

    {tab === "variants" && <div className="product-choice-workspace"><div className="catalog-split product-variant-layout">
      <form className="v14-panel catalog-form" key={editingVariant?.id ?? "new"} onSubmit={saveVariant}><PanelHead eyebrow="Sellable choice" title={editingVariant ? "แก้ไข Variant" : "เพิ่ม Variant"} note="ต้องมี Active อย่างน้อย 1 รายการ"/><fieldset disabled={!editable || busy === "variant"}>
        <div className="v14-grid v14-grid--2"><Field name="sku" label="Variant SKU *" defaultValue={editingVariant?.sku ?? `${p.sku}-`}/><Field name="factorySku" label="Factory SKU" defaultValue={editingVariant?.factory_sku}/></div><Field name="name" label="ชื่อ Variant *" defaultValue={editingVariant?.name}/><Area name="specificationSummary" label="สเปก Variant" defaultValue={editingVariant?.specification_summary}/>
        <div className="product-measurements product-measurements--variant"><Field name="widthMm" type="number" min="0" step="0.01" label="กว้าง" defaultValue={editingVariant?.width_mm}/><Field name="depthMm" type="number" min="0" step="0.01" label="ลึก" defaultValue={editingVariant?.depth_mm}/><Field name="heightMm" type="number" min="0" step="0.01" label="สูง" defaultValue={editingVariant?.height_mm}/><Field name="weightKg" type="number" min="0" step="0.001" label="kg" defaultValue={editingVariant?.weight_kg}/><Field name="cbm" type="number" min="0" step="0.0001" label="CBM" defaultValue={editingVariant?.cbm}/><Field name="moq" type="number" min="0" step="0.01" label="MOQ" defaultValue={editingVariant?.moq}/></div>
        <div className="v14-grid v14-grid--2"><Field name="materialSummary" label="วัสดุ" defaultValue={editingVariant?.material_summary}/><Field name="finishSummary" label="Finish" defaultValue={editingVariant?.finish_summary}/></div>
        <div className="v14-actions"><button className="v14-button v14-button--dark"><Plus size={14}/>{editingVariant ? "บันทึก Variant" : "เพิ่ม Variant"}</button>{editingVariant && <button type="button" className="v14-button v14-button--outline" onClick={() => setEditingVariant(undefined)}>ยกเลิก</button>}</div>
      </fieldset></form>
      <div className="v14-panel"><PanelHead eyebrow="Variant list" title="รายการ Variant" note={`${detail.variants.filter(item => item.status === "ACTIVE").length} Active`}/><div className="product-variant-list">{detail.variants.map(item => <article key={item.id}><div><strong>{item.sku}</strong><span>{item.name}</span><small>{[item.width_mm, item.depth_mm, item.height_mm].every(Boolean) ? `${item.width_mm} × ${item.depth_mm} × ${item.height_mm} mm` : "ยังไม่ระบุขนาดครบ"}</small></div><Status value={item.status}/><div className="v14-actions"><button className="v14-button v14-button--small v14-button--outline" disabled={!editable} onClick={() => setEditingVariant(item)}>แก้ไข</button><button className="v14-button v14-button--small v14-button--outline" disabled={!editable} onClick={() => void run(`variant-${item.id}`, `/api/admin/products/${productId}/variants/${item.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) })}>{item.status === "ACTIVE" ? "พักใช้" : "เปิดใช้"}</button></div></article>)}{!detail.variants.length && <div className="v14-empty">ยังไม่มี Variant</div>}</div></div>
    </div>
    <section className="product-options-section">
      <form className="v14-panel catalog-form product-option-form" key={editingOption?.id ?? "new-option"} onSubmit={saveOption}>
        <PanelHead eyebrow="Configurable choice" title={editingOption ? "แก้ไข Option" : "เพิ่ม Option"} note="เช่น สี/วัสดุ หรือเกรดผ้า"/>
        <fieldset disabled={!editable || busy === "option"}>
          <Field name="name" label="ชื่อ Option *" placeholder="สี/วัสดุ" defaultValue={editingOption?.name}/>
          <label className="catalog-check product-option-required"><input name="isRequired" type="checkbox" value="true" defaultChecked={editingOption?.is_required}/> สมาชิกต้องเลือกก่อนสั่งซื้อ</label>
          <div className="v14-actions"><button className="v14-button v14-button--dark"><Plus size={14}/>{editingOption ? "บันทึก Option" : "เพิ่ม Option"}</button>{editingOption && <button type="button" className="v14-button v14-button--outline" onClick={() => setEditingOption(undefined)}>ยกเลิก</button>}</div>
        </fieldset>
      </form>
      <div className="product-option-list">
        {detail.options.map(option => {
          const editingValue = editingOptionValue?.optionId === option.id ? editingOptionValue.value : undefined;
          return <article className="v14-panel product-option-card" key={option.id}>
            <header><div><p className="v14-eyebrow">Product option</p><h3>{option.name}</h3><span>{option.is_required ? "ต้องเลือก" : "ไม่บังคับ"} · {option.values.filter(item => item.status === "ACTIVE").length} Active</span></div><button className="v14-button v14-button--small v14-button--outline" disabled={!editable} onClick={() => setEditingOption(option)}>แก้ชื่อ</button></header>
            <div className="product-option-values">{option.values.map(item => <div key={item.id}><span><strong>{item.label}</strong><small>เพิ่มราคาสมาชิก {moneyValue(item.member_price_delta)} · เพิ่มต้นทุน {moneyValue(item.factory_cost_delta)}</small></span><Status value={item.status}/><div className="v14-actions"><button className="v14-button v14-button--small v14-button--outline" disabled={!editable} onClick={() => setEditingOptionValue({ optionId: option.id, value: item })}>แก้ไข</button><button className="v14-button v14-button--small v14-button--outline" disabled={!editable} onClick={() => void run(`option-value-${item.id}`, `/api/admin/products/${productId}/options/${option.id}/values/${item.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) })}>{item.status === "ACTIVE" ? "พักใช้" : "เปิดใช้"}</button></div></div>)}{!option.values.length && <div className="v14-empty">ยังไม่มีค่าของ Option</div>}</div>
            <form className="catalog-form product-option-value-form" key={editingValue?.id ?? `new-value-${option.id}`} onSubmit={event => saveOptionValue(event, option.id)}><div className="product-option-value-grid"><Field name="label" label="ค่า Option *" placeholder="BK6699" defaultValue={editingValue?.label}/><Field name="memberPriceDelta" type="number" min="0" step="0.01" label="เพิ่มราคาสมาชิก (THB)" defaultValue={editingValue?.member_price_delta ?? 0}/><Field name="factoryCostDelta" type="number" min="0" step="0.01" label={`เพิ่มต้นทุน (${detail.supplier?.default_currency ?? "สกุลเงิน Supplier"})`} defaultValue={editingValue?.factory_cost_delta ?? 0}/></div><div className="v14-actions"><button className="v14-button v14-button--dark" disabled={!editable || busy === "option-value"}><Plus size={14}/>{editingValue ? "บันทึกค่า Option" : "เพิ่มค่า Option"}</button>{editingValue && <button type="button" className="v14-button v14-button--outline" onClick={() => setEditingOptionValue(undefined)}>ยกเลิก</button>}</div></form>
          </article>;
        })}
        {!detail.options.length && <div className="v14-panel v14-empty">ยังไม่มี Option — ตาราง Supplier CN01 ใช้ Option “สี/วัสดุ”</div>}
      </div>
    </section></div>}

    {tab === "files" && <div className="product-files">
      <div className="product-files__forms"><form className="v14-panel catalog-form" onSubmit={event => uploadFile(event, "IMAGE")}><PanelHead eyebrow="Private media" title="รูปสินค้า" note="JPEG, PNG, WebP · สูงสุด 12 รูป"/><fieldset disabled={!editable || busy === "file-IMAGE"}><label>เลือกไฟล์รูป<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required/></label><label className="catalog-check"><input name="isPrimary" type="checkbox" value="true"/> ตั้งเป็นรูปหลัก</label><button className="v14-button v14-button--dark"><ImagePlus size={14}/>อัปโหลดรูป</button></fieldset></form>
      <form className="v14-panel catalog-form" onSubmit={event => uploadFile(event, "DOCUMENT")}><PanelHead eyebrow="Source document" title="เอกสารสินค้า" note="PDF · สูงสุด 10 ไฟล์"/><fieldset disabled={!editable || busy === "file-DOCUMENT"}><label>เลือก PDF<input name="file" type="file" accept="application/pdf" required/></label><div className="v14-grid v14-grid--2"><Select name="documentType" label="ประเภท" options={[["CATALOG","Catalog"],["PRICE_LIST","Price list"],["SPECIFICATION","Specification"],["WARRANTY","Warranty"],["OTHER","Other"]]}/><Field name="sourcePage" label="หน้าอ้างอิง"/></div><label className="catalog-check"><input name="isMemberVisible" type="checkbox" value="true"/> อนุญาตให้สมาชิกเห็นเมื่อ Publish</label><button className="v14-button v14-button--dark"><Upload size={14}/>อัปโหลด PDF</button></fieldset></form></div>
      <section className="v14-panel"><PanelHead eyebrow="Image library" title="รูปสินค้า" note={`${detail.media.length} / 12`}/><div className="product-media-grid">{detail.media.map(item => <article key={item.id} className={item.is_primary ? "primary" : ""}>{item.previewUrl ? <img src={item.previewUrl} alt={item.file?.original_name ?? "Product"}/> : <div className="product-media-placeholder">Preview หมดอายุ</div>}<div><strong>{item.file?.original_name ?? "รูปสินค้า"}</strong><small>{bytes(item.file?.size_bytes)}</small></div>{item.is_primary ? <span className="product-primary"><Check size={11}/>รูปหลัก</span> : <button className="v14-button v14-button--small v14-button--outline" disabled={!editable} onClick={() => void run(`primary-${item.id}`, `/api/admin/products/${productId}/media/${item.id}/primary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) })}>ตั้งเป็นรูปหลัก</button>}</article>)}{!detail.media.length && <div className="v14-empty">ยังไม่มีรูปสินค้า</div>}</div></section>
      <section className="v14-panel"><PanelHead eyebrow="Documents" title="เอกสารแนบ" note={`${detail.documents.length} / 10`}/><div className="product-document-list">{detail.documents.map(item => <a key={item.id} href={`/api/admin/products/${productId}/files/${item.file_id}/download?redirect=1`} target="_blank" rel="noreferrer"><FileText size={16}/><span><strong>{item.file?.original_name ?? item.document_type}</strong><small>{item.document_type} · {bytes(item.file?.size_bytes)}{item.source_page ? ` · หน้า ${item.source_page}` : ""}</small></span><ExternalLink size={13}/></a>)}{!detail.documents.length && <div className="v14-empty">ยังไม่มีเอกสาร</div>}</div></section>
    </div>}

    {tab === "review" && <div className="product-review-grid">
      <section className="v14-panel"><PanelHead eyebrow="Backend validation" title="ผลตรวจความพร้อม" note={validation?.blockingCount ? `ต้องแก้ ${validation.blockingCount} จุด` : "ข้อมูลครบ"}/>{validation?.issues.length ? <div className="product-issues">{validation.issues.map(issue => <div key={issue.code}><CircleAlert size={15}/><span><strong>{issue.message}</strong><small>{issue.section} · {issue.code}</small></span></div>)}</div> : <div className="product-ready"><BadgeCheck size={26}/><strong>ข้อมูลพร้อมส่ง Review</strong><span>Backend ตรวจข้อมูลหลัก, Variant, รูป, ต้นทุนและราคาแล้ว</span></div>}<button className="v14-button v14-button--outline" onClick={() => void load()}><RefreshCw size={13}/>ตรวจอีกครั้ง</button></section>
      <section className="v14-panel product-review-action"><PanelHead eyebrow="Controlled transition" title="Review / Publish" note={`${p.status} · ${p.qa_status}`}/><Lifecycle current={p.status}/>
        {p.review_note && <div className="product-review-note"><strong>หมายเหตุจากผู้ตรวจ</strong><p>{p.review_note}</p></div>}
        {p.status === "DRAFT" && <><p>เมื่อข้อมูลครบ ผู้ดูแล Product ส่งเข้าคิว Review ได้</p><button className="v14-button v14-button--dark" disabled={!canManage || !validation?.readyForReview || !!busy} onClick={() => window.confirm("ยืนยันส่ง Product เข้าตรวจ?") && void run("submit-review", `/api/admin/products/${productId}/submit-review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) })}><Send size={14}/>ส่งเข้าตรวจ</button></>}
        {p.status === "REVIEW" && p.qa_status !== "PASSED" && <ReviewForm canPublish={canPublish} busy={busy} onSubmit={(decision, note) => run(`review-${decision}`, `/api/admin/products/${productId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note, confirmed: true }) })}/>} 
        {p.status === "REVIEW" && p.qa_status === "PASSED" && <><div className="product-ready product-ready--compact"><ShieldCheck size={21}/><strong>ผ่าน Review แล้ว</strong><span>พร้อม Publish เมื่อ Validation ยังผ่านครบ</span></div><button className="v14-button" disabled={!canPublish || !validation?.readyForPublish || !!busy} onClick={() => window.confirm("ยืนยัน Publish Product ให้สมาชิกเห็น?") && void run("publish", `/api/admin/products/${productId}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) })}><PackageCheck size={14}/>Publish Product</button></>}
        {p.status === "PUBLISHED" && <UnpublishForm canPublish={canPublish} busy={busy} onSubmit={note => run("unpublish", `/api/admin/products/${productId}/unpublish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, confirmed: true }) })}/>} 
        {!canPublish && p.status === "REVIEW" && <PermissionNote text="ต้องมีสิทธิ์ catalog.publish จึง Review หรือ Publish ได้"/>}
      </section>
    </div>}
  </div>;
}

function Field({ label, defaultValue, ...props }: { label: string; defaultValue?: unknown } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) { return <label>{label}<input {...props} defaultValue={defaultValue == null ? "" : String(defaultValue)}/></label>; }
function Area({ label, defaultValue, ...props }: { label: string; defaultValue?: unknown } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "defaultValue">) { return <label>{label}<textarea rows={3} {...props} defaultValue={defaultValue == null ? "" : String(defaultValue)}/></label>; }
function Select({ label, options, ...props }: { label: string; options: string[][] } & React.SelectHTMLAttributes<HTMLSelectElement>) { return <label>{label}<select {...props}>{options.map(([id, text]) => <option value={id} key={id}>{text}</option>)}</select></label>; }
function PanelHead({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) { return <div className="v14-panel__head"><div><p className="v14-eyebrow">{eyebrow}</p><h2>{title}</h2></div><small>{note}</small></div>; }
function Status({ value }: { value: string }) { const tone = ["ACTIVE","PASSED","PUBLISHED"].includes(value) ? "good" : ["DRAFT","PROSPECT","NOT_REVIEWED"].includes(value) ? "warn" : ["NEEDS_FIX","SUSPENDED","INACTIVE"].includes(value) ? "bad" : "info"; return <span className={`v14-status v14-status--${tone}`}>{value}</span>; }
function Readiness({ label, count }: { label: string; count: number }) { return <div className={count === 0 ? "ready" : "pending"}><small>{label}</small><strong>{count === 0 ? <><Check size={13}/>ครบ</> : `ขาด ${count}`}</strong></div>; }
function PermissionNote({ text }: { text: string }) { return <p className="catalog-permission-note">{text}</p>; }
function Lifecycle({ current }: { current: string }) { return <div className="product-lifecycle">{["DRAFT","REVIEW","PUBLISHED"].map((state, index) => <div className={state === current ? "active" : ""} key={state}><span>{index + 1}</span><strong>{state}</strong></div>)}</div>; }
function ReviewForm({ canPublish, busy, onSubmit }: { canPublish: boolean; busy: string; onSubmit: (decision: "PASSED" | "NEEDS_FIX", note: string) => Promise<void> }) { const [note, setNote] = useState(""); return <div className="product-review-form"><label>หมายเหตุผู้ตรวจ<textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="จำเป็นเมื่อส่งกลับแก้ไข"/></label><div className="v14-actions"><button className="v14-button v14-button--dark" disabled={!canPublish || !!busy} onClick={() => window.confirm("ยืนยันให้ Product ผ่าน Review?") && void onSubmit("PASSED", note)}><Check size={14}/>ผ่าน Review</button><button className="v14-button v14-button--outline" disabled={!canPublish || !note.trim() || !!busy} onClick={() => window.confirm("ยืนยันส่ง Product กลับแก้ไข?") && void onSubmit("NEEDS_FIX", note)}>ส่งกลับแก้ไข</button></div></div>; }
function UnpublishForm({ canPublish, busy, onSubmit }: { canPublish: boolean; busy: string; onSubmit: (note: string) => Promise<void> }) { const [note, setNote] = useState(""); return <div className="product-review-form"><div className="product-ready product-ready--compact"><PackageCheck size={21}/><strong>Product เผยแพร่แล้ว</strong><span>สมาชิกเห็นข้อมูลผ่าน Member Catalog</span></div><label>เหตุผลที่ถอน Publish<textarea rows={3} value={note} onChange={event => setNote(event.target.value)}/></label><button className="v14-button v14-button--outline" disabled={!canPublish || note.trim().length < 3 || !!busy} onClick={() => window.confirm("ยืนยันถอน Product ออกจาก Member Catalog?") && void onSubmit(note)}>ถอน Publish</button></div>; }
