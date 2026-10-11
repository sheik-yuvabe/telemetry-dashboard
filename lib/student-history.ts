import { TelemetryReport } from "./types";
import { Batch, Enrollment, StudentProject, UsageEvent, usageTotal } from "./workspace-types";

export type HistoryScope = { batchId: string; studentId: string; from: string; through: string; project: string; lesson: string; status: string };
export type EvidenceClaim = { text: string; reportIds: string[] };
export type StudentSummary = { overview: EvidenceClaim[]; strengths: EvidenceClaim[]; difficulties: EvidenceClaim[]; progress: EvidenceClaim[]; nextSteps: EvidenceClaim[]; limitations: string[] };
export type SavedSummary = { content: StudentSummary; generatedAt: string; sourceHash: string; reportCount: number; model: string; promptVersion: string; apiUsage: { inputTokens: number; outputTokens: number; totalTokens: number }; review: "draft" | "reviewed" };
export type SummaryState = { saved: SavedSummary | null; stale: boolean; available: boolean; message: string };
export type StudentContext = { batch: Batch; student: Enrollment; projects: StudentProject[]; usage: UsageEvent[]; reports: TelemetryReport[]; demo: boolean };
export function lessonKey(report: TelemetryReport) { return report.lessonPath || `Month ${report.month} / Week ${report.week} / Day ${report.day}`; }
export function orderedReports(reports: TelemetryReport[]) {
  return [...reports].sort((a, b) => b.reportDate.localeCompare(a.reportDate) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
export function filterHistory(reports: TelemetryReport[], scope: HistoryScope) {
  return orderedReports(reports.filter(r => (r.batchId ?? "batch-1") === scope.batchId && r.studentId === scope.studentId
    && (!scope.from || r.reportDate >= scope.from) && (!scope.through || r.reportDate <= scope.through)
    && (!scope.project || (scope.project === "unassigned" ? !r.projectId : r.projectId === scope.project))
    && (!scope.lesson || lessonKey(r) === scope.lesson) && (!scope.status || r.understandingStatus === scope.status)));
}
export function historyOverview(reports: TelemetryReport[], usage: UsageEvent[], scope: HistoryScope) {
  const daily = new Map<string, TelemetryReport>();
  for (const report of orderedReports(reports)) if (!daily.has(report.reportDate)) daily.set(report.reportDate, report);
  const gaps = new Map<string, Set<string>>();
  for (const report of daily.values()) for (const gap of report.gapCategories) {
    if (!gaps.has(gap)) gaps.set(gap, new Set());
    gaps.get(gap)!.add(report.reportDate);
  }
  const groups = new Map<string, Map<string, TelemetryReport>>();
  for (const report of orderedReports(reports)) {
    const key = JSON.stringify([report.projectId ?? null, lessonKey(report)]);
    if (!groups.has(key)) groups.set(key, new Map());
    if (!groups.get(key)!.has(report.reportDate)) groups.get(key)!.set(report.reportDate, report);
  }
  const trends = [...groups.values()].map(group => {
    const rows = [...group.values()].reverse();
    return { lesson: lessonKey(rows[0]), projectId: rows[0].projectId ?? null,
      points: rows.map(row => ({ date: row.reportDate, score: row.progressScore, status: row.understandingStatus, reportId: row.id })) };
  });
  const events = usage.filter(e => {
    const date = new Date(Date.parse(e.occurredAt) + 19800000).toISOString().slice(0, 10);
    return e.batchId === scope.batchId && e.studentId === scope.studentId && (!scope.from || date >= scope.from) && (!scope.through || date <= scope.through)
      && (!scope.project || (scope.project === "unassigned" ? !e.projectId : e.projectId === scope.project));
  });
  const sorted = orderedReports(reports);
  return { reportCount: reports.length, reportDays: daily.size, firstDate: sorted.at(-1)?.reportDate ?? null, lastDate: sorted[0]?.reportDate ?? null,
    latestStatus: sorted[0]?.understandingStatus ?? null,
    gaps: [...gaps].map(([name, dates]) => ({ name, days: dates.size })).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name)),
    trends, tokenTotal: events.length ? usageTotal(events) : null, usage: events };
}
export type HistoryOverview = ReturnType<typeof historyOverview>;
export type HistoryResponse = { context: Omit<StudentContext, "reports" | "usage">; overview: HistoryOverview; reports: TelemetryReport[]; nextCursor: string | null; lessons: string[]; scope: HistoryScope };
