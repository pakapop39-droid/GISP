import { MemberProfileEditor, type MemberProfile } from "@/components/member-profile-editor";
import { MemberApplicationFiles, type ApplicationFile } from "@/components/member-application-files";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const profileColumns = [
  "id",
  "contact_name",
  "contact_phone",
  "company_name",
  "company_legal_name",
  "tax_id",
  "business_type",
  "address_line",
  "district",
  "province",
  "postal_code",
  "service_areas",
  "product_interests",
  "training_interest",
  "training_note",
].join(",");

export default async function MemberProfilePage() {
  const context = await requireAppAccess({ active: true });
  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database
    .from("member_profiles")
    .select(profileColumns)
    .eq("id", context.memberProfileId!)
    .single();

  if (error || !data) throw error ?? new Error("MEMBER_PROFILE_NOT_FOUND");

  const filesResult = await insforge.database
    .from("file_metadata")
    .select("id,original_name,mime_type,size_bytes,visibility,created_at")
    .eq("member_profile_id", context.memberProfileId!)
    .eq("entity_type", "MEMBER_APPLICATION")
    .order("created_at", { ascending: false });

  if (filesResult.error) throw filesResult.error;

  return (
    <>
      <section className="v14-hero">
        <div>
          <p className="v14-eyebrow">Company profile</p>
          <h1>ข้อมูลบริษัท</h1>
          <p>ตรวจสอบและแก้ไขข้อมูลที่เชื่อมกับสิทธิ์และ Ownership ของบัญชีนี้</p>
        </div>
      </section>
      <MemberProfileEditor initialProfile={data as unknown as MemberProfile} />
      <MemberApplicationFiles initialFiles={(filesResult.data ?? []) as unknown as ApplicationFile[]} />
    </>
  );
}
