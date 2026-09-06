import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const id=z.uuid(),date=z.iso.datetime();
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("ACK_PARTIAL"),shipment_id:id,note:z.string().trim().optional()}),
  z.object({action:z.literal("CONFIRM_APPOINTMENT"),delivery_id:id}),
  z.object({action:z.literal("REQUEST_RESCHEDULE"),delivery_id:id,preferred_dates:z.array(date).min(1),reason:z.string().trim().min(3),contact_name:z.string().trim().optional(),contact_phone:z.string().trim().optional(),site_note:z.string().trim().optional()}),
]);

export async function POST(request:NextRequest){
  try{
    const context=await requireAppAccess({active:true});
    if(!context.roles.includes("MEMBER"))return NextResponse.json({message:"หน้านี้สำหรับสมาชิก"},{status:403});
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({message:"ข้อมูลไม่ครบ",fields:parsed.error.flatten().fieldErrors},{status:400});
    const input=parsed.data;
    const call=input.action==="ACK_PARTIAL"
      ? ["acknowledge_partial_shipment",{shipment_id_input:input.shipment_id,note_input:input.note??null},"รับทราบ Partial Shipment แล้ว"] as const
      : input.action==="CONFIRM_APPOINTMENT"
        ? ["confirm_delivery_appointment",{delivery_id_input:input.delivery_id},"ยืนยันนัดส่งแล้ว"] as const
        : ["request_delivery_reschedule",{delivery_id_input:input.delivery_id,preferred_dates_input:input.preferred_dates,reason_input:input.reason,contact_name_input:input.contact_name??null,contact_phone_input:input.contact_phone??null,site_note_input:input.site_note??null,requested_address_input:null},"ส่งคำขอเลื่อนนัดแล้ว"] as const;
    const client=await createInsForgeServerClient();
    const result=await client.database.rpc(call[0],call[1]);
    if(result.error)throw result.error;
    return NextResponse.json({data:result.data,message:call[2]});
  }catch(error){return apiError(error)}
}
