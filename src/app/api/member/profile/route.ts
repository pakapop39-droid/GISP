import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { memberProfileSchema, onboardingRpcInput } from "@/lib/member/onboarding";

export async function GET() {
  try {
    const context = await requireAppAccess({ active: false, allowSuspendedHistory: true });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.from("member_profiles").select("*").eq("user_id", context.userId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const parsed = memberProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ active: true });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("save_member_onboarding", onboardingRpcInput(parsed.data));
    if (error) throw error;
    return NextResponse.json({ data, message: "บันทึกข้อมูลแล้ว" });
  } catch (error) {
    return apiError(error);
  }
}
