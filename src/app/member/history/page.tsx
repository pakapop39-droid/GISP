import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { MemberHistoryItem } from "@/lib/auth/types";

export default async function MemberHistory(){await requireAppAccess({active:true});const insforge=await createInsForgeServerClient();const {data}=await insforge.database.rpc("get_member_history",{});const items=(data??[]) as MemberHistoryItem[];return <><section className="v14-hero"><div><p className="v14-eyebrow">Sanitized history</p><h1>ประวัติ Project และ Order</h1><p>รายการนี้ไม่รวมต้นทุน Supplier หรือข้อมูลภายใน และยังอ่านได้ในโหมดระงับบัญชี</p></div></section><section className="v14-panel"><div className="v14-list">{items.length?items.map(item=><div key={item.item_id}><strong>{item.reference}</strong><span>{item.title}</span><span className="v14-status v14-status--neutral">{item.status}</span></div>):<div><strong>ยังไม่มีรายการ</strong><span>Slice ถัดไปจะเริ่มสร้าง Project จริง</span><span/></div>}</div></section></>}

