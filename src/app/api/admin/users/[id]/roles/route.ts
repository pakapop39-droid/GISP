import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { internalUserJobGroupsSchema } from "@/lib/auth/internal-user-schema";
import { requireSuperAdmin } from "@/lib/auth/session";
import { rolesForStaffJobGroup } from "@/lib/auth/staff-job-groups";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const parsed = internalUserJobGroupsSchema.safeParse(await request.json().catch(() => null));
    if (!z.string().uuid().safeParse(id).success || !parsed.success) return invalidInput();
    const roleCodes = [...new Set(parsed.data.jobGroups.flatMap(rolesForStaffJobGroup))];
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("replace_internal_staff_job_groups", {
      target_user_id_input: id,
      job_groups_input: parsed.data.jobGroups,
      role_codes_input: roleCodes,
    });
    if (error) throw error;
    return NextResponse.json({ data, message: "อัปเดตกลุ่มงานแล้ว" });
  } catch (error) {
    return apiError(error);
  }
}
