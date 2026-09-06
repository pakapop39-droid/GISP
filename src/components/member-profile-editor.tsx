"use client";

import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BUSINESS_TYPE_OPTIONS, businessTypeDraftFromStored, businessTypeStoredValue, type BusinessTypeCode, type BusinessTypeSelection } from "@/lib/member/business-types";

export type MemberProfile = {
  id: string;
  contact_name: string;
  contact_phone: string | null;
  company_name: string;
  company_legal_name: string | null;
  tax_id: string | null;
  business_type: string | null;
  address_line: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
  service_areas: string[] | null;
  product_interests: string[] | null;
  training_interest: boolean;
  training_note: string | null;
};

type DraftProfile = Omit<MemberProfile, "id" | "service_areas" | "product_interests" | "business_type"> & {
  service_areas: string;
  product_interests: string;
  business_type: BusinessTypeSelection;
  business_type_other: string;
};

function toDraft(profile: MemberProfile): DraftProfile {
  const businessType = businessTypeDraftFromStored(profile.business_type);
  return {
    contact_name: profile.contact_name,
    contact_phone: profile.contact_phone ?? "",
    company_name: profile.company_name,
    company_legal_name: profile.company_legal_name ?? "",
    tax_id: profile.tax_id ?? "",
    business_type: businessType.code,
    business_type_other: businessType.other,
    address_line: profile.address_line ?? "",
    district: profile.district ?? "",
    province: profile.province ?? "",
    postal_code: profile.postal_code ?? "",
    service_areas: (profile.service_areas ?? []).join(", "),
    product_interests: (profile.product_interests ?? []).join(", "),
    training_interest: profile.training_interest,
    training_note: profile.training_note ?? "",
  };
}

