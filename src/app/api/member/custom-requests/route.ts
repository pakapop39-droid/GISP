import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { customRequestInputSchema } from "@/lib/custom-rfq/schema";
import { customRequestRpcInput, requestColumns, requireMember } from "@/lib/custom-rfq/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(request: NextRequest) {
  try {
    await requireMember();
    const db = await createInsForgeServerClient();
    let query = db.database.from("custom_requests").select(requestColumns).order("updated_at", { ascending: false }).limit(100);
    const status = request.nextUrl.searchParams.get("status");
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (status) query = query.eq("status", status);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) throw error;
    const projectIds = [...new Set((data ?? []).map((row) => row.project_id))];
    const projects = projectIds.length
      ? await db.database.from("projects").select("id,project_number,name").in("id", projectIds).limit(100)
      : { data: [], error: null };
    if (projects.error) throw projects.error;
    const names = new Map((projects.data ?? []).map((row) => [row.id, row]));
    return NextResponse.json({ data: (data ?? []).map((row) => ({ ...row, project: names.get(row.project_id) ?? null })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    await requireMember();
    const parsed = customRequestInputSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("create_custom_request_draft", customRequestRpcInput(parsed.data));
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "บันทึกร่าง Custom Request แล้ว" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
