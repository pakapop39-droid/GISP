"use client";

import { useRef, useState } from "react";
import {
  staffJobGroupDefinitions,
  staffJobGroups,
} from "@/lib/auth/staff-job-groups";

export function AdminUsersForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ error?: boolean; text: string }>();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    setMessage(undefined);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          temporaryPassword: form.get("password"),
          jobGroups: form.getAll("jobGroups"),
        }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      setMessage({
        error: !response.ok,
        text: body.message ?? (response.ok ? "สร้างผู้ใช้แล้ว" : "สร้างผู้ใช้ไม่สำเร็จ"),
      });
      if (response.ok) formRef.current?.reset();
    } catch {
      setMessage({
        error: true,
        text: "เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง",
      });
    } finally {
      setPending(false);
    }
  }

  return <form ref={formRef} action={submit} className="v14-panel">
    <div className="v14-panel__head"><div><p className="v14-eyebrow">Internal account</p><h2>สร้างผู้ใช้ภายใน</h2></div></div>
    <div className="v14-grid v14-grid--2">
      <label>ชื่อ<input name="name" required/></label>
      <label>อีเมล<input name="email" type="email" required/></label>
      <label>รหัสผ่านเริ่มต้น<input name="password" type="password" minLength={10} required/><small className="mt-1 block text-ink/50">อย่างน้อย 10 ตัวอักษร ส่งให้พนักงานทางช่องทางส่วนตัว และให้เปลี่ยนหลังล็อกอินครั้งแรก</small></label>
    </div>
    <fieldset>
      <legend className="text-xs font-bold">เลือกกลุ่มงานที่รับผิดชอบอย่างน้อย 1 กลุ่ม</legend>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {staffJobGroups.map((group, index) => {
          const definition = staffJobGroupDefinitions[group];
          return <label key={group} className="!mb-0 flex items-start gap-3 rounded-xl border border-ink/10 bg-white p-4">
            <input name="jobGroups" value={group} type="checkbox" defaultChecked={index === 0} className="!mt-1 !w-auto"/>
            <span><b className="block text-sm">{definition.label}</b><small className="mt-1 block text-ink/55">{definition.description}</small></span>
          </label>;
        })}
      </div>
    </fieldset>
    <p className="mt-4 text-xs text-ink/55">สิทธิ์เจ้าของระบบไม่แสดงในหน้านี้ และพนักงานไม่สามารถเพิ่มสิทธิ์ให้ตัวเองได้</p>
    {message && <div role={message.error ? "alert" : "status"} aria-live="polite" className={`mt-4 rounded-xl border px-4 py-3 text-sm font-bold ${message.error ? "border-lacquer/20 bg-lacquer/10 text-lacquer" : "border-jade/20 bg-jade/10 text-jade"}`}><b className="mr-2">{message.error ? "สร้างไม่สำเร็จ:" : "สำเร็จ:"}</b>{message.text}</div>}
    <button disabled={pending} className="v14-button mt-5">{pending ? "กำลังสร้าง" : "สร้างผู้ใช้"}</button>
  </form>;
}
