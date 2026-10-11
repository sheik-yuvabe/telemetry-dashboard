import { getDemoReports, supabaseFetch } from "./store";
import { FeedbackPayload, RawTelemetryRow, TelemetryReport } from "./types";
import { getWorkspace } from "./workspace-store";
import { scopeWorkspace } from "./workspace-types";
import { seededReports } from "./mock-data";

export async function dashboardData(batchId: string, demo = false) {
  const workspace = scopeWorkspace(await getWorkspace(batchId, demo), batchId);
  let reports: TelemetryReport[] = [];
  if (workspace.mode === "demo") {
    if (batchId === "batch-1") reports = demo ? [...seededReports] : getDemoReports(batchId);
    else reports = workspace.students.slice(0, 7).map((student, i) => ({
      id: `sample-report-${i}`, batchId, studentId: student.studentId, studentName: student.name,
      projectId: workspace.projects[i].id, reportDate: "2026-10-10", createdAt: "2026-10-10T10:30:00Z",
      month: 1, week: 2, day: 4, lessonPath: "course/month-1/week-2/day-4", assignmentPath: null,
      lessonConfidence: "high", understandingStatus: i === 2 || i === 4 ? "stuck" : i === 6 ? "partial" : "clear",
      progressScore: workspace.projects[i].progress, confidenceScore: [78, 88, 38, 80, 46, 72, 56][i],
      gapCategories: i === 2 ? ["debugging"] : i === 4 ? ["problem-decomposition"] : i === 6 ? ["concept"] : [],
      summary: i === 2 ? "Kavin needs help tracing the data between the form and the API." : i === 4 ? "Nila is finding it difficult to break expense categories into smaller tasks." : "Making steady progress and explaining implementation decisions.",
      likelyCauses: [], recommendedTutorAction: i === 2 ? "Trace one request together from input to response." : i === 4 ? "Plan the next feature as three small, testable steps." : "Review the next project milestone.", repeatedTopicSignals: i === 2 ? 3 : 0, triggerReason: "session_end",
    }));
    if (batchId !== "batch-1") reports = reports.flatMap(report => [
      report,
      ...[5, 6, 7, 8, 9, 10].map(day => ({
        ...report, id: `${report.id}-history-${day}`, reportDate: `2026-10-${String(day).padStart(2, "0")}`,
        createdAt: `2026-10-${String(day).padStart(2, "0")}T05:00:00Z`,
        progressScore: Math.max(10, report.progressScore - (11 - day) * 6),
        confidenceScore: Math.max(25, report.confidenceScore - (11 - day) * 3),
        understandingStatus: day < 8 ? "partial" as const : report.understandingStatus,
        gapCategories: day < 8 ? ["concept" as const] : report.gapCategories,
        summary: day < 8 ? "Explained the initial project structure and identified the next implementation step. Still needs guidance connecting the concepts." : "Tested the current feature and explained the result. The original report records the remaining learning gaps.",
        recommendedTutorAction: day < 8 ? "Ask the learner to explain one small change before implementing the next." : report.recommendedTutorAction,
        triggerReason: "manual" as const,
      })),
    ]);
    if (batchId !== "batch-1" && !demo) reports.push(...getDemoReports(batchId));
  } else if (!workspace.setupRequired) {
    for (let offset = 0; ; offset += 500) {
      const query = new URLSearchParams({ select: "*", batch_id: `eq.${batchId}`, order: "report_date.desc,created_at.desc,id.desc", limit: "500", offset: String(offset) });
      const response = await supabaseFetch(`/rest/v1/telemetry_reports?${query}`);
      if (!response.ok) throw new Error("Learning reports could not be loaded.");
      const rows = await response.json() as RawTelemetryRow[];
      reports.push(...rows.map((r) => ({ id: r.id, batchId: r.batch_id, projectId: r.project_id, studentId: r.student_id, studentName: r.student_name, reportDate: r.report_date, createdAt: r.created_at, month: r.month, week: r.week, day: r.day, lessonPath: r.lesson_path, assignmentPath: r.assignment_path, lessonConfidence: r.lesson_confidence, understandingStatus: r.understanding_status, progressScore: r.progress_score, confidenceScore: r.confidence_score, gapCategories: r.gap_categories, summary: r.summary, likelyCauses: r.likely_causes, recommendedTutorAction: r.recommended_tutor_action, repeatedTopicSignals: r.repeated_topic_signals, triggerReason: r.trigger_reason } as TelemetryReport)));
      if (rows.length < 500) break;
    }
  }
  return { workspace, reports };
}

export async function validateReportEnrollment(payload: FeedbackPayload) {
  if ((payload.batchId ?? "batch-1") === "batch-1" && !payload.projectId) return;
  const data = await getWorkspace(payload.batchId ?? "batch-1");
  if (!data.students.some((student) => student.batchId === payload.batchId && student.studentId === payload.studentId)) throw new Error("Student is not enrolled in the selected batch.");
  if (payload.projectId && !data.projects.some((project) => project.batchId === payload.batchId && project.studentId === payload.studentId && project.id === payload.projectId)) throw new Error("Project does not belong to this student and batch.");
}
