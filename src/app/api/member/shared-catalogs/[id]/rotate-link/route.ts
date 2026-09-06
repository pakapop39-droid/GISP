import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { requireMember } from "@/lib/shared-catalog/server";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireMember(); const { id } = await params; const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("rotate_shared_catalog_link", { catalog_id_input: id });
    if (error) throw error; return NextResponse.json({ data: { token: data }, message: "สร้างลิงก์ใหม่แล้ว ลิงก์เดิมถูกปิดทันที" });
  } catch (error) { return apiError(error); }
}

