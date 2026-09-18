import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const id = z.uuid();
const date = z.iso.datetime();
export const logisticsActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_WAREHOUSE_RECEIPT"),
    supplier_order_id: id,
    warehouse_id: id,
    received_at: date,
    package_count: z.coerce.number().int().min(1),
    actual_weight_kg: z.coerce.number().min(0).optional(),
    actual_cbm: z.coerce.number().min(0).optional(),
    note: z.string().trim().optional(),
    items: z.array(z.object({
      supplier_order_item_id: id,
      received_quantity: z.coerce.number().positive(),
      condition: z.literal("GOOD").default("GOOD"),
    })).min(1),
  }),
  z.object({
    action: z.literal("RELEASE_WAREHOUSE_RECEIPT_ITEM"),
    warehouse_receipt_item_id: id,
    release_quantity: z.coerce.number().positive(),
  }),
  z.object({
    action: z.literal("CREATE_CONSOLIDATION"),
    customer_order_id: id,
    warehouse_id: id,
    strategy: z.literal("CONSOLIDATE_ALL"),
    items: z.array(z.object({
      warehouse_receipt_item_id: id,
      quantity: z.coerce.number().positive(),
    })).min(1),
  }),
  z.object({ action: z.literal("CONFIRM_CONSOLIDATION"), consolidation_id: id }),
  z.object({ action: z.literal("CREATE_SHIPMENT"), consolidation_id: id, shipment_name: z.string().trim().min(2), shipping_method: z.enum(["LCL","FCL","TRUCK","AIR","COURIER"]), tracking_number: z.string().trim().optional(), etd_at: date.optional(), eta_at: date.optional(), remaining_plan: z.string().trim().optional(), additional_member_charge: z.coerce.number().min(0).default(0), charge_bearer: z.enum(["GISP","MEMBER"]).default("GISP") }),
  z.object({ action: z.literal("DISPATCH_SHIPMENT"), shipment_id: id }),
  z.object({ action: z.literal("ADD_TRACKING"), shipment_id: id, status: z.enum(["FACTORY_PICKUP_SCHEDULED","PICKED_UP_FROM_FACTORY","ARRIVED_CHINA_WAREHOUSE","CONSOLIDATED","BOOKED","EXPORT_CUSTOMS","DEPARTED_CHINA","IN_TRANSIT","ARRIVED_THAILAND","IMPORT_CUSTOMS","THAILAND_WAREHOUSE","READY_FOR_DELIVERY","DELAY","NOTE"]), event_at: date, location: z.string().trim().optional(), note: z.string().trim().optional(), eta_at: date.optional(), member_visible: z.boolean().default(true), evidence_file_id: id.optional() }),
  z.object({ action: z.literal("SCHEDULE_DELIVERY"), shipment_id: id, scheduled_at: date, scheduled_window_end: date, contact_name: z.string().trim().min(2), contact_phone: z.string().trim().min(5), site_note: z.string().trim().optional() }),
  z.object({ action: z.literal("REVIEW_RESCHEDULE"), request_id: id, approve: z.boolean(), decision_note: z.string().trim().min(2), accepted_scheduled_at: date.optional(), accepted_window_end: date.optional() }),
  z.object({ action: z.literal("ADVANCE_DELIVERY"), delivery_id: id, target_status: z.enum(["OUT_FOR_DELIVERY","ARRIVED","FAILED","RESCHEDULE_REQUIRED"]), reason: z.string().trim().optional(), driver_name: z.string().trim().optional(), driver_phone: z.string().trim().optional(), vehicle_registration: z.string().trim().optional() }),
  z.object({ action: z.literal("RECORD_DELIVERY"), delivery_id: id, delivered_at: date, recipient_name: z.string().trim().min(2), recipient_phone: z.string().trim().optional(), items: z.array(z.object({ shipment_item_id: id, quantity_delivered: z.coerce.number().min(0), condition: z.enum(["GOOD","DAMAGED","MISSING","WRONG_ITEM","OTHER"]), issue_type: z.enum(["DAMAGED","MISSING","WRONG_ITEM","QUALITY","OTHER"]).optional(), issue_description: z.string().trim().optional() })).min(1), evidence_file_ids: z.array(id).min(1), next_delivery_plan: z.string().trim().optional(), note: z.string().trim().optional() }),
  z.object({ action: z.literal("ADD_COST"), customer_order_id: id, shipment_id: id.optional(), delivery_id: id.optional(), category: z.enum(["CHINA_DOMESTIC_TRANSPORT","WAREHOUSE","INSPECTION","CONSOLIDATION","PACKING","INTERNATIONAL_FREIGHT","INSURANCE","CUSTOMS","TAX","THAILAND_WAREHOUSE","THAILAND_DELIVERY","LIFTING","OTHER"]), description: z.string().trim().min(2), supplier_cost: z.coerce.number().min(0), supplier_currency: z.string().trim().length(3), exchange_rate: z.coerce.number().positive(), member_charge: z.coerce.number().min(0), is_billable: z.boolean(), internal_note: z.string().trim().optional(), member_visible_note: z.string().trim().optional(), evidence_file_ids: z.array(id).default([]) }),
  z.object({ action: z.literal("FINALIZE_COSTS"), customer_order_id: id }),
  z.object({ action: z.literal("ISSUE_INVOICE"), customer_order_id: id, vat_rate: z.coerce.number().min(0).max(100), due_at: date.optional(), note: z.string().trim().optional() }),
]);

