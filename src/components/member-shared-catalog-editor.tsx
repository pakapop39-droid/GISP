"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  ArrowLeft,
  Copy,
  ImageUp,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SharedCatalogScope } from "@/lib/shared-catalog/types";

type Product = { id: string; sku: string; nameTh: string };
type Item = {
  id: string;
  product_id: string;
  sort_order: number;
  product: null | { sku: string; name_th: string; status: string };
};
type Catalog = {
  id: string;
  title: string;
  introduction: string | null;
  brand_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  line_url: string | null;
  scope_type: SharedCatalogScope;
  source_product_id: string | null;
  source_project_id: string | null;
  status: string;
  share_token: string;
  expires_at: string | null;
  published_at: string | null;
};

const scopeLabel: Record<SharedCatalogScope, string> = {
  CURATED: "Catalog ที่เลือกสินค้าเอง",
  PRODUCT: "สินค้ารายชิ้น",
  PROJECT: "สินค้าในโครงการ",
  FULL_CATALOG: "สินค้าทั้งหมด",
};

export function MemberSharedCatalogEditor({ catalogId }: { catalogId: string }) {
  const [catalog, setCatalog] = useState<Catalog>();
  const [items, setItems] = useState<Item[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [detail, catalogResponse] = await Promise.all([
      fetch(`/api/member/shared-catalogs/${catalogId}`),
      fetch("/api/member/catalog?pageSize=60"),
    ]);
    const [detailBody, catalogBody] = await Promise.all([detail.json(), catalogResponse.json()]);
    if (!detail.ok) {
      setError(detailBody.message ?? "โหลดไม่สำเร็จ");
      return;
    }
    setCatalog(detailBody.data.catalog);
    setItems(detailBody.data.items ?? []);
    setProducts(catalogBody.data?.items ?? []);
  }, [catalogId]);
  useEffect(() => { void load(); }, [load]);

  async function action(path: string, method = "POST", payload?: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/member/shared-catalogs/${catalogId}${path}`, {
      method,
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await response.json();
    if (response.ok) {
      setMessage(body.message ?? "บันทึกแล้ว");
      await load();
    } else {
      setError(body.message ?? "ทำรายการไม่สำเร็จ");
    }
    setBusy(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog) return;
    const form = new FormData(event.currentTarget);
    await action("", "PATCH", {
      title: form.get("title"),
      introduction: form.get("introduction"),
      brandName: form.get("brandName"),
      contactName: form.get("contactName"),
      contactPhone: form.get("contactPhone"),
      contactEmail: form.get("contactEmail"),
      lineUrl: form.get("lineUrl"),
      scopeType: catalog.scope_type,
      sourceId: catalog.source_product_id ?? catalog.source_project_id,
      expiresAt: form.get("expiresAt") ? new Date(String(form.get("expiresAt"))).toISOString() : null,
    });
  }

  async function searchProducts() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/member/catalog?pageSize=60&search=${encodeURIComponent(search)}`);
    const body = await response.json();
    if (response.ok) setProducts(body.data?.items ?? []);
    else setError(body.message ?? "ค้นหาสินค้าไม่สำเร็จ");
    setBusy(false);
  }

  const shareLink = typeof window !== "undefined" && catalog
    ? `${window.location.origin}/catalog/share/${catalog.share_token}`
    : "";
  if (!catalog) {
    return <div className="v14-panel v14-empty">{error || <><LoaderCircle className="animate-spin"/>กำลังโหลด…</>}</div>;
  }
  const canPublish = catalog.scope_type !== "CURATED" || items.length > 0;

  return <div className="member-catalog">
    <Link href="/member/shared-catalogs" className="member-detail__back"><ArrowLeft/>กลับรายการ</Link>
    <section className="v14-hero">
      <div><p className="v14-eyebrow">{scopeLabel[catalog.scope_type]} · {catalog.status}</p><h1>{catalog.title}</h1><p>ลูกค้าจะไม่เห็นราคาและข้อมูลภายใน การแก้ไขมีผลเมื่อกดเผยแพร่ Snapshot ใหม่</p></div>
      <div className="member-catalog__promise"><ShieldCheck/><strong>ไม่แสดงราคา</strong><span>Public-safe catalog</span></div>
    </section>
    {error ? <div className="v14-alert"><b>ทำรายการไม่สำเร็จ</b><span>{error}</span></div> : null}
    {message ? <div className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{message}</div> : null}

    <form onSubmit={save} className="v14-panel grid gap-3 md:grid-cols-2">
      <label>ชื่อ Catalog<input name="title" defaultValue={catalog.title} required/></label>
      <label>ชื่อบริษัท<input name="brandName" defaultValue={catalog.brand_name} required/></label>
      <label className="md:col-span-2">ข้อความแนะนำ<textarea name="introduction" defaultValue={catalog.introduction ?? ""}/></label>
      <label>ชื่อผู้ติดต่อ<input name="contactName" defaultValue={catalog.contact_name ?? ""}/></label>
      <label>โทรศัพท์<input name="contactPhone" defaultValue={catalog.contact_phone ?? ""}/></label>
      <label>อีเมล<input name="contactEmail" type="email" defaultValue={catalog.contact_email ?? ""}/></label>
      <label>LINE URL<input name="lineUrl" type="url" defaultValue={catalog.line_url ?? ""}/></label>
      <label>วันหมดอายุ (เว้นว่าง = ไม่หมดอายุ)<input name="expiresAt" type="datetime-local" defaultValue={catalog.expires_at ? catalog.expires_at.slice(0, 16) : ""}/></label>
      <div className="rounded-xl bg-stone-50 p-3 text-sm"><b>รูปแบบ:</b> {scopeLabel[catalog.scope_type]}<br/>ประเภทลิงก์เปลี่ยนไม่ได้ หากต้องการแบบอื่นให้สร้างลิงก์ใหม่</div>
      <button disabled={busy} className="v14-button v14-button--dark md:col-span-2">บันทึกข้อมูลและวันหมดอายุ</button>
    </form>

    <section className="v14-panel">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Brand logo</p><h2>โลโก้บริษัท</h2></div></div>
      <form onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        const response = await fetch(`/api/member/shared-catalogs/${catalogId}/logo`, { method: "POST", body: form });
        const body = await response.json();
        if (response.ok) setMessage(body.message);
        else setError(body.message);
        setBusy(false);
      }} className="flex flex-wrap gap-3">
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required/>
        <button disabled={busy} className="v14-button v14-button--outline"><ImageUp/>อัปโหลดโลโก้</button>
      </form>
    </section>

    {catalog.scope_type === "CURATED" ? <section className="v14-panel">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Products</p><h2>เลือกและจัดลำดับสินค้า</h2></div><small>ลูกค้าไม่เห็นราคา</small></div>
      <div className="mb-3 flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchProducts(); } }} placeholder="ค้นหาด้วยชื่อ SKU หรือวัสดุ"/><button type="button" disabled={busy} onClick={() => void searchProducts()} className="v14-button v14-button--outline">ค้นหา</button></div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]"><select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">เลือกสินค้า</option>{products.filter((product) => !items.some((item) => item.product_id === product.id)).map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.nameTh}</option>)}</select><button type="button" disabled={busy || !selected} onClick={() => void action("/items", "POST", { productId: selected, sortOrder: items.length })} className="v14-button v14-button--dark"><Plus/>เพิ่ม</button></div>
      <div className="mt-4 grid gap-2">{items.map((item, index) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><span><b>{item.product?.sku ?? "ไม่พร้อมใช้งาน"} · {item.product?.name_th ?? item.product_id}</b><small className="block">ไม่มีราคาในลิงก์ลูกค้า</small></span><span className="flex gap-2"><button type="button" disabled={busy || index === 0} onClick={() => void (async () => { const previous = items[index - 1]; await action("/items", "POST", { productId: previous.product_id, sortOrder: index }); await action("/items", "POST", { productId: item.product_id, sortOrder: index - 1 }); })()} className="v14-button v14-button--outline">↑</button><button type="button" disabled={busy} onClick={() => void action("/items", "DELETE", { productId: item.product_id })} className="v14-button v14-button--outline"><Trash2/></button></span></div>)}</div>
    </section> : <section className="v14-panel"><p className="v14-eyebrow">Automatic selection</p><h2>{scopeLabel[catalog.scope_type]}</h2><p className="mt-2 text-black/60">{catalog.scope_type === "FULL_CATALOG" ? "ระบบแสดงสินค้า Published ที่พร้อมขายทั้งหมดแบบอัปเดตสด แยกหมวดและค้นหาได้" : catalog.scope_type === "PROJECT" ? "ระบบ Snapshot เฉพาะสินค้ามาตรฐานที่พร้อมขายในโครงการ โดยไม่ส่งชื่อลูกค้า ที่อยู่ จำนวน หรือราคา" : "ระบบ Snapshot สินค้ารายการนี้เมื่อเผยแพร่"}</p></section>}

    <section className="v14-panel">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Publish & share</p><h2>ตรวจและส่งให้ลูกค้า</h2></div></div>
      {catalog.status === "PUBLISHED" ? <div className="mb-4 rounded-xl bg-emerald-50 p-4"><small>ลิงก์สำหรับลูกค้า</small><p className="break-all font-medium">{shareLink}</p><button type="button" onClick={() => void navigator.clipboard.writeText(shareLink)} className="v14-button v14-button--outline mt-2"><Copy/>คัดลอกลิงก์</button></div> : null}
      <div className="v14-actions">
        <a href={`/member/shared-catalogs/${catalogId}/preview`} target="_blank" rel="noreferrer" className="v14-button v14-button--outline">ดูตัวอย่างลูกค้า</a>
        <button type="button" disabled={busy || !canPublish} onClick={() => window.confirm("ยืนยันว่าตรวจ Preview และช่องทางติดต่อแล้ว ลูกค้าจะไม่เห็นราคา ต้องการเผยแพร่ Snapshot ใหม่นี้ใช่หรือไม่?") && void action("/publish")} className="v14-button v14-button--dark"><Send/>เผยแพร่ Snapshot ใหม่</button>
        {catalog.status === "PUBLISHED" ? <><a href={shareLink} target="_blank" rel="noreferrer" className="v14-button v14-button--outline">เปิดหน้าลูกค้า</a><button type="button" disabled={busy} onClick={() => void action("/rotate-link")} className="v14-button v14-button--outline"><RefreshCw/>เปลี่ยนลิงก์</button><button type="button" disabled={busy} onClick={() => void action("/revoke")} className="v14-button v14-button--outline"><ShieldOff/>ปิดลิงก์</button></> : null}
      </div>
    </section>
  </div>;
}
