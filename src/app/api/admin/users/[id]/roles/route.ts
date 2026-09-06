import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireSuperAdmin } from "@/lib/auth/session";
import { productionRoles } from "@/lib/auth/types";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const schema = z.object({ action: z.enum(["assign", "revoke"]), role: z.enum(productionRoles) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return invalidInput();
  try {
    await requireSuperAdmin();
    const insforge = await createInsForgeServerClient();
    const rpc = parsed.data.action === "assign" ? "assign_production_role" : "revoke_production_role";
    const { data, error } = await insforge.database.rpc(rpc, { target_user_id_input: id, role_code_input: parsed.data.role });
    if (error) throw error;
    return NextResponse.json({ data, message: "อัปเดตบทบาทแล้ว" });
  } catch (error) {
    return apiError(error);
  }
}
