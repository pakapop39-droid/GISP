import { FinishLibraryWorkspace } from "@/components/finish-library-workspace";
import { requireAppAccess } from "@/lib/auth/session";

export default async function FinishLibraryPage() {
  const context = await requireAppAccess({ permissions: ["catalog.read"] });
  return (
    <FinishLibraryWorkspace
      canManage={context.permissions.includes("catalog.manage")}
      canImport={context.permissions.includes("catalog.import")}
    />
  );
}

