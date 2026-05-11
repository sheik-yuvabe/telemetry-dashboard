import { createHash } from "node:crypto";
import { seededReports } from "./mock-data";
import {
  CreateFeedbackResult,
  DailyProgressPoint,
  FeedbackPayload,
  LessonConfidence,
  RawTelemetryRow,
  TelemetryReport,
  TriggerReason,
  UnderstandingStatus,
} from "./types";

let inMemoryReports = [...seededReports];
const inMemoryFingerprints = new Map(
  seededReports.map((report) => [createReportFingerprint(report), report]),
);

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseConfig());
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function supabaseRequest<T>(path: string, init?: RequestInit) {
  const response = await supabaseFetch(path, init);

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Supabase request failed with ${response.status}: ${errorText || "Unknown error"}`,
    );
  }

  return (await response.json()) as T;
}

function mapRowToReport(row: RawTelemetryRow): TelemetryReport {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    reportDate: row.report_date,
    createdAt: row.created_at,
    month: row.month,
    week: row.week,
    day: row.day,
    lessonPath: row.lesson_path,
    assignmentPath: row.assignment_path,
    lessonConfidence: row.lesson_confidence as LessonConfidence,
    understandingStatus: row.understanding_status as UnderstandingStatus,
    progressScore: row.progress_score,
    confidenceScore: row.confidence_score,
    gapCategories: row.gap_categories,
    summary: row.summary,
    likelyCauses: row.likely_causes,
    recommendedTutorAction: row.recommended_tutor_action,
    repeatedTopicSignals: row.repeated_topic_signals,
    triggerReason: row.trigger_reason as TriggerReason,
  };
}

function mapReportToRow(report: TelemetryReport): RawTelemetryRow {
  return {
    id: report.id,
    student_id: report.studentId,
    student_name: report.studentName,
    report_date: report.reportDate,
    created_at: report.createdAt,
    month: report.month,
    week: report.week,
    day: report.day,
    lesson_path: report.lessonPath,
    assignment_path: report.assignmentPath,
    lesson_confidence: report.lessonConfidence,
    understanding_status: report.understandingStatus,
    progress_score: report.progressScore,
    confidence_score: report.confidenceScore,
    gap_categories: report.gapCategories,
    summary: report.summary,
    likely_causes: report.likelyCauses,
    recommended_tutor_action: report.recommendedTutorAction,
    repeated_topic_signals: report.repeatedTopicSignals,
    trigger_reason: report.triggerReason,
  };
}

export async function listReportDates() {
  if (!hasSupabaseConfig()) {
    return Array.from(new Set(inMemoryReports.map((report) => report.reportDate))).sort(
      (left, right) => right.localeCompare(left),
    );
  }

  const rows = await supabaseRequest<Array<{ report_date: string }>>(
    "/rest/v1/telemetry_reports?select=report_date&order=report_date.desc",
  );

  return Array.from(new Set(rows.map((row) => row.report_date)));
}

export async function getReportsByDate(reportDate: string) {
  if (!hasSupabaseConfig()) {
    return inMemoryReports
      .filter((report) => report.reportDate === reportDate)
      .sort((left, right) => left.studentName.localeCompare(right.studentName));
  }

  const rows = await supabaseRequest<RawTelemetryRow[]>(
    `/rest/v1/telemetry_reports?select=*&report_date=eq.${reportDate}&order=student_name.asc`,
  );

  return rows.map(mapRowToReport);
}

export async function findLatestReportForStudent(studentId: string) {
  if (!hasSupabaseConfig()) {
    return [...inMemoryReports]
      .filter((report) => report.studentId === studentId)
      .sort((left, right) => right.reportDate.localeCompare(left.reportDate))[0];
  }

  const rows = await supabaseRequest<RawTelemetryRow[]>(
    `/rest/v1/telemetry_reports?select=*&student_id=eq.${studentId}&order=report_date.desc&limit=1`,
  );

  return rows[0] ? mapRowToReport(rows[0]) : null;
}

export async function getStudentProgress(studentId: string): Promise<DailyProgressPoint[]> {
  const reports = hasSupabaseConfig()
    ? (
        await supabaseRequest<RawTelemetryRow[]>(
          `/rest/v1/telemetry_reports?select=*&student_id=eq.${studentId}&order=report_date.asc`,
        )
      ).map(mapRowToReport)
    : [...inMemoryReports]
        .filter((report) => report.studentId === studentId)
        .sort((left, right) => left.reportDate.localeCompare(right.reportDate));

  return reports.map((report) => ({
    studentId: report.studentId,
    studentName: report.studentName,
    reportDate: report.reportDate,
    month: report.month,
    week: report.week,
    day: report.day,
    understandingStatus: report.understandingStatus,
    progressScore: report.progressScore,
    confidenceScore: report.confidenceScore,
  }));
}

function createReportFromPayload(payload: FeedbackPayload): TelemetryReport {
  return {
    id: crypto.randomUUID(),
    studentId: payload.studentId,
    studentName: payload.studentName,
    reportDate: payload.reportDate,
    createdAt: new Date().toISOString(),
    month: payload.month,
    week: payload.week,
    day: payload.day,
    lessonPath: payload.lessonPath,
    assignmentPath: payload.assignmentPath,
    lessonConfidence: payload.lessonConfidence,
    understandingStatus: payload.understandingStatus,
    progressScore: payload.progressScore,
    confidenceScore: payload.confidenceScore,
    gapCategories: payload.gapCategories,
    summary: payload.summary,
    likelyCauses: payload.likelyCauses,
    recommendedTutorAction: payload.recommendedTutorAction,
    repeatedTopicSignals: payload.repeatedTopicSignals,
    triggerReason: payload.triggerReason,
  };
}

function createReportFingerprint(payload: FeedbackPayload) {
  const normalizedPayload = {
    studentId: payload.studentId,
    studentName: payload.studentName,
    reportDate: payload.reportDate,
    month: payload.month,
    week: payload.week,
    day: payload.day,
    lessonPath: payload.lessonPath ?? null,
    assignmentPath: payload.assignmentPath ?? null,
    lessonConfidence: payload.lessonConfidence,
    understandingStatus: payload.understandingStatus,
    progressScore: payload.progressScore,
    confidenceScore: payload.confidenceScore,
    gapCategories: [...payload.gapCategories].sort(),
    summary: payload.summary.trim(),
    likelyCauses: [...payload.likelyCauses].map((cause) => cause.trim()).sort(),
    recommendedTutorAction: payload.recommendedTutorAction.trim(),
    repeatedTopicSignals: payload.repeatedTopicSignals,
    triggerReason: payload.triggerReason,
  };

  return createHash("sha256")
    .update(JSON.stringify(normalizedPayload))
    .digest("hex");
}

type InsertableTelemetryRow = RawTelemetryRow & {
  report_fingerprint: string;
};

function createInsertableRow(payload: FeedbackPayload) {
  const report = createReportFromPayload(payload);
  const reportFingerprint = createReportFingerprint(payload);

  return {
    report,
    reportFingerprint,
    row: {
      ...mapReportToRow(report),
      report_fingerprint: reportFingerprint,
    } satisfies InsertableTelemetryRow,
  };
}

async function findReportByFingerprint(reportFingerprint: string) {
  const encodedFingerprint = encodeURIComponent(reportFingerprint);
  const rows = await supabaseRequest<RawTelemetryRow[]>(
    `/rest/v1/telemetry_reports?select=*&report_fingerprint=eq.${encodedFingerprint}&limit=1`,
  );

  return rows[0] ? mapRowToReport(rows[0]) : null;
}

export async function createFeedbackReport(
  payload: FeedbackPayload,
): Promise<CreateFeedbackResult> {
  const { report, reportFingerprint, row } = createInsertableRow(payload);

  if (!hasSupabaseConfig()) {
    const existingReport = inMemoryFingerprints.get(reportFingerprint);

    if (existingReport) {
      return {
        report: existingReport,
        deduplicated: true,
      };
    }

    inMemoryReports = [report, ...inMemoryReports];
    inMemoryFingerprints.set(reportFingerprint, report);

    return {
      report,
      deduplicated: false,
    };
  }

  const response = await supabaseFetch("/rest/v1/telemetry_reports", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify([row]),
  });

  if (response.ok) {
    const rows = (await response.json()) as RawTelemetryRow[];

    return {
      report: mapRowToReport(rows[0]),
      deduplicated: false,
    };
  }

  const errorText = await response.text();
  const isDuplicateInsert =
    response.status === 409 && errorText.includes("telemetry_reports_report_fingerprint_idx");

  if (isDuplicateInsert) {
    const existingReport = await findReportByFingerprint(reportFingerprint);

    if (!existingReport) {
      throw new Error(
        "Supabase reported a duplicate telemetry report, but the existing row could not be loaded.",
      );
    }

    return {
      report: existingReport,
      deduplicated: true,
    };
  }

  throw new Error(
    `Supabase request failed with ${response.status}: ${errorText || "Unknown error"}`,
  );
}
