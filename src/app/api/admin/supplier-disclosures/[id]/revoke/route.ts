import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { revokeSupplierDisclosureSchema } from "@/lib/projects/schema";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAppAccess({ active: true, permissions: ["visits.manage"] });
    if (!context.roles.includes("SUPER_ADMIN")) throw new AppAccessError("PERMISSION_DENIED", 403, "เฉพาะ Super Admin เท่านั้นที่ถอนสิทธิ์ Supplier ได้");
    const parsed = revokeSupplierDisclosureSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("revoke_supplier_disclosure", { grant_id_input: id, reason_input: parsed.data.reason });
    if (error) throw error;
    return NextResponse.json({ data, message: "ถอนสิทธิ์เปิดเผย Supplier แล้ว" });
  } catch (error) { return apiError(error); }
}
