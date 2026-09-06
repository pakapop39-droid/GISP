import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { onboardingRpcInput, onboardingSchema } from "@/lib/member/onboarding";

export async function POST(request: NextRequest) {
  const parsed = onboardingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
  try {
    const context = await requireAppAccess({ active: false });
    const insforge = await createInsForgeServerClient();
    const saved = await insforge.database.rpc("save_member_onboarding", onboardingRpcInput(parsed.data));
    if (saved.error) throw saved.error;
    const now = new Date().toISOString();
    const consents = await insforge.database.from("user_consents").insert([
      { user_id: context.userId, consent_type: "TERMS", policy_version: "2026-08-18", accepted_at: now },
      { user_id: context.userId, consent_type: "PRIVACY", policy_version: "2026-08-18", accepted_at: now },
    ]);
    if (consents.error && !String(consents.error.message).includes("duplicate")) throw consents.error;
    const submitted = await insforge.database.rpc("submit_member_application", {});
    if (submitted.error) throw submitted.error;
    return NextResponse.json({ data: { memberProfileId: saved.data, applicationId: submitted.data }, message: "ส่งคำขออนุมัติแล้ว" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

