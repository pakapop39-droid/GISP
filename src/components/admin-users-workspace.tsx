"use client";

import { useEffect, useRef, useState } from "react";
import { AdminUsersForm } from "./admin-users-form";
import type { InternalUser } from "@/lib/auth/internal-users";
import {
  staffJobGroupDefinitions,
  staffJobGroupLabelsForRoles,
  staffJobGroups,
  staffJobGroupsForRoles,
  type StaffJobGroup,
} from "@/lib/auth/staff-job-groups";

const statuses = { ACTIVE: "ใช้งานได้", PENDING: "รอดำเนินการ", SUSPENDED: "ถูกระงับ", INACTIVE: "ปิดบัญชีแล้ว" };
type DialogKind = "reset" | "groups" | "suspend" | "reactivate" | "deactivate";
type DialogState = { kind: DialogKind; user: InternalUser };

async function fetchUsers(): Promise<{ users: InternalUser[]; currentUserId: string }> {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "โหลดรายชื่อไม่สำเร็จ");
  return { users: body.data, currentUserId: body.currentUserId };
}

function managementBlockReason(user: InternalUser, currentUserId: string) {
  if (user.id === currentUserId) return "บัญชีที่กำลังใช้งานอยู่";
  if (user.roles.includes("SUPER_ADMIN")) return "บัญชีเจ้าของระบบได้รับการป้องกัน";
  if (user.status === "INACTIVE") return "บัญชีนี้ถูกปิดถาวรแล้ว";
  if (staffJobGroupsForRoles(user.roles) === null) return "สิทธิ์เฉพาะหรือชุดสิทธิ์ไม่สมบูรณ์ ต้องให้ทีมเทคนิคตรวจสอบ";
  return null;
}

