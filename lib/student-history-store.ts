import { dashboardData } from "./dashboard-data";
import { hasSupabaseConfig, supabaseFetch, mapRowToReport } from "./store";
import { RawTelemetryRow, TelemetryReport } from "./types";
import { ApiError } from "./mentor-api";
import { HistoryScope, StudentContext, filterHistory, historyOverview, lessonKey, orderedReports } from "./student-history";

async function rows(table: string, filters: Record<string, string>, order: string) {
  const all: Record<string, unknown>[] = [];
  let previous: Record<string, unknown> | undefined;
  for (;;) {
    const query = new URLSearchParams({ select: "*", ...filters, order, limit: "500" });
    if (previous) {
      if (table === "telemetry_reports") {
        const d = String(previous.report_date), t = String(previous.created_at), id = String(previous.id);
        query.set("or", `(report_date.lt.${d},and(report_date.eq.${d},created_at.lt.${t}),and(report_date.eq.${d},created_at.eq.${t},id.lt.${id}))`);
      } else {
        const field = order.split(".")[0];
        query.set(field, `gt.${previous[field]}`);
      }
    }
    const response = await supabaseFetch(`/rest/v1/${table}?${query}`);
    if (!response.ok) throw new ApiError("Student history is unavailable. Check the database and Batch 2 migration.", 503);
    const page = await response.json() as Record<string, unknown>[];
    all.push(...page);
    if (page.length < 500) return all;
    if (all.length >= 20000) throw new ApiError("This history is too large for the current reader. Archive or partition the source before continuing.", 413);
    previous = page.at(-1);
  }
}
export async function studentContext(scope: HistoryScope, demo: boolean): Promise<StudentContext> {
  if (demo) {
    const data = await dashboardData(scope.batchId, true);
    const student = data.workspace.students.find(s => s.studentId === scope.studentId);
    const batch = data.workspace.batches.find(b => b.id === scope.batchId);
    if (!student || !batch) throw new ApiError("Student not found in this batch.", 404);
    return { student, batch, demo: true, projects: data.workspace.projects.filter(p => p.studentId === scope.studentId),
      usage: data.workspace.usage.filter(u => u.studentId === scope.studentId), reports: data.reports.filter(r => r.studentId === scope.studentId) };
  }
  if (!hasSupabaseConfig()) throw new ApiError("Configure Supabase before loading live student history.", 503);
  const filter = { batch_id: `eq.${scope.batchId}`, student_id: `eq.${scope.studentId}` };
  const [students, batches] = await Promise.all([rows("batch_students", filter, "student_id.asc"), rows("batches", { id: `eq.${scope.batchId}` }, "id.asc")]);
  if (!students[0] || !batches[0]) throw new ApiError("Student not found in this batch.", 404);
  const [projects, events, reports] = await Promise.all([
    rows("student_projects", filter, "id.asc"), rows("usage_events", filter, "event_id.asc"), rows("telemetry_reports", filter, "report_date.desc,created_at.desc,id.desc"),
  ]);
  const s = students[0], b = batches[0];
  return { demo: false, student: { studentId: String(s.student_id), batchId: scope.batchId, name: String(s.name), accountId: s.account_id as string | null },
    batch: { id: String(b.id), name: String(b.name), status: b.status as "active" | "archived" },
    projects: projects.map(p => ({ id: String(p.id), batchId: scope.batchId, studentId: scope.studentId, name: String(p.name), description: String(p.description), progress: Number(p.progress), status: p.status as "building", repositoryUrl: p.repository_url as string | null })),
    usage: events.map(e => ({ eventId: String(e.event_id), batchId: scope.batchId, studentId: scope.studentId, projectId: e.project_id as string | null, accountId: String(e.account_id), sessionId: String(e.session_id), occurredAt: String(e.occurred_at), inputTokens: Number(e.input_tokens), outputTokens: Number(e.output_tokens), cachedInputTokens: Number(e.cached_input_tokens), source: String(e.source) })),
    reports: reports.map(r => mapRowToReport(r as unknown as RawTelemetryRow)) };
}
export function historyPage(context: StudentContext, scope: HistoryScope, cursor: string | null, reportId: string | null) {
  const filtered = filterHistory(context.reports, scope);
  let remaining = filtered;
  if (cursor) {
    try {
      if (cursor.length > 1000) throw Error();
      const [reportDate, createdAt, id] = JSON.parse(Buffer.from(cursor, "base64url").toString()) as string[];
      if (![reportDate, createdAt, id].every(v => typeof v === "string" && v.length > 0)) throw Error();
      const boundary = { reportDate, createdAt, id } as TelemetryReport;
      remaining = filtered.filter(r => r.id !== id && orderedReports([boundary, r])[0] === boundary);
    } catch { throw new ApiError("Invalid report cursor."); }
  }
  if (reportId) {
    remaining = context.reports.filter(r => r.id === reportId);
    if (!remaining.length) throw new ApiError("Report not found for this student.", 404);
  }
  const reports = remaining.slice(0, 20), last = reports.at(-1);
  return { context: { student: context.student, batch: context.batch, projects: context.projects, demo: context.demo }, scope,
    overview: historyOverview(filtered, context.usage, scope), reports,
    nextCursor: !reportId && remaining.length > 20 && last ? Buffer.from(JSON.stringify([last.reportDate, last.createdAt, last.id])).toString("base64url") : null,
    lessons: [...new Set(context.reports.map(lessonKey))].sort() };
}
