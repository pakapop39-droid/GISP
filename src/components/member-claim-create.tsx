"use client";

import { ArrowLeft, FileUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { claimIssueLabels, type EligibleDeliveryItem } from "@/lib/claims/types";

export function MemberClaimCreate() {
  const router = useRouter();
  const [items, setItems] = useState<EligibleDeliveryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [defaultDiscoveredAt] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16));
  useEffect(() => { void fetch("/api/member/claims/eligible-items", { cache: "no-store" }).then(async (response) => { const body = await response.json() as { data?: EligibleDeliveryItem[]; message?: string }; if (!response.ok) setError(body.message); else setItems(body.data ?? []); }); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) throw new Error("กรุณาแนบหลักฐานอย่างน้อย 1 ไฟล์");
      const upload = new FormData(); upload.set("file", file);
      const uploadResponse = await fetch("/api/claims/evidence", { method: "POST", body: upload });
      const uploadBody = await uploadResponse.json() as { data?: { id: string }; message?: string };
      if (!uploadResponse.ok || !uploadBody.data?.id) throw new Error(uploadBody.message ?? "อัปโหลดหลักฐานไม่สำเร็จ");
      const response = await fetch("/api/member/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        delivery_item_id: form.get("delivery_item_id"), issue_type: form.get("issue_type"), subject: form.get("subject"), description: form.get("description"),
        claimed_quantity: form.get("claimed_quantity"), severity: form.get("severity"), discovered_at: new Date(String(form.get("discovered_at"))).toISOString(),
        packaging_condition: form.get("packaging_condition"), temporary_action: form.get("temporary_action"), evidence_file_id: uploadBody.data.id,
      }) });
      const body = await response.json() as { data?: string; message?: string };
      if (!response.ok || !body.data) throw new Error(body.message ?? "เปิด Claim ไม่สำเร็จ");
      router.push(`/member/claims/${body.data}`); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "เปิด Claim ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <main className="claim-create"><Link href="/member/claims" className="member-detail__back"><ArrowLeft/>กลับรายการ Claim</Link><section className="quotation-detail__hero"><div><p className="v14-eyebrow">แจ้งปัญหาหลังส่งมอบ</p><h1>เปิด Claim ใหม่</h1><p>เลือกสินค้าที่ส่งมอบแล้ว อธิบายปัญหา และแนบหลักฐานเพื่อให้ทีมตรวจสอบ</p></div><ShieldCheck/></section>{error ? <p className="v14-alert">{error}</p> : null}
    {!items.length ? <section className="v14-panel v14-empty"><b>ยังไม่มีสินค้าที่เปิด Claim ได้</b><span>ต้องเป็นรายการที่ส่งมอบสำเร็จแล้ว</span></section> : <form className="v14-panel claim-form" onSubmit={submit}><div className="claim-form__grid"><label className="claim-form__wide">สินค้าที่ส่งมอบ<select name="delivery_item_id" required>{items.map((item) => <option key={item.delivery_item_id} value={item.delivery_item_id}>{item.order_number} · {item.item_name} · ส่งแล้ว {item.quantity_delivered}</option>)}</select></label><label>ประเภทปัญหา<select name="issue_type" required>{Object.entries(claimIssueLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>ระดับความเร่งด่วน<select name="severity" defaultValue="MEDIUM"><option value="LOW">ต่ำ</option><option value="MEDIUM">ปานกลาง</option><option value="HIGH">สูง</option><option value="CRITICAL">วิกฤต</option></select></label><label>จำนวนที่มีปัญหา<input name="claimed_quantity" type="number" min="0.001" step="0.001" defaultValue="1" required/></label><label>วันที่พบปัญหา<input name="discovered_at" type="datetime-local" defaultValue={defaultDiscoveredAt} required/></label><label className="claim-form__wide">หัวข้อ<input name="subject" minLength={5} maxLength={200} placeholder="เช่น มุมโต๊ะเสียหายหลังแกะบรรจุภัณฑ์" required/></label><label className="claim-form__wide">รายละเอียด<textarea name="description" minLength={10} rows={5} placeholder="อธิบายตำแหน่ง ลักษณะ และผลกระทบของปัญหา" required/></label><label>สภาพบรรจุภัณฑ์<textarea name="packaging_condition" rows={3} placeholder="เช่น กล่องยุบด้านขวา"/></label><label>การแก้ไขชั่วคราว<textarea name="temporary_action" rows={3} placeholder="เช่น แยกสินค้าไว้และยังไม่ใช้งาน"/></label><label className="claim-form__wide claim-upload"><FileUp size={18}/>หลักฐาน PDF/JPG/PNG/MP4 (สูงสุด 25 MB)<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.mp4" required/></label></div><p className="claim-rule-note">ระบบจะแนะนำผู้รับผิดชอบจากประเภทปัญหา แต่ Order Admin ต้องยืนยันเอง และไม่มีการชดเชยอัตโนมัติ</p><button disabled={busy} className="v14-button v14-button--dark">{busy ? "กำลังส่ง Claim…" : "ส่ง Claim ให้ทีมตรวจสอบ"}</button></form>}
  </main>;
}
