import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { ReportTable } from "@/components/report-table";
import { SummaryPanel } from "@/components/summary-panel";
import { getReportsByDate, hasSupabaseConfig, listReportDates } from "@/lib/store";
import { buildDailySummary, formatDisplayDate, resolveSelectedDate } from "@/lib/summary";

type HomeProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const availableDates = await listReportDates();
  const selectedDate = resolveSelectedDate(params.date, availableDates);
  const reports = await getReportsByDate(selectedDate);
  const summary = buildDailySummary(reports, selectedDate);
  const demoMode = !hasSupabaseConfig();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(243,180,114,0.28),_transparent_28%),linear-gradient(180deg,_#f8f3eb_0%,_#f4efe6_48%,_#efe5d4_100%)] px-6 py-8 text-slate-900 md:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 p-8 shadow-[0_24px_80px_rgba(74,49,18,0.12)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-800">
                Mentor Telemetry Console
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                See who is progressing, who is stuck, and why.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-700 md:text-lg">
                This dashboard is built around summarized conceptual-gap reports from
                the Codex workflow in VS Code. Mentors start with a cohort-level daily
                summary, then drill into individual students to guide follow-up support.
              </p>
            </div>
            <div className="flex flex-col gap-4 rounded-[1.5rem] border border-amber-200/80 bg-amber-50/80 p-5 lg:min-w-80">
              <div>
                <p className="text-sm font-medium text-amber-900">Selected teaching day</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {formatDisplayDate(selectedDate)}
                </p>
              </div>
              <form className="flex flex-col gap-3 sm:flex-row lg:flex-col" action="/" method="get">
                <label className="flex flex-1 flex-col gap-2 text-sm text-slate-700">
                  Jump to a day
                  <input
                    type="date"
                    name="date"
                    defaultValue={selectedDate}
                    className="h-11 rounded-xl border border-amber-200 bg-white px-4 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </label>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Load reports
                </button>
              </form>
              {demoMode ? (
                <p className="rounded-xl border border-dashed border-amber-300 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-700">
                  Demo mode is active because Supabase environment variables are not
                  configured yet. The UI is running on seeded sample telemetry.
                </p>
              ) : (
                <p className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/80 px-4 py-3 text-sm leading-6 text-emerald-900">
                  Supabase is configured. API routes will read and write live
                  telemetry reports.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Students tracked"
            value={summary.totalStudents.toString()}
            accent="amber"
            caption={`${summary.statusBreakdown.stuck} need immediate attention`}
          />
          <MetricCard
            label="Average progress"
            value={`${summary.averageProgress}%`}
            accent="slate"
            caption={`${summary.averageConfidence}% average confidence`}
          />
          <MetricCard
            label="Top recurring gap"
            value={summary.topGaps[0]?.label ?? "No major pattern"}
            accent="rose"
            caption={
              summary.topGaps[0]
                ? `${summary.topGaps[0].count} student reports mention it`
                : "No telemetry for this day yet"
            }
          />
          <MetricCard
            label="Highest-risk student"
            value={summary.priorityStudents[0]?.studentName ?? "No priority flags"}
            accent="teal"
            caption={
              summary.priorityStudents[0]
                ? summary.priorityStudents[0].summary
                : "No flagged learners for the selected day"
            }
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[1.75rem] border border-white/70 bg-white/70 p-5 shadow-[0_20px_60px_rgba(74,49,18,0.10)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Teaching Days
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  Progress timeline
                </h2>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {availableDates.map((date) => {
                const isActive = date === selectedDate;

                return (
                  <Link
                    key={date}
                    href={`/?date=${date}`}
                    className={`rounded-2xl border px-4 py-4 transition ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white shadow-lg"
                        : "border-slate-200 bg-white text-slate-800 hover:border-amber-300 hover:bg-amber-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {formatDisplayDate(date)}
                    </p>
                    <p
                      className={`mt-1 text-sm ${
                        isActive ? "text-slate-200" : "text-slate-500"
                      }`}
                    >
                      Review cohort summary and student reports
                    </p>
                  </Link>
                );
              })}
            </div>
          </aside>

          <div className="grid gap-6">
            <SummaryPanel summary={summary} />
            <ReportTable reports={reports} />
          </div>
        </section>
      </div>
    </main>
  );
}
