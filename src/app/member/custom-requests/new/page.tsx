import { Suspense } from "react";
import { MemberCustomRequestForm } from "@/components/member-custom-request-form";
import { requireAppAccess } from "@/lib/auth/session";

export default async function NewCustomRequestPage() {
  await requireAppAccess({ active: true });
  return <Suspense fallback={<div className="v14-empty">กำลังเตรียมแบบฟอร์ม…</div>}><MemberCustomRequestForm/></Suspense>;
}
