"use client";

import { BadgeCheck, Boxes, CalendarClock, CircleDollarSign, MapPin, PackageCheck, Ship, Truck, Upload } from "lucide-react";
import { useState } from "react";
import { allAdminOrderCapabilities } from "@/lib/orders/admin-access";
import { formatOrderMoney, type AdminOrderCapabilities, type LogisticsDetail, type OrderDetail, type Shipment, type WarehouseReceiptItem } from "@/lib/orders/types";

type Post = (path:string,payload:Record<string,unknown>)=>Promise<boolean>;
const trackingOptions=["DEPARTED_CHINA","IN_TRANSIT","ARRIVED_THAILAND","IMPORT_CUSTOMS","THAILAND_WAREHOUSE","READY_FOR_DELIVERY"] as const;
const trackingLabels:Record<string,string>={DEPARTED_CHINA:"ออกจากจีน",IN_TRANSIT:"อยู่ระหว่างขนส่ง",ARRIVED_THAILAND:"ถึงประเทศไทย",IMPORT_CUSTOMS:"อยู่ระหว่างพิธีการนำเข้า",THAILAND_WAREHOUSE:"ถึงคลังไทย",READY_FOR_DELIVERY:"พร้อมนัดส่ง",DELAY:"ล่าช้า"};
const shipmentLabels:Record<string,string>={AWAITING_MEMBER_ACKNOWLEDGEMENT:"รอสมาชิกรับทราบค่าใช้จ่าย",GATE_CHECKED:"ผ่านเงื่อนไขก่อนจัดส่ง",DISPATCHED:"ออกเดินทางแล้ว",IN_TRANSIT:"อยู่ระหว่างขนส่ง",ARRIVED_THAILAND:"ถึงประเทศไทย",IMPORT_CUSTOMS:"อยู่ระหว่างพิธีการนำเข้า",THAILAND_WAREHOUSE:"ถึงคลังไทย",READY_FOR_DELIVERY:"พร้อมนัดส่ง",PARTIALLY_DELIVERED:"ส่งมอบบางส่วน",DELIVERED:"ส่งมอบครบแล้ว"};
const deliveryLabels:Record<string,string>={PROPOSED:"รอสมาชิกยืนยันนัด",MEMBER_CONFIRMED:"สมาชิกยืนยันแล้ว",RESCHEDULE_REQUESTED:"ขอเลื่อนนัด",CONFIRMED:"ยืนยันนัดแล้ว",OUT_FOR_DELIVERY:"กำลังนำส่ง",ARRIVED:"ถึงหน้างาน",PARTIALLY_DELIVERED:"ส่งบางส่วน",DELIVERED:"ส่งครบ",DELIVERED_WITH_ISSUE:"ส่งพร้อมปัญหา",FAILED:"ส่งไม่สำเร็จ"};
const receiptLabels:Record<string,string>={EXPECTED:"รอรับสินค้า",PARTIALLY_RECEIVED:"รับบางส่วน",RECEIVED_COMPLETE:"รับครบแล้ว",DISCREPANCY:"พบจำนวนไม่ตรง",DAMAGED:"พบสินค้าชำรุด",READY_FOR_CONSOLIDATION:"พร้อมรวมสินค้า",CANCELLED:"ยกเลิก"};
const consolidationLabels:Record<string,string>={DRAFT:"ฉบับร่าง",CONFIRMED:"ยืนยันแล้ว",SHIPMENT_CREATED:"สร้าง Shipment แล้ว",CANCELLED:"ยกเลิก"};
const consolidationStrategyLabels:Record<string,string>={CONSOLIDATE_ALL:"รวมทั้งหมด",PARTIAL:"ส่งบางส่วน",DIRECT:"ส่งตรง"};
const shipmentTypeLabels:Record<string,string>={CONSOLIDATED:"รวมเที่ยว",PARTIAL:"ส่งบางส่วน",DIRECT:"ส่งตรง"};
const conditionLabels:Record<string,string>={GOOD:"สภาพดี",DAMAGED:"ชำรุด",MISSING:"สูญหาย",WRONG_ITEM:"สินค้าผิดรายการ",OTHER:"อื่น ๆ"};
const costStatusLabels:Record<string,string>={DRAFT:"ฉบับร่าง",FINALIZED:"ยืนยันแล้ว",INVOICED:"ออกใบแจ้งหนี้แล้ว",VOID:"ยกเลิก"};
const invoiceStatusLabels:Record<string,string>={DRAFT:"ฉบับร่าง",ISSUED:"ออกใบแจ้งหนี้แล้ว",PARTIALLY_PAID:"ชำระบางส่วน",PAID:"ชำระแล้ว",VOID:"ยกเลิก"};
const iso=(days=0)=>new Date(Date.now()+days*86400000).toISOString();
const requiredIso=(value:FormDataEntryValue|null)=>{
  const timestamp=new Date(String(value??""));
  if(!value||Number.isNaN(timestamp.getTime()))throw new Error("กรุณาระบุวันและเวลาที่ถูกต้อง");
  return timestamp.toISOString();
};
const shipmentName=(name:string,orderNumber:string)=>name.startsWith("Shipment ")?`การจัดส่ง ${name.slice("Shipment ".length)}`:(name||`การจัดส่ง ${orderNumber}`);
export const trackingStatusLabel=(status:string)=>trackingLabels[status]??status;
export const shipmentStatusLabel=(status:string)=>shipmentLabels[status]??status;