export type LogisticsActionInput = z.infer<typeof logisticsActionSchema>;
export function logisticsRpc(input: LogisticsActionInput): [string, Record<string, unknown>, string] {
  switch (input.action) {
    case "CREATE_WAREHOUSE_RECEIPT": return ["create_warehouse_receipt", {
      supplier_order_id_input: input.supplier_order_id,
      warehouse_id_input: input.warehouse_id,
      received_at_input: input.received_at,
      package_count_input: input.package_count,
      actual_weight_kg_input: input.actual_weight_kg ?? null,
      actual_cbm_input: input.actual_cbm ?? null,
      note_input: input.note ?? null,
      items_input: input.items.map((item) => ({
        supplier_order_item_id: item.supplier_order_item_id,
        received_quantity: item.received_quantity,
        condition: "GOOD",
        blocked_quantity: 0,
        discrepancy_note: null,
      })),
      evidence_file_ids_input: [],
    }, "บันทึกรับสินค้าเข้าคลังแล้ว"];
    case "RELEASE_WAREHOUSE_RECEIPT_ITEM": return ["release_warehouse_receipt_item", {
      warehouse_receipt_item_id_input: input.warehouse_receipt_item_id,
      release_quantity_input: input.release_quantity,
    }, "ปล่อยสินค้าเพื่อรวมเที่ยวแล้ว"];
    case "CREATE_CONSOLIDATION": return ["create_consolidation", {
      customer_order_id_input: input.customer_order_id,
      warehouse_id_input: input.warehouse_id,
      strategy_input: "CONSOLIDATE_ALL",
      reason_input: null,
      items_input: input.items,
    }, "สร้างแผนรวมสินค้าแล้ว"];
    case "CONFIRM_CONSOLIDATION": return ["confirm_consolidation", {
      consolidation_id_input: input.consolidation_id,
    }, "ยืนยันแผนรวมสินค้าแล้ว"];
    case "CREATE_SHIPMENT": return ["create_shipment_v2", { consolidation_id_input:input.consolidation_id,shipment_name_input:input.shipment_name,shipping_method_input:input.shipping_method,tracking_number_input:input.tracking_number??null,etd_at_input:input.etd_at??null,eta_at_input:input.eta_at??null,remaining_plan_input:input.remaining_plan??null,additional_member_charge_input:input.additional_member_charge,charge_bearer_input:input.charge_bearer }, "สร้าง Shipment แล้ว"];
    case "DISPATCH_SHIPMENT": return ["dispatch_shipment", { shipment_id_input:input.shipment_id }, "Dispatch Shipment แล้ว"];
    case "ADD_TRACKING": return ["add_shipment_event", { shipment_id_input:input.shipment_id,status_input:input.status,event_at_input:input.event_at,location_input:input.location??null,note_input:input.note??null,eta_at_input:input.eta_at??null,is_member_visible_input:input.member_visible,evidence_file_id_input:input.evidence_file_id??null }, "อัปเดต Tracking แล้ว"];
    case "SCHEDULE_DELIVERY": return ["schedule_delivery", { shipment_id_input:input.shipment_id,scheduled_at_input:input.scheduled_at,scheduled_window_end_input:input.scheduled_window_end,contact_name_input:input.contact_name,contact_phone_input:input.contact_phone,site_note_input:input.site_note??null }, "เสนอนัดส่งแล้ว"];
    case "REVIEW_RESCHEDULE": return ["review_delivery_reschedule", { request_id_input:input.request_id,approve_input:input.approve,decision_note_input:input.decision_note,accepted_scheduled_at_input:input.accepted_scheduled_at??null,accepted_window_end_input:input.accepted_window_end??null }, "บันทึกผลพิจารณาเลื่อนนัดแล้ว"];
    case "ADVANCE_DELIVERY": return ["advance_delivery_status", { delivery_id_input:input.delivery_id,target_status_input:input.target_status,reason_input:input.reason??null,driver_name_input:input.driver_name??null,driver_phone_input:input.driver_phone??null,vehicle_registration_input:input.vehicle_registration??null }, "อัปเดตสถานะ Delivery แล้ว"];
    case "RECORD_DELIVERY": return ["record_delivery_v2", { delivery_id_input:input.delivery_id,delivered_at_input:input.delivered_at,recipient_name_input:input.recipient_name,recipient_phone_input:input.recipient_phone??null,items_input:input.items,evidence_file_ids_input:input.evidence_file_ids,next_delivery_plan_input:input.next_delivery_plan??null,note_input:input.note??null }, "บันทึกผลส่งมอบและ POD แล้ว"];
    case "ADD_COST": return ["add_logistics_cost", { customer_order_id_input:input.customer_order_id,shipment_id_input:input.shipment_id??null,delivery_id_input:input.delivery_id??null,category_input:input.category,description_input:input.description,supplier_cost_input:input.supplier_cost,supplier_currency_input:input.supplier_currency,exchange_rate_input:input.exchange_rate,member_charge_input:input.member_charge,is_billable_input:input.is_billable,internal_note_input:input.internal_note??null,member_visible_note_input:input.member_visible_note??null,evidence_file_ids_input:input.evidence_file_ids }, "บันทึก Actual Logistics Cost แล้ว"];
    case "FINALIZE_COSTS": return ["finalize_logistics_costs", { customer_order_id_input:input.customer_order_id }, "Finance สรุปต้นทุนแล้ว"];
    case "ISSUE_INVOICE": return ["issue_freight_invoice", { customer_order_id_input:input.customer_order_id,vat_rate_input:input.vat_rate,due_at_input:input.due_at??null,note_input:input.note??null }, "ออก Freight Invoice แล้ว"];
  }
}

