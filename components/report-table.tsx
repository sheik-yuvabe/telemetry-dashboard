import Link from "next/link";
import { TelemetryReport } from "@/lib/types";
import { formatDisplayDate } from "@/lib/summary";
import { StatusBadge } from "./status-badge";

type ReportTableProps = {
  reports: TelemetryReport[];
};

export function ReportTable({ reports }: ReportTableProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/70 p-6 shadow-[0_20px_60px_rgba(74,49,18,0.10)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Student Reports
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Daily conceptual-gap review
          </h2>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          Each row is one summarized report, not a raw error log.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.25rem] border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="px-4 py-3 text-sm font-medium">Student</th>
              <th className="px-4 py-3 text-sm font-medium">Lesson</th>
              <th className="px-4 py-3 text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-sm font-medium">Progress</th>
              <th className="px-4 py-3 text-sm font-medium">Main gap</th>
              <th className="px-4 py-3 text-sm font-medium">Updated</th>
              <th className="px-4 py-3 text-sm font-medium">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {reports.map((report) => (
              <tr key={report.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-slate-950">{report.studentName}</p>
                    <p className="text-sm text-slate-500">{report.studentId}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm leading-6 text-slate-700">
                  <p>
                    Month {report.month}, Week {report.week}, Day {report.day}
                  </p>
                  <p className="text-slate-500">{report.assignmentPath}</p>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={report.understandingStatus} />
                </td>
                <td className="px-4 py-4 text-sm leading-6 text-slate-700">
                  <p className="font-medium text-slate-950">{report.progressScore}%</p>
                  <p>Confidence {report.confidenceScore}%</p>
                </td>
                <td className="px-4 py-4 text-sm leading-6 text-slate-700">
                  <p className="font-medium text-slate-950">
                    {report.gapCategories[0]?.replace(/-/g, " ") ?? "No major gap"}
                  </p>
                  <p>{report.summary}</p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  {formatDisplayDate(report.reportDate)}
                </td>
                <td className="px-4 py-4">
                  <Link
                    href={`/students/${report.studentId}`}
                    className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