export function AdminUsersWorkspace() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [draftGroups, setDraftGroups] = useState<StaffJobGroup[]>([]);
  const [reason, setReason] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const requestNumber = useRef(0);

  async function loadUsers() {
    const number = ++requestNumber.current;
    setLoading(true);
    setError("");
    try {
      const data = await fetchUsers();
      if (number === requestNumber.current) {
        setUsers(data.users);
        setCurrentUserId(data.currentUserId);
      }
    } catch (loadError) {
      if (number === requestNumber.current) setError(loadError instanceof Error ? loadError.message : "เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      if (number === requestNumber.current) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const number = ++requestNumber.current;
    void fetchUsers().then((data) => {
      if (!cancelled && number === requestNumber.current) {
        setUsers(data.users);
        setCurrentUserId(data.currentUserId);
      }
    }).catch((loadError: unknown) => {
      if (!cancelled && number === requestNumber.current) setError(loadError instanceof Error ? loadError.message : "เชื่อมต่อระบบไม่สำเร็จ");
    }).finally(() => {
      if (!cancelled && number === requestNumber.current) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  function openDialog(kind: DialogKind, user: InternalUser) {
    setDialog({ kind, user });
    setDraftGroups(staffJobGroupsForRoles(user.roles) ?? []);
    setReason("");
    setConfirmationEmail("");
    setNotice(null);
  }

  async function submitDialog() {
    if (!dialog || pending) return;
    setPending(true);
    setNotice(null);
    try {
      let url = `/api/admin/users/${dialog.user.id}/lifecycle`;
      let body: Record<string, unknown> | undefined;
      if (dialog.kind === "reset") {
        url = `/api/admin/users/${dialog.user.id}/reset-password`;
      } else if (dialog.kind === "groups") {
        url = `/api/admin/users/${dialog.user.id}/roles`;
        body = { jobGroups: draftGroups };
      } else {
        body = { action: dialog.kind, confirmed: true };
        if (dialog.kind === "suspend" || dialog.kind === "deactivate") body.reason = reason;
        if (dialog.kind === "deactivate") body.confirmationEmail = confirmationEmail;
      }
      const response = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message || "ทำรายการไม่สำเร็จ");
      setNotice({ error: false, text: `${dialog.user.email}: ${result.message ?? "ทำรายการแล้ว"}` });
      setDialog(null);
      await loadUsers();
    } catch (actionError) {
      setNotice({ error: true, text: actionError instanceof Error ? actionError.message : "เชื่อมต่อระบบไม่สำเร็จ" });
    } finally {
      setPending(false);
    }
  }

  const search = query.trim().toLocaleLowerCase();
  const visible = users.filter((user) => `${user.full_name} ${user.email}`.toLocaleLowerCase().includes(search));
  const deactivateReady = dialog?.kind !== "deactivate"
    || (reason.trim().length >= 3 && confirmationEmail.trim().toLocaleLowerCase() === dialog.user.email.trim().toLocaleLowerCase());
  const submitDisabled = pending
    || (dialog?.kind === "groups" && draftGroups.length === 0)
    || (dialog?.kind === "suspend" && reason.trim().length < 3)
    || !deactivateReady;

  return <>
    <AdminUsersForm onCreated={() => void loadUsers()} />
    <section className="v14-panel mt-6" aria-labelledby="staff-list-title">
      <div className="v14-panel__head"><div><p className="v14-eyebrow">Internal accounts</p><h2 id="staff-list-title">รายชื่อพนักงาน</h2></div><button type="button" className="v14-button" disabled={loading} onClick={() => void loadUsers()}>โหลดใหม่</button></div>
      <p className="mb-4 text-sm text-ink/60">แก้กลุ่มงาน ระงับ หรือปิดบัญชีได้จากคอลัมน์จัดการ ระบบไม่อนุญาตให้จัดการบัญชีตนเองและบัญชีเจ้าของระบบ</p>
      {notice && <p role={notice.error ? "alert" : "status"} className={`my-4 rounded-xl p-4 ${notice.error ? "bg-lacquer/10 text-lacquer" : "bg-jade/10 text-jade"}`}>{notice.text}</p>}
      {dialog && <div role="dialog" aria-modal="true" aria-labelledby="staff-dialog-title" className="my-4 rounded-xl border border-ink/15 bg-white p-5 shadow-sm">
        <h3 id="staff-dialog-title" className="text-lg font-bold">{dialog.kind === "groups" ? "แก้ไขกลุ่มงาน" : dialog.kind === "suspend" ? "ระงับบัญชี" : dialog.kind === "reactivate" ? "เปิดใช้งานบัญชี" : dialog.kind === "deactivate" ? "ปิดบัญชีถาวร" : "ส่งลิงก์ตั้งรหัสใหม่"}</h3>
        <p className="mt-1 text-sm"><b>{dialog.user.full_name}</b> · {dialog.user.email}</p>
        {dialog.kind === "groups" && <fieldset className="mt-4"><legend className="text-sm font-bold">เลือกอย่างน้อย 1 กลุ่ม</legend><div className="mt-2 grid gap-2 lg:grid-cols-3">{staffJobGroups.map((group) => <label key={group} className="flex items-start gap-2 rounded-lg border border-ink/10 p-3"><input className="!mt-1 !w-auto" type="checkbox" checked={draftGroups.includes(group)} onChange={(event) => setDraftGroups((current) => event.target.checked ? [...current, group] : current.filter((item) => item !== group))}/><span><b className="block text-sm">{staffJobGroupDefinitions[group].label}</b><small>{staffJobGroupDefinitions[group].description}</small></span></label>)}</div></fieldset>}
        {(dialog.kind === "suspend" || dialog.kind === "deactivate") && <label className="mt-4 block">เหตุผล<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required placeholder="ระบุเหตุผลอย่างน้อย 3 ตัวอักษร"/></label>}
        {dialog.kind === "deactivate" && <div className="mt-4 rounded-xl border border-lacquer/20 bg-lacquer/5 p-4"><p className="font-bold text-lacquer">คำสั่งนี้เปิดกลับไม่ได้จากหน้านี้</p><p className="mt-1 text-sm">ระบบจะตั้งเป็น INACTIVE ถอนสิทธิ์ทั้งหมด และยกเลิก Session แต่ยังเก็บบัญชีและประวัติงานไว้</p><label className="mt-3 block">พิมพ์อีเมลพนักงานเพื่อยืนยัน<input type="email" value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} autoComplete="off" placeholder={dialog.user.email}/></label></div>}
        {dialog.kind === "suspend" && <p className="mt-3 text-sm text-ink/60">พนักงานจะถูกออกจากระบบทันที และสามารถเปิดใช้งานกลับได้ภายหลัง</p>}
        {dialog.kind === "reactivate" && <p className="mt-3 text-sm text-ink/60">ยืนยันเปิดให้พนักงานกลับมาเข้าสู่ระบบตามกลุ่มงานเดิม</p>}
        {dialog.kind === "reset" && <p className="mt-3 text-sm text-ink/60">รหัสเดิมยังใช้ได้จนกว่าพนักงานจะเปิดลิงก์และตั้งรหัสใหม่</p>}
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="v14-button" disabled={submitDisabled} onClick={() => void submitDialog()}>{pending ? "กำลังดำเนินการ…" : "ยืนยัน"}</button><button type="button" className="v14-button v14-button--outline" disabled={pending} onClick={() => setDialog(null)}>ยกเลิก</button></div>
      </div>}
      <label>ค้นหาชื่อหรืออีเมล<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="พิมพ์ชื่อหรืออีเมลพนักงาน" /></label>
      {error ? <p role="alert" className="my-4 text-lacquer">{error} กรุณากดโหลดใหม่</p> : loading ? <p role="status" className="my-4">กำลังโหลดรายชื่อ…</p> : <>
        <p className="my-3 text-sm">พบ {visible.length} จาก {users.length} บัญชี</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>{["ชื่อ", "อีเมล", "กลุ่มงาน", "สถานะ", "จัดการ"].map((title) => <th scope="col" key={title} className="border-b border-ink/10 p-3">{title}</th>)}</tr></thead>
          <tbody>{visible.map((user) => {
            const blockReason = managementBlockReason(user, currentUserId);
            const managedGroups = staffJobGroupsForRoles(user.roles);
            const commonDisabled = pending || Boolean(blockReason) || !user.email;
            return <tr key={user.id}>
              <td className="border-b border-ink/10 p-3">{user.full_name}</td><td className="border-b border-ink/10 p-3">{user.email || "ไม่พบอีเมล"}</td>
              <td className="border-b border-ink/10 p-3">{staffJobGroupLabelsForRoles(user.roles).join(", ")}</td><td className="border-b border-ink/10 p-3">{statuses[user.status]}</td>
              <td className="border-b border-ink/10 p-3"><div className="flex min-w-[430px] flex-wrap gap-2">
                <button type="button" className="v14-button v14-button--small" disabled={commonDisabled || managedGroups === null} onClick={() => openDialog("groups", user)}>แก้กลุ่มงาน</button>
                {user.status === "ACTIVE" && <button type="button" className="v14-button v14-button--small v14-button--outline" disabled={commonDisabled} onClick={() => openDialog("suspend", user)}>ระงับ</button>}
                {user.status === "SUSPENDED" && <button type="button" className="v14-button v14-button--small v14-button--outline" disabled={commonDisabled} onClick={() => openDialog("reactivate", user)}>เปิดใช้งาน</button>}
                {(user.status === "ACTIVE" || user.status === "SUSPENDED") && <button type="button" className="v14-button v14-button--small v14-button--outline" disabled={commonDisabled} onClick={() => openDialog("deactivate", user)}>ปิดบัญชี</button>}
                <button type="button" className="v14-button v14-button--small v14-button--outline" disabled={commonDisabled} onClick={() => openDialog("reset", user)}>ส่งลิงก์ตั้งรหัส</button>
              </div>{blockReason && <small className="mt-2 block text-ink/50">{blockReason}</small>}</td>
            </tr>;
          })}</tbody>
        </table></div>
        {!visible.length && <p className="my-5 text-center text-ink/60">{users.length ? "ไม่พบชื่อหรืออีเมลที่ค้นหา" : "ยังไม่มีบัญชีพนักงาน"}</p>}
      </>}
    </section>
  </>;
}
