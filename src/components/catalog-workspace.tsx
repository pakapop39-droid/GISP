"use client";

import {
  ArrowRight,
  Calculator,
  Check,
  Factory,
  LoaderCircle,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Supplier = {
  id: string; code: string; name: string; legal_name?: string | null;
  country_code: string; default_currency: string; contact_name?: string | null;
  status: string; default_lead_time_days?: number | null;
};
type Product = {
  id: string; supplier_id: string; category_id?: string | null; sku: string;
  factory_sku?: string | null; product_type: string; name_th: string;
  name_en?: string | null; country_code: string; status: string; qa_status: string;
};
type Country = { code: string; name_th: string; name_en: string };
type Category = { id: string; code: string; name_th: string; name_en?: string | null };
type Formula = {
  id: string; scope_type: "GLOBAL" | "SUPPLIER" | "PRODUCT"; supplier_id?: string | null;
  product_id?: string | null; version_number: number; name: string; status: string;
  suggested_resale_markup_percent: number; freight_estimate_min_percent: number;
  freight_estimate_max_percent: number; created_at: string;
};
type CostVersion = {
  id: string; factory_cost: number; currency: string; exchange_rate_to_thb: number;
  factory_cost_thb: number; status: string; effective_from: string;
};
type PriceVersion = {
  id: string; amount: number; currency: string; status: string; valid_from: string;
  suggested_resale_amount?: number | null; freight_estimate_min?: number | null;
  freight_estimate_max?: number | null;
};
type FormulaComponent = {
  componentCode: string; componentName: string;
  calculationType: "PERCENTAGE" | "FIXED_AMOUNT_THB";
  calculationBasis: "FACTORY_COST_THB" | "MEMBER_PRICE";
  componentValue: number; includedInMemberPrice: boolean; enabled: boolean; sortOrder: number;
};
type PricePreview = {
  factoryCostThb: number; memberPrice: number; suggestedResalePrice: number;
  freightEstimateMin: number; freightEstimateMax: number; grossMargin: number;
  marginPercent: number; components: Array<{ code: string; name: string; calculatedAmount: number }>;
};
type Tab = "suppliers" | "products" | "pricing";
type ApiBody<T> = { data: T; message?: string; code?: string };

const defaultComponents: FormulaComponent[] = [
  { componentCode: "IMPORT", componentName: "ค่าดำเนินการนำเข้า", calculationType: "PERCENTAGE", calculationBasis: "FACTORY_COST_THB", componentValue: 5, includedInMemberPrice: true, enabled: true, sortOrder: 10 },
  { componentCode: "OPS", componentName: "ค่าดำเนินงาน", calculationType: "PERCENTAGE", calculationBasis: "FACTORY_COST_THB", componentValue: 10, includedInMemberPrice: true, enabled: true, sortOrder: 20 },
  { componentCode: "SERVICE", componentName: "ค่าบริการสมาชิก", calculationType: "PERCENTAGE", calculationBasis: "MEMBER_PRICE", componentValue: 10, includedInMemberPrice: true, enabled: true, sortOrder: 30 },
];
const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiBody<T>> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as Partial<ApiBody<T>> & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "ระบบไม่สามารถทำรายการได้");
  return body as ApiBody<T>;
}

