export type CatalogImportHistoryJob = {
  id: string;
  file_name: string;
  source_type: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  created_at: string;
  page_count?: number;
  processed_pages?: number;
  ai_cost_usd?: number;
  compute_cost_usd?: number;
};

type CatalogImportDetailTarget = Pick<HTMLElement, "focus" | "scrollIntoView">;

export function revealCatalogImportDetail(target: CatalogImportDetailTarget | null) {
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function CatalogImportHistoryButton({ job, selected, onSelect }: { job: CatalogImportHistoryJob; selected: boolean; onSelect: () => void }) {
  return <button type="button" aria-pressed={selected} aria-current={selected ? "true" : undefined} onClick={onSelect} className={`grid w-full grid-cols-[1fr_auto] gap-3 border p-3 text-left transition md:grid-cols-[1.5fr_.6fr_.8fr_auto] ${selected ? "border-[#356b52] bg-[#356b52]/10 ring-1 ring-[#356b52]/30" : "border-black/10 hover:bg-black/[.025]"}`}><span><strong className="block">{job.file_name}</strong><small>{new Date(job.created_at).toLocaleString("th-TH")}</small>{selected ? <span className="mt-1 inline-flex rounded-full bg-[#356b52] px-2 py-0.5 text-[11px] font-bold text-white">กำลังดู</span> : null}</span><span>{job.source_type}</span><span>พร้อม {job.valid_rows} · ต้องแก้ {job.invalid_rows}</span><strong>{job.status}</strong></button>;
}

export function CatalogImportCurrentJob({ fileName, status }: { fileName: string; status: string }) {
  return <section className="rounded-xl border border-[#356b52]/30 bg-[#356b52]/5 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="catalog-import-current-job" className="font-serif text-xl">กำลังดูงาน: {fileName}</h2><span className="v14-status">{status}</span></div></section>;
}
