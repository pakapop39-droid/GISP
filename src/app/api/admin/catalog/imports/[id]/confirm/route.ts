import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.import", "catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const result = await insforge.database.rpc("execute_catalog_import_job", { import_job_id_input: id });
    if (result.error) throw result.error;
    return NextResponse.json({ data: result.data, message: `สร้าง Product Draft แล้ว ${result.data?.imported ?? 0} รายการ` });
  } catch (error) {
    return apiError(error);
  }
}