export function CatalogWorkspace({ canManage, canReadCost, canManageCost, canManageFormula }:{
  canManage:boolean; canReadCost:boolean; canManageCost:boolean; canManageFormula:boolean;
}) {
  const [tab, setTab] = useState<Tab>("suppliers");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedFormulaId, setSelectedFormulaId] = useState("");
  const [costs, setCosts] = useState<CostVersion[]>([]);
  const [prices, setPrices] = useState<PriceVersion[]>([]);
  const [components, setComponents] = useState<FormulaComponent[]>(defaultComponents);
  const [scopeType, setScopeType] = useState<Formula["scope_type"]>("GLOBAL");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind:"good"|"bad"; text:string }>();
  const [preview, setPreview] = useState<PricePreview>();

  const load = useCallback(async () => {
    setLoading(true); setNotice(undefined);
    try {
      const [supplierBody, productBody, optionBody, formulaBody] = await Promise.all([
        requestJson<Supplier[]>("/api/admin/suppliers"),
        requestJson<Product[]>("/api/admin/products"),
        requestJson<{ countries:Country[]; categories:Category[] }>("/api/admin/catalog-options"),
        canManageFormula ? requestJson<{ formulas:Formula[] }>("/api/admin/pricing-formulas") : Promise.resolve({ data:{ formulas:[] } }),
      ]);
      setSuppliers(supplierBody.data); setProducts(productBody.data);
      setCountries(optionBody.data.countries); setCategories(optionBody.data.categories);
      setFormulas(formulaBody.data.formulas);
      setSelectedProductId(current => current || productBody.data[0]?.id || "");
      setSelectedFormulaId(current => current || formulaBody.data.formulas[0]?.id || "");
    } catch (error) {
      setNotice({ kind:"bad", text:error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ" });
    } finally { setLoading(false); }
  }, [canManageFormula]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!selectedProductId) return;
    void Promise.all([
      canReadCost ? requestJson<CostVersion[]>(`/api/admin/products/${selectedProductId}/factory-costs`) : Promise.resolve({ data:[] }),
      requestJson<PriceVersion[]>(`/api/admin/products/${selectedProductId}/prices`),
    ]).then(([costBody, priceBody]) => { setCosts(costBody.data); setPrices(priceBody.data); })
      .catch(error => setNotice({ kind:"bad", text:error instanceof Error ? error.message : "โหลดข้อมูลราคาไม่สำเร็จ" }));
  }, [selectedProductId, canReadCost]);

  const selectedProduct = products.find(item => item.id === selectedProductId);
  const supplierMap = useMemo(() => new Map(suppliers.map(item => [item.id, item])), [suppliers]);
  const activePriceCount = prices.filter(price => price.status === "ACTIVE").length;

  async function submitSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("supplier"); setNotice(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const body = await requestJson<{id:string}>("/api/admin/suppliers", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        code:form.get("code"), name:form.get("name"), legalName:form.get("legalName") || null,
        countryCode:form.get("countryCode"), defaultCurrency:form.get("defaultCurrency"),
        contactName:form.get("contactName") || null, contactEmail:form.get("contactEmail") || null,
        contactPhone:form.get("contactPhone") || null, websiteUrl:form.get("websiteUrl") || null,
        defaultLeadTimeDays:form.get("leadDays") ? Number(form.get("leadDays")) : null,
      }) });
      event.currentTarget.reset(); setNotice({kind:"good",text:`${body.message} ขั้นต่อไป: สร้าง Product Draft`}); await load();
    } catch (error) { setNotice({kind:"bad",text:error instanceof Error ? error.message : "สร้าง Supplier ไม่สำเร็จ"}); }
    finally { setBusy(""); }
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("product"); setNotice(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const body = await requestJson<{id:string}>("/api/admin/products", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        supplierId:form.get("supplierId"), categoryId:form.get("categoryId") || null,
        sku:form.get("sku"), factorySku:form.get("factorySku") || null,
        nameTh:form.get("nameTh"), nameEn:form.get("nameEn") || null,
        productType:form.get("productType"), countryCode:form.get("countryCode"),
        defaultLeadTimeDays:form.get("leadDays") ? Number(form.get("leadDays")) : null,
      }) });
      event.currentTarget.reset(); setSelectedProductId(body.data.id);
      setNotice({kind:"good",text:body.message ?? "สร้าง Product Draft แล้ว"}); window.location.assign(`/admin/catalog/products/${body.data.id}`);
    } catch (error) { setNotice({kind:"bad",text:error instanceof Error ? error.message : "สร้าง Product ไม่สำเร็จ"}); }
    finally { setBusy(""); }
  }

  async function submitCost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedProductId) return;
    const form = new FormData(event.currentTarget); setBusy("cost"); setNotice(undefined);
    try {
      const body = await requestJson<{id:string}>(`/api/admin/products/${selectedProductId}/factory-costs`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        variantId:null, factoryCost:Number(form.get("factoryCost")), currency:form.get("currency"), exchangeRateToThb:Number(form.get("exchangeRate")),
      }) });
      setNotice({kind:"good",text:`${body.message} ขั้นต่อไป: Preview สูตรราคา`});
      const costBody = await requestJson<CostVersion[]>(`/api/admin/products/${selectedProductId}/factory-costs`); setCosts(costBody.data);
    } catch (error) { setNotice({kind:"bad",text:error instanceof Error ? error.message : "บันทึกต้นทุนไม่สำเร็จ"}); }
    finally { setBusy(""); }
  }

  async function submitFormula(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy("formula"); setNotice(undefined);
    const scopedSupplier = scopeType === "SUPPLIER" ? String(form.get("scopeId") || "") : null;
    const scopedProduct = scopeType === "PRODUCT" ? String(form.get("scopeId") || "") : null;
    try {
      const body = await requestJson<{id:string}>("/api/admin/pricing-formulas", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        scopeType, supplierId:scopedSupplier, productId:scopedProduct, name:form.get("formulaName"),
        suggestedResaleMarkupPercent:Number(form.get("resaleMarkup")),
        freightEstimateMinPercent:Number(form.get("freightMin")), freightEstimateMaxPercent:Number(form.get("freightMax")), components,
      }) });
      setSelectedFormulaId(body.data.id); setNotice({kind:"good",text:`${body.message} ขั้นต่อไป: Preview ก่อนเปิดใช้`}); await load();
    } catch (error) { setNotice({kind:"bad",text:error instanceof Error ? error.message : "บันทึกสูตรไม่สำเร็จ"}); }
    finally { setBusy(""); }
  }

  async function previewFormula() {
    if (!selectedFormulaId || !selectedProductId) { setNotice({kind:"bad",text:"กรุณาเลือก Product และ Formula ก่อน"}); return; }
    setBusy("preview"); setNotice(undefined);
    try {
      const body = await requestJson<PricePreview>(`/api/admin/pricing-formulas/${selectedFormulaId}/preview`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({productId:selectedProductId,variantId:null}) });
      setPreview(body.data); setNotice({kind:"good",text:"คำนวณตัวอย่างแล้ว ยังไม่มีการเปลี่ยนราคาที่ใช้งานจริง"});
    } catch (error) { setNotice({kind:"bad",text:error instanceof Error ? error.message : "Preview ไม่สำเร็จ"}); }
    finally { setBusy(""); }
  }

  async function activateFormula() {
    const formula = formulas.find(item => item.id === selectedFormulaId);
    if (!formula || formula.status !== "DRAFT" || !window.confirm(`เปิดใช้สูตร “${formula.name}” ใช่หรือไม่?`)) return;
    setBusy("activate-formula");
    try { const body=await requestJson<{id:string}>(`/api/admin/pricing-formulas/${formula.id}/activate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmed:true})});setNotice({kind:"good",text:`${body.message} ขั้นต่อไป: เปิดใช้ราคาสมาชิกของ Product`});await load(); }
    catch(error){setNotice({kind:"bad",text:error instanceof Error?error.message:"เปิดใช้สูตรไม่สำเร็จ"});}
    finally{setBusy("");}
  }

  async function activateMemberPrice() {
    if (!selectedProductId || !window.confirm("ยืนยันคำนวณและเปิดใช้ราคาสมาชิกจากต้นทุนและสูตร Active ปัจจุบัน?")) return;
    setBusy("activate-price");
    try { const body=await requestJson<{id:string}>(`/api/admin/products/${selectedProductId}/member-prices`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({variantId:null,confirmed:true})});setNotice({kind:"good",text:`${body.message} Product พร้อมเข้าสู่ขั้น Review/Publish`});const priceBody=await requestJson<PriceVersion[]>(`/api/admin/products/${selectedProductId}/prices`);setPrices(priceBody.data); }
    catch(error){setNotice({kind:"bad",text:error instanceof Error?error.message:"เปิดใช้ราคาไม่สำเร็จ"});}
    finally{setBusy("");}
  }

  function updateComponent(index:number, field:keyof FormulaComponent, value:string|number|boolean) {
    setComponents(current => current.map((item,itemIndex)=>itemIndex===index?{...item,[field]:value}:item));
  }

  return <div className="catalog-workspace">
    <section className="v14-hero catalog-hero"><div><p className="v14-eyebrow">Catalog operations</p><h1>สินค้า โรงงาน และโครงสร้างราคา</h1><p>จัดการโรงงาน สินค้า ต้นทุน และราคาสมาชิก พร้อมตรวจความครบถ้วนก่อนเผยแพร่สินค้า</p><Link className="v14-button v14-button--outline catalog-sample-link" href="/admin/catalog/samples-warranty"><PackagePlus size={14}/> ตัวอย่างสินค้าและการรับประกัน</Link></div><div className="catalog-hero__seal"><ShieldCheck size={18}/><span>SERVER CALCULATED</span><small>ต้นทุนไม่ออกสู่ Member API</small></div></section>

    <div className="catalog-flow" aria-label="ขั้นตอนการทำงาน">
      {[[Factory,"01","Supplier"],[PackagePlus,"02","Product Draft"],[Calculator,"03","Factory Cost"],[Sparkles,"04","Member Price"]].map(([Icon,no,label],index)=><div key={String(label)} className="catalog-flow__step">{index>0&&<ArrowRight className="catalog-flow__arrow" size={14}/>}<span>{typeof Icon!=="string"&&<Icon size={15}/>}</span><small>{String(no)}</small><strong>{String(label)}</strong></div>)}
    </div>

    <section className="catalog-metrics">
      <Metric label="SUPPLIERS" value={suppliers.length} note="โรงงานในระบบ"/>
      <Metric label="PRODUCTS" value={products.length} note="สินค้าและ Draft"/>
      <Metric label="ACTIVE FORMULAS" value={formulas.filter(item=>item.status==="ACTIVE").length} note="สูตรที่กำลังใช้งาน"/>
      <Metric label="PRICE STATUS" value={activePriceCount} note="สินค้าที่เลือกมีราคา Active"/>
    </section>

    {notice&&<div className={`catalog-notice catalog-notice--${notice.kind}`} role="status">{notice.kind==="good"?<Check size={15}/>:null}<span>{notice.text}</span></div>}

    <div className="catalog-tabs" role="tablist" aria-label="Catalog workspace">
      <button className={tab==="suppliers"?"active":""} onClick={()=>setTab("suppliers")}>01 Supplier</button>
      <button className={tab==="products"?"active":""} onClick={()=>setTab("products")}>02 Product Draft</button>
      <button className={tab==="pricing"?"active":""} onClick={()=>setTab("pricing")}>03 Cost & Formula</button>
      <button className="catalog-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={13} className={loading?"animate-spin":""}/>โหลดข้อมูลใหม่</button>
    </div>

    {loading?<section className="v14-panel catalog-loading"><LoaderCircle className="animate-spin"/>กำลังโหลดข้อมูลจริง…</section>:null}
    {!loading&&tab==="suppliers"?<section className="catalog-split">
      <div className="v14-panel"><PanelHead eyebrow="Supplier master" title="รายชื่อโรงงาน" note={`${suppliers.length} รายการ`}/><div className="catalog-table"><div className="catalog-table__head"><span>รหัส / โรงงาน</span><span>ประเทศ</span><span>สกุลเงิน</span><span>สถานะ</span></div>{suppliers.map(item=><div className="catalog-table__row" key={item.id}><span><strong>{item.code}</strong><small>{item.name}</small></span><span>{item.country_code}</span><span>{item.default_currency}</span><Status value={item.status}/></div>)}{!suppliers.length&&<Empty text="ยังไม่มี Supplier เริ่มจากแบบฟอร์มด้านขวา"/>}</div></div>
      <form className="v14-panel catalog-form" onSubmit={submitSupplier}><PanelHead eyebrow="New supplier" title="เพิ่มโรงงาน" note="สร้างเป็น Prospect ก่อน"/><fieldset disabled={!canManage||busy==="supplier"}><div className="v14-grid v14-grid--2"><Field name="code" label="รหัส Supplier *" placeholder="SUP-CN-001"/><Field name="name" label="ชื่อโรงงาน *" placeholder="Guangdong Living"/></div><Field name="legalName" label="ชื่อนิติบุคคล"/><div className="v14-grid v14-grid--2"><Select name="countryCode" label="ประเทศ *" options={countries.map(c=>[c.code,`${c.name_th} (${c.code})`])}/><Select name="defaultCurrency" label="สกุลเงิน *" options={[["CNY","CNY"],["THB","THB"],["USD","USD"]]}/></div><div className="v14-grid v14-grid--2"><Field name="contactName" label="ผู้ติดต่อ"/><Field name="contactEmail" type="email" label="อีเมล"/></div><div className="v14-grid v14-grid--2"><Field name="contactPhone" label="โทรศัพท์"/><Field name="leadDays" type="number" min="1" label="Lead time (วัน)"/></div><Field name="websiteUrl" type="url" label="เว็บไซต์" placeholder="https://"/><button className="v14-button v14-button--dark" disabled={!canManage||busy==="supplier"}>{busy==="supplier"?<LoaderCircle className="animate-spin" size={14}/>:<Plus size={14}/>}สร้าง Supplier</button></fieldset>{!canManage&&<PermissionNote/>}</form>
    </section>:null}

    {!loading&&tab==="products"?<section className="catalog-split">
      <div className="v14-panel"><PanelHead eyebrow="Product master" title="Product Draft" note={`${products.length} รายการ`}/><div className="catalog-table"><div className="catalog-table__head catalog-table__head--product"><span>SKU / ชื่อสินค้า</span><span>Supplier</span><span>ประเภท</span><span>สถานะ</span></div>{products.map(item=><button type="button" className="catalog-table__row catalog-table__row--product" key={item.id} onClick={()=>window.location.assign(`/admin/catalog/products/${item.id}`)}><span><strong>{item.sku}</strong><small>{item.name_th} · เปิด Product Detail</small></span><span>{supplierMap.get(item.supplier_id)?.name??"—"}</span><span>{item.product_type}</span><Status value={item.status}/></button>)}{!products.length&&<Empty text="ยังไม่มี Product สร้าง Supplier ก่อน แล้วเพิ่มสินค้าได้ที่นี่"/>}</div></div>
      <form className="v14-panel catalog-form" onSubmit={submitProduct}><PanelHead eyebrow="New product" title="สร้าง Product Draft" note="ยังไม่ต้องกรอกราคา"/><fieldset disabled={!canManage||busy==="product"}><Select name="supplierId" label="Supplier *" options={suppliers.map(s=>[s.id,`${s.code} — ${s.name}`])}/><div className="v14-grid v14-grid--2"><Field name="sku" label="GISP SKU *" placeholder="CHR-001"/><Field name="factorySku" label="Factory SKU"/></div><Field name="nameTh" label="ชื่อสินค้า (ไทย) *"/><Field name="nameEn" label="ชื่อสินค้า (อังกฤษ)"/><div className="v14-grid v14-grid--2"><Select name="productType" label="ประเภทสินค้า *" options={[["STANDARD","Standard"],["READY_TO_ORDER","Ready to order"],["BUILT_IN","Built-in"],["MATERIAL","Material"],["EQUIPMENT","Equipment"],["DECORATIVE","Decorative"],["CUSTOM_TEMPLATE","Custom template"]]}/><Select name="countryCode" label="ประเทศต้นทาง *" options={countries.map(c=>[c.code,`${c.name_th} (${c.code})`])}/></div><Select name="categoryId" label="หมวดหมู่" allowEmpty options={categories.map(c=>[c.id,`${c.code} — ${c.name_th}`])}/><Field name="leadDays" type="number" min="1" label="Lead time (วัน)"/><button className="v14-button v14-button--dark" disabled={!canManage||!suppliers.length||busy==="product"}>{busy==="product"?<LoaderCircle className="animate-spin" size={14}/>:<PackagePlus size={14}/>}สร้าง Product Draft</button></fieldset>{!canManage&&<PermissionNote/>}</form>
    </section>:null}

    {!loading&&tab==="pricing"?<section className="catalog-pricing">
      <div className="v14-panel catalog-pricing__selector"><PanelHead eyebrow="Price cockpit" title="เลือกสินค้า" note="ต้นทุนและสูตรแยกเวอร์ชัน"/><Select name="selectedProduct" label="Product" value={selectedProductId} onChange={e=>{setSelectedProductId(e.target.value);setPreview(undefined)}} options={products.map(p=>[p.id,`${p.sku} — ${p.name_th}`])}/>{selectedProduct&&<div className="catalog-product-chip"><span><strong>{selectedProduct.sku}</strong><small>{supplierMap.get(selectedProduct.supplier_id)?.name}</small></span><Status value={selectedProduct.status}/></div>}</div>

      <div className="catalog-pricing__grid">
        <div className="catalog-pricing__controls">
        <form className="v14-panel catalog-form" onSubmit={submitCost}><PanelHead eyebrow="Factory cost" title="ต้นทุนล่าสุด" note={costs[0]?`${money.format(costs[0].factory_cost_thb)} THB` : "ยังไม่มีต้นทุน"}/>{costs[0]&&<div className="catalog-cost-current"><span>{money.format(costs[0].factory_cost)} {costs[0].currency}</span><ArrowRight size={13}/><strong>{money.format(costs[0].factory_cost_thb)} THB</strong><small>Rate {costs[0].exchange_rate_to_thb}</small></div>}<fieldset disabled={!canManageCost||!selectedProductId||busy==="cost"}><div className="v14-grid v14-grid--2"><Field name="factoryCost" type="number" min="0" step="0.0001" label="Factory Cost *"/><Select name="currency" label="สกุลเงิน *" options={[["CNY","CNY"],["THB","THB"],["USD","USD"]]}/></div><Field name="exchangeRate" type="number" min="0.00000001" step="0.00000001" label="อัตราแลกเปลี่ยนเป็น THB *"/><button className="v14-button v14-button--dark" disabled={!canManageCost||!selectedProductId||busy==="cost"}>{busy==="cost"?<LoaderCircle className="animate-spin" size={14}/>:<Save size={14}/>}บันทึกต้นทุนเวอร์ชันใหม่</button></fieldset>{!canManageCost&&<PermissionNote/>}</form>

        <div className="v14-panel"><PanelHead eyebrow="Formula versions" title="เลือกสูตรเพื่อ Preview" note={`${formulas.length} เวอร์ชัน`}/><div className="catalog-formula-list">{formulas.map(item=><button type="button" key={item.id} className={selectedFormulaId===item.id?"active":""} onClick={()=>{setSelectedFormulaId(item.id);setPreview(undefined)}}><span><strong>{item.name}</strong><small>{item.scope_type} · Version {item.version_number}</small></span><Status value={item.status}/></button>)}{!formulas.length&&<Empty text="ยังไม่มีสูตรราคา สร้างสูตรด้านล่าง"/>}</div><div className="v14-actions"><button type="button" className="v14-button v14-button--outline" onClick={previewFormula} disabled={!selectedFormulaId||!selectedProductId||busy==="preview"}>{busy==="preview"?<LoaderCircle className="animate-spin" size={14}/>:<Calculator size={14}/>}Preview</button><button type="button" className="v14-button" onClick={activateFormula} disabled={formulas.find(f=>f.id===selectedFormulaId)?.status!=="DRAFT"||busy==="activate-formula"}>เปิดใช้ Formula</button></div></div>
        </div>

        <div className="v14-panel catalog-preview"><PanelHead eyebrow="Calculation preview" title="ผลคำนวณ" note="ข้อมูลลับสำหรับทีมภายใน"/>{preview?<><div className="catalog-preview__price"><small>MEMBER PRICE</small><strong>{money.format(preview.memberPrice)} <span>THB</span></strong><p>ต้นทุน {money.format(preview.factoryCostThb)} · Margin {money.format(preview.marginPercent)}%</p></div><dl className="catalog-preview__breakdown">{preview.components.map(item=><div key={item.code}><dt>{item.name}</dt><dd>+ {money.format(item.calculatedAmount)}</dd></div>)}<div><dt>Suggested resale</dt><dd>{money.format(preview.suggestedResalePrice)}</dd></div><div><dt>Freight estimate</dt><dd>{money.format(preview.freightEstimateMin)}–{money.format(preview.freightEstimateMax)}</dd></div></dl><button type="button" className="v14-button v14-button--dark" onClick={activateMemberPrice} disabled={busy==="activate-price"}>{busy==="activate-price"?<LoaderCircle className="animate-spin" size={14}/>:<Sparkles size={14}/>}เปิดใช้ราคาสมาชิก</button></>:<Empty text="เลือก Product และ Formula แล้วกด Preview ระบบจะยังไม่บันทึกราคาจนกว่าจะยืนยัน"/>}{prices[0]&&<div className="catalog-active-price"><Status value={prices[0].status}/><span>ราคาปัจจุบัน</span><strong>{money.format(prices[0].amount)} {prices[0].currency}</strong></div>}</div>
      </div>

      {canManageFormula?<form className="v14-panel catalog-builder" onSubmit={submitFormula}><PanelHead eyebrow="Formula builder" title="สร้างสูตรราคาเวอร์ชันใหม่" note="สูตรทุกเวอร์ชันเริ่มเป็น Draft"/><div className="catalog-builder__top"><Field name="formulaName" label="ชื่อ Formula *" placeholder="Global Standard 2026"/><label>ขอบเขตสูตร<select value={scopeType} onChange={e=>setScopeType(e.target.value as Formula["scope_type"])}><option value="GLOBAL">Global — ใช้เป็นฐานทุกสินค้า</option><option value="SUPPLIER">Supplier — ทับเฉพาะโรงงาน</option><option value="PRODUCT">Product — ทับเฉพาะสินค้า</option></select></label>{scopeType!=="GLOBAL"?<Select name="scopeId" label={scopeType==="SUPPLIER"?"เลือก Supplier *":"เลือก Product *"} options={(scopeType==="SUPPLIER"?suppliers:products).map(item=>[item.id,"code" in item?`${item.code} — ${item.name}`:`${item.sku} — ${item.name_th}`])}/>:<div className="catalog-global-note"><ShieldCheck size={16}/><span>Global Formula เป็นฐาน และสามารถถูก Supplier/Product Formula ทับได้</span></div>}</div><div className="catalog-builder__rates"><Field name="resaleMarkup" type="number" min="0" step="0.01" defaultValue="25" label="Suggested resale markup (%)"/><Field name="freightMin" type="number" min="0" step="0.01" defaultValue="15" label="Freight ต่ำสุด (%)"/><Field name="freightMax" type="number" min="0" step="0.01" defaultValue="20" label="Freight สูงสุด (%)"/></div><div className="catalog-components"><div className="catalog-components__head"><span>ส่วนประกอบราคา</span><button type="button" onClick={()=>setComponents(current=>[...current,{componentCode:`ITEM${current.length+1}`,componentName:"รายการใหม่",calculationType:"PERCENTAGE",calculationBasis:"FACTORY_COST_THB",componentValue:0,includedInMemberPrice:true,enabled:true,sortOrder:(current.length+1)*10}])}><Plus size={13}/>เพิ่มรายการ</button></div>{components.map((item,index)=><div className="catalog-component" key={`${item.componentCode}-${index}`}><input aria-label="Component code" value={item.componentCode} onChange={e=>updateComponent(index,"componentCode",e.target.value.toUpperCase())}/><input aria-label="Component name" value={item.componentName} onChange={e=>updateComponent(index,"componentName",e.target.value)}/><select aria-label="Calculation type" value={item.calculationType} onChange={e=>updateComponent(index,"calculationType",e.target.value)}><option value="PERCENTAGE">เปอร์เซ็นต์</option><option value="FIXED_AMOUNT_THB">จำนวนเงิน THB</option></select><select aria-label="Calculation basis" value={item.calculationBasis} onChange={e=>updateComponent(index,"calculationBasis",e.target.value)}><option value="FACTORY_COST_THB">จากต้นทุน THB</option><option value="MEMBER_PRICE">จากราคาสะสม</option></select><input aria-label="Component value" type="number" min="0" step="0.01" value={item.componentValue} onChange={e=>updateComponent(index,"componentValue",Number(e.target.value))}/><label className="catalog-check"><input type="checkbox" checked={item.includedInMemberPrice} onChange={e=>updateComponent(index,"includedInMemberPrice",e.target.checked)}/>รวมในราคา</label><button type="button" aria-label="ลบส่วนประกอบ" onClick={()=>setComponents(current=>current.filter((_,i)=>i!==index))}><Trash2 size={14}/></button></div>)}</div><button className="v14-button v14-button--dark" disabled={busy==="formula"||!components.length}>{busy==="formula"?<LoaderCircle className="animate-spin" size={14}/>:<Save size={14}/>}บันทึก Formula Draft</button></form>:<section className="v14-panel"><PermissionNote/></section>}
    </section>:null}
  </div>;
}

function Metric({label,value,note}:{label:string;value:number;note:string}){return <div><small>{label}</small><strong>{String(value).padStart(2,"0")}</strong><span>{note}</span></div>}
function PanelHead({eyebrow,title,note}:{eyebrow:string;title:string;note:string}){return <div className="v14-panel__head"><div><p className="v14-eyebrow">{eyebrow}</p><h2>{title}</h2></div><small>{note}</small></div>}
function Field({label,...props}:{label:string}&React.InputHTMLAttributes<HTMLInputElement>){return <label>{label}<input required={label.includes("*")} {...props}/></label>}
function Select({label,options,allowEmpty=false,...props}:{label:string;options:Array<[string,string]>;allowEmpty?:boolean}&React.SelectHTMLAttributes<HTMLSelectElement>){return <label>{label}<select required={label.includes("*")} {...props}>{allowEmpty&&<option value="">— ไม่ระบุ —</option>}{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>}
function Status({value}:{value:string}){const kind=value==="ACTIVE"||value==="PUBLISHED"?"good":value==="DRAFT"||value==="PROSPECT"?"warn":value==="SUSPENDED"?"bad":"neutral";return <span className={`v14-status v14-status--${kind}`}>{value}</span>}
function Empty({text}:{text:string}){return <div className="v14-empty">{text}</div>}
function PermissionNote(){return <p className="catalog-permission-note">บัญชีนี้ดูข้อมูลได้ แต่ไม่มีสิทธิ์แก้ไข</p>}

