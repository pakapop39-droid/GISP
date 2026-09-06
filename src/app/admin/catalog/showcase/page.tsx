/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Database, ImageIcon, PackageSearch, ShieldCheck } from "lucide-react";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const GOLDEN_SKUS = ["CN01-1232","CN01-126677","CN01-126679","CN01-127134","CN01-127139","CN01-139895"];
const must = <T,>(result:{data?:T|null;error?:any},label:string):T => {
  if(result.error) throw new Error(`${label}: ${result.error.message??"unknown error"}`);
  return (result.data??[]) as T;
};
const money=new Intl.NumberFormat("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});

export default async function CatalogShowcasePage(){
  await requireAppAccess({permissions:["catalog.read","catalog.cost.read"]});
  const admin=createInsForgeAdminClient();
  const products=must<any[]>(await admin.database.from("products").select("id,sku,name_th,product_type,status,qa_status,supplier_product_code,source_row_number,source_specification_raw,category_id,width_mm,depth_mm,height_mm,material_summary,factory_cost,factory_currency,default_lead_time_days").in("sku",GOLDEN_SKUS).order("sku"),"products");
  const ids=products.map(item=>item.id);
  const categoryIds=[...new Set(products.map(item=>item.category_id).filter(Boolean))];
  const [categories,variants,options,media,costs,prices]=await Promise.all([
    admin.database.from("categories").select("id,code,name_th").in("id",categoryIds),
    admin.database.from("product_variants").select("id,product_id,sku,name,status").in("product_id",ids),
    admin.database.from("product_options").select("id,product_id,name,is_required").in("product_id",ids),
    admin.database.from("product_media").select("id,product_id,file_id,is_primary").in("product_id",ids),
    admin.database.from("product_cost_versions").select("id,product_id,status,factory_cost,currency,factory_cost_thb").in("product_id",ids),
    admin.database.from("product_prices").select("id,product_id,status,amount,currency").in("product_id",ids),
  ]);
  const categoryRows=must<any[]>(categories,"categories");
  const variantRows=must<any[]>(variants,"variants");
  const optionRows=must<any[]>(options,"options");
  const mediaRows=must<any[]>(media,"media");
  const costRows=must<any[]>(costs,"costs");
  const priceRows=must<any[]>(prices,"prices");
  const fileIds=mediaRows.map(item=>item.file_id);
  const fileRows=fileIds.length?must<any[]>(await admin.database.from("file_metadata").select("id,bucket,object_key").in("id",fileIds),"files"):[];
  const imageByProduct=new Map<string,string>();
  const confidential=fileRows.filter(item=>item.bucket==="gisp-confidential");
  if(confidential.length){
    const signed=must<any[]>(await admin.storage.from("gisp-confidential").createSignedUrls(confidential.map(item=>item.object_key),600),"signed images");
    confidential.forEach((file,index)=>{
      const productId=mediaRows.find(item=>item.file_id===file.id&&item.is_primary)?.product_id;
      const url=signed[index]?.signedUrl;
      if(productId&&url) imageByProduct.set(productId,url);
    });
  }
  const categoryById=new Map(categoryRows.map(item=>[item.id,item]));
  const visibleCount=products.filter(item=>item.status==="PUBLISHED").length;
  return <main className="mx-auto grid max-w-[1480px] gap-5 pb-16">
    <section className="rounded-[22px] border border-black/10 bg-[#fbf8f1] p-6 shadow-sm md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="v14-eyebrow">CN01 · GOLDEN SAMPLE MAPPING</p><h1 className="mt-2 max-w-4xl font-serif text-4xl leading-tight tracking-tight md:text-5xl">ข้อมูลต้นทางเดินทางเข้า Application อย่างไร</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-black/60">อ่านข้อมูลจริง 6 รายการจาก Branch โดยไม่เปลี่ยนราคาและไม่ Publish เพิ่ม ใช้ตรวจความเข้าใจก่อนขยาย Mapping ไปครบ 723 รายการ</p></div><div className="flex items-center gap-3 rounded-2xl bg-[#173c31] px-5 py-4 text-white"><ShieldCheck size={22}/><div><strong className="block text-sm">READ-ONLY SHOWCASE</strong><span className="text-xs text-white/60">ไม่แก้ข้อมูลธุรกิจ</span></div></div></div>
    </section>
    <section className="grid overflow-hidden rounded-2xl border border-black/10 bg-white/55 md:grid-cols-5">
      {[["01","Supplier file"],["02","Product master"],["03","Variant & option"],["04","Cost & price"],["05","Member catalog"]].map(([no,label],index)=><div key={no} className="flex min-h-20 items-center gap-3 border-b border-black/10 p-4 md:border-b-0 md:border-r last:border-0"><span className="grid size-8 place-items-center rounded-full bg-[#a83226] text-xs font-black text-white">{no}</span><strong className="text-sm">{label}</strong>{index<4&&<ArrowRight className="ml-auto hidden text-black/25 md:block" size={15}/>}</div>)}
    </section>
    <section className="grid gap-4 md:grid-cols-3"><Metric icon={<PackageSearch size={19}/>} label="GOLDEN SAMPLES" value={String(products.length)} note="สินค้า CN01 ตัวแทน"/><Metric icon={<Database size={19}/>} label="DATABASE MAPPED" value={String(products.length)} note="มี Product master จริง"/><Metric icon={<CheckCircle2 size={19}/>} label="MEMBER VISIBLE" value={String(visibleCount)} note="ต้อง Publish จึงจะมองเห็น"/></section>
    <section className="grid gap-5">{products.map(product=>{
      const category=categoryById.get(product.category_id);
      const productVariants=variantRows.filter(item=>item.product_id===product.id);
      const productOptions=optionRows.filter(item=>item.product_id===product.id);
      const activeCost=costRows.find(item=>item.product_id===product.id&&item.status==="ACTIVE");
      const activePrice=priceRows.find(item=>item.product_id===product.id&&item.status==="ACTIVE");
      const memberVisible=product.status==="PUBLISHED"&&Boolean(activePrice);
      return <article key={product.id} className="overflow-hidden rounded-[22px] border border-black/10 bg-[#fbf8f1] shadow-sm"><div className="grid lg:grid-cols-[270px_1fr]">
        <div className="relative min-h-64 bg-[#e9e2d7]">{imageByProduct.get(product.id)?<img src={imageByProduct.get(product.id)} alt={product.name_th} className="absolute inset-0 h-full w-full object-cover"/>:<div className="grid h-full min-h-64 place-items-center text-black/35"><ImageIcon size={32}/></div>}<span className="absolute left-4 top-4 rounded-full bg-black/75 px-3 py-1 text-[10px] font-black tracking-wider text-white">{product.sku}</span></div>
        <div className="grid gap-5 p-5 md:p-7"><header className="flex flex-col justify-between gap-4 border-b border-black/10 pb-5 md:flex-row md:items-start"><div><p className="text-xs font-black tracking-[.14em] text-[#a83226]">{category?.code??"UNCATEGORIZED"} · {product.product_type}</p><h2 className="mt-2 font-serif text-3xl leading-tight">{product.name_th}</h2><p className="mt-2 text-xs text-black/50">Supplier code {product.supplier_product_code??"—"} · Excel row {product.source_row_number??"—"}</p></div><Status ready={memberVisible} label={memberVisible?"เห็นใน Member Catalog":"ยังเป็น Internal Draft"}/></header>
        <div className="grid gap-3 md:grid-cols-5"><MappingStep title="ข้อมูลต้นทาง" ready={Boolean(product.source_specification_raw)} detail={product.source_specification_raw||"ยังไม่มีสเปกต้นทาง"}/><MappingStep title="Product master" ready detail={`${product.width_mm??"—"} × ${product.depth_mm??"—"} × ${product.height_mm??"—"} mm`}/><MappingStep title="Variant / Option" ready={productVariants.length>0||productOptions.length>0} detail={`${productVariants.length} variant · ${productOptions.length} option`}/><MappingStep title="Cost / Price" ready={Boolean(activeCost&&activePrice)} detail={activeCost?`${money.format(Number(activeCost.factory_cost))} ${activeCost.currency}${activePrice?` → ${money.format(Number(activePrice.amount))} ${activePrice.currency}`:" · ยังไม่มีราคาสมาชิก"}`:"ยังไม่มี Cost version"}/><MappingStep title="Member view" ready={memberVisible} detail={memberVisible?"พร้อมให้สมาชิกค้นหาและเปิดรายละเอียด":"ต้องผ่าน Cost, Price, Review และ Publish"}/></div>
        <div className="grid gap-3 rounded-2xl bg-black/[.035] p-4 md:grid-cols-3"><Info label="วัสดุที่ Map แล้ว" value={product.material_summary||"ยังไม่ได้ยืนยัน Material mapping"}/><Info label="Lead time" value={product.default_lead_time_days?`${product.default_lead_time_days} วัน`:"ยังไม่ได้กำหนด"}/><Info label="สถานะ Workflow" value={`${product.status} / ${product.qa_status}`}/></div>
        <div><Link href={`/admin/catalog/products/${product.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-bold text-white no-underline">เปิด Product Detail จริง <ArrowRight size={15}/></Link></div></div>
      </div></article>})}</section>
  </main>;
}
function Metric({icon,label,value,note}:{icon:React.ReactNode;label:string;value:string;note:string}){return <div className="flex items-center gap-4 rounded-2xl border border-black/10 bg-[#fbf8f1] p-5"><span className="grid size-11 place-items-center rounded-xl bg-[#173c31] text-white">{icon}</span><div><small className="text-[10px] font-black tracking-[.14em] text-black/45">{label}</small><strong className="block text-3xl">{value}</strong><span className="text-xs text-black/50">{note}</span></div></div>}
function Status({ready,label}:{ready:boolean;label:string}){return <span className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-black ${ready?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-900"}`}>{ready?<CheckCircle2 size={14}/>:<CircleDashed size={14}/>} {label}</span>}
function MappingStep({title,detail,ready}:{title:string;detail:string;ready:boolean}){return <div className={`rounded-xl border p-3 ${ready?"border-emerald-900/15 bg-emerald-50/60":"border-amber-900/15 bg-amber-50/70"}`}><div className="flex items-center gap-2">{ready?<CheckCircle2 size={14} className="text-emerald-700"/>:<CircleDashed size={14} className="text-amber-700"/>}<strong className="text-xs">{title}</strong></div><p className="mt-2 line-clamp-4 text-[11px] leading-5 text-black/55">{detail}</p></div>}
function Info({label,value}:{label:string;value:string}){return <div><small className="text-[10px] font-black tracking-wider text-black/40">{label}</small><p className="mt-1 text-xs leading-5 text-black/70">{value}</p></div>}
