import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET(request: NextRequest) {
  try {
    const context = await requireAppAccess({ active: true });
    const kind = request.nextUrl.searchParams.get("kind") === "security" ? "security" : "audit";
    const needed = kind === "security" ? "security.read" : "audit.read";
    if (!context.permissions.includes(needed)) return NextResponse.json({ code: "PERMISSION_DENIED", message: "ไม่มีสิทธิ์ดู Log นี้" }, { status: 403 });
    const admin = createInsForgeAdminClient();
    const table = kind === "security" ? "security_events" : "audit_events";
    const { data, error } = await admin.database.from(table).select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}