export function warehouseReleaseAvailable(item: WarehouseReceiptItem) {
  return Math.max(0, Number(item.received_quantity) - Number(item.blocked_quantity) - Number(item.released_quantity));
}

export type ConsolidationReadyBatch = {
  warehouseId: string;
  items: Array<{ warehouse_receipt_item_id: string; quantity: number }>;
};

export function consolidationReadyBatches(logistics: LogisticsDetail): ConsolidationReadyBatch[] {
  const allocated = new Map<string, number>();
  for (const group of logistics.consolidations.filter((group) => group.status !== "CANCELLED")) {
    for (const item of group.items) {
      allocated.set(item.warehouse_receipt_item_id, (allocated.get(item.warehouse_receipt_item_id) ?? 0) + Number(item.quantity));
    }
  }
  const batches = new Map<string, ConsolidationReadyBatch["items"]>();
  for (const receipt of logistics.receipts.filter((receipt) => receipt.status !== "CANCELLED")) {
    for (const item of receipt.items) {
      const quantity = Math.max(0, Number(item.released_quantity) - (allocated.get(item.id) ?? 0));
      if (quantity <= 0) continue;
      const items = batches.get(receipt.warehouse_id) ?? [];
      items.push({ warehouse_receipt_item_id: item.id, quantity });
      batches.set(receipt.warehouse_id, items);
    }
  }
  return [...batches].map(([warehouseId, items]) => ({ warehouseId, items }));
}

function Status({children}:{children:string}){return <span className="v14-status v14-status--info">{children}</span>}

function ShipmentTrackingForm({shipment,busy,post}:{shipment:Shipment;busy:boolean;post:Post}){
  const initialStatus=trackingOptions.find(option=>!shipment.history.some(history=>history.status===option))??"READY_FOR_DELIVERY";
  const [status,setStatus]=useState<(typeof trackingOptions)[number]>(initialStatus);
  const [uploading,setUploading]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    let evidenceFileId:string|undefined;
    try{
      if(status==="THAILAND_WAREHOUSE"){
        const file=form.get("customsEvidence");
        if(!(file instanceof File)||!file.size)throw new Error("กรุณาแนบหลักฐานพิธีการนำเข้าอย่างน้อย 1 ไฟล์");
        setUploading(true);
        const uploadForm=new FormData();
        uploadForm.set("file",file);uploadForm.set("kind","CUSTOMS_ENTRY");uploadForm.set("entityId",shipment.id);
        const response=await fetch("/api/admin/operations-media",{method:"POST",body:uploadForm});
        const body=await response.json() as {data?:{id:string};message?:string};
        if(!response.ok||!body.data?.id)throw new Error(body.message??"อัปโหลดหลักฐานพิธีการนำเข้าไม่สำเร็จ");
        evidenceFileId=body.data.id;
      }
      await post("/api/admin/logistics/actions",{action:"ADD_TRACKING",shipment_id:shipment.id,status,event_at:new Date().toISOString(),location:form.get("location"),note:form.get("note"),member_visible:true,evidence_file_id:evidenceFileId});
    }catch(error){window.alert(error instanceof Error?error.message:"เพิ่มสถานะติดตามไม่สำเร็จ")}
    finally{setUploading(false)}
  }
  return <form className="slice8-inline-form" onSubmit={submit}>
    <label>สถานะถัดไป<select name="status" value={status} onChange={event=>setStatus(event.target.value as typeof status)}>{trackingOptions.map(option=><option key={option} value={option}>{trackingStatusLabel(option)}</option>)}</select></label>
    <label>สถานที่<input name="location" placeholder="ระบุสถานที่จริง" required/></label>
    <label>หมายเหตุ<input name="note" placeholder="ระบุข้อเท็จจริงที่ตรวจแล้ว"/></label>
    {status==="THAILAND_WAREHOUSE"?<label>หลักฐานพิธีการนำเข้า (ข้อมูลลับ)<input name="customsEvidence" type="file" accept=".pdf,.jpg,.jpeg,.png" required/></label>:null}
    <button disabled={busy||uploading} className="v14-button"><MapPin size={14}/>{uploading?"กำลังอัปโหลด…":status==="THAILAND_WAREHOUSE"?"ยืนยันผ่านพิธีการและถึงคลังไทย":"เพิ่มสถานะติดตาม"}</button>
  </form>
}

