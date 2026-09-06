import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth-page-shell";
import { ResetPasswordForm } from "@/components/password-recovery-form";
export default function ResetPasswordPage(){return <AuthPageShell><Suspense fallback={<div className="h-80 w-full max-w-md"/>}><ResetPasswordForm/></Suspense></AuthPageShell>}

