"use client";

import { useState } from "react";
import {
  AlertTriangle, BadgeDollarSign, Boxes, CheckCircle2, ClipboardCheck, ClipboardList,
  Factory, FileText, Landmark, LayoutDashboard, ReceiptText,
  ShieldCheck, Truck, UserCog, UsersRound,
} from "lucide-react";
import { actorForAdmin, dispatchGateForItem, paymentSummary, v14Progress, v14UatSummary, type AdminDemoRole, type ClaimResponsibility, type InternalRole } from "@/demo";
import { useV14 } from "./v14-context";
import { baht, Empty, Handoff, Metric, PageHero, Panel, PortalShell, Status, type NavItem } from "./v14-ui";

const nav: NavItem[] = [
  { key: "dashboard", label: "Dashboard & Action Required", icon: LayoutDashboard },
  { key: "members", label: "Members", icon: UsersRound },
  { key: "users", label: "Internal Users & Roles", icon: UserCog },
  { key: "suppliers", label: "Suppliers", icon: Factory },
  { key: "products", label: "Products & Catalog", icon: Boxes },
  { key: "price", label: "Price Structure", icon: BadgeDollarSign },
  { key: "visits", label: "Material Samples & Visits", icon: Landmark },
  { key: "rfq", label: "RFQ & Quotations", icon: ClipboardList },
  { key: "orders", label: "Orders & Supplier Orders", icon: ReceiptText },
  { key: "payments", label: "Customer & Supplier Payments", icon: BadgeDollarSign },
  { key: "production", label: "Production", icon: Factory },
  { key: "qc", label: "QC", icon: ClipboardCheck },
  { key: "logistics", label: "Warehouse, Shipment & Delivery", icon: Truck },
  { key: "claims", label: "Claims", icon: AlertTriangle },
  { key: "documents", label: "Documents & Audit", icon: FileText },
  { key: "uat", label: "UAT & Sign-off", icon: CheckCircle2 },
];

const roleLabels: Record<AdminDemoRole, string> = { GISP_ADMIN:"GISP Admin", FINANCE:"Finance", QC:"QC", LOGISTICS:"Logistics", EXECUTIVE:"Executive", SUPER_ADMIN:"Super Admin Persona" };
const actionRoles: Record<string, AdminDemoRole[]> = {
  members:["GISP_ADMIN","SUPER_ADMIN"], users:["SUPER_ADMIN"], suppliers:["GISP_ADMIN","SUPER_ADMIN"], products:["GISP_ADMIN","SUPER_ADMIN"], price:["SUPER_ADMIN"], visits:["GISP_ADMIN","SUPER_ADMIN"], rfq:["GISP_ADMIN","SUPER_ADMIN"], orders:["GISP_ADMIN","SUPER_ADMIN"], payments:["FINANCE"], production:["GISP_ADMIN","SUPER_ADMIN"], qc:["QC"], logistics:["LOGISTICS"], claims:["GISP_ADMIN","SUPER_ADMIN"], documents:["GISP_ADMIN","FINANCE","QC","LOGISTICS","EXECUTIVE","SUPER_ADMIN"], uat:["GISP_ADMIN","SUPER_ADMIN"], dashboard:["GISP_ADMIN","FINANCE","QC","LOGISTICS","EXECUTIVE","SUPER_ADMIN"],
};

const tone = (value: string) => value.includes("APPROVED") || value.includes("ACTIVE") || value.includes("PASS") || value.includes("VERIFIED") || value.includes("DELIVERED") ? "good" : value.includes("REJECT") || value.includes("SUSPENDED") || value.includes("FAILED") || value.includes("NEEDS_FIX") ? "bad" : value.includes("PENDING") || value.includes("SUBMITTED") || value.includes("DRAFT") ? "warn" : "neutral";

