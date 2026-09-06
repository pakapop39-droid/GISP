import Link from "next/link";

export function BrandMark({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <Link
      href="/dashboard"
      className="group inline-flex items-center gap-3 no-underline"
      aria-label="GISP dashboard"
    >
      <span
        className={`grid size-10 place-items-center rounded-[10px] border text-[13px] font-bold tracking-[0.16em] transition-colors ${
          inverse ? "bg-porcelain text-ink" : "bg-ink text-porcelain"
        }`}
      >
        GI
      </span>
      {!compact && (
        <span className="leading-none">
          <span
            className={`block text-[17px] font-bold tracking-[-0.02em] ${
              inverse ? "text-porcelain" : "text-ink"
            }`}
          >
            GISP
          </span>
          <span
            className={`mt-1 block text-[9px] font-bold uppercase tracking-[0.18em] ${
              inverse ? "text-porcelain/75" : "text-ink/70"
            }`}
          >
            Interior Supply
          </span>
        </span>
      )}
    </Link>
  );
}
