import { Suspense } from "react";
import { Check, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandMark } from "@/components/brand-mark";

export default function LoginPage() {
  return (
    <main className="auth-page ui-auth ui-auth--login">
      <section className="auth-story">
        <div>
          <BrandMark inverse />
        </div>
        <div className="auth-story__content">
          <p className="auth-kicker">Controlled supply workflow</p>
          <h2>ทุกขั้นตอน<br />อยู่ในที่เดียว</h2>
          <p>
            จัดการโครงการ ราคา การอนุมัติ QC และการส่งมอบ
            ด้วยข้อมูลที่ตรวจสอบย้อนหลังได้
          </p>
          <ul className="auth-assurance" aria-label="มาตรฐานความปลอดภัย">
            <li><Check size={15} /> สิทธิ์แยกตามบทบาท</li>
            <li><Check size={15} /> ราคาและสถานะบันทึกเป็น Snapshot</li>
            <li><Check size={15} /> ทุก Action มี Audit Trail</li>
          </ul>
        </div>
        <div className="auth-story__foot"><LockKeyhole size={14} /> Secure company workspace</div>
      </section>

      <section className="auth-access">
        <div className="auth-access__top">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-ink/60 transition hover:text-ink"
          >
            กลับหน้าหลัก
          </Link>
        </div>
        <div className="auth-access__body">
          <Suspense fallback={<div className="h-96 w-full max-w-md" />}>
            <AuthForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
