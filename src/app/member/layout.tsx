import { redirect } from "next/navigation";
import { ProductionShell } from "@/components/production-shell";
import { readAppAccessContext } from "@/lib/auth/session";

export default async function MemberLayout({children}:{children:React.ReactNode}){const context=await readAppAccessContext();if(!context)redirect("/login");if(!context.roles.includes("MEMBER"))redirect("/admin/dashboard");return <ProductionShell portal="member" context={context}>{children}</ProductionShell>}
