import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { requireMember } from "@/lib/shared-catalog/server";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireMember(); const { id } = await params; const db = await createInsForgeServerClient();
    const { error } = await db.database.rpc("revoke_shared_catalog", { catalog_id_input: id });
    if (error) throw error; return NextResponse.json({ message: "ปิดลิงก์ Catalog แล้ว" });
  } catch (error) { return apiError(error); }
}

