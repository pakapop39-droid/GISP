"use client";

import { ArrowLeft, CheckCircle2, LoaderCircle, MapPin, PackageSearch, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { sampleStatusLabels, sampleTypeLabels, warrantyStatusLabels } from "@/lib/catalog/sample-warranty";

type Supplier = { id:string; code:string; name:string; status:string; country_code:string };
type Location = { id:string; supplier_id:string; country_code:string; city:string; location_type:string; public_label:string; address_line:string|null; contact_name:string|null; contact_email:string|null; contact_phone:string|null; status:string };
type Product = { id:string; supplier_id:string; sku:string; name_th:string; product_type:string; status:string; qa_status:string };
type Sample = { id:string; sample_code:string; sample_type:keyof typeof sampleTypeLabels; product_id:string; supplier_location_id:string; display_name:string; member_note:string|null; shelf_location:string|null; availability_status:keyof typeof sampleStatusLabels; internal_note:string|null; created_at:string };
type Warranty = { id:string; supplier_id:string; product_id:string|null; version_number:number; title:string; member_summary:string; terms_text:string; duration_months:number|null; status:keyof typeof warrantyStatusLabels; effective_from:string; effective_until:string|null; activated_at:string|null; created_at:string };
type Data = { suppliers:Supplier[]; locations:Location[]; products:Product[]; samples:Sample[]; warranties:Warranty[] };
type Notice = { kind:"good"|"bad"; text:string };

async function requestJson<T>(url:string, init?:RequestInit):Promise<{data:T;message?:string}> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as { data?:T; message?:string };
  if (!response.ok || body.data === undefined) throw new Error(body.message ?? "ระบบไม่สามารถทำรายการได้");
  return body as {data:T;message?:string};
}

function field(form:FormData, name:string) { return String(form.get(name) ?? "").trim(); }

