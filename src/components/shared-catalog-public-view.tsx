"use client";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicCatalogItem } from "@/lib/shared-catalog/public-safe";
import type { SharedCatalogView } from "@/lib/shared-catalog/server";

type InterestItem = Pick<PublicCatalogItem, "id" | "sku" | "nameTh" | "categoryName">;

const scopeLabels: Record<SharedCatalogView["scopeType"], string> = {
  CURATED: "ชุดสินค้าที่คัดสรร",
  PRODUCT: "รายละเอียดสินค้า",
  PROJECT: "สินค้าสำหรับโครงการ",
  FULL_CATALOG: "สินค้าทั้งหมด",
};

export function SharedCatalogPublicView({
  data: initialData,
  preview = false,
  dataUrl,
  storageKey = "preview",
}: {
  data: SharedCatalogView;
  preview?: boolean;
  dataUrl?: string;
  storageKey?: string;
}) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<PublicCatalogItem | null>(null);
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const localKey = `gisp-customer-interest:${storageKey}`;

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(localKey);
      if (value) setInterests(JSON.parse(value) as InterestItem[]);
    } catch {
      setInterests([]);
    }
  }, [localKey]);

  function persist(next: InterestItem[]) {
    setInterests(next);
    try {
      window.localStorage.setItem(localKey, JSON.stringify(next));
    } catch {
      // The selection still works for the current page when storage is unavailable.
    }
  }

  function toggle(item: PublicCatalogItem) {
    if (interests.some((selected) => selected.id === item.id)) {
      persist(interests.filter((selected) => selected.id !== item.id));
    } else {
      persist([...interests, {
        id: item.id,
        sku: item.sku,
        nameTh: item.nameTh,
        categoryName: item.categoryName,
      }]);
    }
  }

  async function load(page: number, nextCategory = category) {
    if (!dataUrl) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        category: nextCategory,
        page: String(page),
        pageSize: String(data.pagination.pageSize),
      });
      const response = await fetch(`${dataUrl}?${params}`, { cache: "no-store" });
      const body = await response.json() as { data?: SharedCatalogView; message?: string };
      if (!response.ok || !body.data) throw new Error(body.message ?? "โหลดสินค้าไม่สำเร็จ");
      setData(body.data);
    } finally {
      setLoading(false);
    }
  }

  const contactMessage = useMemo(() => {
    const lines = interests.map((item, index) =>
      `${index + 1}. ${item.sku} — ${item.nameTh}`);
    return [
      `สวัสดีครับ/ค่ะ สนใจสินค้าจาก ${data.brand.name}`,
      ...lines,
      typeof window === "undefined" ? "" : `ลิงก์: ${window.location.href}`,
    ].filter(Boolean).join("\n");
  }, [data.brand.name, interests]);

  function copyInterest() {
    void navigator.clipboard.writeText(contactMessage);
  }

  return <main className="v14-app min-h-screen bg-[#f2eee6] pb-28 text-[#173c31]">
    {preview ? <div className="bg-amber-100 px-5 py-3 text-center text-sm font-bold text-amber-950">ตัวอย่างก่อนเผยแพร่ · ลูกค้ายังไม่เห็นการแก้ไขชุดนี้</div> : null}
    <header className="border-b border-black/10 bg-[#fbf8f1]">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5">
        {data.brand.logoUrl ? <img src={data.brand.logoUrl} alt={data.brand.name} className="size-14 rounded-xl object-contain" /> : null}
        <div><p className="text-xs font-black uppercase tracking-[.18em]">Selected by</p><h1 className="font-serif text-2xl">{data.brand.name}</h1></div>
      </div>
    </header>

    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10">
      <section>
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#a83226]">{scopeLabels[data.scopeType]}</p>
        <h2 className="mt-2 font-serif text-4xl md:text-6xl">{data.title}</h2>
        {data.introduction ? <p className="mt-4 max-w-3xl text-lg leading-8 text-black/65">{data.introduction}</p> : null}
        <p className="mt-3 text-sm text-black/55">สนใจสินค้าเลือกรายการไว้ แล้วติดต่อ {data.brand.contactName ?? data.brand.name} เพื่อสอบถามราคาและความพร้อม</p>
      </section>

      {data.scopeType !== "PRODUCT" ? <section className="grid gap-3 rounded-2xl border border-black/10 bg-[#fbf8f1] p-4 md:grid-cols-[1fr_240px_auto]">
        <label className="grid gap-1 text-sm font-bold">ค้นหาสินค้า
          <span className="flex items-center rounded-xl border bg-white px-3"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(1); }} className="w-full border-0 bg-transparent" placeholder="ชื่อสินค้า รหัส วัสดุ หรือสเปก"/></span>
        </label>
        <label className="grid gap-1 text-sm font-bold">หมวดสินค้า
          <select value={category} onChange={(event) => { const value = event.target.value; setCategory(value); void load(1, value); }}>
            <option value="">ทุกหมวด</option>
            {data.categories.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
          </select>
        </label>
        <button disabled={loading} onClick={() => void load(1)} className="v14-button v14-button--dark self-end"><Search size={15}/>{loading ? "กำลังค้นหา…" : "ค้นหา"}</button>
      </section> : null}

      <p className="text-sm text-black/55">พบ {data.pagination.total.toLocaleString("th-TH")} รายการ · ไม่มีการแสดงราคาในลิงก์นี้</p>
      {data.notices.map((notice) => <p key={notice} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{notice}</p>)}

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => {
          const selected = interests.some((interest) => interest.id === item.id);
          return <article key={item.id} className="overflow-hidden rounded-2xl border border-black/10 bg-[#fbf8f1]">
            <button onClick={() => setDetail(item)} className="relative block aspect-[4/3] w-full bg-[#e7e0d5] text-left">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.nameTh} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-black/30"><ShoppingBag size={38}/></span>}
              {item.availability === "INQUIRE" ? <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">กรุณาสอบถามความพร้อม</span> : null}
              {item.projectAreaName ? <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold">{item.projectAreaName}</span> : null}
            </button>
            <div className="grid gap-3 p-5">
              <small>{item.categoryName ?? item.productType} · {item.sku}</small>
              <button onClick={() => setDetail(item)} className="text-left"><h3 className="font-serif text-2xl">{item.nameTh}</h3>{item.nameEn ? <p className="text-sm text-black/45">{item.nameEn}</p> : null}</button>
              <dl className="grid gap-2 text-sm">
                <div><dt className="text-black/45">วัสดุ / ผิว</dt><dd>{[item.materialSummary, item.finishSummary].filter(Boolean).join(" · ") || "สอบถามรายละเอียด"}</dd></div>
                <div><dt className="text-black/45">Lead time โดยประมาณ</dt><dd className="flex items-center gap-1"><Clock3 size={13}/>{item.leadTimeDays ?? "—"} วัน</dd></div>
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDetail(item)} className="v14-button v14-button--outline">ดูรายละเอียด</button>
                <button onClick={() => toggle(item)} className={`v14-button ${selected ? "bg-[#173c31] text-white" : "v14-button--outline"}`}>{selected ? <Check/> : <ShoppingBag/>}{selected ? "เลือกแล้ว" : "สนใจ"}</button>
              </div>
            </div>
          </article>;
        })}
      </section>

      {!data.items.length ? <section className="rounded-2xl border border-dashed p-10 text-center"><ShoppingBag className="mx-auto"/><h3 className="mt-3 text-xl font-bold">ไม่พบสินค้าที่ตรงกับการค้นหา</h3><button className="mt-4 underline" onClick={() => { setSearch(""); setCategory(""); void load(1, ""); }}>ล้างตัวกรอง</button></section> : null}

      {data.pagination.totalPages > 1 ? <nav className="flex items-center justify-center gap-4" aria-label="หน้ารายการสินค้า">
        <button disabled={loading || data.pagination.page <= 1} onClick={() => void load(data.pagination.page - 1)} className="v14-button v14-button--outline"><ChevronLeft/>ก่อนหน้า</button>
        <span>หน้า {data.pagination.page} จาก {data.pagination.totalPages}</span>
        <button disabled={loading || data.pagination.page >= data.pagination.totalPages} onClick={() => void load(data.pagination.page + 1)} className="v14-button v14-button--outline">ถัดไป<ChevronRight/></button>
      </nav> : null}

      <footer className="rounded-2xl bg-[#173c31] p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[.18em] text-white/60">Contact member</p>
        <h2 className="mt-2 font-serif text-3xl">สอบถามราคาและรายละเอียดกับ {data.brand.contactName ?? data.brand.name}</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {data.brand.contactPhone ? <a href={`tel:${data.brand.contactPhone}`} className="v14-button bg-white text-[#173c31]"><Phone/>โทร {data.brand.contactPhone}</a> : null}
          {data.brand.contactEmail ? <a href={`mailto:${data.brand.contactEmail}?subject=${encodeURIComponent(`สอบถามสินค้า ${data.title}`)}&body=${encodeURIComponent(contactMessage)}`} className="v14-button border border-white/30"><Mail/>อีเมลรายการที่สนใจ</a> : null}
          {data.brand.lineUrl ? <button onClick={() => { copyInterest(); window.open(data.brand.lineUrl ?? "", "_blank", "noopener,noreferrer"); }} className="v14-button border border-white/30"><MessageCircle/>คัดลอกรายการและเปิด LINE</button> : null}
          <button onClick={copyInterest} className="v14-button border border-white/30"><Copy/>คัดลอกรายการ</button>
        </div>
      </footer>
    </div>

    {interests.length ? <aside className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-[#fbf8f1]/95 p-3 shadow-2xl backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <span><b>รายการที่สนใจ {interests.length} รายการ</b><small className="block text-black/55">เก็บไว้เฉพาะใน Browser เครื่องนี้</small></span>
        <span className="flex gap-2"><button onClick={() => persist([])} className="v14-button v14-button--outline">ล้างรายการ</button><button onClick={copyInterest} className="v14-button v14-button--dark"><Copy/>คัดลอกเพื่อติดต่อ</button></span>
      </div>
    </aside> : null}

    {detail ? <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={detail.nameTh}>
      <article className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-[#fbf8f1] shadow-2xl">
        <div className="sticky top-0 z-10 flex justify-between border-b bg-[#fbf8f1] p-4"><b>{detail.sku}</b><button onClick={() => setDetail(null)} aria-label="ปิดรายละเอียด" className="grid size-11 place-items-center rounded-full border"><X/></button></div>
        {detail.imageUrl ? <img src={detail.imageUrl} alt={detail.nameTh} className="aspect-[16/9] w-full object-cover"/> : null}
        <div className="grid gap-5 p-6">
          <div><small>{detail.categoryName ?? detail.productType}</small><h2 className="font-serif text-4xl">{detail.nameTh}</h2>{detail.nameEn ? <p className="text-black/50">{detail.nameEn}</p> : null}</div>
          {detail.descriptionTh ? <p className="leading-7">{detail.descriptionTh}</p> : null}
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-black/45">Specification</dt><dd>{detail.specificationSummary ?? "สอบถามรายละเอียด"}</dd></div>
            <div><dt className="text-sm text-black/45">ขนาด ก × ล × ส</dt><dd>{detail.dimensions.widthMm ?? "—"} × {detail.dimensions.depthMm ?? "—"} × {detail.dimensions.heightMm ?? "—"} มม.</dd></div>
            <div><dt className="text-sm text-black/45">วัสดุ / ผิว</dt><dd>{[detail.materialSummary, detail.finishSummary].filter(Boolean).join(" · ") || "สอบถามรายละเอียด"}</dd></div>
            <div><dt className="text-sm text-black/45">Lead time โดยประมาณ</dt><dd>{detail.leadTimeDays ?? "—"} วัน</dd></div>
          </dl>
          {detail.selectedOptions.length ? <div><small className="text-black/45">ตัวเลือกในโครงการ</small><p>{detail.selectedOptions.join(" · ")}</p></div> : null}
          <button onClick={() => toggle(detail)} className="v14-button v14-button--dark"><ShoppingBag/>{interests.some((item) => item.id === detail.id) ? "นำออกจากรายการที่สนใจ" : "สนใจสินค้านี้"}</button>
          <p className="text-center text-sm text-black/50">สอบถามราคาและความพร้อมกับ {data.brand.contactName ?? data.brand.name}</p>
        </div>
      </article>
    </div> : null}
  </main>;
}
