/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Link2,
  LoaderCircle,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Supplier = { id: string; code: string; name: string; status: string };
type FinishCollection = {
  id: string; supplier_id: string; code: string; name_th: string; name_zh: string | null;
  material_category: string | null; source_document: string; source_version: string | null; status: string;
};
type Finish = {
  id: string; collection_id: string; code: string; name_th: string; name_zh: string | null;
  material: string | null; color_hex: string | null; swatch_file_id: string | null;
  source_document: string; source_page: string; metadata: Record<string, unknown>;
  status: string; swatchPreviewUrl: string | null;
};
type OptionTarget = {
  optionValueId: string; supplierId: string; productId: string; productSku: string;
  productName: string; productStatus: string; optionName: string; valueLabel: string; finishId: string | null;
};
type Library = { suppliers: Supplier[]; collections: FinishCollection[]; finishes: Finish[]; optionTargets: OptionTarget[] };

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as { data?: T; message?: string };
  if (!response.ok) throw new Error(body.message ?? "ระบบไม่สามารถทำรายการได้");
  return body as { data: T; message?: string };
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const nullable = (form: FormData, name: string) => text(form, name) || null;

export function FinishLibraryWorkspace({ canManage, canImport }: { canManage: boolean; canImport: boolean }) {
  const [library, setLibrary] = useState<Library>({ suppliers: [], collections: [], finishes: [], optionTargets: [] });
  const [editingCollection, setEditingCollection] = useState<FinishCollection>();
  const [editingFinish, setEditingFinish] = useState<Finish>();
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [selectedFinishId, setSelectedFinishId] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "good" | "bad"; text: string }>();

  const load = useCallback(async (keepNotice = false) => {
    setLoading(true);
    if (!keepNotice) setNotice(undefined);
    try {
      const body = await requestJson<Library>("/api/admin/catalog/finishes", { cache: "no-store" });
      setLibrary(body.data);
      setSelectedTargetId((current) => current || body.data.optionTargets[0]?.optionValueId || "");
    } catch (error) {
      setNotice({ kind: "bad", text: error instanceof Error ? error.message : "โหลดคลังสีไม่สำเร็จ" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function run(action: string, body: Record<string, unknown>, success: string) {
    setBusy(action);
    setNotice(undefined);
    try {
      const response = await requestJson<unknown>("/api/admin/catalog/finishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice({ kind: "good", text: response.message ?? success });
      await load(true);
      return true;
    } catch (error) {
      setNotice({ kind: "bad", text: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ" });
      return false;
    } finally {
      setBusy("");
    }
  }

  async function saveCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = editingCollection ? "UPDATE_COLLECTION" : "CREATE_COLLECTION";
    const done = await run(action, {
      action,
      ...(editingCollection ? { collectionId: editingCollection.id } : {}),
      supplierId: text(form, "supplierId"),
      code: text(form, "code"),
      nameTh: text(form, "nameTh"),
      nameZh: nullable(form, "nameZh"),
      materialCategory: nullable(form, "materialCategory"),
      sourceDocument: text(form, "sourceDocument"),
      sourceVersion: nullable(form, "sourceVersion"),
    }, "บันทึก Collection แล้ว");
    if (done) setEditingCollection(undefined);
  }

  async function saveFinish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = editingFinish ? "UPDATE_FINISH" : "CREATE_FINISH";
    const done = await run(action, {
      action,
      ...(editingFinish ? { finishId: editingFinish.id } : {}),
      collectionId: text(form, "collectionId"),
      code: text(form, "code"),
      nameTh: text(form, "nameTh"),
      nameZh: nullable(form, "nameZh"),
      material: nullable(form, "material"),
      colorHex: nullable(form, "colorHex"),
      sourceDocument: text(form, "sourceDocument"),
      sourcePage: text(form, "sourcePage"),
      metadata: {},
    }, "บันทึกสีแล้ว");
    if (done) setEditingFinish(undefined);
  }

  async function uploadSwatch(event: React.FormEvent<HTMLFormElement>, finishId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(`swatch-${finishId}`);
    setNotice(undefined);
    try {
      const response = await requestJson<unknown>(`/api/admin/catalog/finishes/${finishId}/swatch`, { method: "POST", body: form });
      formElement.reset();
      setNotice({ kind: "good", text: response.message ?? "อัปโหลดรูปแล้ว" });
      await load(true);
    } catch (error) {
      setNotice({ kind: "bad", text: error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ" });
    } finally {
      setBusy("");
    }
  }


  const collectionById = useMemo(() => new Map(library.collections.map((item) => [item.id, item])), [library.collections]);
  const selectedTarget = library.optionTargets.find((target) => target.optionValueId === selectedTargetId);
  const compatibleFinishes = library.finishes.filter((finish) => {
    const collection = collectionById.get(finish.collection_id);
    return finish.status === "ACTIVE" && collection?.status === "ACTIVE" && collection.supplier_id === selectedTarget?.supplierId;
  });

  if (loading && !library.collections.length) {
    return <div className="catalog-loading"><LoaderCircle className="animate-spin" size={18}/>กำลังโหลดคลังสี</div>;
  }

  return <div className="space-y-5">
    <section className="v14-hero"><div><Link href="/admin/catalog" className="product-detail__back"><ArrowLeft size={13}/>Catalog</Link><p className="v14-eyebrow">Shared finish library · Advanced</p><h1>คลังสีและผิวสำเร็จ</h1><p>จัดการชื่อ รูปสวอตช์ และการผูกสีกับ Option หลังนำเข้าข้อมูลจากหน้าหลัก</p><div className="mt-3">{canImport ? <Link className="v14-button v14-button--outline" href="/admin/catalog/imports">กลับไปนำเข้า Catalog</Link> : null}</div></div><button className="v14-button v14-button--outline" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/>โหลดใหม่</button></section>
    {notice ? <div className={`catalog-notice catalog-notice--${notice.kind}`} role="status">{notice.kind === "good" ? <Check size={15}/> : null}<span>{notice.text}</span></div> : null}

    <section className="grid gap-4 xl:grid-cols-2">
      <form className="v14-panel catalog-form" key={editingCollection?.id ?? "new-collection"} onSubmit={saveCollection}>
        <div className="v14-panel__head"><div><p className="v14-eyebrow">Collection</p><h2>{editingCollection ? "แก้ไข Collection" : "สร้าง Collection สี"}</h2></div><Palette size={20}/></div>
        <fieldset disabled={!canManage || !!busy}>
          <label>Supplier *<select name="supplierId" required disabled={Boolean(editingCollection)} defaultValue={editingCollection?.supplier_id}>{library.suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.code} — {supplier.name}</option>)}</select>{editingCollection ? <input type="hidden" name="supplierId" value={editingCollection.supplier_id}/> : null}</label>
          <div className="v14-grid v14-grid--2"><Field name="code" label="รหัส Collection *" defaultValue={editingCollection?.code}/><Field name="nameTh" label="ชื่อไทย *" defaultValue={editingCollection?.name_th}/></div>
          <div className="v14-grid v14-grid--2"><Field name="nameZh" label="ชื่อจีน" defaultValue={editingCollection?.name_zh}/><Field name="materialCategory" label="กลุ่มวัสดุ" defaultValue={editingCollection?.material_category}/></div>
          <div className="v14-grid v14-grid--2"><Field name="sourceDocument" label="เอกสารต้นทาง *" defaultValue={editingCollection?.source_document}/><Field name="sourceVersion" label="เวอร์ชันเอกสาร" defaultValue={editingCollection?.source_version}/></div>
          <div className="v14-actions"><button className="v14-button v14-button--dark"><Plus size={14}/>{editingCollection ? "บันทึกการแก้ไข" : "สร้าง Draft"}</button>{editingCollection ? <button type="button" className="v14-button v14-button--outline" onClick={() => setEditingCollection(undefined)}>ยกเลิก</button> : null}</div>
        </fieldset>
      </form>
      <div className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Collections</p><h2>รายการ Collection</h2></div><small>{library.collections.length} รายการ</small></div><div className="space-y-2">{library.collections.map((collection) => <article className="flex flex-wrap items-center justify-between gap-3 border border-black/10 p-3" key={collection.id}><span><strong className="block">{collection.code} — {collection.name_th}</strong><small>{collection.source_document} · {collection.status}</small></span><div className="v14-actions"><button className="v14-button v14-button--small v14-button--outline" disabled={!canManage} onClick={() => setEditingCollection(collection)}><Pencil size={12}/>แก้ไข</button><button className="v14-button v14-button--small v14-button--outline" disabled={!canManage || !!busy} onClick={() => void run("collection-status", { action: "SET_COLLECTION_STATUS", collectionId: collection.id, status: collection.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }, "เปลี่ยนสถานะแล้ว")}>{collection.status === "ACTIVE" ? "พักใช้" : "เปิดใช้"}</button></div></article>)}{!library.collections.length ? <p className="v14-empty">ยังไม่มี Collection สี</p> : null}</div></div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
      <form className="v14-panel catalog-form" key={editingFinish?.id ?? "new-finish"} onSubmit={saveFinish}>
        <div className="v14-panel__head"><div><p className="v14-eyebrow">Finish value</p><h2>{editingFinish ? "แก้ไขข้อมูลสี" : "เพิ่มสี"}</h2></div><Plus size={20}/></div>
        <fieldset disabled={!canManage || !!busy || !library.collections.length}>
          <label>Collection *<select name="collectionId" required defaultValue={editingFinish?.collection_id}>{library.collections.map((collection) => <option value={collection.id} key={collection.id}>{collection.code} — {collection.name_th}</option>)}</select></label>
          <div className="v14-grid v14-grid--2"><Field name="code" label="รหัสสี *" defaultValue={editingFinish?.code}/><Field name="nameTh" label="ชื่อไทย *" defaultValue={editingFinish?.name_th}/></div>
          <div className="v14-grid v14-grid--2"><Field name="nameZh" label="ชื่อจีน" defaultValue={editingFinish?.name_zh}/><Field name="material" label="วัสดุ/ผิว" defaultValue={editingFinish?.material}/></div>
          <Field name="colorHex" label="สีประมาณบนจอ (#RRGGBB)" placeholder="#AABBCC" pattern="#[0-9A-Fa-f]{6}" defaultValue={editingFinish?.color_hex}/>
          <div className="v14-grid v14-grid--2"><Field name="sourceDocument" label="เอกสารต้นทาง *" defaultValue={editingFinish?.source_document}/><Field name="sourcePage" label="หน้าอ้างอิง *" defaultValue={editingFinish?.source_page}/></div>
          <div className="v14-actions"><button className="v14-button v14-button--dark"><Plus size={14}/>{editingFinish ? "บันทึกการแก้ไข" : "เพิ่มเป็น Draft"}</button>{editingFinish ? <button type="button" className="v14-button v14-button--outline" onClick={() => setEditingFinish(undefined)}>ยกเลิก</button> : null}</div>
        </fieldset>
      </form>
      <div className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Swatches</p><h2>สีในคลัง</h2></div><small>{library.finishes.length} รายการ</small></div><div className="grid max-h-[760px] gap-3 overflow-auto sm:grid-cols-2">{library.finishes.map((finish) => {
        const collection = collectionById.get(finish.collection_id);
        return <article className="border border-black/10 p-3" key={finish.id}><div className="flex gap-3">{finish.swatchPreviewUrl ? <img src={finish.swatchPreviewUrl} alt={`ตัวอย่างสี ${finish.code}`} className="h-16 w-16 border border-black/10 object-cover"/> : <div className="flex h-16 w-16 items-center justify-center border border-dashed border-black/20" style={{ backgroundColor: finish.color_hex ?? "transparent" }}><Palette size={18}/></div>}<span><strong className="block">{finish.code}</strong><span className="block text-sm">{finish.name_th}</span><small>{collection?.code ?? "—"} · {finish.status}</small></span></div><p className="mt-2 text-xs text-black/55">อ้างอิง {finish.source_document} หน้า {finish.source_page}</p><form className="mt-3 flex gap-2" onSubmit={(event) => uploadSwatch(event, finish.id)}><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required disabled={!canManage || !!busy} className="min-w-0 flex-1 text-xs"/><button className="v14-button v14-button--small v14-button--outline" disabled={!canManage || !!busy}>{busy === `swatch-${finish.id}` ? <LoaderCircle className="animate-spin" size={12}/> : <ImagePlus size={12}/>}รูป</button></form><div className="v14-actions mt-3"><button className="v14-button v14-button--small v14-button--outline" disabled={!canManage} onClick={() => setEditingFinish(finish)}><Pencil size={12}/>แก้ไข</button><button className="v14-button v14-button--small v14-button--outline" disabled={!canManage || !!busy || (finish.status !== "ACTIVE" && !finish.swatch_file_id)} onClick={() => void run("finish-status", { action: "SET_FINISH_STATUS", finishId: finish.id, status: finish.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }, "เปลี่ยนสถานะแล้ว")}>{finish.status === "ACTIVE" ? "พักใช้" : "เปิดใช้"}</button></div></article>;
      })}{!library.finishes.length ? <p className="v14-empty">ยังไม่มีสีในคลัง</p> : null}</div></div>
    </section>

    <section className="v14-panel catalog-form"><div className="v14-panel__head"><div><p className="v14-eyebrow">Product mapping</p><h2>ผูกสีกับค่า Option ของสินค้า</h2></div><Link2 size={20}/></div><fieldset disabled={!canManage || !!busy || !library.optionTargets.length}><div className="grid gap-3 md:grid-cols-2"><label>ค่า Option<select value={selectedTargetId} onChange={(event) => { const target = library.optionTargets.find((item) => item.optionValueId === event.target.value); setSelectedTargetId(event.target.value); setSelectedFinishId(target?.finishId ?? ""); }}>{library.optionTargets.map((target) => <option value={target.optionValueId} key={target.optionValueId}>{target.productSku} — {target.productName} / {target.optionName}: {target.valueLabel}</option>)}</select></label><label>สีจากคลัง<select value={selectedFinishId} onChange={(event) => setSelectedFinishId(event.target.value)}><option value="">— ไม่ผูกสี —</option>{compatibleFinishes.map((finish) => <option value={finish.id} key={finish.id}>{finish.code} — {finish.name_th}</option>)}</select></label></div><button className="v14-button v14-button--dark mt-3" type="button" onClick={() => void run("mapping", { action: "MAP_FINISH", optionValueId: selectedTargetId, finishId: selectedFinishId || null }, "บันทึก Mapping แล้ว")}><Link2 size={14}/>บันทึก Mapping</button></fieldset>{!library.optionTargets.length ? <p className="catalog-permission-note">สร้าง Option และค่า Option ใน Product Draft ก่อน แล้วจึงกลับมาผูกสี</p> : null}</section>

  </div>;
}

function Field({ label, defaultValue, ...props }: { label: string; defaultValue?: unknown } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return <label>{label}<input required={label.includes("*")} {...props} defaultValue={defaultValue == null ? "" : String(defaultValue)}/></label>;
}
