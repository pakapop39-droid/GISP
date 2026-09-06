import "server-only";

import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { signedMemberProductMedia } from "@/lib/catalog/member-server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export type ScheduleItem = {
  item_id: string; area_name: string; product_id: string; sku: string; product_name: string;
  category_name: string | null; specification: string | null; selected_options: Array<{ label?: string }>;
  quantity: number; unit: string; member_price: number; suggested_resale: number | null;
  freight_min: number | null; freight_max: number | null; lead_time_days: number | null;
  item_status: string; supplier_name: string | null; supplier_address: string | null; supplier_contact: string | null;
};

export async function loadProjectSchedule(projectId: string) {
  const context = await requireAppAccess({ active: true });
  if (!context.roles.includes("MEMBER")) throw new AppAccessError("PERMISSION_DENIED", 403, "หน้านี้สำหรับสมาชิก");
  const db = await createInsForgeServerClient();
  const projectResult = await db.database.from("projects").select("id,project_number,name,site_address,expected_need_date,end_customer_id,created_at").eq("id", projectId).maybeSingle();
  if (projectResult.error) throw projectResult.error;
  if (!projectResult.data) throw new Error("NOT_FOUND");
  const customerPromise = projectResult.data.end_customer_id
    ? db.database
        .from("end_customers")
        .select("name,phone,email,address")
        .eq("id", projectResult.data.end_customer_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const [customerResult, scheduleResult] = await Promise.all([
    customerPromise,
    db.database.rpc("get_member_project_schedule", { project_id_input: projectId }),
  ]);
  if (customerResult.error) throw customerResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  const items = (scheduleResult.data ?? []) as ScheduleItem[];
  const media = await signedMemberProductMedia([...new Set(items.map(item => item.product_id))]);
  return { project: projectResult.data, customer: customerResult.data, items: items.map(item => ({ ...item, image_url: media.get(item.product_id)?.[0]?.url ?? null })) };
}
