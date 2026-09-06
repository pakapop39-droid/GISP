const styles = {
  success: "bg-jade/10 text-jade ring-jade/20",
  warning: "bg-brass/15 text-[#7a561d] ring-brass/25",
  danger: "bg-lacquer/10 text-lacquer ring-lacquer/20",
  neutral: "bg-ink/5 text-ink/60 ring-ink/10",
};

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof styles;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ${styles[tone]}`}
    >
      {children}
    </span>
  );
}
