"use client";

import { ArrowLeft, Download, LoaderCircle, MapPin, Pencil, Plus, Share2, ShoppingCart, Store, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type OptionChoice = { optionId: string; valueId: string; label: string };
type ProjectItem = { id: string; area_id: string | null; product_id: string | null; variant_id: string | null; product_sku_snapshot: string | null; item_name: string; specification_snapshot: string | null; selected_options: OptionChoice[]; quantity: number; ordered_quantity: number; unit: string; current_unit_price: number; suggested_resale_amount: number | null; freight_estimate_min: number | null; freight_estimate_max: number | null; lead_time_days_snapshot: number | null; status: string };
type Data = {
  project: { id: string; project_number: string; name: string; project_type: string; site_address: string; status: string; expected_need_date: string | null; note: string | null };
  customer: { name: string; phone: string | null; email: string | null; address: string | null } | null;
  areas: Array<{ id: string; name: string; note: string | null }>;
  items: ProjectItem[];
  visits: Array<{ id: string; product_id: string; product_name: string; preferred_at: string; attendee_count: number; note: string | null; status: string; review_note: string | null; visit_instruction: string | null }>;
  disclosures: Array<{ id: string; reason: string; status: string; supplier_name: string | null; supplier_legal_name: string | null; supplier_address: string | null; supplier_city: string | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null; revoke_reason: string | null }>;
};
type Catalog = { items: Array<{ id: string; sku: string; nameTh: string; price: { memberPrice: number } }> };
type Product = { variants: Array<{ id: string; sku: string; name: string }>; options: Array<{ id: string; name: string; isRequired: boolean; values: Array<{ id: string; label: string }> }> };

const visitLabels: Record<string, string> = { SUBMITTED: "รอตรวจ", APPROVED: "อนุมัติแล้ว", COMPLETED: "เสร็จสิ้น", REJECTED: "ไม่อนุมัติ", CANCELLED: "ยกเลิก" };
const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function selectedChoices(product: Product | undefined, selections: Record<string, string>) {
  return (product?.options ?? []).map(option => {
    const value = option.values.find(item => item.id === selections[option.id]);
    return value ? { optionId: option.id, valueId: value.id, label: value.label } : null;
  }).filter((value): value is OptionChoice => Boolean(value));
}

function ItemEditor({ item, areas, busy, onCancel, onSave }: { item: ProjectItem; areas: Data["areas"]; busy: boolean; onCancel: () => void; onSave: (payload: unknown) => Promise<void> }) {
  const [product, setProduct] = useState<Product>();
  const [variantId, setVariantId] = useState(item.variant_id ?? "");
  const [options, setOptions] = useState<Record<string, string>>(Object.fromEntries(item.selected_options.map(option => [option.optionId, option.valueId])));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!item.product_id) return;
    const controller = new AbortController();
    void fetch(`/api/member/catalog/${item.product_id}`, { signal: controller.signal }).then(response => response.json()).then(body => {
      if (!body.data) throw new Error(body.message ?? "โหลดตัวเลือกไม่สำเร็จ");
      setProduct(body.data);
    }).catch(caught => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "โหลดตัวเลือกไม่สำเร็จ"); });
    return () => controller.abort();
  }, [item.product_id]);
  return <form className="mt-3 grid gap-2 rounded-lg border p-3 md:grid-cols-2" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void onSave({ areaId: form.get("areaId") || null, variantId: variantId || null, selectedOptions: selectedChoices(product, options), quantity: Number(form.get("quantity")) }); }}>
    {error ? <p className="text-red-700 md:col-span-2">{error}</p> : null}
    <label>พื้นที่<select name="areaId" defaultValue={item.area_id ?? ""}><option value="">ไม่ระบุพื้นที่</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
    <label>จำนวน<input name="quantity" type="number" min="0.001" step="0.001" defaultValue={item.quantity} required /></label>
    {product?.variants.length ? <label>Variant<select value={variantId} onChange={event => setVariantId(event.target.value)}><option value="">เลือก Variant</option>{product.variants.map(variant => <option key={variant.id} value={variant.id}>{variant.sku} — {variant.name}</option>)}</select></label> : null}
    {product?.options.map(option => <label key={option.id}>{option.name}{option.isRequired ? " *" : ""}<select value={options[option.id] ?? ""} onChange={event => setOptions(current => ({ ...current, [option.id]: event.target.value }))}><option value="">เลือก</option>{option.values.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>)}
    <div className="flex gap-2 md:col-span-2"><button disabled={busy || !product} className="v14-button v14-button--dark">บันทึกรายการ</button><button type="button" onClick={onCancel} className="v14-button v14-button--outline"><X size={14}/>ยกเลิก</button></div>
  </form>;
}

