"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MemberCatalogItem } from "@/lib/catalog/member-safe";
import { ProductCard } from "./member-catalog-workspace";

async function uploadImage(file: File): Promise<Blob> {
  if (file.size <= 3 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error("กรุณาเลือกรูปไม่เกิน 40 ล้านพิกเซล");
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("เตรียมรูปไม่สำเร็จ กรุณาลองเปลี่ยนภาพ");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error("รูปยังมีขนาดใหญ่เกินไป กรุณาย่อภาพแล้วลองอีกครั้ง");
    return blob;
  } finally { bitmap.close(); }
}

export function MemberImageSearch({ databaseMode = false }: { databaseMode?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [items, setItems] = useState<MemberCatalogItem[] | null>(null);
  const [count, setCount] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  const previewUrl = useRef("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/member/catalog?pageSize=12", { signal: controller.signal })
      .then(r => r.ok ? r.json() : null).then(body => { if (body?.data) setCategories(body.data.categories); }).catch(() => {});
    return () => { controller.abort(); pending.current?.abort(); URL.revokeObjectURL(previewUrl.current); };
  }, []);

  function selectFile(next: File | null) {
    URL.revokeObjectURL(previewUrl.current); previewUrl.current = "";
    setItems(null); setError(""); setPreview(""); setFile(null);
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size > 10 * 1024 * 1024 || !next.size) {
      setError("กรุณาเลือกภาพ JPEG, PNG หรือ WebP ขนาดไม่เกิน 10 MB");
      if (input.current) input.current.value = "";
      return;
    }
    previewUrl.current = URL.createObjectURL(next);
    setPreview(previewUrl.current);
    setFile(next);
  }

  async function search() {
    if (!file || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError(""); setItems(null);
    try {
      const upload = await uploadImage(file);
      if (controller.signal.aborted) return;
      const form = new FormData(); form.set("image", upload, "query-image"); form.set("categoryId", category);
      const response = await fetch("/api/member/catalog/image-search", { method: "POST", body: form, signal: controller.signal });
      const body = await response.json();
      if (!response.ok || !body.data) throw new Error(body.message ?? "ค้นหาไม่สำเร็จ กรุณาลองใหม่");
      setItems(body.data.items); setCount(body.data.indexedProducts);
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "ค้นหาไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }

  return <div className="member-catalog">
    <section className="v14-hero member-catalog__hero">
      <div><p className="v14-eyebrow">ค้นหาจากภาพ · รุ่นทดลอง</p><h1>ค้นหาสินค้าที่เหมือนหรือคล้าย</h1><p>เลือกรูปสินค้าหนึ่งชิ้น แล้วค้นหาสินค้าใน GISP ที่มีลักษณะใกล้เคียง</p></div>
      <Link className="v14-button v14-button--outline" href="/member/catalog">กลับไปค้นหาด้วยข้อความ</Link>
    </section>
    <section className="v14-panel grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-black/20 bg-stone-50">
        {preview ? <Image src={preview} alt="รูปที่เลือกใช้ค้นหา" fill unoptimized sizes="(max-width: 768px) 100vw, 40vw" className="object-contain p-3" /> : <div className="flex flex-col items-center gap-3 p-8 text-center text-black/50"><Camera size={40}/><p>รูปชัด เห็นตัวสินค้าเต็มชิ้น<br/>ช่วยให้ค้นหาได้ดีขึ้น</p></div>}
      </div>
      <form className="flex min-w-0 flex-col gap-4" onSubmit={event => { event.preventDefault(); void search(); }}>
        <label className="flex flex-col gap-2 font-medium">เลือกรูปสินค้า<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => selectFile(e.target.files?.[0] ?? null)} className="w-full min-w-0 text-sm" /></label>
        <p className="text-sm text-black/60">JPEG, PNG หรือ WebP สูงสุด 10 MB · ภาพนิ่งไม่เกิน 40 ล้านพิกเซล</p>
        <label className="flex flex-col gap-2">หมวดสินค้า<select className="rounded-lg border border-black/20 p-3" value={category} disabled={busy} onChange={e => { setCategory(e.target.value); setItems(null); }}><option value="">ทุกหมวด</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <p className="text-sm leading-6 text-black/60">เมื่อกดค้นหา รูปจะส่งให้บริการ Voyage ประมวลผล ระบบ GISP ไม่บันทึกรูปค้นหานี้ลงคลังสินค้า</p>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={!file || busy} className="v14-button v14-button--dark disabled:opacity-50">{busy ? <LoaderCircle size={18} className="animate-spin"/> : <Search size={18}/>} {busy ? "กำลังค้นหา…" : "ค้นหาด้วยรูปนี้"}</button>
          {file && !busy ? <button type="button" className="v14-button v14-button--outline" onClick={() => { selectFile(null); if (input.current) input.current.value = ""; }}><X size={16}/>ล้างรูป</button> : null}
        </div>
        <p className="text-xs text-black/50">ใช้ Voyage multimodal 3.5 · {databaseMode ? "ทดลองได้ 30 ครั้งต่อวันต่อบัญชี/องค์กร" : "รอบทดลองจำกัด 30 ครั้งต่อบัญชี/องค์กร"}</p>
      </form>
    </section>
    <div aria-live="polite" aria-atomic="true">
      {error ? <div role="alert" className="v14-alert"><b>ค้นหาไม่สำเร็จ</b><span>{error}</span></div> : null}
      {busy ? <p className="v14-panel">กำลังเปรียบเทียบภาพกับสินค้าใน GISP กรุณารอสักครู่…</p> : null}
      {items ? <div className="v14-panel"><h2 className="text-xl font-semibold">{items.length ? `สินค้าที่ใกล้เคียง ${items.length} รายการ` : "ไม่มีสินค้าที่แสดงได้ในหมวดนี้"}</h2><p className="mt-2 text-sm text-black/60">ทดลองจากภาพหลักของสินค้า {count} รายการ เรียงจากภาพที่ใกล้เคียงที่สุด ผลอาจต่างรุ่นหรือไม่มีสินค้าที่ตรงกับรูป กรุณาตรวจรายละเอียดก่อนเลือก</p>{!items.length ? <p className="mt-2">ลองเลือกทุกหมวด หรือเปลี่ยนภาพแล้วค้นหาใหม่</p> : null}</div> : null}
    </div>
    {items?.length ? <section className="member-catalog__grid" aria-label="ผลค้นหาด้วยรูปภาพ">{items.map(item => <ProductCard key={item.id} item={item}/>)}</section> : null}
  </div>;
}