const toList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function MemberProfileEditor({ initialProfile }: { initialProfile: MemberProfile }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [draft, setDraft] = useState(() => toDraft(initialProfile));
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  function update<K extends keyof DraftProfile>(key: K, value: DraftProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function cancel() {
    setDraft(toDraft(profile));
    setEditing(false);
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    setMessage(undefined);

    const payload = {
      ...draft,
      service_areas: toList(draft.service_areas),
      product_interests: toList(draft.product_interests),
    };

    try {
      const response = await fetch("/api/member/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "บันทึกข้อมูลไม่สำเร็จ");

      const { business_type_other, ...profilePayload } = payload;
      const nextProfile = {
        ...profile,
        ...profilePayload,
        business_type: businessTypeStoredValue(payload.business_type as BusinessTypeCode, business_type_other),
      };
      setProfile(nextProfile);
      setDraft(toDraft(nextProfile));
      setEditing(false);
      setMessage(body.message ?? "บันทึกข้อมูลแล้ว");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <form className="v14-panel" onSubmit={submit}>
        <div className="v14-panel__head">
          <div>
            <p className="v14-eyebrow">Edit member profile</p>
            <h2>แก้ไขข้อมูลบริษัท</h2>
          </div>
          <button type="button" className="v14-button v14-button--outline" onClick={cancel} disabled={pending}>
            <X size={15} /> ยกเลิก
          </button>
        </div>

        <p className="mb-5">การแก้ข้อมูลของบัญชีที่อนุมัติแล้วจะบันทึกทันที โดยไม่ส่งคำขออนุมัติใหม่</p>

        <div className="v14-grid v14-grid--2">
          <Field label="ชื่อผู้ติดต่อ" required value={draft.contact_name} onChange={(value) => update("contact_name", value)} />
          <Field label="เบอร์โทรศัพท์" value={draft.contact_phone ?? ""} onChange={(value) => update("contact_phone", value)} />
          <Field label="ชื่อบริษัท / สตูดิโอ" required value={draft.company_name} onChange={(value) => update("company_name", value)} />
          <Field label="ชื่อนิติบุคคล" value={draft.company_legal_name ?? ""} onChange={(value) => update("company_legal_name", value)} />
          <Field label="เลขประจำตัวผู้เสียภาษี" value={draft.tax_id ?? ""} onChange={(value) => update("tax_id", value)} />
          <label>
            ประเภทธุรกิจ
            <select required value={draft.business_type} onChange={(event) => update("business_type", event.target.value as BusinessTypeSelection)}>
              <option value="" disabled>เลือกประเภทธุรกิจ</option>
              {BUSINESS_TYPE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </label>
          {draft.business_type === "OTHER" && <Field label="ระบุประเภทธุรกิจอื่น ๆ" required value={draft.business_type_other} onChange={(value) => update("business_type_other", value)} />}
        </div>

        <div className="mt-5 border-t border-ink/10 pt-5">
          <TextArea label="ที่อยู่" value={draft.address_line ?? ""} onChange={(value) => update("address_line", value)} />
          <div className="v14-grid v14-grid--2">
            <Field label="เขต / อำเภอ" value={draft.district ?? ""} onChange={(value) => update("district", value)} />
            <Field label="จังหวัด" value={draft.province ?? ""} onChange={(value) => update("province", value)} />
            <Field label="รหัสไปรษณีย์" value={draft.postal_code ?? ""} onChange={(value) => update("postal_code", value)} />
            <Field label="พื้นที่ให้บริการ (คั่นด้วยจุลภาค)" value={draft.service_areas} onChange={(value) => update("service_areas", value)} />
          </div>
          <Field label="สินค้าที่สนใจ (คั่นด้วยจุลภาค)" value={draft.product_interests} onChange={(value) => update("product_interests", value)} />
          <label className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white/70 p-4">
            <input
              className="!w-auto"
              type="checkbox"
              checked={draft.training_interest}
              onChange={(event) => update("training_interest", event.target.checked)}
            />
            สนใจหลักสูตร / การอบรมจาก GISP
          </label>
          <TextArea label="หัวข้อหลักสูตรที่สนใจ" value={draft.training_note ?? ""} onChange={(value) => update("training_note", value)} />
        </div>

        {error && <p role="alert" className="v14-alert">{error}</p>}
        <div className="v14-actions justify-end">
          <button type="button" className="v14-button v14-button--outline" onClick={cancel} disabled={pending}>ยกเลิก</button>
          <button type="submit" className="v14-button v14-button--dark" disabled={pending}>
            {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
            {pending ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
          </button>
        </div>
      </form>
    );
  }

  const address = [profile.address_line, profile.district, profile.province, profile.postal_code].filter(Boolean).join(" ");
  const fields = [
    ["ชื่อผู้ติดต่อ", profile.contact_name],
    ["เบอร์โทรศัพท์", profile.contact_phone],
    ["ชื่อบริษัท", profile.company_name],
    ["ชื่อนิติบุคคล", profile.company_legal_name],
    ["เลขภาษี", profile.tax_id],
    ["ประเภทธุรกิจ", profile.business_type],
    ["ที่อยู่", address],
    ["พื้นที่บริการ", profile.service_areas?.join(", ")],
    ["สินค้าที่สนใจ", profile.product_interests?.join(", ")],
    ["ความสนใจอบรม", profile.training_interest ? profile.training_note || "สนใจรับข้อมูลหลักสูตร" : "ไม่ระบุ"],
  ];

  return (
    <section className="v14-panel">
      <div className="v14-panel__head">
        <div>
          <p className="v14-eyebrow">Member profile</p>
          <h2>ข้อมูลที่บันทึกไว้</h2>
        </div>
        <button type="button" className="v14-button v14-button--dark" onClick={() => { setEditing(true); setMessage(undefined); }}>
          <Pencil size={15} /> แก้ไขข้อมูล
        </button>
      </div>
      {message && <p role="status" className="mb-4 rounded-xl border border-jade/20 bg-jade/10 px-4 py-3 text-xs font-bold text-jade">{message}</p>}
      <div className="v14-list">
        {fields.map(([label, value]) => (
          <div key={String(label)}>
            <strong>{label}</strong>
            <span>{value || "—"}</span>
            <span />
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label>
      {label}
      <input {...props} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
