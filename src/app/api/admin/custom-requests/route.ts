import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireRfqAdmin } from "@/lib/custom-rfq/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET(request: NextRequest) {
  try {
    await requireRfqAdmin();
    const admin = createInsForgeAdminClient();
    let query = admin.database.from("custom_requests")
      .select("id,organization_id,member_profile_id,project_id,request_number,request_type,item_name,quantity,unit,status,submitted_at,created_at,updated_at")
      .order("updated_at", { ascending: false }).limit(200);
    const status = request.nextUrl.searchParams.get("status");
    if (status) query = query.eq("status", status);
    const requests = await query;
    if (requests.error) throw requests.error;
    const rows = requests.data ?? [];
    const projectIds = [...new Set(rows.map((row) => row.project_id))];
    const profileIds = [...new Set(rows.map((row) => row.member_profile_id))];
    const requestIds = rows.map((row) => row.id);
    const [projects, profiles, assignments] = await Promise.all([
      projectIds.length ? admin.database.from("projects").select("id,project_number,name").in("id", projectIds).limit(200) : Promise.resolve({ data: [], error: null }),
      profileIds.length ? admin.database.from("member_profiles").select("id,company_name").in("id", profileIds).limit(200) : Promise.resolve({ data: [], error: null }),
      requestIds.length ? admin.database.from("assignments").select("id,entity_id,assigned_to,due_at,action_required,status").eq("entity_type", "CUSTOM_REQUEST").in("entity_id", requestIds).in("status", ["OPEN", "IN_PROGRESS"]).limit(200) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [projects, profiles, assignments]) if (result.error) throw result.error;
    const userIds = [...new Set((assignments.data ?? []).map((row) => row.assigned_to).filter(Boolean))];
    const users = userIds.length ? await admin.database.from("users").select("id,full_name").in("id", userIds).limit(200) : { data: [], error: null };
    if (users.error) throw users.error;
    const projectMap = new Map((projects.data ?? []).map((row) => [row.id, row]));
    const profileMap = new Map((profiles.data ?? []).map((row) => [row.id, row]));
    const assignmentMap = new Map((assignments.data ?? []).map((row) => [row.entity_id, row]));
    const userMap = new Map((users.data ?? []).map((row) => [row.id, row.full_name]));
    return NextResponse.json({ data: rows.map((row) => {
      const assignment = assignmentMap.get(row.id);
      return { ...row, project: projectMap.get(row.project_id) ?? null, member: profileMap.get(row.member_profile_id) ?? null,
        assignment: assignment ? { ...assignment, assigned_name: assignment.assigned_to ? userMap.get(assignment.assigned_to) ?? null : null } : null };
    }) });
  } catch (error) { return apiError(error); }
}