const shipmentPermissionActions = new Set<LogisticsActionInput["action"]>([
  "CREATE_WAREHOUSE_RECEIPT",
  "RELEASE_WAREHOUSE_RECEIPT_ITEM",
  "CREATE_CONSOLIDATION",
  "CONFIRM_CONSOLIDATION",
  "CREATE_SHIPMENT",
  "DISPATCH_SHIPMENT",
  "ADD_TRACKING",
]);

const logisticsErrorMessages: Record<string, string> = {
  WAREHOUSE_NOT_ACTIVE: "คลังสินค้านี้ไม่ได้เปิดใช้งาน กรุณาเลือกคลัง Active",
  WAREHOUSE_RECEIPT_EXCEEDS_EXPECTED: "จำนวนรับเข้าคลังเกินจำนวนที่ Supplier Order ระบุ",
  RELEASE_EXCEEDS_AVAILABLE_QUANTITY: "จำนวนที่ปล่อยเกินจำนวนพร้อมใช้ในคลัง",
  CONSOLIDATION_EXCEEDS_RELEASED_QUANTITY: "จำนวนที่รวมเที่ยวเกินจำนวนที่ปล่อยจากคลังแล้ว",
  CONSOLIDATION_NOT_CONFIRMABLE: "แผนรวมสินค้านี้ไม่อยู่ในสถานะที่ยืนยันได้",
  CONSOLIDATION_NOT_CONFIRMED: "ต้องยืนยันแผนรวมสินค้าก่อนสร้าง Shipment",
  DISPATCH_GATE_FAILED: "ยังสร้าง Shipment ไม่ได้ เพราะ Dispatch Gate ยังไม่ผ่านครบทุกเงื่อนไข",
  CUSTOMS_EVIDENCE_REQUIRED: "กรุณาแนบหลักฐานพิธีการนำเข้าก่อนยืนยันถึงคลังไทย",
  INVALID_CUSTOMS_EVIDENCE: "หลักฐานพิธีการนำเข้าไม่ตรงกับ Shipment หรือไม่ได้จัดเก็บเป็นข้อมูลลับ",
  THAILAND_WAREHOUSE_REQUIRED: "ต้องยืนยันผ่านพิธีการและถึงคลังไทยพร้อมหลักฐานก่อนเปลี่ยนเป็นพร้อมนัดส่ง",
  DUPLICATE_SHIPMENT_MILESTONE: "สถานะนี้ถูกบันทึกแล้ว กรุณาเลือกสถานะถัดไป",
  SHIPMENT_STATUS_CANNOT_MOVE_BACKWARD: "ไม่สามารถย้อนสถานะ Shipment ไปขั้นตอนก่อนหน้าได้",
};

