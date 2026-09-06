"use client";

import { ArrowRight, Eye, EyeOff, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "เข้าสู่ระบบไม่สำเร็จ");
      const session = await fetch("/api/auth/session", { cache: "no-store" });
      const sessionBody = (await session.json()) as { next?: string; message?: string };
      if (!session.ok) throw new Error(sessionBody.message ?? "ตรวจสอบเซสชันไม่สำเร็จ");
      const requested = searchParams.get("next");
      const safeRequested = requested?.startsWith("/") && !requested.startsWith("//") ? requested : undefined;
      router.replace(safeRequested ?? sessionBody.next ?? "/member/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เกิดข้อผิดพลาด");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-form-card">
      <p className="auth-kicker">Secure company access</p>
      <h1>เข้าสู่ระบบ</h1>
      <p className="auth-form-card__lead">ใช้บัญชีบริษัทของคุณเพื่อเข้าสู่ GISP Workspace</p>
      <form action={submit} className="auth-form">
        <label className="block">
          <span>อีเมล</span>
          <div className="auth-field"><Mail size={17} /><input name="email" type="email" required autoComplete="email" placeholder="name@company.com" /></div>
        </label>
        <label className="block">
          <span>รหัสผ่าน</span>
          <div className="auth-field"><ShieldCheck size={17} /><input name="password" type={showPassword ? "text" : "password"} minLength={10} required autoComplete="current-password" placeholder="รหัสผ่านอย่างน้อย 10 ตัวอักษร" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        </label>
        <div className="auth-form__links"><Link href="/register">สมัครบัญชีบริษัท</Link><Link href="/forgot-password">ลืมรหัสผ่าน</Link></div>
        {error && <p role="alert" className="auth-form__error">{error}</p>}
        <button type="submit" disabled={pending} className="auth-submit">{pending ? <LoaderCircle size={17} className="animate-spin" /> : null}<span>{pending ? "กำลังตรวจสอบ" : "เข้าสู่ระบบ"}</span>{pending ? null : <ArrowRight size={17} />}</button>
      </form>
      <p className="auth-form-card__note"><ShieldCheck size={14} /> ระบบตรวจสถานะบริษัท Session และสิทธิ์ทุกครั้ง</p>
    </div>
  );
}
