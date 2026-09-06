"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [pending,setPending]=useState(false); const [message,setMessage]=useState<string>();
  async function submit(formData:FormData){setPending(true);const response=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:formData.get("email")})});const body=await response.json() as {message:string};setMessage(body.message);setPending(false)}
  return <div className="w-full max-w-md"><p className="text-[10px] font-black uppercase tracking-[.2em] text-lacquer">Password recovery</p><h1 className="mt-4 font-display text-4xl font-semibold">ขอลิงก์เปลี่ยนรหัสผ่าน</h1><p className="mt-3 text-sm leading-6 text-ink/60">เพื่อความปลอดภัย ระบบจะตอบแบบเดียวกันไม่ว่าอีเมลจะมีบัญชีหรือไม่</p><form action={submit} className="mt-8 space-y-4"><input name="email" type="email" required placeholder="name@company.com" className="h-12 w-full rounded-xl border border-ink/10 bg-white px-4 text-sm outline-none" />{message&&<p className="rounded-xl bg-jade/10 px-4 py-3 text-xs text-jade">{message}</p>}<button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lacquer text-sm font-bold text-white">{pending&&<LoaderCircle size={16} className="animate-spin"/>}ส่งลิงก์แบบใช้ครั้งเดียว</button></form><Link href="/login" className="mt-5 block text-center text-xs font-bold text-ink/55">กลับไปเข้าสู่ระบบ</Link></div>;
}

export function ResetPasswordForm() {
  const searchParams=useSearchParams(); const token=searchParams.get("token")??"";
  const ready=searchParams.get("insforge_status")==="ready"&&searchParams.get("insforge_type")==="reset_password"&&token;
  const [pending,setPending]=useState(false); const [message,setMessage]=useState<{error?:boolean;text:string}>();
  async function submit(formData:FormData){setPending(true);const password=String(formData.get("password"));const confirm=String(formData.get("confirm"));if(password!==confirm){setMessage({error:true,text:"รหัสผ่านทั้งสองช่องไม่ตรงกัน"});setPending(false);return}const response=await fetch("/api/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,newPassword:password})});const body=await response.json() as {message:string};setMessage({error:!response.ok,text:body.message});setPending(false)}
  return <div className="w-full max-w-md"><p className="text-[10px] font-black uppercase tracking-[.2em] text-lacquer">One-time reset link</p><h1 className="mt-4 font-display text-4xl font-semibold">ตั้งรหัสผ่านใหม่</h1>{!ready?<p className="mt-6 rounded-xl bg-lacquer/10 px-4 py-3 text-sm text-lacquer">ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่</p>:<form action={submit} className="mt-8 space-y-4"><input name="password" type="password" minLength={10} required placeholder="รหัสผ่านใหม่อย่างน้อย 10 ตัว" className="h-12 w-full rounded-xl border border-ink/10 bg-white px-4 text-sm"/><input name="confirm" type="password" minLength={10} required placeholder="ยืนยันรหัสผ่านใหม่" className="h-12 w-full rounded-xl border border-ink/10 bg-white px-4 text-sm"/>{message&&<p className={`rounded-xl px-4 py-3 text-xs ${message.error?"bg-lacquer/10 text-lacquer":"bg-jade/10 text-jade"}`}>{message.text}</p>}<button disabled={pending} className="h-12 w-full rounded-xl bg-lacquer text-sm font-bold text-white">{pending?"กำลังเปลี่ยน":"เปลี่ยนรหัสผ่าน"}</button></form>}<Link href="/login" className="mt-5 block text-center text-xs font-bold text-ink/55">กลับไปเข้าสู่ระบบ</Link></div>;
}