function logisticsDatabaseError(error: unknown) {
  const sourceMessage = error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "";
  const matched = Object.keys(logisticsErrorMessages).find((code) => sourceMessage.includes(code));
  return matched
    ? NextResponse.json({ code: matched, message: logisticsErrorMessages[matched] }, { status: 409 })
    : null;
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAppAccess({ active:true });
    const parsed=logisticsActionSchema.safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({message:"ข้อมูล Logistics ไม่ครบ",fields:parsed.error.flatten().fieldErrors},{status:400});
    if (shipmentPermissionActions.has(parsed.data.action) && !context.permissions.includes("shipments.manage")) {
      throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่มีสิทธิ์จัดการคลังและ Shipment");
    }
    const client=await createInsForgeServerClient();
    let input: LogisticsActionInput = parsed.data;
    if (input.action === "ADD_TRACKING" && input.status === "THAILAND_WAREHOUSE" && !input.evidence_file_id) {
      return NextResponse.json({
        code: "CUSTOMS_EVIDENCE_REQUIRED",
        message: logisticsErrorMessages.CUSTOMS_EVIDENCE_REQUIRED,
      }, { status: 400 });
    }
    if (input.action === "ADD_TRACKING" && input.status === "READY_FOR_DELIVERY") {
      const shipmentResult = await client.database.from("shipments")
        .select("status").eq("id", input.shipment_id).maybeSingle();
      if (shipmentResult.error) throw shipmentResult.error;
      if (!shipmentResult.data) {
        return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบ Shipment ที่มีสิทธิ์จัดการ" }, { status: 404 });
      }
      if (shipmentResult.data.status !== "THAILAND_WAREHOUSE") {
        return NextResponse.json({
          code: "THAILAND_WAREHOUSE_REQUIRED",
          message: logisticsErrorMessages.THAILAND_WAREHOUSE_REQUIRED,
        }, { status: 409 });
      }
    }
    if (input.action === "CREATE_SHIPMENT") {
      const consolidationResult = await client.database.from("consolidation_groups")
        .select("strategy").eq("id", input.consolidation_id).maybeSingle();
      if (consolidationResult.error) throw consolidationResult.error;
      if (!consolidationResult.data) {
        return NextResponse.json({
          code: "NOT_FOUND",
          message: "ไม่พบ Consolidation ที่มีสิทธิ์สร้าง Shipment",
        }, { status: 404 });
      }
      if (consolidationResult.data.strategy === "CONSOLIDATE_ALL") {
        if (input.additional_member_charge !== 0 || input.charge_bearer !== "GISP") {
          return NextResponse.json({
            code: "INVALID_CONSOLIDATED_SHIPMENT_CHARGE",
            message: "Consolidate All ต้องไม่มีค่าใช้จ่ายเพิ่มของ Member และ GISP เป็นผู้รับภาระ",
          }, { status: 400 });
        }
        input = { ...input, additional_member_charge: 0, charge_bearer: "GISP" };
      }
    }
    const [name,args,message]=logisticsRpc(input);
    const result=await client.database.rpc(name,args);
    if(result.error)throw result.error;
    return NextResponse.json({data:result.data,message});
  } catch(error){return logisticsDatabaseError(error) ?? apiError(error)}
}
