import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { appModules } from "@/config/modules";

type ModuleDefinition = (typeof appModules)[number];

export function ModuleCard({ module }: { module: ModuleDefinition }) {
  const Icon = module.icon;
  return (
    <Link
      href={`/${module.slug}`}
      className="group relative min-h-56 overflow-hidden rounded-[26px] border border-ink/10 bg-white p-6 shadow-paper transition duration-300 hover:-translate-y-1 hover:border-ink/20"
    >
      <div className="flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-ink text-porcelain">
          <Icon size={20} strokeWidth={1.8} />
        </span>
        <ArrowUpRight
          aria-hidden="true"
          size={18}
          className="text-ink/25 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-lacquer"
        />
      </div>
      <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/70">
        Slice {module.order}
      </p>
      <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
        {module.label}
      </h3>
      <p className="mt-2 max-w-[29ch] text-sm leading-6 text-ink/70">
        {module.description}
      </p>
    </Link>
  );
}
