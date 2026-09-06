import {
  ArrowUpRight,
  CircleDot,
  Clock3,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { notFound } from "next/navigation";
import { QuickActionForm } from "@/components/quick-action-form";
import { StatusPill } from "@/components/status-pill";
import { moduleActions } from "@/config/module-actions";
import { findModule } from "@/config/modules";

const queue = [
  {
    ref: "DEMO-260731-0012",
    title: "Riverside House",
    owner: "บริษัท ดีไซน์ พาร์ทเนอร์",
    status: "ACTION_REQUIRED",
    due: "วันนี้ 16:00",
    tone: "danger" as const,
  },
  {
    ref: "DEMO-260730-0088",
    title: "Ari Townhome",
    owner: "Studio North",
    status: "IN_PROGRESS",
    due: "1 ส.ค. 2569",
    tone: "warning" as const,
  },
  {
    ref: "DEMO-260728-0031",
    title: "Lakeside Villa",
    owner: "Form & Function",
    status: "COMPLETED",
    due: "เสร็จแล้ว",
    tone: "success" as const,
  },
];

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: slug } = await params;
  const moduleDefinition = findModule(slug);
  if (!moduleDefinition) notFound();

  const Icon = moduleDefinition.icon;
  const action = moduleActions[moduleDefinition.slug];

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-col gap-6 border-b border-ink/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-[20px] bg-ink text-porcelain shadow-xl shadow-black/10">
            <Icon size={23} strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lacquer">
              Workflow slice {moduleDefinition.order}
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {moduleDefinition.label}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
              {moduleDefinition.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {moduleDefinition.actions.map((actionLabel) => (
            <span
              key={actionLabel}
              className="rounded-full border border-ink/10 bg-white px-3.5 py-2 text-xs font-semibold text-ink/70"
            >
              {actionLabel}
            </span>
          ))}
        </div>
      </div>

      <div className={`mt-8 grid gap-7 ${action ? "xl:grid-cols-[1fr_360px]" : ""}`}>
        <section>
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-950">
            ข้อมูลสรุปและรายการด้านล่างเป็นข้อมูลตัวอย่างสำหรับตรวจ UX — แบบฟอร์มด้านขวาเชื่อมกับ Action Endpoint จริง
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["ต้องดำเนินการ", "12", "danger"],
              ["กำลังทำ", "28", "warning"],
              ["เสร็จเดือนนี้", "64", "success"],
            ].map(([label, value, tone]) => (
              <div
                key={label}
                className="rounded-[22px] border border-ink/8 bg-white p-5 shadow-paper"
              >
                <p className="text-xs font-semibold text-ink/65">{label}</p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="font-display text-3xl font-semibold">{value}</p>
                  <StatusPill tone={tone as "danger" | "warning" | "success"}>
                    {tone}
                  </StatusPill>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-[26px] border border-ink/8 bg-white shadow-paper">
            <div className="flex flex-col gap-3 border-b border-ink/8 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">รายการล่าสุด</h2>
                <p className="mt-1 text-xs text-ink/65">
                  Assignment และ Due Date ที่ผูกกับธุรกรรม
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-ink/10 px-3.5 py-2 text-xs font-bold"
              >
                <Filter size={14} />
                ตัวกรอง
              </button>
            </div>
            <div className="divide-y divide-ink/7">
              {queue.map((item) => (
                <article
                  key={item.ref}
                  className="group grid gap-4 px-5 py-5 transition hover:bg-porcelain/55 sm:grid-cols-[1.5fr_1fr_auto] sm:items-center"
                >
                  <div className="flex items-start gap-3">
                    <CircleDot size={16} className="mt-1 text-ink/25" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/32">
                        {item.ref}
                      </p>
                      <h3 className="mt-1 text-sm font-bold">{item.title}</h3>
                      <p className="mt-1 text-xs text-ink/65">{item.owner}</p>
                    </div>
                  </div>
                  <div>
                    <StatusPill tone={item.tone}>{item.status}</StatusPill>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink/65">
                      <Clock3 size={12} />
                      {item.due}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-lacquer"
                    >
                      เปิดรายการ
                      <ArrowUpRight size={14} />
                    </button>
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-full hover:bg-ink/5"
                      aria-label="เมนูเพิ่มเติม"
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {action && (
          <aside>
            <QuickActionForm definition={action} />
            <div className="mt-4 rounded-[22px] border border-ink/8 bg-white p-5">
              <p className="text-xs font-bold">Backend guarded</p>
              <p className="mt-2 text-xs leading-5 text-ink/65">
                ปุ่มนี้เรียก Action Endpoint ที่ตรวจ Session, Permission, RLS
                และ Business State ก่อนบันทึกทุกครั้ง
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
