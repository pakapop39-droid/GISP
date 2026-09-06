import { redirect } from "next/navigation";
import { accessHome, readAppAccessContext } from "@/lib/auth/session";

export default async function LegacyPlatformLayout() {
  const context = await readAppAccessContext();
  redirect(context ? accessHome(context) : "/login");
}
