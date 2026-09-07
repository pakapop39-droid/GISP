"use client";

/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect */

import { ArrowDown, Box, CheckCircle2, FolderKanban, Layers3, Link2, LoaderCircle, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { SharedCatalogScope } from "@/lib/shared-catalog/types";

type Catalog = {
  id: string;
  title: string;
  brand_name: string;
  status: string;
  scope_type: SharedCatalogScope;
  share_token: string;
  expires_at: string | null;
  updated_at: string;
};
type Project = { id: string; project_number: string; name: string; status: string };
type MemberProfile = {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_phone: string | null;
};

const statusLabel: Record<string, string> = {
  DRAFT: "ร่าง",
  PUBLISHED: "เผยแพร่แล้ว",
  REVOKED: "ปิดลิงก์แล้ว",
};
const scopeLabel: Record<SharedCatalogScope, string> = {
  CURATED: "คัดสินค้าเอง",
  PRODUCT: "สินค้ารายชิ้น",
  PROJECT: "สินค้าในโครงการ",
  FULL_CATALOG: "สินค้าทั้งหมด",
};
const scopeIcon = {
  CURATED: Layers3,
  PRODUCT: Box,
  PROJECT: FolderKanban,
  FULL_CATALOG: ShoppingBag,
};

export function MemberSharedCatalogsWorkspace() {
  const params = useSearchParams();
  const productId = params.get("productId");
  const requestedProjectId = params.get("projectId");
  const requestedScope = params.get("scope");
  const initialScope: SharedCatalogScope =
    productId ? "PRODUCT" : requestedProjectId ? "PROJECT" :
    requestedScope === "FULL_CATALOG" ? "FULL_CATALOG" : "CURATED";
  const [items, setItems] = useState<Catalog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [scopeType, setScopeType] = useState<SharedCatalogScope>(initialScope);
  const [projectId, setProjectId] = useState(requestedProjectId ?? "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [catalogResponse, projectResponse, profileResponse] = await Promise.all([
      fetch("/api/member/shared-catalogs"),
      fetch("/api/member/projects"),
      fetch("/api/member/profile"),
    ]);
    const [catalogBody, projectBody, profileBody] = await Promise.all([
      catalogResponse.json(),
      projectResponse.json(),
      profileResponse.json(),
    ]);
    if (catalogResponse.ok) setItems(catalogBody.data ?? []);
    else setError(catalogBody.message ?? "โหลดไม่สำเร็จ");
    if (projectResponse.ok) setProjects((projectBody.data ?? []).filter(
      (project: Project) => project.status !== "CANCELLED"));
    if (profileResponse.ok) setProfile(profileBody.data ?? null);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const sourceId = useMemo(() => {
    if (scopeType === "PRODUCT") return productId;
    if (scopeType === "PROJECT") return projectId;
    return null;
  }, [productId, projectId, scopeType]);

  async function createCatalog(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const response = await fetch("/api/member/shared-catalogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (response.ok) {
      window.location.href = `/member/shared-catalogs/${body.data.id}`;
      return;
    }
    setError(body.message ?? "สร้างไม่สำเร็จ");
    setBusy(false);
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createCatalog({
        title: form.get("title"),
        brandName: form.get("brandName"),
        introduction: form.get("introduction"),
        contactName: form.get("contactName"),
        contactPhone: form.get("contactPhone"),
        contactEmail: form.get("contactEmail"),
        lineUrl: form.get("lineUrl"),
        scopeType,
        sourceId,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
  }

  async function createFullCatalog() {
    if (!profile?.company_name) {
      prepareFullCatalog();
      return;
    }
    await createCatalog({
      title: `Catalog สินค้าของ ${profile.company_name}`,
      brandName: profile.company_name,
      introduction: "เลือกดูสินค้าที่พร้อมขาย ค้นหาตามชื่อหรือหมวด แล้วติดต่อเราเมื่อพบรายการที่สนใจ",
      contactName: profile.contact_name ?? "",
      contactPhone: profile.contact_phone ?? "",
      contactEmail: "",
      lineUrl: "",
      scopeType: "FULL_CATALOG",
      sourceId: null,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
  }

  const productScopeUnavailable = scopeType === "PRODUCT" && !productId;
  const projectScopeUnavailable = scopeType === "PROJECT" && !projectId;
  const fullCatalogLinks = items.filter((item) => item.scope_type === "FULL_CATALOG");
  const activeFullCatalog = fullCatalogLinks.find((item) =>
    item.status === "PUBLISHED" && (!item.expires_at || new Date(item.expires_at).getTime() > Date.now()));

  function prepareFullCatalog() {
    setScopeType("FULL_CATALOG");
    requestAnimationFrame(() => document.getElementById("create-customer-link")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return <div className="member-catalog">
    <section className="v14-hero">
      <div><p className="v14-eyebrow">Customer browse catalog</p><h1>ลิงก์ Catalog สำหรับลูกค้า</h1><p>ส่งสินค้าให้ลูกค้าเลือกดูได้โดยไม่ต้องสมัครสมาชิก ทุกลิงก์ซ่อนราคาและข้อมูลภายใน</p></div>
      <div className="member-catalog__promise"><Link2/><strong>{items.length} ลิงก์</strong><span>ปิดหรือเปลี่ยนลิงก์ได้ทันที</span></div>
    </section>
    {(productId || requestedProjectId || requestedScope) ? <div className="rounded-xl bg-emerald-50 p-4 text-emerald-950">ระบบเลือกชนิดลิงก์จากหน้าที่คุณเข้ามาแล้ว ตรวจข้อมูลด้านล่างและสร้างลิงก์ได้เลย</div> : null}
    {error ? <div className="v14-alert"><b>ทำรายการไม่สำเร็จ</b><span>{error}</span></div> : null}

    <section className="v14-panel border-emerald-800/25 bg-emerald-50/70">
      <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-emerald-900 text-white"><ShoppingBag size={25}/></span>
        <div>
          <p className="v14-eyebrow">Member full catalog link</p>
          <h2>หน้ารวมสินค้าทั้งหมดของฉัน</h2>
          <p className="mt-2">ลูกค้าเลือกดู ค้นหา และเลือกหมวดสินค้าได้โดยไม่เห็นราคา เมื่อลูกค้าสนใจจะติดต่อกลับมาที่ <b>{profile?.company_name ?? "บริษัทของ Member"}</b></p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">ลิงก์ทุกอันผูกกับบัญชี Member ผู้สร้าง และใช้ชื่อบริษัทกับช่องทางติดต่อของ Member</p>
        </div>
        {activeFullCatalog ? <Link href={`/member/shared-catalogs/${activeFullCatalog.id}`} className="v14-button v14-button--dark"><CheckCircle2 size={15}/>เปิดลิงก์ของฉัน</Link> : <button type="button" disabled={busy || loading} onClick={() => void createFullCatalog()} className="v14-button v14-button--dark">{busy ? <LoaderCircle className="animate-spin" size={15}/> : <Plus size={15}/>} {busy ? "กำลังสร้างลิงก์…" : "สร้างลิงก์ของฉัน"}</button>}
      </div>
      <div className="mt-4 border-t border-emerald-900/15 pt-3 text-sm text-emerald-950">
        {activeFullCatalog ? <>มีลิงก์หน้ารวมสินค้าที่เปิดใช้งานแล้ว: <b>{activeFullCatalog.title}</b></> : <>บัญชีนี้ยังไม่มีลิงก์หน้ารวมสินค้า กด “สร้างลิงก์ของฉัน” เพื่อสร้างร่างทันที แล้วตรวจข้อมูลก่อนเผยแพร่</>}
      </div>
    </section>

    <section id="create-customer-link" className="v14-panel scroll-mt-6">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">New customer link</p><h2>{scopeType === "FULL_CATALOG" ? "สร้างลิงก์หน้ารวมสินค้าของ Member" : "สร้างลิงก์สำหรับลูกค้า"}</h2></div>{scopeType === "FULL_CATALOG" ? <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><ArrowDown size={15}/>สินค้าพร้อมขายทั้งหมด</span> : null}</div>
      <form key={`${profile?.id ?? "profile-loading"}-${scopeType}`} onSubmit={create} className="grid gap-3 md:grid-cols-2">
        <label>รูปแบบลิงก์
          <select value={scopeType} onChange={(event) => setScopeType(event.target.value as SharedCatalogScope)}>
            <option value="CURATED">เลือกและจัดลำดับสินค้าเอง</option>
            {productId ? <option value="PRODUCT">สินค้ารายชิ้นจากหน้าปัจจุบัน</option> : null}
            <option value="PROJECT">สินค้าในโครงการ</option>
            <option value="FULL_CATALOG">สินค้าทั้งหมด แยกตามหมวด</option>
          </select>
        </label>
        {scopeType === "PROJECT" ? <label>โครงการ
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
            <option value="">เลือกโครงการ</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.project_number} — {project.name}</option>)}
          </select>
        </label> : <div className="rounded-xl bg-stone-50 p-3 text-sm">ลูกค้าจะไม่เห็นราคา ชื่อลูกค้า ที่อยู่โครงการ Supplier หรือต้นทุนภายใน</div>}
        <label>ชื่อ Catalog<input name="title" required minLength={2} defaultValue={scopeType === "FULL_CATALOG" && profile?.company_name ? `Catalog สินค้าของ ${profile.company_name}` : ""} placeholder={scopeType === "FULL_CATALOG" ? "สินค้าทั้งหมดของเรา" : "เช่น รายการสินค้าสำหรับบ้านคุณเอ"}/></label>
        <label>ชื่อบริษัทที่แสดง<input name="brandName" required minLength={2} defaultValue={profile?.company_name ?? ""}/></label>
        <label className="md:col-span-2">ข้อความแนะนำ<textarea name="introduction" rows={2}/></label>
        <label>ชื่อผู้ติดต่อ<input name="contactName" defaultValue={profile?.contact_name ?? ""}/></label>
        <label>โทรศัพท์<input name="contactPhone" defaultValue={profile?.contact_phone ?? ""}/></label>
        <label>อีเมล<input name="contactEmail" type="email"/></label>
        <label>LINE URL<input name="lineUrl" type="url" placeholder="https://line.me/ti/p/..."/></label>
        <button disabled={busy || productScopeUnavailable || projectScopeUnavailable} className="v14-button v14-button--dark md:col-span-2">{busy ? <LoaderCircle className="animate-spin"/> : <Plus/>}สร้างลิงก์ร่างและตั้งค่าต่อ</button>
        {productScopeUnavailable ? <p className="text-sm text-red-700 md:col-span-2">กรุณาเปิดหน้ารายละเอียดสินค้าแล้วกด “ส่งสินค้านี้ให้ลูกค้าดู”</p> : null}
      </form>
    </section>

    <section className="v14-panel">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Your customer links</p><h2>รายการทั้งหมด</h2></div></div>
      {loading ? <div className="v14-empty"><LoaderCircle className="animate-spin"/>กำลังโหลด…</div> : items.length ? <div className="grid gap-3">{items.map((item) => {
        const expired = item.expires_at && new Date(item.expires_at).getTime() <= Date.now();
        const Icon = scopeIcon[item.scope_type];
        return <Link key={item.id} href={`/member/shared-catalogs/${item.id}`} className="rounded-xl border border-black/10 p-4 hover:border-emerald-700">
          <div className="flex items-start justify-between gap-3"><span className="flex gap-3"><Icon/><span><small>{scopeLabel[item.scope_type]} · {item.brand_name}</small><h3 className="text-xl font-semibold">{item.title}</h3><small>แก้ไขล่าสุด {new Date(item.updated_at).toLocaleString("th-TH")}</small></span></span><span className="v14-status v14-status--good">{expired ? "หมดอายุ" : statusLabel[item.status] ?? item.status}</span></div>
        </Link>;
      })}</div> : <div className="v14-empty">ยังไม่มีลิงก์ Catalog</div>}
    </section>
  </div>;
}
