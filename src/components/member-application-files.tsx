"use client";

import { ExternalLink, FileCheck2, FileText, LoaderCircle, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";

export type ApplicationFile = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  visibility: "MEMBER_PRIVATE" | "CONFIDENTIAL" | "PUBLIC";
  created_at: string;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function MemberApplicationFiles({ initialFiles, pendingSummary = false }: { initialFiles: ApplicationFile[]; pendingSummary?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ApplicationFile[]>(initialFiles);
  const [selectedName, setSelectedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function loadFiles() {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/files", { cache: "no-store" });
      const body = (await response.json()) as { data?: ApplicationFile[]; message?: string };
      if (!response.ok) throw new Error(body.message ?? "โหลดรายการเอกสารไม่สำเร็จ");
      setFiles(body.data ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "โหลดรายการเอกสารไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) {
      setError("กรุณาเลือกไฟล์ก่อนกดอัปโหลด");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setError("รองรับ PDF, JPEG และ PNG ขนาดไม่เกิน 10 MB ต่อไฟล์");
      return;
    }

    setUploading(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/files", { method: "POST", body: form });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "อัปโหลดเอกสารไม่สำเร็จ");
      setMessage(`${body.message ?? "อัปโหลดเอกสารแล้ว"} — สามารถกด “เปิดไฟล์” เพื่อตรวจสอบได้`);
      if (input.current) input.current.value = "";
      setSelectedName("");
      await loadFiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "อัปโหลดเอกสารไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="v14-panel">
      <div className="v14-panel__head">
        <div>
          <p className="v14-eyebrow">Application documents</p>
          <h2>เอกสารสมัคร</h2>
        </div>
        <span className="inline-flex items-center gap-2 text-[10px] font-bold text-jade">
          <ShieldCheck size={15} /> ไฟล์ส่วนตัว
        </span>
      </div>

      {pendingSummary && <p role="status" className="mb-4 text-sm leading-7">{files.length ? `อัปโหลดแล้ว ${files.length} ไฟล์ — รอทีมตรวจสอบ` : "ยังไม่มีเอกสาร กรุณาแนบหนังสือรับรองบริษัท หรือทะเบียนพาณิชย์ฉบับปัจจุบันอย่างน้อย 1 รายการ"}</p>}
      <p className="mb-4">รองรับ PDF, JPEG และ PNG ไม่เกิน 10 MB ต่อไฟล์ สูงสุด 5 ไฟล์</p>

      <div className="flex flex-col gap-3 border-y border-ink/10 py-4 sm:flex-row sm:items-center">
        <label className="!mb-0 flex min-h-11 flex-1 cursor-pointer !items-center !gap-3 !border !border-ink/15 !bg-white/80 !px-4 !py-0 hover:!border-ink/40">
          <Upload size={15} className="shrink-0" />
          <span className={selectedName ? "truncate text-ink" : "text-ink/45"}>
            {selectedName || "เลือกเอกสารจากเครื่อง"}
          </span>
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="sr-only !w-px !min-w-0 !max-w-px"
            aria-label="เลือกเอกสารสมัคร"
            onChange={(event) => setSelectedName(event.target.files?.[0]?.name ?? "")}
          />
        </label>
        <button type="button" className="v14-button v14-button--dark min-h-11" onClick={upload} disabled={uploading || files.length >= 5}>
          {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? "กำลังอัปโหลด…" : files.length >= 5 ? "ครบ 5 ไฟล์แล้ว" : "อัปโหลดไฟล์"}
        </button>
      </div>

      {error && <div role="alert" className="v14-alert mt-4"><p>{error}</p><button type="button" disabled={loading || uploading} onClick={loadFiles} className="v14-button v14-button--outline mt-3">โหลดรายการเอกสารใหม่</button></div>}
      {message && <p role="status" className="mt-4 rounded-xl border border-jade/20 bg-jade/10 px-4 py-3 text-xs font-bold !text-jade">{message}</p>}

      <div className="mt-4 grid gap-2">
        {loading ? (
          <div className="v14-empty min-h-20"><LoaderCircle size={18} className="animate-spin" /> กำลังโหลดรายการเอกสาร</div>
        ) : files.length ? files.map((file) => (
          <div key={file.id} className="grid items-center gap-3 rounded-xl border border-ink/10 bg-white/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="flex min-w-0 items-center gap-3">
              {file.mime_type === "application/pdf" ? <FileText size={18} className="shrink-0 text-lacquer" /> : <FileCheck2 size={18} className="shrink-0 text-jade" />}
              <div className="min-w-0">
                <strong className="block truncate text-xs">{file.original_name}</strong>
                <span className="text-[10px] text-ink/50">{formatDate(file.created_at)}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-ink/50">{formatSize(file.size_bytes)}</span>
            <a className="v14-button v14-button--outline v14-button--small" href={`/api/files/${file.id}/download?redirect=1`} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> เปิดไฟล์
            </a>
          </div>
        )) : (
          <div className="v14-empty min-h-20">ยังไม่มีเอกสารสมัครในบัญชีนี้</div>
        )}
      </div>
    </section>
  );
}
