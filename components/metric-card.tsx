type MetricCardProps = {
  label: string;
  value: string;
  caption: string;
  accent: "amber" | "slate" | "rose" | "teal";
};

const accentStyles: Record<MetricCardProps["accent"], string> = {
  amber: "from-amber-100 via-white to-orange-50 border-amber-200",
  slate: "from-slate-100 via-white to-slate-50 border-slate-200",
  rose: "from-rose-100 via-white to-rose-50 border-rose-200",
  teal: "from-teal-100 via-white to-cyan-50 border-teal-200",
};

export function MetricCard({ label, value, caption, accent }: MetricCardProps) {
  return (
    <article
      className={`rounded-[1.5rem] border bg-gradient-to-br p-5 shadow-[0_20px_60px_rgba(74,49,18,0.10)] ${accentStyles[accent]}`}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{caption}</p>
    </article>
  );
}
