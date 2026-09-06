import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["members.read"] });
    const admin = createInsForgeAdminClient();
    const [applications, profiles, users] = await Promise.all([
      admin.database.from("member_applications").select("*").order("submitted_at", { ascending: false }),
      admin.database.from("member_profiles").select("*"),
      admin.database.from("users").select("id,full_name,phone,status,status_reason,status_changed_at"),
    ]);
    if (applications.error) throw applications.error;
    if (profiles.error) throw profiles.error;
    if (users.error) throw users.error;
    const profileMap = new Map((profiles.data ?? []).map((row: Record<string, unknown>) => [row.id, row]));
    const userMap = new Map((users.data ?? []).map((row: Record<string, unknown>) => [row.id, row]));
    const data = (applications.data ?? []).map((application: Record<string, unknown>) => ({
      ...application,
      profile: profileMap.get(application.member_profile_id),
      user: userMap.get(application.user_id),
    }));
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

