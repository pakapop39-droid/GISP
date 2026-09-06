"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { customRequestTypeLabels, customRequestTypes } from "@/lib/custom-rfq/types";

type Project = { id: string; project_number: string; name: string };
type Area = { id: string; name: string };
type CatalogItem = { id: string; sku: string; nameTh: string };

const numberOrNull = (value: FormDataEntryValue | null) => value ? Number(value) : null;

export function MemberCustomRequestForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [projectId, setProjectId] = useState(search.get("projectId") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/member/projects").then((response) => response.json()),
      fetch("/api/member/catalog?pageSize=100").then((response) => response.json()),
    ]).then(([projectBody, catalogBody]) => {
      setProjects(projectBody.data ?? []);
      setCatalog(catalogBody.data?.items ?? []);
      if (projectBody.data?.[0]?.id) setProjectId((current) => current || projectBody.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    void fetch(`/api/member/projects/${projectId}`).then((response) => response.json()).then((body) => setAreas(body.data?.areas ?? []));
  }, [projectId]);

  const baseProductId = useMemo(() => search.get("baseProductId") ?? "", [search]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      projectId,
      areaId: form.get("areaId") || null,
      baseProductId: form.get("baseProductId") || null,
      requestType: form.get("requestType"),
      itemName: form.get("itemName"),
      description: form.get("description"),
      widthMm: numberOrNull(form.get("widthMm")), depthMm: numberOrNull(form.get("depthMm")), heightMm: numberOrNull(form.get("heightMm")),
      quantity: Number(form.get("quantity")), unit: form.get("unit"),
      requestedMaterial: form.get("requestedMaterial"), requestedColor: form.get("requestedColor"),
      requestedFunction: form.get("requestedFunction"), memberNote: form.get("memberNote"),
    };
    const response = await fetch("/api/member/custom-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) setError(body.message ?? "บันทึกร่างไม่สำเร็จ");
    else router.push(`/member/custom-requests/${body.data.id}`);
    setBusy(false);
  }

  return <div className="member-catalog">
    <Link href="/member/custom-requests" className="member-detail__back"><ArrowLeft size={16}/>กลับรายการ</Link>
    <section className="v14-hero"><div><p className="v14-eyebrow">CUSREQ-001 · New request</p><h1>สร้าง Custom Request</h1><p>กรอกข้อมูลตาม 5 ขั้นตอน แล้วบันทึกร่างเพื่อแนบไฟล์และตรวจสอบก่อนส่ง</p></div></section>
    {error ? <div className="v14-alert"><b>บันทึกไม่สำเร็จ</b><span>{error}</span></div> : null}
    <form onSubmit={save} className="grid gap-4">
      <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">01 · Request type</p><h2>ประเภทคำขอ</h2></div></div><div className="grid gap-3 md:grid-cols-2"><label>ประเภท<select name="requestType" required>{customRequestTypes.map((type) => <option key={type} value={type}>{customRequestTypeLabels[type]}</option>)}</select></label><label>สินค้าเดิม (ถ้ามี)<select name="baseProductId" defaultValue={baseProductId}><option value="">ไม่มีสินค้าเดิม</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.sku} — {item.nameTh}</option>)}</select></label></div></section>
      <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">02 · Specification</p><h2>รายละเอียดและขนาด</h2></div></div><div className="grid gap-3 md:grid-cols-2"><label>ชื่อรายการ<input name="itemName" required minLength={2}/></label><label>จำนวนและหน่วย<span className="grid grid-cols-2 gap-2"><input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required/><select name="unit" defaultValue="EA"><option value="EA">ชิ้น</option><option value="SET">ชุด</option><option value="SQM">ตารางเมตร</option><option value="M">เมตรยาว</option></select></span></label><label className="md:col-span-2">รายละเอียด<textarea name="description" rows={5} required minLength={10} placeholder="อธิบายรูปแบบ การใช้งาน และสิ่งที่ต้องการเปลี่ยน"/></label><label>กว้าง (มม.)<input name="widthMm" type="number" min="0.01" step="0.01"/></label><label>ลึก (มม.)<input name="depthMm" type="number" min="0.01" step="0.01"/></label><label>สูง (มม.)<input name="heightMm" type="number" min="0.01" step="0.01"/></label><label>วัสดุที่ต้องการ<input name="requestedMaterial"/></label><label>สีที่ต้องการ<input name="requestedColor"/></label><label>ฟังก์ชันที่ต้องการ<input name="requestedFunction"/></label></div></section>
      <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">03 · Reference files</p><h2>ไฟล์อ้างอิง</h2></div><small>บันทึกร่างก่อน แล้วระบบจะเปิดให้อัปโหลด PDF รูปภาพ และ CAD</small></div></section>
      <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">04 · Project</p><h2>โครงการและพื้นที่</h2></div></div><div className="grid gap-3 md:grid-cols-2"><label>โครงการ<select value={projectId} onChange={(event) => { const nextProjectId = event.target.value; if (!nextProjectId) setAreas([]); setProjectId(nextProjectId); }} required><option value="">เลือกโครงการ</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.project_number} — {project.name}</option>)}</select></label><label>พื้นที่<select name="areaId"><option value="">ไม่ระบุพื้นที่</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label className="md:col-span-2">หมายเหตุถึง GISP<textarea name="memberNote" rows={3}/></label></div></section>
      <section className="v14-panel"><div className="v14-panel__head"><div><p className="v14-eyebrow">05 · Review</p><h2>บันทึกร่างเพื่อตรวจสอบ</h2></div></div><p>หลังบันทึก ระบบจะพาไปหน้ารายละเอียดเพื่อแนบไฟล์ ตรวจข้อมูล และกดส่งให้ GISP</p><button disabled={busy || !projectId} className="v14-button v14-button--dark"><Save size={16}/>{busy ? "กำลังบันทึก…" : "บันทึกร่างและไปขั้นตอนถัดไป"}</button></section>
    </form>
  </div>;
}