export function AdminLogisticsPanel({data,busy,post,capabilities=allAdminOrderCapabilities}:{data:OrderDetail;busy:boolean;post:Post;capabilities?:AdminOrderCapabilities}){
  const {logistics,order}=data;
  const [uploading,setUploading]=useState(false);
  const [receiptSourceId,setReceiptSourceId]=useState("");
  const prerequisites=logistics.prerequisites??{warehouses:[],receiptSources:[]};
  const receiptSources=prerequisites.receiptSources.filter(source=>source.remaining_quantity>0);
  const selectedReceiptSource=receiptSources.find(source=>source.supplier_order_item_id===receiptSourceId)??receiptSources[0];
  const readyBatches=consolidationReadyBatches(logistics);
  async function uploadPod(deliveryId:string,file:File){
    setUploading(true);
    try{const form=new FormData();form.set("file",file);form.set("kind","DELIVERY_EVIDENCE");form.set("entityId",deliveryId);
      const response=await fetch("/api/admin/operations-media",{method:"POST",body:form});
      const body=await response.json() as {data?:{id:string};message?:string};
      if(!response.ok||!body.data?.id)throw new Error(body.message??"อัปโหลด POD ไม่สำเร็จ");return body.data.id;
    }finally{setUploading(false)}
  }
  async function submitPod(event:React.FormEvent<HTMLFormElement>,shipment:Shipment,deliveryId:string){
    event.preventDefault();const form=new FormData(event.currentTarget);const file=form.get("proof");
    if(!(file instanceof File)||!file.size)return;
    try{const fileId=await uploadPod(deliveryId,file);const delivery=shipment.deliveries.find(row=>row.id===deliveryId)!;
      await post("/api/admin/logistics/actions",{action:"RECORD_DELIVERY",delivery_id:deliveryId,delivered_at:new Date().toISOString(),recipient_name:form.get("recipient"),recipient_phone:form.get("phone"),items:delivery.items.map(item=>({shipment_item_id:item.shipment_item_id,quantity_delivered:Number(form.get(`qty-${item.id}`)),condition:form.get(`condition-${item.id}`),issue_type:form.get(`condition-${item.id}`)==="GOOD"?undefined:"OTHER",issue_description:form.get(`condition-${item.id}`)==="GOOD"?undefined:String(form.get("note")||"พบปัญหาขณะส่งมอบ")})),evidence_file_ids:[fileId],next_delivery_plan:form.get("nextPlan")||undefined,note:form.get("note")||undefined});
    }catch(error){window.alert(error instanceof Error?error.message:"บันทึก POD ไม่สำเร็จ")}
  }
  return <section className="slice8-stack">
    {capabilities.manageLogistics ? <><article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">Slice 8 · การดำเนินงานภายใน</p><h2>รับเข้าคลังและรวมสินค้า</h2></div><Boxes/></div>
      {capabilities.manageWarehouseAndShipment&&selectedReceiptSource&&prerequisites.warehouses.length>0?<form className="slice8-inline-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);const source=receiptSources.find(item=>item.supplier_order_item_id===String(form.get("source")));if(!source)return;const weight=String(form.get("weight")??"").trim();const cbm=String(form.get("cbm")??"").trim();void post("/api/admin/logistics/actions",{action:"CREATE_WAREHOUSE_RECEIPT",supplier_order_id:source.supplier_order_id,warehouse_id:form.get("warehouse"),received_at:new Date().toISOString(),package_count:form.get("packages"),actual_weight_kg:weight?Number(weight):undefined,actual_cbm:cbm?Number(cbm):undefined,note:form.get("note")||undefined,items:[{supplier_order_item_id:source.supplier_order_item_id,received_quantity:form.get("quantity"),condition:"GOOD"}]})}}>
        <label>รายการจาก Supplier Order<select name="source" value={selectedReceiptSource.supplier_order_item_id} onChange={event=>setReceiptSourceId(event.target.value)}>{receiptSources.map(source=><option key={source.supplier_order_item_id} value={source.supplier_order_item_id}>{source.supplier_order_number} · {source.po_number??"ไม่มี PO"} · {source.item_name} · เหลือ {source.remaining_quantity}</option>)}</select></label>
        <label>คลังรับสินค้า<select name="warehouse">{prerequisites.warehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.warehouse_code} · {warehouse.warehouse_name} ({warehouse.country_code})</option>)}</select></label>
        <label>จำนวนรับ<input key={`${selectedReceiptSource.supplier_order_item_id}-${selectedReceiptSource.remaining_quantity}`} name="quantity" type="number" min="0.001" max={selectedReceiptSource.remaining_quantity} step="0.001" defaultValue={selectedReceiptSource.remaining_quantity} required/></label>
        <label>จำนวนหีบห่อ<input name="packages" type="number" min="1" step="1" defaultValue="1" required/></label>
        <label>น้ำหนักจริง (กก.)<input name="weight" type="number" min="0" step="0.001"/></label>
        <label>CBM จริง<input name="cbm" type="number" min="0" step="0.0001"/></label>
        <label>หมายเหตุ<input name="note" placeholder="สภาพสินค้าและข้อสังเกตจริง"/></label>
        <button disabled={busy} className="v14-button v14-button--dark"><PackageCheck size={14}/>บันทึกรับเข้าคลัง</button>
      </form>:capabilities.manageWarehouseAndShipment?<p className="v14-empty">ไม่มีรายการคงเหลือที่พร้อมรับ หรือยังไม่มีคลัง Active</p>:null}
      <div className="slice8-grid">{logistics.receipts.map(receipt=><div className="slice8-card" key={receipt.id}><header><b>{receipt.receipt_number}</b><Status>{receiptLabels[receipt.status]??receipt.status}</Status></header><p>{new Date(receipt.received_at).toLocaleString("th-TH")} · {receipt.package_count} หีบห่อ · {receipt.actual_weight_kg??"—"} กก.</p>{receipt.items.map(item=>{const available=warehouseReleaseAvailable(item);return <div key={item.id}><small>รับ {item.received_quantity} · ปล่อย {item.released_quantity} · พักไว้ {item.blocked_quantity}</small>{capabilities.manageWarehouseAndShipment&&available>0?<button disabled={busy} className="v14-button v14-button--small" onClick={()=>void post("/api/admin/logistics/actions",{action:"RELEASE_WAREHOUSE_RECEIPT_ITEM",warehouse_receipt_item_id:item.id,release_quantity:available})}>ปล่อยจำนวน {available} เพื่อรวมเที่ยว</button>:null}</div>})}</div>)}{!logistics.receipts.length?<p className="v14-empty">ยังไม่มีรายการรับเข้าคลัง</p>:null}</div>
      {capabilities.manageWarehouseAndShipment&&readyBatches.length?<div className="slice8-grid">{readyBatches.map(batch=>{const warehouse=prerequisites.warehouses.find(item=>item.id===batch.warehouseId);return <div className="slice8-card" key={batch.warehouseId}><header><b>พร้อมสร้าง Consolidation</b></header><p>{warehouse?`${warehouse.warehouse_code} · ${warehouse.warehouse_name}`:batch.warehouseId}</p><small>{batch.items.length} รายการ · {batch.items.reduce((sum,item)=>sum+item.quantity,0)} หน่วย</small><button disabled={busy} className="v14-button v14-button--dark" onClick={()=>void post("/api/admin/logistics/actions",{action:"CREATE_CONSOLIDATION",customer_order_id:order.id,warehouse_id:batch.warehouseId,strategy:"CONSOLIDATE_ALL",items:batch.items})}><Boxes size={14}/>รวมสินค้าทั้งหมดในคลังนี้</button></div>})}</div>:null}
      <div className="slice8-grid">{logistics.consolidations.map(group=><div className="slice8-card" key={group.id}><header><b>{group.consolidation_number}</b><Status>{consolidationLabels[group.status]??group.status}</Status></header><p>{consolidationStrategyLabels[group.strategy]??group.strategy} · {group.reason??"รวมสินค้าทั้งหมด"}</p><small>{group.items.length} รายการ · {group.items.reduce((sum,item)=>sum+Number(item.quantity),0)} หน่วย</small>{capabilities.manageWarehouseAndShipment&&group.status==="DRAFT"?<button disabled={busy} className="v14-button" onClick={()=>void post("/api/admin/logistics/actions",{action:"CONFIRM_CONSOLIDATION",consolidation_id:group.id})}><BadgeCheck size={14}/>ยืนยัน Consolidation</button>:null}{capabilities.manageWarehouseAndShipment&&group.status==="CONFIRMED"&&!logistics.shipments.some(shipment=>shipment.consolidation_group_id===group.id)?<form className="slice8-inline-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{void post("/api/admin/logistics/actions",{action:"CREATE_SHIPMENT",consolidation_id:group.id,shipment_name:form.get("shipmentName"),shipping_method:form.get("shippingMethod"),tracking_number:form.get("tracking")||undefined,etd_at:requiredIso(form.get("etd")),eta_at:requiredIso(form.get("eta")),additional_member_charge:0,charge_bearer:"GISP"})}catch(error){window.alert(error instanceof Error?error.message:"วันเวลาจัดส่งไม่ถูกต้อง")}}}><label>ชื่อ Shipment<input name="shipmentName" minLength={2} required/></label><label>วิธีขนส่ง<select name="shippingMethod" defaultValue="LCL"><option value="LCL">LCL</option><option value="FCL">FCL</option><option value="TRUCK">TRUCK</option><option value="AIR">AIR</option><option value="COURIER">COURIER</option></select></label><label>เลขติดตาม (ถ้ามี)<input name="tracking"/></label><label>ออกเดินทางโดยประมาณ<input name="etd" type="datetime-local" required/></label><label>ถึงโดยประมาณ<input name="eta" type="datetime-local" required/></label><button disabled={busy} className="v14-button v14-button--dark"><Ship size={14}/>สร้าง Shipment (ค่าใช้จ่ายเพิ่ม 0)</button></form>:null}</div>)}</div>
    </article>
    {logistics.shipments.map(shipment=><article className="v14-panel" key={shipment.id}><div className="v14-panel__head"><div><p className="v14-eyebrow">{shipment.shipment_number} · {shipmentTypeLabels[shipment.shipment_type]??shipment.shipment_type}</p><h2>{shipmentName(shipment.shipment_name,order.order_number)}</h2></div><Status>{shipmentStatusLabel(shipment.status)}</Status></div>
      <div className="slice8-summary"><span><Ship/>เลขติดตาม <b>{shipment.tracking_number??"—"}</b></span><span><PackageCheck/>จำนวน <b>{shipment.items.reduce((sum,item)=>sum+Number(item.quantity),0)}</b></span><span><CalendarClock/>กำหนดถึงโดยประมาณ <b>{shipment.estimated_arrival_at?new Date(shipment.estimated_arrival_at).toLocaleDateString("th-TH"):"—"}</b></span></div>
      {shipment.partialDecision?<div className="slice8-notice"><b>การจัดส่งบางส่วน</b><span>{shipment.partialDecision.reason} · ค่าใช้จ่ายของสมาชิก {formatOrderMoney(shipment.partialDecision.additional_member_charge,order.currency)}</span><Status>{shipment.partialDecision.member_acknowledged_at?"รับทราบแล้ว":"รอรับทราบ"}</Status></div>:null}
      {shipment.status==="GATE_CHECKED"?<button disabled={busy} className="v14-button v14-button--dark" onClick={()=>void post("/api/admin/logistics/actions",{action:"DISPATCH_SHIPMENT",shipment_id:shipment.id})}><Truck size={14}/>ยืนยันออกเดินทาง</button>:null}
      {["DISPATCHED","IN_TRANSIT","ARRIVED_THAILAND","IMPORT_CUSTOMS","THAILAND_WAREHOUSE"].includes(shipment.status)?<ShipmentTrackingForm key={shipment.history.length} shipment={shipment} busy={busy} post={post}/>:null}
      {(shipment.customsEvidence??[]).length?<p>หลักฐานพิธีการนำเข้าภายใน: {(shipment.customsEvidence??[]).map(file=>file.original_name).join(", ")}</p>:null}
      <div className="slice8-timeline">{shipment.history.map(event=><div key={event.id}><span/><section><b>{trackingStatusLabel(event.status)}</b><p>{event.location_text??"—"} · {event.note??""}</p><small>{new Date(event.event_at).toLocaleString("th-TH")}</small></section></div>)}</div>
      {["READY_FOR_DELIVERY","PARTIALLY_DELIVERED"].includes(shipment.status)&&!shipment.deliveries.some(d=>["PROPOSED","MEMBER_CONFIRMED","RESCHEDULE_REQUESTED","CONFIRMED","OUT_FOR_DELIVERY","ARRIVED"].includes(d.status))?<form className="slice8-inline-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{const start=requiredIso(form.get("scheduledAt"));const end=requiredIso(form.get("scheduledEnd"));if(end<=start)throw new Error("เวลาสิ้นสุดต้องหลังเวลาเริ่มนัด");void post("/api/admin/logistics/actions",{action:"SCHEDULE_DELIVERY",shipment_id:shipment.id,scheduled_at:start,scheduled_window_end:end,contact_name:form.get("contact"),contact_phone:form.get("phone"),site_note:form.get("note")})}catch(error){window.alert(error instanceof Error?error.message:"วันเวลานัดส่งไม่ถูกต้อง")}}}><label>วันเวลาเริ่มนัด<input name="scheduledAt" type="datetime-local" required/></label><label>วันเวลาสิ้นสุด<input name="scheduledEnd" type="datetime-local" required/></label><label>ผู้ติดต่อ<input name="contact" required/></label><label>โทรศัพท์<input name="phone" type="tel" required/></label><label>หมายเหตุหน้างาน<input name="note" placeholder="ระบุข้อมูลหน้างานจริง"/></label><button disabled={busy} className="v14-button v14-button--dark"><CalendarClock size={14}/>เสนอนัดส่ง</button></form>:null}
      {shipment.deliveries.map(delivery=><div className="slice8-delivery" key={delivery.id}><header><b>{delivery.delivery_number}</b><Status>{deliveryLabels[delivery.status]??delivery.status}</Status></header><p>{delivery.scheduled_at?new Date(delivery.scheduled_at).toLocaleString("th-TH"):"ยังไม่ระบุวัน"} · {delivery.contact_name}</p>
        {delivery.reschedules.filter(r=>r.status==="SUBMITTED").map(request=><form className="slice8-inline-form slice8-notice" key={request.id} onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{const start=requiredIso(form.get("acceptedAt"));const end=requiredIso(form.get("acceptedEnd"));if(end<=start)throw new Error("เวลาสิ้นสุดต้องหลังเวลาเริ่มนัด");void post("/api/admin/logistics/actions",{action:"REVIEW_RESCHEDULE",request_id:request.id,approve:true,decision_note:form.get("decisionNote"),accepted_scheduled_at:start,accepted_window_end:end})}catch(error){window.alert(error instanceof Error?error.message:"วันเวลานัดส่งไม่ถูกต้อง")}}}><span><b>ขอเลื่อนนัด:</b> {request.reason}</span><label>วันเวลาใหม่<input name="acceptedAt" type="datetime-local" required/></label><label>สิ้นสุดช่วงเวลา<input name="acceptedEnd" type="datetime-local" required/></label><label>เหตุผลการอนุมัติ<input name="decisionNote" required/></label><button disabled={busy} className="v14-button v14-button--small">อนุมัติวันใหม่</button></form>)}
        {["MEMBER_CONFIRMED","CONFIRMED"].includes(delivery.status)?<form className="slice8-inline-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);void post("/api/admin/logistics/actions",{action:"ADVANCE_DELIVERY",delivery_id:delivery.id,target_status:"OUT_FOR_DELIVERY",driver_name:form.get("driverName"),driver_phone:form.get("driverPhone"),vehicle_registration:form.get("vehicleRegistration")})}}><label>ผู้ขับรถ<input name="driverName" required/></label><label>โทรศัพท์ผู้ขับ<input name="driverPhone" type="tel" required/></label><label>ทะเบียนรถ<input name="vehicleRegistration" required/></label><button disabled={busy} className="v14-button"><Truck size={14}/>เริ่มนำส่ง</button></form>:null}
        {delivery.status==="OUT_FOR_DELIVERY"?<form className="slice8-pod" onSubmit={event=>void submitPod(event,shipment,delivery.id)}><h3>หลักฐานการส่งมอบ</h3>{delivery.items.map(item=><div key={item.id}><label>จำนวนส่งจริง<input name={`qty-${item.id}`} type="number" min="0" max={item.expected_quantity} step="0.001" required/></label><label>สภาพ<select name={`condition-${item.id}`}>{Object.entries(conditionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>)}<label>ผู้รับ<input name="recipient" required/></label><label>โทรศัพท์<input name="phone" type="tel"/></label><label>แผนส่งครั้งถัดไป (กรณีส่งบางส่วน)<input name="nextPlan" placeholder="ระบุแผนจริง"/></label><label>หมายเหตุ<input name="note" placeholder="ระบุผลตรวจรับจริง"/></label><label>หลักฐานรูปภาพ/PDF<input name="proof" type="file" accept=".jpg,.jpeg,.png,.pdf" required/></label><button disabled={busy||uploading} className="v14-button v14-button--dark"><Upload size={14}/>{uploading?"กำลังอัปโหลด…":"บันทึกหลักฐานส่งมอบ"}</button></form>:null}
        {delivery.items.some(item=>Number(item.quantity_delivered)>0)?<div className="slice8-items">{delivery.items.map(item=><small key={item.id}>ส่ง {item.quantity_delivered}/{item.expected_quantity} · เหลือ {item.remaining_quantity} · {item.condition}</small>)}</div>:null}
      </div>)}
    </article>)}</> : null}
    {capabilities.manageFreight && logistics.shipments.some(shipment=>shipment.deliveries.some(delivery=>["DELIVERED","PARTIALLY_DELIVERED","DELIVERED_WITH_ISSUE"].includes(delivery.status)))?<article className="v14-panel slice8-freight"><div className="v14-panel__head"><div><p className="v14-eyebrow">ต้นทุนภายใน → ใบแจ้งหนี้สมาชิก</p><h2>ค่าขนส่งจริง</h2></div><CircleDollarSign/></div>
      <div className="slice8-items">{logistics.costs.map(cost=><div key={cost.id}><span><b>{cost.description}</b><small>{cost.category} · {costStatusLabels[cost.status]??cost.status}</small></span><span>ต้นทุน {formatOrderMoney(cost.supplier_cost,cost.supplier_currency)}<br/>เรียกเก็บ {formatOrderMoney(cost.member_charge,cost.member_currency)}</span></div>)}</div>
      {!logistics.costs.length?<form className="slice8-inline-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);const lastShipment=logistics.shipments.at(-1);const lastDelivery=lastShipment?.deliveries.at(-1);void post("/api/admin/logistics/actions",{action:"ADD_COST",customer_order_id:order.id,shipment_id:lastShipment?.id,delivery_id:lastDelivery?.id,category:"INTERNATIONAL_FREIGHT",description:"ค่าขนส่งระหว่างประเทศ",supplier_cost:form.get("supplierCost"),supplier_currency:"THB",exchange_rate:1,member_charge:form.get("memberCharge"),is_billable:true,internal_note:"ข้อมูลต้นทุนภายใน",member_visible_note:"ค่าขนส่งตามจริง",evidence_file_ids:[]})}}><label>ต้นทุนภายใน<input name="supplierCost" type="number" min="0" step="0.01" required/></label><label>ยอดเรียกเก็บ Member<input name="memberCharge" type="number" min="0" step="0.01" required/></label><button disabled={busy} className="v14-button">บันทึก Actual Cost</button></form>:null}
      {logistics.costs.some(cost=>cost.status==="DRAFT")?<button disabled={busy} className="v14-button v14-button--dark" onClick={()=>void post("/api/admin/logistics/actions",{action:"FINALIZE_COSTS",customer_order_id:order.id})}><BadgeCheck size={14}/>ฝ่ายการเงินยืนยันต้นทุน</button>:null}
      {logistics.costs.some(cost=>cost.status==="FINALIZED")&&!logistics.invoice?<button disabled={busy} className="v14-button v14-button--dark" onClick={()=>void post("/api/admin/logistics/actions",{action:"ISSUE_INVOICE",customer_order_id:order.id,vat_rate:7,due_at:iso(7),note:"ใบแจ้งหนี้ค่าขนส่งจากต้นทุนจริง"})}>ออกใบแจ้งหนี้ค่าขนส่ง</button>:null}
      {logistics.invoice?<div className="slice8-invoice"><b>{logistics.invoice.invoice_number}</b><strong>{formatOrderMoney(logistics.invoice.grand_total,logistics.invoice.currency)}</strong><Status>{invoiceStatusLabels[logistics.invoice.status]??logistics.invoice.status}</Status></div>:null}
    </article>:null}
  </section>
}

export function MemberLogisticsPanel({data,busy,post}:{data:OrderDetail;busy:boolean;post:Post}){
  return <section className="slice8-stack"><article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">การจัดส่งและการส่งมอบ</p><h2>ติดตามการจัดส่ง</h2></div><Truck/></div>{data.logistics.shipments.length?data.logistics.shipments.map(shipment=><div className="slice8-member-shipment" key={shipment.id}><header><span><b>{shipment.shipment_number}</b><small>เลขติดตาม {shipment.tracking_number??"—"}</small></span><Status>{shipmentStatusLabel(shipment.status)}</Status></header>
    {shipment.partialDecision?<div className="slice8-notice"><span><b>{shipment.partialDecision.member_acknowledgement_required&&!shipment.partialDecision.member_acknowledged_at?"ต้องรับทราบก่อนจัดส่ง":"ข้อมูลการจัดส่งบางส่วน"}</b><br/>{shipment.partialDecision.reason} · ค่าใช้จ่ายเพิ่ม {formatOrderMoney(shipment.partialDecision.additional_member_charge,data.order.currency)}</span>{shipment.partialDecision.member_acknowledgement_required&&!shipment.partialDecision.member_acknowledged_at?<button disabled={busy} className="v14-button v14-button--dark" onClick={()=>void post("/api/member/logistics/actions",{action:"ACK_PARTIAL",shipment_id:shipment.id,note:"ตรวจรายละเอียดและรับทราบแล้ว"})}>รับทราบ</button>:<Status>{shipment.partialDecision.member_acknowledged_at?"รับทราบแล้ว":"ไม่ต้องรับทราบ"}</Status>}</div>:null}
    <div className="slice8-timeline">{shipment.history.map(event=><div key={event.id}><span/><section><b>{trackingStatusLabel(event.status)}</b><p>{event.location_text??""} · {event.note??""}</p><small>{new Date(event.event_at).toLocaleString("th-TH")}</small></section></div>)}</div>
    {shipment.deliveries.map(delivery=><div className="slice8-delivery" key={delivery.id}><header><b>{delivery.delivery_number}</b><Status>{deliveryLabels[delivery.status]??delivery.status}</Status></header><p>{delivery.scheduled_at?new Date(delivery.scheduled_at).toLocaleString("th-TH"):"รอวันนัด"} · {delivery.contact_name}</p>{delivery.status==="PROPOSED"?<div className="v14-actions"><button disabled={busy} className="v14-button v14-button--dark" onClick={()=>void post("/api/member/logistics/actions",{action:"CONFIRM_APPOINTMENT",delivery_id:delivery.id})}>ยืนยันนัด</button><form className="slice8-inline-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{void post("/api/member/logistics/actions",{action:"REQUEST_RESCHEDULE",delivery_id:delivery.id,preferred_dates:[requiredIso(form.get("preferredAt"))],reason:form.get("reason"),contact_name:delivery.contact_name??undefined,contact_phone:delivery.contact_phone??undefined,site_note:form.get("siteNote")||undefined})}catch(error){window.alert(error instanceof Error?error.message:"วันเวลาไม่ถูกต้อง")}}}><label>วันเวลาที่ต้องการ<input name="preferredAt" type="datetime-local" required/></label><label>เหตุผล<input name="reason" required/></label><label>ข้อมูลหน้างาน<input name="siteNote"/></label><button disabled={busy} className="v14-button v14-button--outline">ขอเลื่อนนัด</button></form></div>:null}<div className="slice8-items">{delivery.items.map(item=><small key={item.id}>ส่งแล้ว {item.quantity_delivered}/{item.expected_quantity} · เหลือ {item.remaining_quantity} · {conditionLabels[item.condition]??item.condition}</small>)}</div>{delivery.evidence.length?<p>หลักฐานส่งมอบ: {delivery.evidence.map(item=><a key={item.id} href={`/api/files/${item.file_id}/download?redirect=1`} target="_blank" rel="noreferrer">ดูหลักฐาน</a>)}</p>:null}</div>)}
  </div>):<p className="v14-empty">ยังไม่มีรายการจัดส่ง — รอทีมขนส่งเตรียมการจัดส่ง</p>}</article>
  {data.logistics.invoice?<article className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">ใบแจ้งหนี้ค่าขนส่งจริง</p><h2>{data.logistics.invoice.invoice_number}</h2></div><Status>{invoiceStatusLabels[data.logistics.invoice.status]??data.logistics.invoice.status}</Status></div><div className="slice8-items">{data.logistics.invoice.items.map(item=><div key={item.id}><span><b>{item.description_snapshot}</b><small>{item.category_snapshot}</small></span><strong>{formatOrderMoney(item.amount_snapshot,data.logistics.invoice!.currency)}</strong></div>)}</div><div className="slice8-invoice"><span>รวมภาษีมูลค่าเพิ่ม {data.logistics.invoice.vat_rate_snapshot}%</span><strong>{formatOrderMoney(data.logistics.invoice.grand_total,data.logistics.invoice.currency)}</strong></div><p>ส่งหลักฐานการโอนได้จากกล่อง “ส่งหลักฐานการโอน” ด้านบน โดยเลือกงวดค่าขนส่ง</p></article>:null}</section>
}
