"use client";

import { useEffect, useRef, useState } from "react";
import { AdminUsersForm } from "./admin-users-form";
import type { InternalUser } from "@/lib/auth/internal-users";
import { staffJobGroupLabelsForRoles } from "@/lib/auth/staff-job-groups";

const statuses = { ACTIVE: "ใช้งานได้", PENDING: "รอดำเนินการ", SUSPENDED: "ถูกระงับ", INACTIVE: "ไม่ใช้งาน" };

async function fetchUsers(): Promise<InternalUser[]> {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "โหลดรายชื่อไม่สำเร็จ");
  return body.data;
}

export function AdminUsersWorkspace() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<InternalUser | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const requestNumber = useRef(0);

  async function sendReset() {
    if (!selected || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${selected.id}/reset-password`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "ส่งลิงก์ไม่สำเร็จ");
      setNotice({ error: false, text: `${selected.email}: ${body.message}` });
      setSelected(null);
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : "เชื่อมต่อระบบไม่สำเร็จ" });
    } finally {
      setSending(false);
    }
  }

  async function loadUsers() {
    const number = ++requestNumber.current;
    setLoading(true);
    setError("");
    try {
      const data = await fetchUsers();
      if (number === requestNumber.current) setUsers(data);
    } catch (error) {
      if (number === requestNumber.current) setError(error instanceof Error ? error.message : "เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      if (number === requestNumber.current) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const number = ++requestNumber.current;
    void fetchUsers().then((data) => {
      if (!cancelled && number === requestNumber.current) setUsers(data);
    }).catch((error: unknown) => {
      if (!cancelled && number === requestNumber.current) setError(error instanceof Error ? error.message : "เชื่อมต่อระบบไม่สำเร็จ");
    }).finally(() => {
      if (!cancelled && number === requestNumber.current) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
  const search = query.trim().toLocaleLowerCase();
  const visible = users.filter((user) => `${user.full_name} ${user.email}`.toLocaleLowerCase().includes(search));

  return <>
    <AdminUsersForm onCreated={() => void loadUsers()} />
    <section className="v14-panel mt-6" aria-labelledby="staff-list-title">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Internal accounts</p><h2 id="staff-list-title">รายชื่อพนักงาน</h2></div><button type="button" className="v14-button" disabled={loading} onClick={() => void loadUsers()}>โหลดใหม่</button></div>
      <p className="mb-4 text-sm text-ink/60">รหัสผ่านเดิมไม่สามารถดูย้อนหลังได้ หากลืมรหัส ให้ส่งลิงก์ทางอีเมลเพื่อให้พนักงานตั้งรหัสใหม่เอง</p>
      {notice && <p role={notice.error ? "alert" : "status"} className={`my-4 rounded-xl p-4 ${notice.error ? "bg-lacquer/10 text-lacquer" : "bg-jade/10 text-jade"}`}>{notice.text}</p>}
      {selected && <div className="my-4 rounded-xl border border-ink/10 p-4">
        <p>ส่งลิงก์ตั้งรหัสใหม่ให้ <b>{selected.full_name}</b> ที่ <b>{selected.email}</b></p>
        <p className="my-2 text-sm text-ink/60">รหัสเดิมยังใช้ได้จนกว่าพนักงานจะเปิดลิงก์และบันทึกรหัสใหม่</p>
        <div className="flex gap-3"><button type="button" className="v14-button" disabled={sending} onClick={() => void sendReset()}>{sending ? "กำลังส่ง…" : "ยืนยันส่งลิงก์"}</button><button type="button" className="v14-button v14-button--outline" disabled={sending} onClick={() => setSelected(null)}>ยกเลิก</button></div>
      </div>}
      <label>ค้นหาชื่อหรืออีเมล<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="พิมพ์ชื่อหรืออีเมลพนักงาน" /></label>
      {error ? <p role="alert" className="my-4 text-lacquer">{error} กรุณากดโหลดใหม่</p> : loading ? <p role="status" className="my-4">กำลังโหลดรายชื่อ…</p> : <>
        <p className="my-3 text-sm">พบ {visible.length} จาก {users.length} บัญชี</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>{["ชื่อ", "อีเมล", "กลุ่มงาน", "สถานะ", "จัดการรหัสผ่าน"].map((title) => <th scope="col" key={title} className="border-b border-ink/10 p-3">{title}</th>)}</tr></thead>
          <tbody>{visible.map((user) => <tr key={user.id}>
            <td className="border-b border-ink/10 p-3">{user.full_name}</td><td className="border-b border-ink/10 p-3">{user.email || "ไม่พบอีเมล"}</td>
            <td className="border-b border-ink/10 p-3">{staffJobGroupLabelsForRoles(user.roles).join(", ")}</td><td className="border-b border-ink/10 p-3">{statuses[user.status]}</td>
            <td className="border-b border-ink/10 p-3"><button type="button" className="v14-button whitespace-nowrap" disabled={sending || !user.email} onClick={() => { setSelected(user); setNotice(null); }}>ส่งลิงก์ตั้งรหัสใหม่</button></td>
          </tr>)}</tbody>
        </table></div>
        {!visible.length && <p className="my-5 text-center text-ink/60">{users.length ? "ไม่พบชื่อหรืออีเมลที่ค้นหา" : "ยังไม่มีบัญชีพนักงาน"}</p>}
      </>}
    </section>
  </>;
}
