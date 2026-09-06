"use client";

import {
  ArrowRight,
  Box,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  PackageSearch,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CatalogItem = {
  id: string;
  sku: string;
  productType: string;
  nameTh: string;
  nameEn: string | null;
  leadTimeDays: number | null;
  dimensions: { widthMm: number | null; depthMm: number | null; heightMm: number | null };
  materialSummary: string | null;
  category: { id: string; name: string | null } | null;
  price: {
    memberPrice: number;
    suggestedResalePrice: number | null;
    freightEstimateLow: number | null;
    freightEstimateHigh: number | null;
    currency: string;
  };
  availableSampleCount: number;
  imageUrl: string | null;
  partnerSourceLabel: string;
};
type CatalogResponse = {
  items: CatalogItem[];
  categories: Array<{ id: string; name: string | null }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const postGoLiveFeaturesEnabled = process.env.NEXT_PUBLIC_ENABLE_POST_GO_LIVE_FEATURES === "true";
const sharedCatalogEnabled = postGoLiveFeaturesEnabled || process.env.NEXT_PUBLIC_ENABLE_SHARED_CATALOGS === "true";
const productSourcingEnabled = postGoLiveFeaturesEnabled || process.env.NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING === "true";

export function MemberCatalogWorkspace() {
  const [data, setData] = useState<CatalogResponse>();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState("NEWEST");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        search,
        categoryId,
        sort,
        page: String(page),
        pageSize: "24",
      });
      try {
        const response = await fetch(`/api/member/catalog?${params}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as { data?: CatalogResponse; message?: string };
        if (!response.ok || !body.data) throw new Error(body.message ?? "โหลด Catalog ไม่สำเร็จ");
        setData(body.data);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "โหลด Catalog ไม่สำเร็จ");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [categoryId, page, search, sort]);

  const resultText = useMemo(
    () => `${data?.pagination.total ?? 0} สินค้าที่พร้อมให้สมาชิกดู`,
    [data?.pagination.total],
  );

  return (
    <div className="member-catalog">
      <section className="v14-hero member-catalog__hero">
        <div>
          <p className="v14-eyebrow">Member catalog</p>
          <h1>เลือกสินค้าสำหรับงานของคุณ</h1>
          <p>
            ราคาสมาชิกและข้อมูลสินค้าที่ผ่านการตรวจแล้ว ข้อมูลโรงงาน ต้นทุน
            และสูตรภายในจะไม่แสดงในพื้นที่สมาชิก
          </p>
        </div>
        <div className="member-catalog__promise"><Sparkles size={18} /><strong>Member-safe pricing</strong><span>ราคาก่อน VAT</span></div>
      </section>

      <section className="v14-panel member-catalog__toolbar">
        <label className="member-catalog__search">ค้นหาสินค้า<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ชื่อ รหัสสินค้า วัสดุ หรือหมวด" /></label>
        <label>หมวดสินค้า<select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}><option value="">ทุกหมวด</option>{(data?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name ?? "ไม่ระบุหมวด"}</option>)}</select></label>
        <label>เรียงตาม<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="NEWEST">ใหม่ล่าสุด</option><option value="PRICE_ASC">ราคาต่ำไปสูง</option><option value="PRICE_DESC">ราคาสูงไปต่ำ</option><option value="LEAD_ASC">Lead time สั้นที่สุด</option><option value="NAME">ชื่อสินค้า</option></select></label>
        <span className="member-catalog__count">{resultText}</span>
      </section>

      {sharedCatalogEnabled ? <section className="v14-panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><p className="v14-eyebrow">Share with customer</p><h2 className="text-2xl font-semibold">ส่งหน้ารวมสินค้าให้ลูกค้าเลือกเอง</h2><p className="mt-1 text-sm text-black/60">ลูกค้าค้นหาและเลือกสินค้าตามหมวดได้ โดยไม่เห็นราคาและข้อมูลภายใน</p></div>
        <span className="flex flex-wrap gap-2"><Link href="/member/shared-catalogs?scope=FULL_CATALOG" className="v14-button v14-button--dark">สร้างลิงก์สินค้าทั้งหมด <ArrowRight size={14}/></Link><Link href="/member/shared-catalogs" className="v14-button v14-button--outline">จัดการลิงก์</Link></span>
      </section> : null}

      {productSourcingEnabled ? <section className="v14-panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><p className="v14-eyebrow">Can’t find it?</p><h2 className="text-2xl font-semibold">ไม่พบสินค้าที่ต้องการในแอป</h2><p className="mt-1 text-sm text-black/60">ถ่ายภาพหรือแนบภาพ แล้วส่งให้ทีม GISP ช่วยจัดหาสินค้าสำเร็จรูปที่ตรงหรือใกล้เคียง</p></div>
        <Link href="/member/sourcing-requests/new" className="v14-button v14-button--outline">ส่งภาพให้ช่วยจัดหา <ArrowRight size={14}/></Link>
      </section> : null}

      {error ? <div className="v14-alert"><b>โหลดไม่สำเร็จ</b><span>{error}</span></div> : null}
      {loading ? <div className="v14-panel v14-empty"><LoaderCircle className="animate-spin" /> กำลังโหลดสินค้าที่ Publish แล้ว…</div> : null}
      {!loading && !data?.items.length ? <section className="v14-panel member-catalog__empty"><PackageSearch size={34} /><h2>ยังไม่พบสินค้าที่ตรงกับคำค้น</h2><p>ลองล้างตัวกรอง หรือค้นหาด้วยรหัสสินค้า หมวด หรือวัสดุ</p><button className="v14-button v14-button--outline" onClick={() => { setSearch(""); setCategoryId(""); setPage(1); }}>ล้างตัวกรอง</button></section> : null}

      {!loading && data?.items.length ? (
        <section className="member-catalog__grid" aria-label="รายการสินค้า">
          {data.items.map((item) => <ProductCard key={item.id} item={item} />)}
        </section>
      ) : null}

      {data && data.pagination.totalPages > 1 ? <nav className="member-catalog__pagination" aria-label="หน้ารายการสินค้า"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={15} /> ก่อนหน้า</button><span>หน้า {page} จาก {data.pagination.totalPages}</span><button disabled={page >= data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>ถัดไป <ChevronRight size={15} /></button></nav> : null}
    </div>
  );
}

function ProductCard({ item }: { item: CatalogItem }) {
  const dimensions = [item.dimensions.widthMm, item.dimensions.depthMm, item.dimensions.heightMm].every(Boolean)
    ? `${item.dimensions.widthMm} × ${item.dimensions.depthMm} × ${item.dimensions.heightMm} มม.`
    : "ตรวจขนาดในรายละเอียด";
  return <article className="member-product-card"><Link href={`/member/catalog/${item.id}`} className="member-product-card__image">{item.imageUrl ? <Image src={item.imageUrl} alt={item.nameTh} fill sizes="(max-width: 768px) 100vw, 33vw" unoptimized /> : <Box size={34} />}{item.availableSampleCount > 0 ? <em>มีตัวอย่างวัสดุ</em> : null}</Link><div className="member-product-card__body"><span className="member-product-card__meta">{item.category?.name ?? item.productType} · {item.sku}</span><h2>{item.nameTh}</h2>{item.nameEn ? <p>{item.nameEn}</p> : null}<dl><div><dt>ขนาด</dt><dd>{dimensions}</dd></div><div><dt>Lead time</dt><dd><Clock3 size={12} /> {item.leadTimeDays ?? "—"} วัน</dd></div></dl><div className="member-product-card__price"><span>ราคาสมาชิกก่อน VAT</span><strong>{money.format(item.price.memberPrice)} <small>{item.price.currency}</small></strong><p>ราคาแนะนำขายต่อ {item.price.suggestedResalePrice === null ? "—" : money.format(item.price.suggestedResalePrice)} {item.price.currency}</p></div><Link href={`/member/catalog/${item.id}`} className="v14-button v14-button--dark">ดูรายละเอียด <ArrowRight size={14} /></Link></div></article>;
}
