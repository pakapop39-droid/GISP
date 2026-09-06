import { redirect } from "next/navigation";
import { ProductionShell } from "@/components/production-shell";
import { readAppAccessContext } from "@/lib/auth/session";

export default async function AdminLayout({children}:{children:React.ReactNode}){const context=await readAppAccessContext();if(!context)redirect("/login");if(!context.roles.some(role=>role!=="MEMBER"))redirect("/member/dashboard");return <ProductionShell portal="admin" context={context} releaseStage={process.env.RELEASE_STAGE} staffOperations={process.env.ENABLE_STAFF_OPERATIONS === "true"}>{children}</ProductionShell>}