export function SampleWarrantyWorkspace({ canManageSamples, canManageWarranty }:{canManageSamples:boolean;canManageWarranty:boolean}) {
  const [data, setData] = useState<Data>({suppliers:[],locations:[],products:[],samples:[],warranties:[]});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [locationSupplierId, setLocationSupplierId] = useState("");
  const [sampleProductId, setSampleProductId] = useState("");
  const [warrantySupplierId, setWarrantySupplierId] = useState("");
  const [effectiveNow] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await requestJson<Data>("/api/admin/catalog/samples-warranty");
      setData(body.data);
      setLocationSupplierId(current => current || body.data.suppliers[0]?.id || "");
      setSampleProductId(current => current || body.data.products[0]?.id || "");
      setWarrantySupplierId(current => current || body.data.suppliers[0]?.id || "");
    } catch (error) {
      setNotice({kind:"bad",text:error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ"});
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const suppliers = data.suppliers.filter(item => item.status === "ACTIVE");
  const productMap = useMemo(() => new Map(data.products.map(item => [item.id,item])), [data.products]);
  const supplierMap = useMemo(() => new Map(data.suppliers.map(item => [item.id,item])), [data.suppliers]);
  const locationMap = useMemo(() => new Map(data.locations.map(item => [item.id,item])), [data.locations]);
  const sampleProduct = productMap.get(sampleProductId);
  const sampleLocations = data.locations.filter(item => item.supplier_id === sampleProduct?.supplier_id && item.status === "ACTIVE");
  const warrantyProducts = data.products.filter(item => item.supplier_id === warrantySupplierId);

  async function post(action:Record<string,unknown>, busyKey:string) {
    setBusy(busyKey); setNotice(undefined);
    try {
      const body = await requestJson<{id:string}>("/api/admin/catalog/samples-warranty", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action)});
      setNotice({kind:"good",text:body.message ?? "บันทึกแล้ว"}); await load();
    } catch (error) { setNotice({kind:"bad",text:error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"}); }
    finally { setBusy(""); }
  }

  async function createLocation(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    await post({action:"CREATE_LOCATION",supplierId:field(form,"supplierId"),countryCode:field(form,"countryCode"),city:field(form,"city"),locationType:field(form,"locationType"),publicLabel:field(form,"publicLabel"),addressLine:field(form,"addressLine")||null,contactName:field(form,"contactName")||null,contactEmail:field(form,"contactEmail")||null,contactPhone:field(form,"contactPhone")||null},"location");
    formElement.reset();
  }
  async function createSample(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    await post({action:"CREATE_SAMPLE",productId:field(form,"productId"),supplierLocationId:field(form,"supplierLocationId"),sampleCode:field(form,"sampleCode"),sampleType:field(form,"sampleType"),displayName:field(form,"displayName"),memberNote:field(form,"memberNote")||null,shelfLocation:field(form,"shelfLocation")||null,internalNote:field(form,"internalNote")||null},"sample");
    formElement.reset();
  }
  async function createWarranty(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    await post({action:"CREATE_WARRANTY",supplierId:field(form,"supplierId"),productId:field(form,"productId")||null,title:field(form,"title"),memberSummary:field(form,"memberSummary"),termsText:field(form,"termsText"),durationMonths:field(form,"durationMonths")?Number(field(form,"durationMonths")):null,effectiveFrom:new Date(field(form,"effectiveFrom")).toISOString()},"warranty");
    formElement.reset();
  }

  return <main className="sw-workspace">
    <Link href="/admin/catalog" className="sw-back"><ArrowLeft size={15}/> กลับศูนย์ Catalog</Link>
    <header className="sw-hero">
      <div><p className="v14-eyebrow">Slice 11 · Samples & Partner Warranty</p><h1>ตัวอย่างสินค้าและการรับประกัน</h1><p>ควบคุมจุดให้บริการตัวอย่าง สถานะยืม และฉบับเงื่อนไขรับประกัน โดยแยกข้อมูลภายในออกจาก Member Portal</p></div>
      <button className="v14-button v14-button--outline" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading?"animate-spin":""}/> โหลดใหม่</button>
    </header>
    <section className="sw-rule"><ShieldCheck/><div><strong>Member-safe by design</strong><p>สมาชิกเห็นเฉพาะชื่อ/ประเภท/สถานะ/เมือง/ป้ายสถานที่สาธารณะ ไม่เห็นชื่อ Supplier, ที่อยู่, ผู้ติดต่อ, ชั้นวาง หรือหมายเหตุภายใน</p></div></section>
    {notice ? <div className={`sw-notice sw-notice--${notice.kind}`} role="status">{notice.kind==="good"?<CheckCircle2 size={17}/>:null}{notice.text}</div> : null}
    {loading ? <section className="v14-panel v14-empty"><LoaderCircle className="animate-spin"/>กำลังโหลดข้อมูล…</section> : <>
      <section className="sw-grid">
        <article className="v14-panel sw-form-card">
          <div className="sw-title"><MapPin/><div><p className="v14-eyebrow">Admin only</p><h2>เพิ่มสถานที่เก็บตัวอย่าง</h2></div></div>
          {canManageSamples ? <form onSubmit={createLocation}>
            <label>Supplier<select name="supplierId" value={locationSupplierId} onChange={e=>setLocationSupplierId(e.target.value)} required>{suppliers.map(item=><option value={item.id} key={item.id}>{item.code} — {item.name}</option>)}</select></label>
            <div className="sw-fields"><label>ประเทศ<input name="countryCode" defaultValue={supplierMap.get(locationSupplierId)?.country_code ?? "TH"} maxLength={2} required/></label><label>เมือง<input name="city" placeholder="กรุงเทพฯ" required/></label></div>
            <label>ประเภท<select name="locationType" defaultValue="SHOWROOM"><option value="SHOWROOM">โชว์รูม</option><option value="WAREHOUSE">คลังสินค้า</option><option value="FACTORY">โรงงาน</option></select></label>
            <label>ชื่อที่ให้สมาชิกเห็น<input name="publicLabel" placeholder="โชว์รูมกรุงเทพฯ" required/></label>
            <details><summary>ข้อมูลภายใน (สมาชิกไม่เห็น)</summary><label>ที่อยู่<input name="addressLine"/></label><div className="sw-fields"><label>ผู้ติดต่อ<input name="contactName"/></label><label>โทรศัพท์<input name="contactPhone"/></label></div><label>อีเมล<input type="email" name="contactEmail"/></label></details>
            <button className="v14-button v14-button--dark" disabled={busy==="location"}>{busy==="location"?<LoaderCircle className="animate-spin" size={15}/>:<MapPin size={15}/>}บันทึกสถานที่</button>
          </form>:<p>บัญชีนี้ไม่มีสิทธิ์จัดการตัวอย่าง</p>}
        </article>
        <article className="v14-panel sw-form-card">
          <div className="sw-title"><PackageSearch/><div><p className="v14-eyebrow">Physical sample</p><h2>ลงทะเบียนตัวอย่าง</h2></div></div>
          {canManageSamples ? <form onSubmit={createSample}>
            <label>สินค้า<select name="productId" value={sampleProductId} onChange={e=>setSampleProductId(e.target.value)} required>{data.products.map(item=><option value={item.id} key={item.id}>{item.sku} — {item.name_th} ({item.product_type})</option>)}</select></label>
            <label>ประเภท<select name="sampleType" defaultValue="MATERIAL_SWATCH"><option value="MATERIAL_SWATCH">ตัวอย่างวัสดุ</option><option value="BUILT_IN_DISPLAY" disabled={sampleProduct?.product_type!=="BUILT_IN"}>ชุดตัวอย่าง Built-in {sampleProduct?.product_type!=="BUILT_IN"?"(ต้องเลือกสินค้า Built-in)":""}</option></select></label>
            <label>สถานที่<select name="supplierLocationId" required><option value="">เลือกสถานที่</option>{sampleLocations.map(item=><option value={item.id} key={item.id}>{item.public_label} · {item.city}</option>)}</select></label>
            <div className="sw-fields"><label>รหัสตัวอย่าง<input name="sampleCode" required/></label><label>ชื่อที่แสดง<input name="displayName" required/></label></div>
            <label>ข้อความสำหรับสมาชิก<textarea name="memberNote" placeholder="นัดหมายล่วงหน้าก่อนเข้าชม"/></label>
            <details><summary>ข้อมูลภายใน (สมาชิกไม่เห็น)</summary><label>ตำแหน่งชั้นวาง<input name="shelfLocation"/></label><label>หมายเหตุภายใน<textarea name="internalNote"/></label></details>
            {!sampleLocations.length?<p className="sw-help">ต้องเพิ่มสถานที่ของ Supplier รายนี้ก่อน</p>:null}
            <button className="v14-button v14-button--dark" disabled={busy==="sample"||!sampleLocations.length}>{busy==="sample"?<LoaderCircle className="animate-spin" size={15}/>:<PackageSearch size={15}/>}บันทึกตัวอย่าง</button>
          </form>:<p>บัญชีนี้ไม่มีสิทธิ์จัดการตัวอย่าง</p>}
        </article>
      </section>
      <section className="v14-panel sw-form-card">
        <div className="sw-title"><ShieldCheck/><div><p className="v14-eyebrow">Versioned warranty</p><h2>สร้างฉบับร่างเงื่อนไขรับประกัน</h2><p>เมื่อ Activate ฉบับใหม่ ระบบจะ Retire ฉบับเดิม แต่ Order/Claim เก่าจะคง Snapshot เดิม</p></div></div>
        {canManageWarranty ? <form className="sw-warranty-form" onSubmit={createWarranty}>
          <label>Supplier<select name="supplierId" value={warrantySupplierId} onChange={e=>setWarrantySupplierId(e.target.value)} required>{suppliers.map(item=><option value={item.id} key={item.id}>{item.code} — {item.name}</option>)}</select></label>
          <label>ขอบเขตสินค้า<select name="productId" defaultValue=""><option value="">ทุกสินค้าของ Supplier</option>{warrantyProducts.map(item=><option value={item.id} key={item.id}>{item.sku} — {item.name_th}</option>)}</select></label>
          <div className="sw-fields"><label>ชื่อเงื่อนไข<input name="title" required/></label><label>ระยะเวลา (เดือน)<input name="durationMonths" type="number" min="1" max="600"/></label></div>
          <label>วันที่เริ่มใช้<input name="effectiveFrom" type="datetime-local" defaultValue={effectiveNow} required/></label>
          <label>สรุปสำหรับสมาชิก<textarea name="memberSummary" required/></label><label>เงื่อนไขฉบับเต็ม<textarea name="termsText" rows={5} required/></label>
          <button className="v14-button v14-button--dark" disabled={busy==="warranty"}>{busy==="warranty"?<LoaderCircle className="animate-spin" size={15}/>:<ShieldCheck size={15}/>}บันทึกเป็นฉบับร่าง</button>
        </form>:<p>บัญชีนี้ไม่มีสิทธิ์จัดการการรับประกัน</p>}
      </section>
      <section className="sw-grid sw-grid--records">
        <article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Sample register</p><h2>รายการตัวอย่าง ({data.samples.length})</h2></div></div><div className="sw-list">{data.samples.length?data.samples.map(sample=>{const product=productMap.get(sample.product_id);const location=locationMap.get(sample.supplier_location_id);return <div className="sw-item" key={sample.id}><div><strong>{sample.sample_code} · {sample.display_name}</strong><small>{sampleTypeLabels[sample.sample_type]} · {product?.sku} · {location?.public_label}</small><small className="sw-private">ภายใน: ชั้น {sample.shelf_location||"—"} · {sample.internal_note||"ไม่มีหมายเหตุ"}</small></div><select aria-label={`สถานะ ${sample.sample_code}`} value={sample.availability_status} disabled={!canManageSamples||busy===sample.id} onChange={e=>void post({action:"SET_SAMPLE_STATUS",sampleId:sample.id,status:e.target.value},sample.id)}>{Object.entries(sampleStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>}):<p className="sw-empty">ยังไม่มีตัวอย่าง</p>}</div></article>
        <article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Warranty versions</p><h2>ประวัติการรับประกัน ({data.warranties.length})</h2></div></div><div className="sw-list">{data.warranties.length?data.warranties.map(warranty=><div className="sw-item sw-item--warranty" key={warranty.id}><div><strong>V{warranty.version_number} · {warranty.title}</strong><small>{supplierMap.get(warranty.supplier_id)?.name} · {warranty.product_id?productMap.get(warranty.product_id)?.sku:"ทุกสินค้า"} · {warrantyStatusLabels[warranty.status]}</small><p>{warranty.member_summary}</p></div>{canManageWarranty&&warranty.status==="DRAFT"?<button className="v14-button v14-button--dark" disabled={busy===warranty.id} onClick={()=>void post({action:"ACTIVATE_WARRANTY",warrantyId:warranty.id},warranty.id)}>Activate</button>:canManageWarranty&&warranty.status==="ACTIVE"?<button className="v14-button v14-button--outline" disabled={busy===warranty.id} onClick={()=>void post({action:"RETIRE_WARRANTY",warrantyId:warranty.id},warranty.id)}>Retire</button>:null}</div>):<p className="sw-empty">ยังไม่มีเงื่อนไขรับประกัน</p>}</div></article>
      </section>
    </>}
  </main>;
}
