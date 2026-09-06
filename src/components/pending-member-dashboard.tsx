"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { SignOutButton } from "./account-status-actions";
import { MemberApplicationFiles, type ApplicationFile } from "./member-application-files";
import type { AppAccessContext } from "../lib/auth/types";

type Profile = {
  contact_name: string; contact_phone: string | null; company_name: string;
  company_legal_name: string | null; tax_id: string | null; business_type: string | null;
  address_line: string | null; district: string | null; province: string | null; postal_code: string | null;
};

export function PendingMemberDashboard({ context }: { context: AppAccessContext }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [files, setFiles] = useState<ApplicationFile[] | null>(null);
  const [profileError, setProfileError] = useState("");
  const [filesError, setFilesError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load<T>(url: string, accept: (value: T) => void, fail: (message: string) => void) {
      fail("");
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || body.data == null) throw new Error("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
        if (!controller.signal.aborted) accept(body.data as T);
      } catch {
        if (!controller.signal.aborted) fail("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
    }
    void Promise.allSettled([
      load<Profile>("/api/member/profile", setProfile, setProfileError),
      load<ApplicationFile[]>("/api/files", setFiles, setFilesError),
    ]);
    return () => controller.abort();
  }, [attempt]);

  async function checkStatus() {
    setChecking(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.status === 401) { router.replace("/login"); return; }
      const body = await response.json();
      if (!response.ok || typeof body.next !== "string") throw new Error("STATUS_FAILED");
      // Only navigate to known account destinations returned by the existing access policy.
      const destinations = ["/pending-approval", "/member/dashboard", "/admin/dashboard", "/application-rejected", "/account-suspended", "/onboarding"];
      if (!destinations.includes(body.next)) throw new Error("INVALID_DESTINATION");
      if (body.next !== "/pending-approval") {
        router.replace(body.next);
      } else {
        setStatusMessage("ตรวจสอบสถานะล่าสุดแล้ว");
        router.refresh();
      }
    } catch {
      setStatusMessage("ตรวจสอบสถานะไม่สำเร็จ กรุณาลองใหม่");
    } finally { setChecking(false); }
  }

  function retry(message: string) {
    return <div role="alert" className="v14-alert"><p>{message}</p><button type="button" className="v14-button v14-button--outline mt-3" onClick={() => setAttempt(value => value + 1)}>ลองโหลดใหม่</button></div>;
  }

  const details = profile ? [
    ["ชื่อบริษัท / กิจการ", profile.company_name], ["ชื่อนิติบุคคล", profile.company_legal_name],
    ["ผู้ติดต่อ", profile.contact_name], ["โทรศัพท์", profile.contact_phone],
    ["เลขประจำตัวผู้เสียภาษี", profile.tax_id], ["ประเภทธุรกิจ", profile.business_type],
    ["ที่อยู่", [profile.address_line, profile.district, profile.province, profile.postal_code].filter(Boolean).join(" ")],
  ] : [];

  return <main className="v14-app gisp-production ui-foundation min-h-screen px-4 py-6 sm:px-8">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4"><BrandMark /><SignOutButton /></header>
      <nav aria-label="เมนูผู้รออนุมัติ" className="flex flex-wrap gap-3 border-y border-ink/10 py-4 text-sm">
        <a href="#application-status" className="v14-button v14-button--outline">สถานะคำขอ</a>
        <a href="#company-profile" className="v14-button v14-button--outline">ข้อมูลบริษัท</a>
        <a href="#application-documents" className="v14-button v14-button--outline">เอกสารสมัคร</a>
      </nav>
      <section id="application-status" className="v14-panel scroll-mt-6 !p-6 sm:!p-8">
        <p className="v14-eyebrow">Dashboard ของคุณ</p>
        <span className="v14-status v14-status--warn mt-3">{context.applicationStatus === "UNDER_REVIEW" ? "กำลังตรวจสอบ" : "รออนุมัติ"}</span>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-snug sm:text-4xl">{context.applicationStatus === "UNDER_REVIEW" ? "ทีมกำลังตรวจสอบคำขอ" : "ส่งคำขอสำเร็จแล้ว — อยู่ระหว่างรอการอนุมัติ"}</h1>
        <p className="mt-4 break-words font-semibold">{context.companyName ?? context.displayName}</p>
        <p className="mt-2 text-sm leading-7 text-ink/65">คุณสามารถดูข้อมูลสมัครและเพิ่มเอกสารได้ เมื่อได้รับอนุมัติแล้วจึงจะดูราคา สร้าง Project และสั่งซื้อได้</p>
        <button type="button" disabled={checking} onClick={checkStatus} className="v14-button mt-5">{checking ? "กำลังตรวจสอบ…" : "ตรวจสอบสถานะล่าสุด"}</button>
        <p role="status" className="mt-3 text-sm">{statusMessage}</p>
      </section>
      <section id="company-profile" className="v14-panel scroll-mt-6 !p-6 sm:!p-8">
        <h2 className="font-display text-2xl font-semibold">ข้อมูลบริษัท</h2>
        <p className="mt-2 text-sm text-ink/60">ข้อมูลที่ส่งประกอบคำขอ — ดูได้อย่างเดียวระหว่างรออนุมัติ</p>
        {profileError ? retry(profileError) : profile ? <dl className="mt-5 grid gap-5 sm:grid-cols-2">{details.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-ink/55">{label}</dt><dd className="mt-1 break-words text-sm">{value || "—"}</dd></div>)}</dl> : <p role="status" className="mt-4">กำลังโหลดข้อมูลบริษัท…</p>}
      </section>
      <div id="application-documents" className="scroll-mt-6">
        {filesError ? retry(filesError) : files ? <MemberApplicationFiles initialFiles={files} pendingSummary /> : <p role="status" className="v14-panel !p-6">กำลังโหลดเอกสารสมัคร…</p>}
      </div>
    </div>
  </main>;
}
