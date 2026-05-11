import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import {
  findLatestReportForStudent,
  getStudentProgress,
  hasSupabaseConfig,
} from "@/lib/store";
import { formatDisplayDate, getProgressDirectionLabel } from "@/lib/summary";

type StudentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StudentProgressPage({ params }: StudentPageProps) {
  const { id } = await params;
  const progress = await getStudentProgress(id);
  const latestReport = await findLatestReportForStudent(id);
  const demoMode = !hasSupabaseConfig();

  if (!latestReport) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_#f8f3eb_0%,_#efe5d4_100%)] px-6 py-8 md:px-10">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/70 bg-white/70 p-8 shadow-[0_24px_80px_rgba(74,49,18,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Student Progress
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Student record not found
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
            There is no telemetry history for this student in the current data
            source.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const firstPoint = progress[0];
  const lastPoint = progress[progress.length - 1];
  const progressDelta =
    progress.length > 1 && firstPoint && lastPoint
      ? lastPoint.progressScore - firstPoint.progressScore
      : 0;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f8f3eb_0%,_#efe5d4_100%)] px-6 py-8 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-[2rem] border border-white/70 bg-white/70 p-8 shadow-[0_24px_80px_rgba(74,49,18,0.12)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <Link
                href="/"
                className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:border-amber-300 hover:bg-amber-50"
              >
                Back to dashboard
              </Link>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-800">
                  Student Progress
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                  {latestReport.studentName}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
                  Track how this student has moved across teaching days, what they
                  are stuck on, and what support the mentor should provide next.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-[1.5rem] border border-amber-200/80 bg-amber-50/80 p-5 lg:min-w-80">
              <p className="text-sm text-slate-600">
                Latest report: {formatDisplayDate(latestReport.reportDate)}
              </p>
              <StatusBadge status={latestReport.understandingStatus} />
              <p className="text-sm leading-6 text-slate-700">
                {demoMode
                  ? "Demo mode is active. Add Supabase credentials to switch to live reports."
                  : "Live Supabase data is active for this student."}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_20px_60px_rgba(74,49,18,0.10)]">
            <p className="text-sm font-medium text-slate-500">Current progress</p>
            <p className="mt-3 text-4xl font-semibold text-slate-950">
              {latestReport.progressScore}%
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Confidence: {latestReport.confidenceScore}%
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_20px_60px_rgba(74,49,18,0.10)]">
            <p className="text-sm font-medium text-slate-500">Trend since first report</p>
            <p className="mt-3 text-4xl font-semibold text-slate-950">
              {progressDelta >= 0 ? "+" : ""}
              {progressDelta} pts
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {getProgressDirectionLabel(progressDelta)}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_20px_60px_rgba(74,49,18,0.10)]">
            <p className="text-sm font-medium text-slate-500">Tutor next action</p>
            <p className="mt-3 text-lg font-semibold text-slate-950">
              {latestReport.recommendedTutorAction}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/70 p-6 shadow-[0_20px_60px_rgba(74,49,18,0.10)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Daily history
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Progress across course days
                </h2>
              </div>
            </div>
            <div className="mt-6 overflow-hidden rounded-[1.25rem] border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3 text-sm font-medium">Day</th>
                    <th className="px-4 py-3 text-sm font-medium">Lesson</th>
                    <th className="px-4 py-3 text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-sm font-medium">Progress</th>
                    <th className="px-4 py-3 text-sm font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {progress.map((point) => (
                    <tr key={point.reportDate}>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatDisplayDate(point.reportDate)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        Month {point.month}, Week {point.week}, Day {point.day}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={point.understandingStatus} />
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-950">
                        {point.progressScore}%
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {point.confidenceScore}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/70 bg-white/70 p-6 shadow-[0_20px_60px_rgba(74,49,18,0.10)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Latest diagnosis
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Why this student is stuck
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-700">
              {latestReport.summary}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {latestReport.gapCategories.map((gap) => (
                <span
                  key={gap}
                  className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900"
                >
                  {gap.replace(/-/g, " ")}
                </span>
              ))}
            </div>
            <div className="mt-6">
              <p className="text-sm font-medium text-slate-500">Likely causes</p>
              <ul className="mt-3 flex list-none flex-col gap-3 p-0">
                {latestReport.likelyCauses.map((cause) => (
                  <li
                    key={cause}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                  >
                    {cause}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
