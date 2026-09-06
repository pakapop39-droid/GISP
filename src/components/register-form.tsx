"use client";

import { ArrowRight, LoaderCircle, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [stage, setStage] = useState<"account" | "verify">("account");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string }>();

  async function createAccount(formData: FormData) {
    setPending(true); setMessage(undefined);
    const payload = Object.fromEntries(formData.entries());
    try {
      const response = await fetch("/api/auth/sign-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "สมัครไม่สำเร็จ");
      setEmail(String(payload.email)); setStage("verify"); setMessage({ text: body.message ?? "ส่งรหัสแล้ว" });
    } catch (caught) { setMessage({ error: true, text: caught instanceof Error ? caught.message : "เกิดข้อผิดพลาด" }); }
    finally { setPending(false); }
  }

  async function verify(formData: FormData) {
    setPending(true); setMessage(undefined);
    try {
      const response = await fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, otp: formData.get("otp") }) });
      const body = (await response.json()) as { message?: string; next?: string };
      if (!response.ok) throw new Error(body.message ?? "ยืนยันไม่สำเร็จ");
      router.replace(body.next ?? "/onboarding"); router.refresh();
    } catch (caught) { setMessage({ error: true, text: caught instanceof Error ? caught.message : "เกิดข้อผิดพลาด" }); }
    finally { setPending(false); }
  }

  async function resend() {
    setPending(true);
    await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setMessage({ text: "หากบัญชียังรอยืนยัน ระบบได้ส่งรหัสใหม่แล้ว" }); setPending(false);
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lacquer">Company registration · {stage === "account" ? "01" : "02"}</p>
      <h1 className="mt-4 font-display text-4xl font-semibold">{stage === "account" ? "สร้างบัญชีบริษัท" : "ยืนยันอีเมล"}</h1>
      <p className="mt-3 text-sm leading-6 text-ink/60">{stage === "account" ? "ใช้หนึ่ง Login ต่อหนึ่ง Member Profile และตั้งรหัสผ่านอย่างน้อย 10 ตัว" : `กรอกรหัส 6 หลักที่ส่งไปยัง ${email}`}</p>
      {stage === "account" ? (
        <form action={createAccount} className="mt-8 space-y-4">
          <Field label="ชื่อผู้ติดต่อ" name="name" autoComplete="name" />
          <Field label="อีเมลบริษัท" name="email" type="email" autoComplete="email" />
          <Field label="รหัสผ่าน" name="password" type="password" minLength={10} autoComplete="new-password" />
          {message && <Notice {...message} />}
          <Submit pending={pending} label="สร้างบัญชีและส่ง OTP" />
        </form>
      ) : (
        <form action={verify} className="mt-8 space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-ink/60">รหัสยืนยัน 6 หลัก</span><input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus className="h-16 w-full rounded-xl border border-ink/10 bg-white px-4 text-center font-display text-3xl tracking-[0.35em] outline-none focus:border-lacquer/45" /></label>
          {message && <Notice {...message} />}
          <Submit pending={pending} label="ยืนยันและกรอกข้อมูลบริษัท" />
          <button type="button" onClick={resend} disabled={pending} className="flex w-full items-center justify-center gap-2 text-xs font-bold text-ink/55"><RotateCw size={14} />ส่งรหัสใหม่</button>
        </form>
      )}
    </div>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-ink/60">{label}</span><input required className="h-12 w-full rounded-xl border border-ink/10 bg-white px-4 text-sm outline-none focus:border-lacquer/45 focus:ring-4 focus:ring-lacquer/8" {...props} /></label>; }
function Notice({ error, text }: { error?: boolean; text: string }) { return <p role={error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-xs ${error ? "bg-lacquer/10 text-lacquer" : "bg-jade/10 text-jade"}`}>{text}</p>; }
function Submit({ pending, label }: { pending: boolean; label: string }) { return <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lacquer text-sm font-bold text-white disabled:opacity-60">{pending ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowRight size={17} />}{pending ? "กำลังดำเนินการ" : label}</button>; }

