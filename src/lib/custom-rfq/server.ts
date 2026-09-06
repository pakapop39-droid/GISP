import "server-only";
import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import type { customRequestInputSchema } from "@/lib/custom-rfq/schema";

export const requestColumns = "id,organization_id,member_profile_id,project_id,area_id,base_product_id,request_number,request_type,item_name,specification,description,width_mm,depth_mm,height_mm,quantity,unit,requested_material,requested_color,requested_function,requested_options_json,member_note,status,submitted_by,submitted_at,created_at,updated_at";

export async function requireMember() {
  const context = await requireAppAccess({ active: true });
  if (!context.roles.includes("MEMBER")) throw new AppAccessError("PERMISSION_DENIED", 403, "หน้านี้สำหรับสมาชิก");
  return context;
}

export async function requireRfqAdmin() {
  return requireAppAccess({ active: true, permissions: ["rfq.manage"] });
}

export function customRequestRpcInput(input: ReturnType<typeof customRequestInputSchema.parse>) {
  return {
    project_id_input: input.projectId,
    area_id_input: input.areaId,
    base_product_id_input: input.baseProductId,
    request_type_input: input.requestType,
    item_name_input: input.itemName,
    description_input: input.description,
    width_mm_input: input.widthMm,
    depth_mm_input: input.depthMm,
    height_mm_input: input.heightMm,
    quantity_input: input.quantity,
    unit_input: input.unit,
    requested_material_input: input.requestedMaterial,
    requested_color_input: input.requestedColor,
    requested_function_input: input.requestedFunction,
    member_note_input: input.memberNote,
  };
}
