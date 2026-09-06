"use client";

import {
  Building2,
  Check,
  FileCheck2,
  FileText,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      disabled={pending}
      className="v14-button v14-button--outline"
    >
      <LogOut size={15} />
      {pending ? "กำลังออก" : "ออกจากระบบ"}
    </button>
  );
}

const applicationDocuments = [
  {
    icon: Building2,
    label: "เอกสารหลัก — กรุณาแนบอย่างน้อย 1 รายการ",
    detail: "หนังสือรับรองบริษัท หรือทะเบียนพาณิชย์ฉบับปัจจุบัน",
    required: true,
  },
  {
    icon: FileCheck2,
    label: "เอกสารภาษี — แนบตามกรณี",
    detail: "ภ.พ.20 หรือเอกสารที่แสดงเลขประจำตัวผู้เสียภาษีของกิจการ",
    required: false,
  },
  {
    icon: FileText,
    label: "เอกสารเสริม — ไม่บังคับ",
    detail: "Company Profile, Portfolio หรือเอกสารแนะนำธุรกิจ",
    required: false,
  },
] as const;

export function ApplicationUpload() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const [message, setMessage] = useState<{ error?: boolean; text: string }>();

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) {
      setMessage({ error: true, text: "กรุณาเลือกไฟล์ก่อนกดอัปโหลด" });
      return;
    }

    setPending(true);
    setMessage(undefined);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/files", { method: "POST", body: form });
    const body = (await response.json()) as { message?: string };
    setMessage({
      error: !response.ok,
      text:
        body.message ??
        (response.ok ? `อัปโหลด ${file.name} เรียบร้อยแล้ว` : "อัปโหลดไม่สำเร็จ"),
    });
    setPending(false);
    if (response.ok && input.current) {
      input.current.value = "";
      setSelectedName("");
    }
  }

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-ink/10 bg-white/75">
      <div className="border-b border-ink/10 px-5 py-5 sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-brass">
          Application documents
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold">ต้องอัปโหลดเอกสารอะไร</h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          ใช้สำหรับยืนยันว่ากิจการมีตัวตนและข้อมูลตรงกับใบสมัคร
        </p>
      </div>

      <div className="grid gap-px bg-ink/10 sm:grid-cols-3">
        {applicationDocuments.map((document) => {
          const Icon = document.icon;
          return (
            <div key={document.label} className="bg-porcelain px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                <span
                  className={`text-[9px] font-black uppercase tracking-[.14em] ${
                    document.required ? "text-lacquer" : "text-ink/45"
                  }`}
                >
                  {document.required ? "เอกสารหลัก" : "ตามกรณี"}
                </span>
              </div>
              <p className="mt-4 text-xs font-bold leading-5">{document.label}</p>
              <p className="mt-1 text-xs leading-5 text-ink/55">{document.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="flex gap-3 rounded-xl border border-jade/20 bg-jade/5 px-4 py-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-jade" size={18} aria-hidden="true" />
          <p className="text-xs leading-5 text-ink/65">
            ไม่ต้องส่งรหัสผ่าน, OTP, Statement หรือข้อมูลบัญชีธนาคาร หากต้องใช้เอกสารเพิ่มเติม
            ทีม GISP จะแจ้งเหตุผลให้ทราบ
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-ink/55">
          <span className="inline-flex items-center gap-1.5 font-bold text-ink">
            <Check size={14} aria-hidden="true" /> PDF, JPEG, PNG
          </span>
          <span aria-hidden="true">•</span>
          <span>ไม่เกิน 10 MB ต่อไฟล์</span>
          <span aria-hidden="true">•</span>
          <span>สูงสุด 5 ไฟล์</span>
          <span aria-hidden="true">•</span>
          <span>อัปโหลดครั้งละ 1 ไฟล์</span>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-h-12 flex-1 cursor-pointer items-center border border-ink/15 bg-white px-4 text-xs transition hover:border-ink/40">
            <Upload className="mr-3 shrink-0" size={16} aria-hidden="true" />
            <span className={selectedName ? "font-bold text-ink" : "text-ink/50"}>
              {selectedName || "เลือกเอกสารจากเครื่อง"}
            </span>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              aria-label="เลือกเอกสารประกอบคำขอ"
              onChange={(event) => setSelectedName(event.target.files?.[0]?.name ?? "")}
            />
          </label>
          <button
            type="button"
            onClick={upload}
            disabled={pending}
            className="v14-button min-h-12 justify-center sm:min-w-32"
          >
            {pending ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Upload size={15} />
            )}
            {pending ? "กำลังอัปโหลด" : "อัปโหลดไฟล์"}
          </button>
        </div>

        {message && (
          <p
            role="status"
            className={`mt-3 text-xs ${message.error ? "text-lacquer" : "text-jade"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
