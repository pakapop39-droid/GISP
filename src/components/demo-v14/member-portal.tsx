"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, BookOpen, Boxes, ClipboardList, CreditCard,
  FileText, FolderKanban, Home, Landmark, MessageSquareQuote, PackageCheck,
  ShieldCheck, Truck, UserRound, Warehouse,
} from "lucide-react";
import { memberSafeSnapshot } from "@/demo";
import { useV14 } from "./v14-context";
import { baht, Empty, Handoff, Metric, PageHero, Panel, PortalShell, Status, type NavItem } from "./v14-ui";

const nav: NavItem[] = [
  { key: "home", label: "Home & Action Required", icon: Home },
  { key: "account", label: "Account & Company", icon: UserRound },
  { key: "catalog", label: "Catalog", icon: BookOpen },
  { key: "visits", label: "Material Sample & Visits", icon: Landmark },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "rfq", label: "Custom RFQ", icon: ClipboardList },
  { key: "quotations", label: "Quotations", icon: MessageSquareQuote },
  { key: "orders", label: "Orders & Payments", icon: CreditCard },
  { key: "qc", label: "Production & QC", icon: PackageCheck },
  { key: "shipments", label: "Shipments & Delivery", icon: Truck },
  { key: "claims", label: "Claims", icon: AlertTriangle },
  { key: "documents", label: "Documents", icon: FileText },
];

const tone = (value: string) => value.includes("APPROVED") || value.includes("VERIFIED") || value.includes("ACCEPTED") || value.includes("PASSED") || value.includes("DELIVERED") || value.includes("CLOSED") ? "good" : value.includes("REJECT") || value.includes("FAILED") ? "bad" : value.includes("PENDING") || value.includes("WAITING") || value.includes("SUBMITTED") ? "warn" : "neutral";

