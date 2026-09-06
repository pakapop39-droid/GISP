import { redirect } from "next/navigation";
import { AccountStatusPage } from "@/components/account-status-page";
import { readAppAccessContext } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { MemberHistoryItem } from "@/lib/auth/types";

export default async function SuspendedPage(){const context=await readAppAccessContext();if(!context)redirect("/login");if(context.userStatus!=="SUSPENDED")redirect("/member/dashboard");const insforge=await createInsForgeServerClient();const {data}=await insforge.database.rpc("get_member_history",{});const history=(data??[]) as MemberHistoryItem[];return <AccountStatusPage eyebrow="Read-only access" title="บัญชีถูกระงับการทำรายการ" description="Session เดิมทุกเครื่องถูกยกเลิก บัญชีนี้ดูได้เฉพาะประวัติ Project/Order แบบตัดราคา ต้นทุน Supplier และข้อมูลภายในออก" tone="bad" reason={context.statusReason}><div className="mt-7"><h2 className="font-display text-2xl">ประวัติที่อ่านได้</h2><div className="v14-list mt-4">{history.length?history.map(item=><div key={item.item_id}><strong>{item.reference}</strong><span>{item.title}</span><span className="v14-status v14-status--neutral">{item.status}</span></div>):<div><strong>ยังไม่มีประวัติ</strong><span>ไม่มี Project หรือ Order เดิมในบัญชีนี้</span><span/></div>}</div></div></AccountStatusPage>}

