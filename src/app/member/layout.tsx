import { redirect } from "next/navigation";
import { ProductionShell } from "@/components/production-shell";
import { readAppAccessContext } from "@/lib/auth/session";
import { enabledReleaseDSlices } from "@/lib/release-stage";

export default async function MemberLayout({children}:{children:React.ReactNode}){const context=await readAppAccessContext();if(!context)redirect("/login");if(!context.roles.includes("MEMBER"))redirect("/admin/dashboard");return <ProductionShell portal="member" context={context} releaseStage={process.env.RELEASE_STAGE} releaseDSlices={enabledReleaseDSlices()} staffOperations={process.env.ENABLE_STAFF_OPERATIONS === "true"}>{children}</ProductionShell>}