export function MemberPortal({ initialScreen = "home" }: { initialScreen?: string }) {
  const { state, run, act } = useV14();
  const safe = useMemo(() => memberSafeSnapshot(state), [state]);
  const screen = nav.some((item) => item.key === initialScreen) ? initialScreen : "home";
  const [email, setEmail] = useState("nara@atelier-demo.example");
  const [company, setCompany] = useState(safe.memberApplication.companyName);
  const [taxId, setTaxId] = useState(safe.memberApplication.taxId);
  const [amount, setAmount] = useState("50000.00");
  const approved = safe.memberApplication.status === "APPROVED";

  return (
    <PortalShell kind="member" title="Atelier Nara" subtitle="หนึ่งบัญชี · หนึ่ง Member Profile" screen={screen} nav={nav} topRight={<Status tone={approved ? "good" : "warn"}>{safe.memberApplication.status}</Status>}>
      {screen === "home" && <MemberHome safe={safe} approved={approved} />}
      {screen === "account" && <Account />}
      {screen === "catalog" && <Catalog />}
      {screen === "visits" && <Visits />}
      {screen === "projects" && <Projects />}
      {screen === "rfq" && <Rfq />}
      {screen === "quotations" && <Quotations />}
      {screen === "orders" && <Orders />}
      {screen === "qc" && <Qc />}
      {screen === "shipments" && <Shipments />}
      {screen === "claims" && <Claims />}
      {screen === "documents" && <Documents />}
    </PortalShell>
  );

  function Account() {
    return <><PageHero eyebrow="01 · FOUNDATION" title="Account & Company" description="สมัครบัญชี Demo และส่งข้อมูลบริษัทให้ทีม GISP ตรวจ โดย Password ไม่ถูกเก็บใน State หรือ Audit" action={<Handoff href="/v1-4/admin?screen=members" label="เปิดฝั่งผู้อนุมัติ"/>}/>
      <div className="v14-grid v14-grid--2"><Panel eyebrow="DEMO ACCOUNT" title="ข้อมูลผู้สมัคร"><label>Email<input value={email} onChange={(e)=>setEmail(e.target.value)}/></label><label>Password จำลอง<input type="password" defaultValue="demo-password"/></label><button className="v14-button" disabled={safe.memberApplication.registered} onClick={()=>run("MEMBER",{type:"REGISTER_DEMO_ACCOUNT",email})}>{safe.memberApplication.registered?"บัญชี Demo พร้อมแล้ว":"สมัครบัญชี Demo"}</button><p className="v14-help"><ShieldCheck size={15}/> Password ใช้แสดงขั้นตอนเท่านั้นและไม่บันทึก</p></Panel>
      <Panel eyebrow="COMPANY APPLICATION" title="ขออนุมัติบริษัท"><label>ชื่อบริษัท<input value={company} onChange={(e)=>setCompany(e.target.value)}/></label><label>เลขผู้เสียภาษี<input value={taxId} onChange={(e)=>setTaxId(e.target.value)}/></label><button className="v14-button v14-button--dark" onClick={()=>run("MEMBER",{type:"SUBMIT_MEMBER_APPLICATION",companyName:company,taxId})}>ส่งข้อมูลให้ GISP ตรวจ</button><div className="v14-summary-row"><span>สถานะปัจจุบัน</span><Status tone={tone(safe.memberApplication.status)}>{safe.memberApplication.status}</Status></div></Panel></div>
      <Panel eyebrow="PERMISSION GUARD" title="ทดลองเข้าระบบก่อนอนุมัติ"><p>กดปุ่มนี้ขณะสถานะ Pending ระบบต้องปฏิเสธ Catalog/Project เมื่อ Admin อนุมัติแล้วจึงจะผ่าน</p><button className="v14-button v14-button--outline" onClick={()=>run("MEMBER",{type:"RUN_PERMISSION_CASE",caseId:"permission-pending"})}>ทดสอบ Pending Member</button><div className="v14-list">{state.workflow.permissionCases.map((item)=><div key={item.id}><b>{item.label}</b><span>{item.detail}</span><Status tone={item.result==="DENIED"?"good":"neutral"}>{item.result}</Status></div>)}</div></Panel></>;
  }

  function Catalog() {
    if (!approved) return <LockedPage title="Catalog ถูกล็อก" />;
    return <><PageHero eyebrow="02 · MEMBER-SAFE CATALOG" title="Catalog" description="เห็นราคา Member, ราคาขายต่อแนะนำ, ค่าขนส่งประมาณการ และ Sample โดยไม่เห็นต้นทุน สูตร Margin หรือข้อมูลภายใน"/><div className="v14-card-grid">{safe.catalog.map((product)=><article className="v14-product" key={product.id}><div className="v14-product__visual"><Boxes size={34}/><span>{product.kind}</span></div><p className="v14-eyebrow">{product.sku} · {product.category}</p><h3>{product.nameTh}</h3><p>{product.specification}</p><dl><div><dt>Member Price</dt><dd>฿{baht(product.memberUnitPrice)}</dd></div><div><dt>Suggested Resale</dt><dd>฿{baht(product.suggestedResalePrice)}</dd></div><div><dt>Freight Estimate</dt><dd>฿{baht(product.freightEstimateLow)}–{baht(product.freightEstimateHigh)}</dd></div></dl><p className="v14-source">{product.partnerSource}</p><button className="v14-button" onClick={()=>run("MEMBER",{type:"ADD_PROJECT_ITEM",productId:product.id,quantity:1,area:"Lobby"})}>เพิ่มเข้า Riverstone</button></article>)}</div></>;
  }

  function Visits() {
    if (!approved) return <LockedPage title="Material Sample & Visits ถูกล็อก"/>;
    return <><PageHero eyebrow="03 · SAMPLE & DISCLOSURE" title="Material Sample & Visits" description="ก่อน Visit Completed ระบบปิดชื่อ ที่อยู่ ผู้ติดต่อ และรหัส Supplier; การเปิดเผยผูกกับ Member Profile นี้เท่านั้น" action={<Handoff href="/v1-4/admin?screen=visits" label="ส่งต่อให้ Admin"/>}/><div className="v14-card-grid">{safe.catalog.flatMap((p)=>p.samples).map((sample)=><article className="v14-card" key={sample.id}><Status tone="info">{sample.type}</Status><h3>{sample.materialName}</h3><p>{sample.memberDisplayLabel}</p><small>{sample.city}, {sample.country} · {sample.status}</small><button className="v14-button" onClick={()=>act({type:"SUBMIT_VISIT",sampleId:sample.id,preferredDate:"2026-09-15"})}>ขอเยี่ยมชม 15 ก.ย.</button></article>)}</div><Panel title="คำขอของฉัน" eyebrow="VISIT REQUESTS">{safe.visits.length ? <div className="v14-list">{safe.visits.map((visit)=><div key={visit.id}><b>{visit.preferredDate}</b><span>{visit.meetingInstruction ?? "รอทีม GISP แจ้งจุดนัดหมาย"}</span><Status tone={tone(visit.status)}>{visit.status}</Status></div>)}</div>:<Empty>ยังไม่มีคำขอเยี่ยมชม</Empty>}</Panel></>;
  }

  function Projects() {
    if (!approved) return <LockedPage title="Projects ถูกล็อก"/>;
    return <><PageHero eyebrow="04 · PROJECT BUILDER" title={safe.project.name} description="เพิ่ม Standard/Custom Product แก้จำนวนและพื้นที่ พร้อมสร้าง Product Schedule จาก Snapshot"/><Panel title="รายการในโครงการ" eyebrow={safe.project.code}>{safe.projectItems.length ? <div className="v14-list">{safe.projectItems.map((item)=><div key={item.id}><b>{item.area} · {item.kind}</b><span>จำนวน {item.quantity} · {item.specificationSnapshot}</span><Status tone={tone(item.status)}>{item.status}</Status></div>)}</div>:<Empty>ยังไม่มีสินค้าในโครงการ</Empty>}<div className="v14-actions"><a className="v14-button v14-button--outline" href="/demo-documents/product-schedule.pdf" target="_blank">เปิด Product Schedule PDF</a><a className="v14-button v14-button--outline" href="/demo-documents/product-schedule.xlsx">ดาวน์โหลด XLSX</a></div></Panel></>;
  }

  function Rfq() {
    if (!approved) return <LockedPage title="Custom RFQ ถูกล็อก"/>;
    const custom = safe.projectItems.filter((item)=>item.kind==="CUSTOM");
    return <><PageHero eyebrow="05 · CUSTOM REQUEST" title="Custom RFQ" description="ส่งสเปกและ File Metadata ให้ Admin ตรวจ พร้อม Assignment/Due Date ฝั่ง Back Office" action={<Handoff href="/v1-4/admin?screen=rfq" label="เปิด RFQ Queue"/>}/><Panel title="Reception Counter — Custom" eyebrow="RIVERSTONE LOBBY"><p>ขนาด 3.20 เมตร, Walnut veneer, Grey stone top, concealed wiring</p>{safe.rfq ? <div className="v14-summary-row"><b>{safe.rfq.number}</b><Status tone={tone(safe.rfq.status)}>{safe.rfq.status}</Status></div>:<button className="v14-button v14-button--dark" disabled={!custom.length} onClick={()=>run("MEMBER",{type:"SUBMIT_RFQ",itemIds:custom.map((i)=>i.id),title:"Riverstone Reception Counter",specification:"3.20m walnut veneer, grey stone top, concealed wiring",files:[{name:"reception-counter-spec.pdf",type:"application/pdf",size:248000}]})}>ส่ง RFQ พร้อมไฟล์จำลอง</button>}{safe.rfq?.status==="NEEDS_INFO"?<button className="v14-button" onClick={()=>run("MEMBER",{type:"RESUBMIT_RFQ",specification:"3.20m walnut veneer, grey stone top, concealed wiring; เพิ่มช่อง service access ด้านหลัง"})}>ส่งข้อมูลเพิ่มเติม</button>:null}</Panel></>;
  }

  function Quotations() {
    return <><PageHero eyebrow="06 · GISP QUOTATION" title="Quotations" description="ตอบได้เฉพาะ Version Active; Version เก่าเป็น SUPERSEDED และ Snapshot ราคา/VAT/สเปกไม่เปลี่ยน"/><div className="v14-card-grid">{safe.quotations.map((quote)=><article className="v14-card" key={quote.id}><div className="v14-summary-row"><b>{quote.number} · V{quote.version}</b><Status tone={tone(quote.status)}>{quote.status}</Status></div><p>{quote.specificationSnapshot}</p><dl className="v14-totals"><div><dt>ฐานราคา</dt><dd>฿{baht(quote.subtotal)}</dd></div><div><dt>VAT {quote.vatRate}%</dt><dd>฿{baht(quote.vatAmount)}</dd></div><div><dt>ยอดรวม</dt><dd>฿{baht(quote.grandTotal)}</dd></div></dl>{quote.status==="SENT"?<div className="v14-actions"><button className="v14-button v14-button--dark" onClick={()=>run("MEMBER",{type:"RESPOND_QUOTATION",quotationId:quote.id,response:"ACCEPT"})}>ยอมรับ</button><button className="v14-button v14-button--outline" onClick={()=>run("MEMBER",{type:"RESPOND_QUOTATION",quotationId:quote.id,response:"REJECT"})}>ปฏิเสธ</button></div>:null}</article>)}{!safe.quotations.length?<Empty>ยังไม่มีใบเสนอราคาจาก GISP</Empty>:null}</div></>;
  }

  function Orders() {
    const ready = safe.projectItems.filter((item)=>item.status==="READY_TO_ORDER");
    return <><PageHero eyebrow="07 · ORDER & PAYMENT" title="Orders & Payments" description="ยอด Order ใช้ Member Price + VAT เท่านั้น; Suggested Resale และ Freight Estimate ไม่รวมในยอด" action={<Handoff href="/v1-4/admin?screen=payments" label="เปิด Finance Queue"/>}/>{!safe.order?<Panel title="สร้าง Order จากรายการที่พร้อม" eyebrow="PARTIAL ORDER"><div className="v14-list">{ready.map((item)=><div key={item.id}><b>{item.area} · {item.kind}</b><span>เลือกจำนวน 1 จาก {item.quantity}</span><Status tone="good">READY</Status></div>)}</div><button className="v14-button v14-button--dark" disabled={!ready.length} onClick={()=>run("MEMBER",{type:"CREATE_ORDER",quantities:Object.fromEntries(ready.map((item)=>[item.id,1]))})}>สร้าง Order เฉพาะรายการนี้</button></Panel>:<><div className="v14-metrics"><Metric label="Order" value={safe.order.number}/><Metric label="Subtotal" value={`฿${baht(safe.order.subtotal)}`}/><Metric label={`VAT ${safe.order.vatRate}%`} value={`฿${baht(safe.order.vatAmount)}`}/><Metric label="Grand Total" value={`฿${baht(safe.order.grandTotal)}`}/></div><div className="v14-grid v14-grid--2">{safe.paymentSchedules.map((schedule)=><Panel key={schedule.id} title={schedule.type} eyebrow="50 / 50 SCHEDULE"><dl className="v14-totals"><div><dt>ครบกำหนด</dt><dd>฿{baht(schedule.dueAmount)}</dd></div><div><dt>Finance ยืนยันแล้ว</dt><dd>฿{baht(schedule.verifiedAmount)}</dd></div></dl><Status tone={tone(schedule.status)}>{schedule.status}</Status><label>ยอดโอนครั้งนี้<input value={amount} onChange={(e)=>setAmount(e.target.value)}/></label><button className="v14-button" onClick={()=>run("MEMBER",{type:"SUBMIT_PAYMENT",scheduleId:schedule.id,amount,reference:`TRX-${Date.now().toString().slice(-6)}`})}>ส่งหลักฐานโอน</button></Panel>)}</div></>}</>;
  }

  function Qc() {
    return <><PageHero eyebrow="08 · PRODUCTION & QC" title="Production & QC" description="ติดตาม ETA/Delay และตรวจผล QC; สินค้า Custom ต้องได้รับ Member Approval ก่อนผ่าน Dispatch Gate"/><Panel title="Production Timeline" eyebrow="LATEST UPDATE">{safe.productionUpdates.length?<div className="v14-list">{safe.productionUpdates.map((item)=><div key={item.id}><b>{item.progress}% · ETA {item.eta}</b><span>{item.delayed?"แจ้ง Delay และ ETA ใหม่":"ตามแผน"}</span><Status tone={item.delayed?"warn":"good"}>{item.delayed?"DELAY":"ON TRACK"}</Status></div>)}</div>:<Empty>รอออก PO และเริ่มผลิต</Empty>}</Panel><Panel title="QC Inspections" eyebrow="IMMUTABLE EVENTS">{safe.qcInspections.length?<div className="v14-list">{safe.qcInspections.map((item)=><div key={item.id}><b>{item.result}</b><span>{item.note}</span><Status tone={tone(item.result)}>{item.correctionOfId?"REINSPECTION":"INSPECTION"}</Status></div>)}</div>:<Empty>ยังไม่มีผลตรวจ QC</Empty>}{safe.projectItems.filter((i)=>i.kind==="CUSTOM").map((item)=><button key={item.id} className="v14-button" onClick={()=>run("MEMBER",{type:"APPROVE_CUSTOM_QC",projectItemId:item.id})}>Member Approve Custom · {item.area}</button>)}</Panel></>;
  }

  function Shipments() {
    return <><PageHero eyebrow="09 · LOGISTICS" title="Shipments & Delivery" description="ดู Partial Shipment, Tracking, ผู้รับ และหลักฐานที่ทีม Logistics เปิดเผย" action={<Handoff href="/v1-4/admin?screen=logistics" label="เปิด Logistics"/>}/>{safe.shipments.length?<div className="v14-card-grid">{safe.shipments.map((shipment)=><article className="v14-card" key={shipment.id}><div className="v14-summary-row"><b>{shipment.number}</b><Status tone={tone(shipment.status)}>{shipment.status}</Status></div><p>Tracking: {shipment.tracking}</p><p>ผู้รับ: {shipment.recipient??"ยังไม่ส่งมอบ"}</p><small>หลักฐาน {shipment.evidence.length} ไฟล์ · {shipment.deliveryResult??"–"}</small></article>)}</div>:<Empty>ยังไม่มี Shipment — ต้องผ่าน Dispatch Gate ก่อน</Empty>}</>;
  }

  function Claims() {
    return <><PageHero eyebrow="10 · AFTER DELIVERY" title="Claims" description="เปิดเคลมจากรายการที่ส่งมอบ พร้อม Warranty Snapshot; ข้อเสนอผู้รับผิดชอบไม่ใช่ค่าชดเชยอัตโนมัติ"/>{safe.claim?<Panel title={safe.claim.number} eyebrow="CLAIM CASE"><div className="v14-summary-row"><span>{safe.claim.description}</span><Status tone={tone(safe.claim.status)}>{safe.claim.status}</Status></div><p><b>Warranty Snapshot V{safe.warranty.version}</b> — {safe.warranty.terms}</p><p>Suggested Responsibility: {safe.suggestedResponsibility}<br/>Confirmed: {safe.confirmedResponsibility??"รอ Order Admin"}</p>{safe.claim.status==="RESOLVED"?<button className="v14-button v14-button--dark" onClick={()=>run("MEMBER",{type:"CONFIRM_CLAIM"})}>ยืนยัน Resolution และปิด Claim</button>:null}</Panel>:<Panel title="เปิด Claim" eyebrow="DELIVERED ITEM"><p>ใช้ Delivery with Issue และ File Metadata เป็นหลักฐาน โดยไม่มี Automatic Compensation</p><button className="v14-button" disabled={!safe.shipments.some((s)=>s.status==="DELIVERED")} onClick={()=>{const shipment=safe.shipments.find((s)=>s.status==="DELIVERED"); const item=shipment?.allocations[0]; if(shipment&&item)run("MEMBER",{type:"OPEN_CLAIM",shipmentId:shipment.id,projectItemId:item.projectItemId,description:"พบรอยเสียหายที่มุมสินค้าเมื่อส่งมอบ"})}}>เปิด Claim จากสินค้าที่ส่งมอบ</button></Panel>}</>;
  }

  function Documents() {
    return <><PageHero eyebrow="11 · MEMBER-SAFE DOCUMENTS" title="Documents" description="Preview และ Print จาก Snapshot ที่เปิดเผยได้เท่านั้น ไม่มี Factory Cost, Formula, Supplier Payment หรือ Internal Note"/><div className="v14-grid v14-grid--2"><Panel title="Product Schedule" eyebrow={safe.project.code}><p>{safe.project.name} · {safe.projectItems.length} รายการ</p><button className="v14-button v14-button--outline" onClick={()=>window.print()}>Print / Save PDF</button></Panel><Panel title={safe.order?.number??"Order ยังไม่สร้าง"} eyebrow="ORDER SNAPSHOT"><dl className="v14-totals"><div><dt>Subtotal</dt><dd>฿{baht(safe.order?.subtotal)}</dd></div><div><dt>VAT</dt><dd>฿{baht(safe.order?.vatAmount)}</dd></div><div><dt>Total</dt><dd>฿{baht(safe.order?.grandTotal)}</dd></div></dl></Panel></div></>;
  }
}

