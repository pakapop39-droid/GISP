import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main className="global-route-loading" role="status" aria-live="polite">
      <span className="global-route-loading__spinner" aria-hidden="true">
        <LoaderCircle size={28} />
      </span>
      <strong>กำลังโหลดข้อมูล…</strong>
      <span>โปรดรอสักครู่</span>
    </main>
  );
}
