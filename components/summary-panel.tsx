import { DailySummary } from "@/lib/types";

type SummaryPanelProps = {
  summary: DailySummary;
};

export function SummaryPanel({ summary }: SummaryPanelProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <article className="rounded-[1.75rem] border border-white/70 bg-white/70 p-6 shadow-[0_20px_60px_rgba(74,49,18,0.10)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Cohort Summary
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          What mentors should read first
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-700">
          {summary.narrative}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-900">Clear</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {summary.statusBreakdown.clear}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">Partial</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {summary.statusBreakdown.partial}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-medium text-rose-900">Stuck</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {summary.statusBreakdown.stuck}
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-[1.75rem] border border-white/70 bg-white/70 p-6 shadow-[0_20px_60px_rgba(74,49,18,0.10)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Recommended Mentor Actions
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          Where to focus next
        </h2>

        <ul className="mt-5 flex list-none flex-col gap-3 p-0">
          {summary.recommendedActions.map((action) => (
            <li
              key={action}
              className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700"
            >
              {action}
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Top recurring gaps</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.topGaps.map((gap) => (
              <span
                key={gap.label}
                className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-800 shadow-sm"
              >
                {gap.label} ({gap.count})
              </span>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