function MemberHome({ safe, approved }: { safe: ReturnType<typeof memberSafeSnapshot>; approved: boolean }) {
  const waiting = [safe.rfq?.status === "NEEDS_INFO", safe.quotations.some((q)=>q.status==="SENT"), safe.paymentSchedules.some((p)=>p.status==="PENDING"), safe.qcInspections.some((q)=>q.result==="PASSED")].filter(Boolean).length;
  return <><PageHero eyebrow="RIVERSTONE · MEMBER WORKSPACE" title="งานของ Atelier Nara" description="หน้าใช้งานของ Member ไม่มี Role Switcher และไม่มีเครื่องมือหลังบ้าน" action={<Handoff href="/v1-4/admin" label="เปิด Back Office อีกแท็บ"/>}/><div className="v14-metrics"><Metric label="Member Status" value={safe.memberApplication.status}/><Metric label="Action Required" value={String(waiting)}/><Metric label="Project Items" value={String(safe.projectItems.length)}/><Metric label="Open Claims" value={safe.claim && safe.claim.status!=="CLOSED"?"1":"0"}/></div><Panel title="เส้นทางถัดไป" eyebrow="MEMBER JOURNEY">{!approved?<p>เริ่มที่ Account & Company → สมัคร Demo → ส่งข้อมูลบริษัท → เปิด Back Office เพื่ออนุมัติ</p>:<p>บัญชีพร้อมใช้งานแล้ว เลือก Catalog → เพิ่มสินค้าเข้า Project → ส่ง RFQ หรือสร้าง Order</p>}</Panel></>;
}

function LockedPage({ title }: { title: string }) {
  return <><PageHero eyebrow="PERMISSION GUARD" title={title} description="บัญชีต้องได้รับการอนุมัติจาก GISP ก่อนจึงจะเข้าถึงข้อมูลและเริ่มธุรกรรมใหม่ได้"/><Panel title="สถานะการเข้าถึง" eyebrow="DENIED AS DESIGNED"><div className="v14-lock"><Warehouse size={40}/><p>กลับไปหน้า Account & Company เพื่อส่งใบสมัคร แล้วเปิด Back Office → Members เพื่ออนุมัติ</p></div></Panel></>;
}
