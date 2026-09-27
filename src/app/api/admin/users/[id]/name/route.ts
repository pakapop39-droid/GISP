import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { internalUserNameSchema } from "@/lib/auth/internal-user-schema";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const parsed = internalUserNameSchema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !parsed.success) {
      return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
    }
    const insforge = await createInsForgeServerClient();
    const result = await insforge.database.rpc("rename_internal_staff_user", {
      target_user_id_input: id,
      full_name_input: parsed.data.name,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ data: result.data, message: "แก้ชื่อที่แสดงแล้ว" });
  } catch (error) {
    return apiError(error);
  }
}
