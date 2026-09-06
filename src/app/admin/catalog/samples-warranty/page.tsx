import { SampleWarrantyWorkspace } from "@/components/sample-warranty-workspace";
import { requireAppAccess } from "@/lib/auth/session";

export default async function SampleWarrantyPage() {
  const context = await requireAppAccess({ permissions: ["catalog.read"] });
  return <SampleWarrantyWorkspace
    canManageSamples={context.permissions.includes("catalog.sample.manage")}
    canManageWarranty={context.permissions.includes("catalog.warranty.manage")}
  />;
}