export function MemberProjectDetail({ projectId }: { projectId: string }) {
  const requestedProductId = useSearchParams().get("productId");
  const [data, setData] = useState<Data>();
  const [catalog, setCatalog] = useState<Catalog>({ items: [] });
  const [product, setProduct] = useState<Product>();
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [options, setOptions] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState("");
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch(`/api/member/projects/${projectId}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "โหลดโครงการไม่สำเร็จ");
    setData(body.data);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetch(`/api/member/projects/${projectId}`), fetch("/api/member/catalog?pageSize=60")]).then(async ([projectResponse, catalogResponse]) => {
      const [projectBody, catalogBody] = await Promise.all([projectResponse.json(), catalogResponse.json()]);
      if (cancelled) return;
      if (!projectResponse.ok) throw new Error(projectBody.message ?? "โหลดโครงการไม่สำเร็จ");
      const nextCatalog = catalogBody.data ?? { items: [] };
      setData(projectBody.data); setCatalog(nextCatalog);
      if (requestedProductId && nextCatalog.items.some((item: Catalog["items"][number]) => item.id === requestedProductId)) setProductId(requestedProductId);
    }).catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : "โหลดโครงการไม่สำเร็จ"); });
    return () => { cancelled = true; };
  }, [projectId, requestedProductId]);

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    void fetch(`/api/member/catalog/${productId}`, { signal: controller.signal }).then(response => response.json()).then(body => {
      setProduct(body.data); setVariantId(body.data?.variants?.[0]?.id ?? "");
      setOptions(Object.fromEntries((body.data?.options ?? []).map((option: Product["options"][number]) => [option.id, option.values[0]?.id ?? ""])));
    }).catch(caught => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError("โหลดตัวเลือกสินค้าไม่สำเร็จ"); });
    return () => controller.abort();
  }, [productId]);

  async function mutate(path: string, payload: unknown, method = "POST") {
    setBusy(true); setError("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "ทำรายการไม่สำเร็จ");
      await load(); setEditingId("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ทำรายการไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const selections = Object.entries(orderQuantities).filter(([, quantity]) => quantity > 0);
      if (!selections.length) throw new Error("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
      const response = await fetch("/api/member/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, project_item_ids: selections.map(([id, quantity]) => `${id}:${quantity}`).join(",") }) });
      const body = await response.json() as { data?: string; message?: string };
      if (!response.ok || !body.data) throw new Error(body.message ?? "สร้าง Order ไม่สำเร็จ");
      window.location.href = `/member/orders/${body.data}`;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "สร้าง Order ไม่สำเร็จ"); setBusy(false); }
  }

  const total = useMemo(() => data?.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.current_unit_price), 0) ?? 0, [data]);
  if (!data) return <div className="v14-panel v14-empty">{error || <><LoaderCircle className="animate-spin"/>กำลังโหลดโครงการ…</>}</div>;

  return <div className="member-catalog">
    <Link href="/member/projects" className="member-detail__back"><ArrowLeft/>กลับโครงการ</Link>
    <section className="v14-hero"><div><p className="v14-eyebrow">{data.project.project_number} · {data.project.project_type}</p><h1>{data.project.name}</h1><p><MapPin className="inline" size={15}/> {data.project.site_address}</p><Link href={`/member/shared-catalogs?scope=PROJECT&projectId=${projectId}`} className="v14-button v14-button--outline mt-4"><Share2/>ส่งสินค้าในโครงการให้ลูกค้าดู</Link></div><div className="member-catalog__promise"><strong>{data.items.length} รายการ</strong><span>{money.format(total)} THB ก่อน VAT</span></div></section>
    {error ? <div className="v14-alert"><b>ทำรายการไม่สำเร็จ</b><span>{error}</span></div> : null}

    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Project information</p><h2>ข้อมูลโครงการ</h2></div></div>
      <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`/api/member/projects/${projectId}`, { name: form.get("name"), projectType: form.get("projectType"), endCustomerName: form.get("endCustomerName"), endCustomerPhone: form.get("endCustomerPhone"), endCustomerEmail: form.get("endCustomerEmail"), siteAddress: form.get("siteAddress"), expectedNeedDate: form.get("expectedNeedDate"), note: form.get("note") }, "PATCH"); }} className="grid gap-3 md:grid-cols-2">
        <label>ชื่อโครงการ<input name="name" defaultValue={data.project.name} required /></label><label>ประเภท<select name="projectType" defaultValue={data.project.project_type}><option value="RESIDENTIAL">บ้านพักอาศัย</option><option value="CONDOMINIUM">คอนโดมิเนียม</option><option value="HOSPITALITY">โรงแรม</option><option value="COMMERCIAL">เชิงพาณิชย์</option><option value="OTHER">อื่น ๆ</option></select></label>
        <label>ลูกค้าปลายทาง<input name="endCustomerName" defaultValue={data.customer?.name ?? ""} required /></label><label>โทรศัพท์<input name="endCustomerPhone" defaultValue={data.customer?.phone ?? ""} /></label><label>อีเมล<input name="endCustomerEmail" type="email" defaultValue={data.customer?.email ?? ""} /></label><label>วันที่ต้องการใช้สินค้า<input name="expectedNeedDate" type="date" defaultValue={data.project.expected_need_date ?? ""} /></label>
        <label className="md:col-span-2">ที่อยู่โครงการ<textarea name="siteAddress" defaultValue={data.project.site_address} required /></label><label className="md:col-span-2">หมายเหตุ<textarea name="note" defaultValue={data.project.note ?? ""} /></label><button disabled={busy} className="v14-button v14-button--dark md:col-span-2">บันทึกการแก้ไข</button>
      </form>
    </section>

    <section className="grid gap-4 lg:grid-cols-2"><article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Project areas</p><h2>พื้นที่ในโครงการ</h2></div></div><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`/api/member/projects/${projectId}/areas`, { name: form.get("name"), note: form.get("note") }); event.currentTarget.reset(); }} className="grid gap-2"><input name="name" required placeholder="เช่น ห้องนั่งเล่น"/><input name="note" placeholder="หมายเหตุ"/><button disabled={busy} className="v14-button v14-button--outline"><Plus/>เพิ่มพื้นที่</button></form><div className="mt-4 grid gap-2">{data.areas.map(area => <div key={area.id} className="rounded-lg border p-3"><b>{area.name}</b><small className="block">{area.note}</small></div>)}</div></article>
      <article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Product schedule</p><h2>ดาวน์โหลดและสั่งซื้อ</h2></div></div><div className="grid gap-3"><a className="v14-button v14-button--dark" href={`/api/member/projects/${projectId}/schedule/pdf`}><Download/>PDF</a><a className="v14-button v14-button--outline" href={`/api/member/projects/${projectId}/schedule/excel`}><Download/>Excel</a><Link className="v14-button v14-button--outline" href="/member/orders"><ShoppingCart/>ดู Order ทั้งหมด</Link></div></article></section>

    <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Catalog to project</p><h2>รายการสินค้าในโครงการ</h2></div></div>
      <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`/api/member/projects/${projectId}/items`, { areaId: form.get("areaId") || null, productId, variantId: variantId || null, selectedOptions: selectedChoices(product, options), quantity: Number(form.get("quantity")) }); }} className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"><label>พื้นที่<select name="areaId"><option value="">ไม่ระบุพื้นที่</option>{data.areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>สินค้า<select value={productId} onChange={event => { setProductId(event.target.value); setProduct(undefined); setVariantId(""); setOptions({}); }} required><option value="">เลือกสินค้า</option>{catalog.items.map(item => <option key={item.id} value={item.id}>{item.sku} — {item.nameTh}</option>)}</select></label>{product?.variants.length ? <label>Variant<select value={variantId} onChange={event => setVariantId(event.target.value)}><option value="">เลือก Variant</option>{product.variants.map(variant => <option key={variant.id} value={variant.id}>{variant.sku} — {variant.name}</option>)}</select></label> : null}{product?.options.map(option => <label key={option.id}>{option.name}{option.isRequired ? " *" : ""}<select value={options[option.id] ?? ""} onChange={event => setOptions(current => ({ ...current, [option.id]: event.target.value }))}><option value="">เลือก</option>{option.values.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>)}<label>จำนวน<input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required /></label><button disabled={busy || !productId} className="v14-button v14-button--dark md:col-span-2"><Plus/>เพิ่มเข้าโครงการ</button></form>
      <div className="mt-5 grid gap-3">{data.items.map(item => <article key={item.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><span><b>{item.product_sku_snapshot ?? "STANDARD"} · {item.item_name}</b><small className="block">{data.areas.find(area => area.id === item.area_id)?.name ?? "ไม่ระบุพื้นที่"} · {item.specification_snapshot ?? "—"}</small><small className="block">{item.selected_options.map(option => option.label).join(" · ") || "ไม่มี Option"}</small></span><span className="text-right"><b>{item.quantity} {item.unit}</b><small className="block">{money.format(Number(item.current_unit_price))} THB/หน่วย</small><small className="block">{item.status}</small></span></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => setEditingId(item.id)} className="v14-button v14-button--outline"><Pencil size={14}/>แก้ไข</button>{item.status === "DRAFT" ? <button disabled={busy} type="button" onClick={() => void mutate(`/api/member/projects/${projectId}/items/${item.id}/ready`, {})} className="v14-button v14-button--dark">ยืนยันพร้อมสั่ง</button> : null}</div>{editingId === item.id ? <ItemEditor item={item} areas={data.areas} busy={busy} onCancel={() => setEditingId("")} onSave={payload => mutate(`/api/member/projects/${projectId}/items/${item.id}`, payload, "PATCH")} /> : null}</article>)}</div>
    </section>

    <section className="v14-panel project-order-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Create order</p><h2>เลือกสินค้าที่พร้อมสั่ง</h2></div><small>แบ่งสั่งบางส่วนได้ ระบบ Snapshot ราคา/สเปกและสร้างยอด 50/50 อัตโนมัติ</small></div>
      {data.items.some(item => ["READY_TO_ORDER", "PARTIALLY_ORDERED"].includes(item.status)) ? <form onSubmit={createOrder}><div className="project-order-list">{data.items.filter(item => ["READY_TO_ORDER", "PARTIALLY_ORDERED"].includes(item.status)).map(item => { const remaining = Number(item.quantity) - Number(item.ordered_quantity); const selected = (orderQuantities[item.id] ?? 0) > 0; return <label key={item.id}><input type="checkbox" checked={selected} onChange={(event) => setOrderQuantities(current => ({ ...current, [item.id]: event.target.checked ? remaining : 0 }))}/><span><b>{item.item_name}</b><small>คงเหลือ {remaining} {item.unit} · {money.format(Number(item.current_unit_price))} THB/หน่วย</small></span><input aria-label={`จำนวน ${item.item_name}`} type="number" min="0.001" max={remaining} step="0.001" value={orderQuantities[item.id] ?? 0} onChange={(event) => setOrderQuantities(current => ({ ...current, [item.id]: Number(event.target.value) }))}/></label>})}</div><button disabled={busy} className="v14-button v14-button--dark"><ShoppingCart size={15}/>{busy ? "กำลังสร้าง…" : "สร้าง Order และยอดชำระ 50/50"}</button></form> : <div className="v14-empty"><ShoppingCart/><b>ยังไม่มีสินค้าที่พร้อมสั่ง</b><span>กด “ยืนยันพร้อมสั่ง” ที่รายการสินค้า แล้วกลับมาเลือกจำนวนตรงนี้</span></div>}
    </section>

    <section className="grid gap-4 lg:grid-cols-2"><article className="v14-panel"><p className="v14-eyebrow">Showroom</p><h2>ขอเข้าชม Showroom</h2><p className="text-sm">เลือกสินค้าที่ต้องการชม เมื่อเจ้าหน้าที่ปิดงานเยี่ยมชม ระบบจึงเปิดเผย Supplier ให้อัตโนมัติ</p><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate(`/api/member/projects/${projectId}/showroom-visits`, { productId: form.get("productId"), preferredAt: new Date(String(form.get("preferredAt"))).toISOString(), attendeeCount: Number(form.get("attendees")), note: form.get("note") }); }} className="mt-3 grid gap-2"><select name="productId" required><option value="">เลือกสินค้าในโครงการ</option>{Array.from(new Map(data.items.filter(item => item.product_id).map(item => [item.product_id as string, item])).values()).map(item => <option key={item.product_id} value={item.product_id as string}>{item.product_sku_snapshot} — {item.item_name}</option>)}</select><input name="preferredAt" type="datetime-local" required /><input name="attendees" type="number" min="1" max="50" defaultValue="1" required /><input name="note" placeholder="หมายเหตุ"/><button disabled={busy} className="v14-button v14-button--outline"><Store/>ส่งคำขอ</button></form><div className="mt-4 grid gap-2">{data.visits.map(visit => <div key={visit.id} className="rounded-lg border p-3"><b>{visit.product_name} · {visitLabels[visit.status] ?? visit.status}</b><small className="block">{new Date(visit.preferred_at).toLocaleString("th-TH")} · {visit.attendee_count} คน</small>{visit.visit_instruction ? <small className="block">นัดหมาย: {visit.visit_instruction}</small> : null}{visit.review_note ? <small className="block">หมายเหตุเจ้าหน้าที่: {visit.review_note}</small> : null}{["SUBMITTED", "APPROVED"].includes(visit.status) ? <button type="button" disabled={busy} onClick={() => { const reason = window.prompt("เหตุผลที่ยกเลิกคำขอ") ?? ""; if (reason.trim().length >= 3) void mutate(`/api/member/projects/${projectId}/showroom-visits/${visit.id}/cancel`, { reason }); }} className="mt-2 underline">ยกเลิกคำขอ</button> : null}</div>)}</div></article>
      <article className="v14-panel"><p className="v14-eyebrow">Supplier disclosure</p><h2>ข้อมูล Supplier ที่ได้รับสิทธิ์</h2><p className="text-sm">ข้อมูลนี้จะแสดงเฉพาะหลังการเยี่ยมชมเสร็จสิ้น และอาจถูกถอนสิทธิ์โดย Super Admin</p><div className="mt-4 grid gap-2">{data.disclosures.length ? data.disclosures.map(disclosure => <div key={disclosure.id} className="rounded-lg border p-3"><b>{disclosure.status === "ACTIVE" ? disclosure.supplier_name : "สิทธิ์ถูกถอนแล้ว"}</b>{disclosure.status === "ACTIVE" ? <><small className="block">{disclosure.supplier_legal_name}</small><small className="block">{[disclosure.supplier_address, disclosure.supplier_city].filter(Boolean).join(", ")}</small><small className="block">{[disclosure.contact_name, disclosure.contact_phone, disclosure.contact_email].filter(Boolean).join(" · ")}</small></> : <small className="block">เหตุผล: {disclosure.revoke_reason ?? "—"}</small>}</div>) : <div className="v14-empty">ยังไม่มี Supplier ที่เปิดเผย</div>}</div></article></section>
  </div>;
}
