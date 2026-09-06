import { redirect } from "next/navigation";
import { accessHome, requireAppAccess } from "@/lib/auth/session";

export default async function DashboardPage() {
  const context = await requireAppAccess({ active: true });
  redirect(accessHome(context));
}