export function AdminPortal({ initialScreen="dashboard" }: { initialScreen?: string }) {
  const { state, act, run } = useV14();
  const screen = nav.some((item)=>item.key===initialScreen) ? initialScreen : "dashboard";
  const role = state.activeAdminRole;
  const allowed = actionRoles[screen]?.includes(role) ?? false;
  const actor = actorForAdmin(role);
  const [staffEmail,setStaffEmail]=useState("operations@gisp-demo.example");
  const [staffName,setStaffName]=useState("วรินทร์ ทีมปฏิบัติการ");
  const [factoryCost,setFactoryCost]=useState("100.00");
  const [paymentReason,setPaymentReason]=useState("ยอดและหลักฐานตรงกัน");

  return <PortalShell kind="admin" title="Operations Control" subtitle="ทีม GISP ภายในเท่านั้น" screen={screen} nav={nav} topRight={<select aria-label="เลือกบทบาททีม GISP" value={role} onChange={(e)=>act({type:"SET_ADMIN_ROLE",role:e.target.value as AdminDemoRole})}>{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}>
    {!allowed ? <RoleLocked screen={screen} role={roleLabels[role]}/> : <>
      {screen==="dashboard"&&<Dashboard/>}
      {screen==="members"&&<Members/>}
      {screen==="users"&&<Users/>}
      {screen==="suppliers"&&<Suppliers/>}
      {screen==="products"&&<Products/>}
      {screen==="price"&&<Price/>}
      {screen==="visits"&&<Visits/>}
      {screen==="rfq"&&<Rfq/>}
      {screen==="orders"&&<Orders/>}
      {screen==="payments"&&<Payments/>}
      {screen==="production"&&<Production/>}
      {screen==="qc"&&<Qc/>}
      {screen==="logistics"&&<Logistics/>}
      {screen==="claims"&&<Claims/>}
      {screen==="documents"&&<Documents/>}
      {screen==="uat"&&<Uat/>}
    </>}
  </PortalShell>;

  function Dashboard(){
    const actions=state.workflow.actionItems.filter((item)=>item.status==="OPEN"&&(role==="SUPER_ADMIN"||item.role===actor||role==="GISP_ADMIN"&&item.role==="GISP_ADMIN"));
    const progress=v14Progress(state);
    return <><PageHero eyebrow="GISP BACK OFFICE" title={`${roleLabels[role]} Dashboard`} description="แสดงเฉพาะงานและข้อมูลสรุปตามบทบาทที่เลือก โดย Executive เป็น Read-only" action={<Handoff href="/v1-4/member" label="เปิด Member Application"/>}/><div className="v14-metrics"><Metric label="Demo Mission" value={`${progress.complete}/${progress.total}`}/><Metric label="Action Required" value={String(actions.length)}/><Metric label="Member Applications" value={state.workflow.memberApplication.status==="PENDING"?"1":"0"}/><Metric label="Build Gate" value={state.buildReadiness}/></div><Panel title="Action Required" eyebrow="ASSIGNMENT & DUE DATE">{actions.length?<div className="v14-list">{actions.map((item)=><div key={item.id}><b>{item.title}</b><span>{item.detail} · Due {item.dueDate}</span><Status tone="warn">{item.sourceModule}</Status></div>)}</div>:<Empty>ไม่มีงานค้างสำหรับบทบาทนี้</Empty>}</Panel><div className="v14-grid v14-grid--2"><Panel title="Operational Summary" eyebrow="BASIC REPORT"><dl className="v14-totals"><div><dt>Orders</dt><dd>{state.workflow.order?1:0}</dd></div><div><dt>Payments waiting</dt><dd>{state.workflow.transfers.filter((x)=>x.status==="SUBMITTED").length}</dd></div><div><dt>Delayed production</dt><dd>{state.workflow.productionUpdates.filter((x)=>x.delayed).length}</dd></div><div><dt>Claims open</dt><dd>{state.workflow.claim&&state.workflow.claim.status!=="CLOSED"?1:0}</dd></div></dl></Panel><Panel title="Portal Handoff" eyebrow="SAME SHARED STATE"><p>เปิด Member Application อีกแท็บ แล้วส่งใบสมัคร/Visit/RFQ/Payment รายการจะมาปรากฏที่นี่หลัง Refresh หรือทันทีเมื่อ Browser ส่ง storage event</p></Panel></div></>;
  }

  function Members(){
    const app=state.workflow.memberApplication;
    return <><PageHero eyebrow="01 · MEMBER ADMIN" title="Members" description="ตรวจใบสมัครบริษัทและเปลี่ยนสถานะตาม Action Guard; ฝั่งนี้ไม่ใช่การเชิญพนักงาน GISP" action={<Handoff href="/v1-4/member?screen=account" label="ดูฝั่งผู้สมัคร"/>}/><Panel title={app.companyName||"ยังไม่ได้ส่งข้อมูล"} eyebrow={app.email}><div className="v14-summary-row"><div><b>Tax ID {app.taxId||"–"}</b><p>หนึ่ง Login = หนึ่ง Member Profile · ไม่มี Member Team/Sub-user</p></div><Status tone={tone(app.status)}>{app.status}</Status></div><div className="v14-actions"><button className="v14-button v14-button--dark" onClick={()=>run("GISP_ADMIN",{type:"REVIEW_MEMBER_APPLICATION",decision:"APPROVE",note:"ตรวจข้อมูลบริษัทผ่าน"})}>Approve</button><button className="v14-button v14-button--outline" onClick={()=>run("GISP_ADMIN",{type:"REVIEW_MEMBER_APPLICATION",decision:"REJECT",note:"เอกสารบริษัทไม่ครบ"})}>Reject พร้อมเหตุผล</button>{app.status==="APPROVED"?<button className="v14-button v14-button--outline" onClick={()=>act({type:"SET_MEMBER_ACCESS_STATUS",decision:"SUSPEND",reason:"ระงับการทำรายการใหม่เพื่อตรวจสอบบัญชี"})}>Suspend</button>:null}{app.status==="SUSPENDED"?<button className="v14-button" onClick={()=>act({type:"SET_MEMBER_ACCESS_STATUS",decision:"REACTIVATE",reason:"ตรวจสอบและเปิดใช้งานอีกครั้งแล้ว"})}>Reactivate</button>:null}</div></Panel><Panel title="Permission Test" eyebrow="CROSS-ORGANIZATION & MEMBER-SAFE"><div className="v14-list">{state.workflow.permissionCases.map((item)=><div key={item.id}><b>{item.label}</b><span>{item.detail}</span><button className="v14-button v14-button--small" onClick={()=>run("GISP_ADMIN",{type:"RUN_PERMISSION_CASE",caseId:item.id})}>ทดสอบ</button></div>)}</div></Panel></>;
  }

  function Users(){
    const roles:InternalRole[]=["MEMBER_ADMIN","PRODUCT_ADMIN","ORDER_ADMIN","PURCHASING","FINANCE","QC","LOGISTICS","EXECUTIVE_VIEWER","SUPER_ADMIN"];
    return <><PageHero eyebrow="02 · SUPER ADMIN" title="Internal Users & Roles" description="Multi-role ใช้เฉพาะพนักงาน GISP เท่านั้น และแยกจาก Member Application โดยสิ้นเชิง"/><div className="v14-grid v14-grid--2"><Panel title="เชิญพนักงาน GISP" eyebrow="INTERNAL ONLY"><label>ชื่อ<input value={staffName} onChange={(e)=>setStaffName(e.target.value)}/></label><label>Email<input value={staffEmail} onChange={(e)=>setStaffEmail(e.target.value)}/></label><button className="v14-button v14-button--dark" onClick={()=>act({type:"INVITE_INTERNAL_USER",fullName:staffName,email:staffEmail})}>เชิญเข้าทีม GISP</button></Panel><Panel title="ขอบเขตที่ล็อก" eyebrow="NO MEMBER TEAM"><p>ไม่มีการเชิญผู้ใช้ย่อยของ Member ไม่มีหลายผู้ใช้ต่อ Member Profile และไม่มี Role ของ Member ในตารางนี้</p></Panel></div><Panel title="ทีมภายใน" eyebrow="MULTI-ROLE"> <div className="v14-list">{state.internalUsers.map((user)=><div key={user.id}><div><b>{user.fullName}</b><p>{user.email}</p></div><span>{user.roles.join(" + ")}</span><button className="v14-button v14-button--small" onClick={()=>act({type:"SET_INTERNAL_ROLES",userId:user.id,roles:user.id==="staff-super-admin"?["SUPER_ADMIN"]:roles.slice(0,2)})}>กำหนด 2 Roles</button></div>)}</div></Panel></>;
  }

  function Suppliers(){
    return <><PageHero eyebrow="03 · MASTER DATA" title="Suppliers" description="ข้อมูล Supplier เป็นข้อมูลภายใน; Member เห็นตัวตน Supplier เฉพาะเมื่อมี Active Disclosure Grant"/><Panel title="Supplier Master" eyebrow="CONFIDENTIAL"><div className="v14-list">{state.workflow.suppliers.map((supplier)=><div key={supplier.id}><div><b>{supplier.name}</b><p>{supplier.city} · {supplier.contactName}</p></div><span>{supplier.documents.length} files</span><Status tone={tone(supplier.status)}>{supplier.status}</Status></div>)}</div><button className="v14-button" onClick={()=>run("GISP_ADMIN",{type:"CREATE_SUPPLIER",name:"Demo Lighting Partner",city:"Shenzhen",contactName:"Partner Coordinator",files:[{name:"supplier-profile.pdf",type:"application/pdf",size:92000}]})}>สร้าง Supplier จำลอง</button></Panel></>;
  }

  function Products(){
    const draft=state.workflow.catalog.find((p)=>p.lifecycleStatus==="DRAFT");
    return <><PageHero eyebrow="04 · PRODUCT ADMIN" title="Products & Catalog" description="แยก Factory Cost และ Member Price พร้อม Publish/Discontinue และรักษา Snapshot เอกสารเดิม"/><div className="v14-card-grid">{state.workflow.catalog.map((p)=><article className="v14-card" key={p.id}><div className="v14-summary-row"><b>{p.sku}</b><Status tone={tone(p.lifecycleStatus)}>{p.lifecycleStatus}</Status></div><h3>{p.nameTh}</h3><dl className="v14-totals"><div><dt>Factory Cost</dt><dd>฿{baht(p.factoryUnitCost)}</dd></div><div><dt>Member Price</dt><dd>฿{baht(p.memberUnitPrice)}</dd></div></dl><div className="v14-actions">{p.lifecycleStatus==="DRAFT"?<button className="v14-button" onClick={()=>run("GISP_ADMIN",{type:"PUBLISH_PRODUCT",productId:p.id})}>Publish</button>:null}{p.lifecycleStatus==="PUBLISHED"?<button className="v14-button v14-button--outline" onClick={()=>run("GISP_ADMIN",{type:"DISCONTINUE_PRODUCT",productId:p.id})}>Discontinue</button>:null}</div></article>)}</div><Panel title="สร้าง Product Draft" eyebrow="FILE METADATA ONLY"><button className="v14-button v14-button--dark" disabled={Boolean(draft)} onClick={()=>run("GISP_ADMIN",{type:"CREATE_PRODUCT_DRAFT",nameTh:"โคมไฟแขวน Custom",sku:"LT-PD-001",supplierId:state.workflow.suppliers[0].id,memberUnitPrice:"18500",factoryUnitCost:"14800"})}>สร้าง Draft ตัวอย่าง</button></Panel></>;
  }

  function Price(){
    const preview=state.formulaPreview;
    return <><PageHero eyebrow="05 · SUPER ADMIN ONLY" title="Price Structure" description="Versioned Formula ลำดับ Global → Supplier → Product; Activate/Retire และ Override ต้องผ่าน Super Admin Guard"/><div className="v14-metrics"><Metric label="Factory Cost" value={`฿${baht(preview.factoryCostThb)}`}/><Metric label="Member Price" value={`฿${baht(preview.memberPrice)}`}/><Metric label="Suggested Resale" value={`฿${baht(preview.suggestedResalePrice)}`}/><Metric label="Freight Estimate" value={`฿${baht(preview.freightEstimateLow)}–${baht(preview.freightEstimateHigh)}`}/></div><div className="v14-grid v14-grid--2"><Panel title="Formula Preview" eyebrow="100 → 125 → 156.25"><label>Factory Cost<input value={factoryCost} onChange={(e)=>setFactoryCost(e.target.value)}/></label><button className="v14-button v14-button--dark" onClick={()=>act({type:"PREVIEW_FORMULA",formulaId:state.activeFormulaId,factoryCostThb:factoryCost})}>คำนวณ Preview</button></Panel><Panel title="Formula Versions" eyebrow="INHERITANCE"><div className="v14-list">{state.formulas.map((formula)=><div key={formula.id}><div><b>{formula.code} V{formula.version}</b><p>{formula.scope}</p></div><Status tone={tone(formula.status)}>{formula.status}</Status>{formula.status==="DRAFT"?<button className="v14-button v14-button--small" onClick={()=>act({type:"ACTIVATE_FORMULA",formulaId:formula.id})}>Activate</button>:null}</div>)}</div></Panel></div></>;
  }

  function Visits(){
    return <><PageHero eyebrow="06 · DISCLOSURE CONTROL" title="Material Samples & Visits" description="Admin Approve/Complete; เมื่อ Complete จึงสร้าง Disclosure Grant เฉพาะ Member+Supplier และ Super Admin Revoke ได้" action={<Handoff href="/v1-4/member?screen=visits" label="ดู Member View"/>}/><Panel title="Visit Queue" eyebrow="ACTION REQUIRED">{state.visits.length?<div className="v14-list">{state.visits.map((visit)=><div key={visit.id}><div><b>{visit.preferredDate}</b><p>{visit.id}</p></div><Status tone={tone(visit.status)}>{visit.status}</Status><div className="v14-actions">{visit.status==="SUBMITTED"?<button className="v14-button v14-button--small" onClick={()=>act({type:"APPROVE_VISIT",visitId:visit.id,instruction:"พบทีม GISP ที่จุดนัดหมาย Guangzhou Design Center"})}>Approve</button>:null}{visit.status==="APPROVED"?<button className="v14-button v14-button--small" onClick={()=>act({type:"COMPLETE_VISIT",visitId:visit.id})}>Complete & Grant</button>:null}</div></div>)}</div>:<Empty>รอ Member ส่งคำขอ Visit</Empty>}</Panel>{state.disclosureGrants.length?<Panel title="Disclosure Grants" eyebrow="MEMBER + SUPPLIER"><div className="v14-list">{state.disclosureGrants.map((grant)=><div key={grant.id}><b>{grant.memberProfileId}</b><span>{grant.supplierId}</span>{!grant.revokedAt&&role==="SUPER_ADMIN"?<button className="v14-button v14-button--small" onClick={()=>act({type:"REVOKE_DISCLOSURE",grantId:grant.id,reason:"สิ้นสุดสิทธิ์ตาม Demo Scenario"})}>Revoke</button>:<Status tone={grant.revokedAt?"bad":"good"}>{grant.revokedAt?"REVOKED":"ACTIVE"}</Status>}</div>)}</div></Panel>:null}</>;
  }

  function Rfq(){
    const customItems=state.workflow.rfq?.itemIds??[];
    return <><PageHero eyebrow="07 · SOURCING" title="RFQ & Quotations" description="ตรวจคำขอ เลือก Supplier Candidate และออก Quotation ในนาม GISP พร้อม Version/Snapshot" action={<Handoff href="/v1-4/member?screen=rfq" label="ดูฝั่ง Member"/>}/><Panel title={state.workflow.rfq?.number??"ยังไม่มี RFQ"} eyebrow="RFQ QUEUE">{state.workflow.rfq?<><div className="v14-summary-row"><span>{state.workflow.rfq.specification}</span><Status tone={tone(state.workflow.rfq.status)}>{state.workflow.rfq.status}</Status></div><div className="v14-actions"><button className="v14-button v14-button--outline" onClick={()=>run("GISP_ADMIN",{type:"REQUEST_RFQ_INFO",message:"กรุณายืนยันช่อง service access ด้านหลัง"})}>ขอข้อมูลเพิ่ม</button><button className="v14-button v14-button--dark" onClick={()=>run("GISP_ADMIN",{type:"SEND_QUOTATION",unitPrices:Object.fromEntries(customItems.map((id)=>[id,"128000.00"])),specification:state.workflow.rfq?.specification??"Confirmed specification",leadTimeDays:55,validityDays:30})}>ออก Quotation Version ใหม่</button></div></>:<Empty>รอ Member ส่ง Custom RFQ</Empty>}</Panel><Panel title="Quotation Versions" eyebrow="IMMUTABLE SNAPSHOT"><div className="v14-list">{state.workflow.quotations.map((q)=><div key={q.id}><b>{q.number} · V{q.version}</b><span>฿{baht(q.grandTotal)} · Valid {q.validityDays} วัน</span><Status tone={tone(q.status)}>{q.status}</Status></div>)}</div></Panel></>;
  }

  function Orders(){
    const order=state.workflow.order;
    return <><PageHero eyebrow="08 · ORDER ADMIN" title="Orders & Supplier Orders" description="ตรวจ Snapshot และแยก Supplier Order; Issue PO ได้เมื่อ Deposit Verified ครบเท่านั้น"/><Panel title={order?.number??"ยังไม่มี Order"} eyebrow="CUSTOMER ORDER">{order?<><dl className="v14-totals"><div><dt>Subtotal</dt><dd>฿{baht(order.subtotal)}</dd></div><div><dt>VAT {order.vatRate}%</dt><dd>฿{baht(order.vatAmount)}</dd></div><div><dt>Total</dt><dd>฿{baht(order.grandTotal)}</dd></div></dl><div className="v14-summary-row"><Status tone={tone(order.status)}>{order.status}</Status><button className="v14-button v14-button--dark" onClick={()=>run("GISP_ADMIN",{type:"ISSUE_PO"})}>Issue PO</button></div></>:<Empty>รอ Member สร้าง Order</Empty>}</Panel><Panel title="Supplier Orders" eyebrow="INTERNAL COST"><div className="v14-list">{state.workflow.supplierOrders.map((so)=><div key={so.id}><b>{so.number}</b><span>Factory Cost ฿{baht(so.factoryCostTotal)}</span><Status tone={so.supplierBalancePaid?"good":"warn"}>{so.supplierBalancePaid?"PAID":"UNPAID"}</Status></div>)}</div></Panel></>;
  }

  function Payments(){
    return <><PageHero eyebrow="09 · FINANCE" title="Customer & Supplier Payments" description="Verify/Reject/Resubmit และ Overpayment Warning; Schedule Verified เมื่อยอด Finance ยืนยันสะสมครบ"/><div className="v14-grid v14-grid--2">{state.workflow.paymentSchedules.map((schedule)=>{const summary=paymentSummary(state.workflow,schedule.id);return <Panel key={schedule.id} title={schedule.type} eyebrow="CUSTOMER SCHEDULE"><dl className="v14-totals"><div><dt>Due</dt><dd>฿{baht(schedule.dueAmount)}</dd></div><div><dt>Verified</dt><dd>฿{baht(schedule.verifiedAmount)}</dd></div><div><dt>Outstanding</dt><dd>฿{baht(summary.outstandingAmount)}</dd></div></dl>{summary.isOverpaid?<Status tone="bad">OVERPAYMENT — FINANCE REVIEW</Status>:<Status tone={tone(schedule.status)}>{schedule.status}</Status>}</Panel>})}</div><Panel title="Transfer Queue" eyebrow="PARTIAL & OVERPAYMENT GUARD">{state.workflow.transfers.length?<div className="v14-list">{state.workflow.transfers.map((transfer)=><div key={transfer.id}><div><b>฿{baht(transfer.amount)}</b><p>{transfer.reference}</p></div><Status tone={tone(transfer.status)}>{transfer.status}</Status>{transfer.status==="SUBMITTED"?<div className="v14-actions"><button className="v14-button v14-button--small" onClick={()=>run("FINANCE",{type:"VERIFY_PAYMENT",transferId:transfer.id})}>Verify</button><button className="v14-button v14-button--small" onClick={()=>run("FINANCE",{type:"REJECT_PAYMENT",transferId:transfer.id,reason:paymentReason})}>Reject</button></div>:null}</div>)}</div>:<Empty>รอ Member ส่งหลักฐานโอน</Empty>}<label>เหตุผลเมื่อต้อง Reject<input value={paymentReason} onChange={(e)=>setPaymentReason(e.target.value)}/></label></Panel><Panel title="Supplier Balance" eyebrow="DISPATCH GATE">{state.workflow.supplierOrders.map((so)=><div className="v14-summary-row" key={so.id}><span>{so.number}</span><button className="v14-button" onClick={()=>run("FINANCE",{type:"MARK_SUPPLIER_BALANCE_PAID",supplierOrderId:so.id})}>Mark Paid</button></div>)}</Panel></>;
  }

  function Production(){return <><PageHero eyebrow="10 · FACTORY FOLLOW-UP" title="Production" description="บันทึก Progress, ETA และ Delay เป็น Timeline Event; การแก้ ETA ไม่แก้ประวัติเก่า"/><Panel title="Production Timeline" eyebrow="EVENT LOG"><div className="v14-actions"><button className="v14-button" onClick={()=>run("GISP_ADMIN",{type:"RECORD_PRODUCTION_UPDATE",progress:35,eta:"2026-10-30",note:"โครงสร้างเสร็จ 35%",delayed:false})}>บันทึก 35%</button><button className="v14-button v14-button--outline" onClick={()=>run("GISP_ADMIN",{type:"RECORD_PRODUCTION_UPDATE",progress:60,eta:"2026-11-12",note:"วัสดุปิดผิวล่าช้า ปรับ ETA",delayed:true})}>แจ้ง Delay + ETA ใหม่</button></div><div className="v14-list">{state.workflow.productionUpdates.map((u)=><div key={u.id}><b>{u.progress}% · ETA {u.eta}</b><span>{u.note}</span><Status tone={u.delayed?"warn":"good"}>{u.delayed?"DELAY":"ON TRACK"}</Status></div>)}</div></Panel></>}

  function Qc(){
    const target=state.workflow.order?.lines[0]?.projectItemId??state.workflow.projectItems[0]?.id;
    const failed=state.workflow.qcInspections.find((q)=>q.result!=="PASSED"&&!state.workflow.qcInspections.some((x)=>x.correctionOfId===q.id));
    return <><PageHero eyebrow="11 · QUALITY CONTROL" title="QC" description="ผลตรวจแก้ตรงไม่ได้ ต้องเพิ่ม Rework/Reinspection Event และ Custom ต้องส่งให้ Member Approve"/><Panel title="Inspection Controls" eyebrow="FAIL → REWORK → REINSPECTION"><div className="v14-actions"><button className="v14-button v14-button--outline" onClick={()=>run("QC",{type:"RECORD_QC",projectItemId:target,result:"FAILED",note:"พบตำหนิผิวด้านหน้า ต้องแก้ไข"})}>Record Fail</button>{failed?<button className="v14-button" onClick={()=>run("QC",{type:"CORRECT_QC",inspectionId:failed.id,note:"Reinspection ผ่านหลังแก้ผิว"})}>Add Reinspection</button>:null}<button className="v14-button v14-button--dark" onClick={()=>run("QC",{type:"RECORD_QC",projectItemId:target,result:"PASSED",note:"Checklist ผ่านครบ"})}>Record Pass</button></div><div className="v14-list">{state.workflow.qcInspections.map((q)=><div key={q.id}><b>{q.result}</b><span>{q.note}</span><Status tone={tone(q.result)}>{q.correctionOfId?"CORRECTION":"ORIGINAL"}</Status></div>)}</div></Panel></>;
  }

  function Logistics(){
    const lines=state.workflow.order?.lines??[];
    return <><PageHero eyebrow="12 · LOGISTICS" title="Warehouse, Shipment & Delivery" description="Partial Shipment มี Quantity Guard; Delivery ต้องมีผู้รับและ File Metadata เป็นหลักฐาน"/><Panel title="Dispatch Gate & Shipment" eyebrow="4 CONDITIONS">{lines.length?<div className="v14-list">{lines.map((line)=>{const gate=dispatchGateForItem(state.workflow,line.projectItemId);const fails=new Set(gate.failures);return <div key={line.projectItemId}><b>{line.projectItemId}</b><span>QC {!fails.has("QC_NOT_PASSED")?"✓":"×"} · Member {!fails.has("CUSTOM_MEMBER_APPROVAL_REQUIRED")?"✓":"×"} · Customer Balance {!fails.has("CUSTOMER_BALANCE_NOT_VERIFIED")?"✓":"×"} · Supplier Balance {!fails.has("SUPPLIER_BALANCE_NOT_PAID")?"✓":"×"}</span><Status tone={gate.allowed?"good":"warn"}>{gate.allowed?"DISPATCH READY":"BLOCKED"}</Status></div>})}</div>:<p>รอ Order ก่อนตรวจ Dispatch Gate</p>}<button className="v14-button v14-button--dark" disabled={!lines.length} onClick={()=>run("LOGISTICS",{type:"CREATE_SHIPMENT",allocations:lines.map((l)=>({projectItemId:l.projectItemId,quantity:1})),tracking:"GISP-CN-TH-0001"})}>สร้าง Partial Shipment</button></Panel><div className="v14-card-grid">{state.workflow.shipments.map((shipment)=><article className="v14-card" key={shipment.id}><div className="v14-summary-row"><b>{shipment.number}</b><Status tone={tone(shipment.status)}>{shipment.status}</Status></div><p>{shipment.tracking}</p>{shipment.status!=="DELIVERED"?<button className="v14-button" onClick={()=>run("LOGISTICS",{type:"RECORD_DELIVERY",shipmentId:shipment.id,recipient:"คุณนารา วัฒนศิลป์",result:"WITH_ISSUE",evidence:[{name:"delivery-proof.jpg",type:"image/jpeg",size:182000}]})}>บันทึก Delivery with Issue</button>:null}</article>)}</div></>;
  }

  function Claims(){
    const claim=state.workflow.claim;
    const responsibilities:ClaimResponsibility[]=["SUPPLIER","LOGISTICS_INSURANCE","INSTALLER"];
    return <><PageHero eyebrow="13 · ORDER ADMIN" title="Claims" description="ใช้ Warranty Snapshot และ Suggested Responsibility ช่วยตัดสินใจ แต่ Order Admin ต้องยืนยันเองและไม่มี Automatic Compensation"/><Panel title={claim?.number??"ยังไม่มี Claim"} eyebrow="WARRANTY RESPONSIBILITY">{claim?<><p>{claim.description}</p><p>{state.warrantySnapshot.terms}</p><div className="v14-actions">{responsibilities.map((value)=><button className="v14-button v14-button--outline" key={value} onClick={()=>act({type:"CONFIRM_CLAIM_RESPONSIBILITY",responsibility:value})}>{value}</button>)}</div><div className="v14-summary-row"><span>Confirmed: {state.confirmedResponsibility??"–"}</span><Status tone={tone(claim.status)}>{claim.status}</Status></div><div className="v14-actions"><button className="v14-button" onClick={()=>run("GISP_ADMIN",{type:"RESOLVE_CLAIM",resolution:"ซ่อมผิวและจัดส่งอะไหล่ภายใน 14 วัน"})}>บันทึก Resolution</button><button className="v14-button v14-button--outline" onClick={()=>run("GISP_ADMIN",{type:"REJECT_CLAIM",reason:"หลักฐานไม่ตรงกับรายการส่งมอบ"})}>Reject พร้อมเหตุผล</button></div></>:<Empty>รอ Member เปิด Claim จาก Delivered Item</Empty>}</Panel></>;
  }

  function Documents(){return <><PageHero eyebrow="14 · GOVERNANCE" title="Documents & Audit" description="เอกสารใช้ Snapshot และ Audit เก็บ Before/After/Reason; Email/Password/Token/Secret ไม่อยู่ใน Log"/><div className="v14-grid v14-grid--2"><Panel title="Dynamic Documents" eyebrow="PRINT BASELINE"><button className="v14-button" onClick={()=>window.print()}>Print / Save PDF</button><p>Quotation, Order, Product Schedule, Delivery Proof และ Claim Timeline</p></Panel><Panel title="Safety Check" eyebrow="MEMBER-SAFE"><p>Member Document ตัด Factory Cost, Formula Components, Margin, Supplier Payment, Internal Note และ Confidential File ก่อน Render</p></Panel></div><Panel title="Audit Timeline" eyebrow={`${state.audit.length+state.workflow.audit.length} EVENTS`}><div className="v14-list">{[...state.audit].reverse().slice(0,16).map((event)=><div key={event.id}><div><b>{event.action}</b><p>{new Date(event.at).toLocaleString("th-TH")}</p></div><span>{event.detail}</span><Status tone="info">{event.actor}</Status></div>)}</div></Panel></>}

  function Uat(){
    const summary=v14UatSummary(state);
    return <><PageHero eyebrow="15 · HUMAN GATE" title="UAT & Sign-off" description="8 หมวดต้อง PASS ทั้งหมดและไม่มี NEEDS FIX จากนั้น GISP Admin จึงกด Human Sign-off ได้"/><div className="v14-metrics"><Metric label="PASS" value={`${summary.passed}/${summary.total}`}/><Metric label="NEEDS FIX" value={String(summary.needsFix)}/><Metric label="NOT TESTED" value={String(summary.untested)}/><Metric label="Gate" value={state.buildReadiness}/></div><Panel title="UAT Scenarios" eyebrow="DEMO 1.4"><div className="v14-list v14-list--uat">{state.uatResults.map((item)=><div key={item.id}><div><b>{item.title}</b><p>{item.note||"ยังไม่มีหมายเหตุ"}</p></div><Status tone={tone(item.status)}>{item.status}</Status><div className="v14-actions"><button className="v14-button v14-button--small" onClick={()=>act({type:"UPDATE_V14_UAT",resultId:item.id,status:"PASS",note:"ตรวจรับจาก Demo 1.4"})}>ผ่าน</button><button className="v14-button v14-button--small" onClick={()=>act({type:"UPDATE_V14_UAT",resultId:item.id,status:"NEEDS_FIX",note:"ต้องแก้ก่อน Sign-off"})}>ต้องแก้</button></div></div>)}</div><div className="v14-actions"><button className="v14-button v14-button--outline" onClick={()=>window.print()}>Print UAT Summary</button><button className="v14-button v14-button--dark" onClick={()=>act({type:"SIGN_OFF_V14"})}>Human Sign-off</button></div></Panel></>;
  }
}

function RoleLocked({screen,role}:{screen:string;role:string}){
  return <><PageHero eyebrow="ROLE GUARD" title="หน้านี้ไม่อยู่ในสิทธิ์ของบทบาทปัจจุบัน" description={`${role} เปิดดูหรือทำรายการใน ${screen} ไม่ได้ กรุณาเลือกบทบาททีม GISP ที่รับผิดชอบจากเมนูด้านบน`}/><Panel title="Permission denied as designed" eyebrow="BACK OFFICE"><div className="v14-lock"><ShieldCheck size={42}/><p>Role Switcher มีไว้สาธิตสิทธิ์ของพนักงาน GISP เท่านั้น ไม่เกี่ยวกับบัญชี Member</p></div></Panel></>;
}
