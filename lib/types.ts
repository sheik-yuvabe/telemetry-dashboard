export type UnderstandingStatus = "clear" | "partial" | "stuck";

export type LessonConfidence = "high" | "medium" | "low";

export type TriggerReason =
  | "idle_timeout"
  | "lesson_switch"
  | "manual"
  | "session_end";

export type GapCategory =
  | "concept"
  | "debugging"
  | "repo-navigation"
  | "problem-decomposition"
  | "tool-usage"
  | "assignment-reading"
  | "git-workflow";

export type TelemetryReport = {
  id: string;
  studentId: string;
  studentName: string;
  reportDate: string;
  createdAt: string;
  month: number;
  week: number;
  day: number;
  lessonPath: string | null;
  assignmentPath: string | null;
  lessonConfidence: LessonConfidence;
  understandingStatus: UnderstandingStatus;
  progressScore: number;
  confidenceScore: number;
  gapCategories: GapCategory[];
  summary: string;
  likelyCauses: string[];
  recommendedTutorAction: string;
  repeatedTopicSignals: number;
  triggerReason: TriggerReason;
};

export type FeedbackPayload = Omit<TelemetryReport, "id" | "createdAt">;

export type CreateFeedbackResult = {
  report: TelemetryReport;
  deduplicated: boolean;
};

export type RawTelemetryRow = {
  id: string;
  student_id: string;
  student_name: string;
  report_date: string;
  created_at: string;
  month: number;
  week: number;
  day: number;
  lesson_path: string | null;
  assignment_path: string | null;
  lesson_confidence: string;
  understanding_status: string;
  progress_score: number;
  confidence_score: number;
  gap_categories: GapCategory[];
  summary: string;
  likely_causes: string[];
  recommended_tutor_action: string;
  repeated_topic_signals: number;
  trigger_reason: string;
  report_fingerprint?: string | null;
};

export type DailySummary = {
  reportDate: string;
  totalStudents: number;
  averageProgress: number;
  averageConfidence: number;
  statusBreakdown: Record<UnderstandingStatus, number>;
  topGaps: Array<{
    key: GapCategory;
    label: string;
    count: number;
  }>;
  priorityStudents: TelemetryReport[];
  recommendedActions: string[];
  narrative: string;
};

export type DailyProgressPoint = {
  studentId: string;
  studentName: string;
  reportDate: string;
  month: number;
  week: number;
  day: number;
  understandingStatus: UnderstandingStatus;
  progressScore: number;
  confidenceScore: number;
};

const allowedGapCategories = new Set<GapCategory>([
  "concept",
  "debugging",
  "repo-navigation",
  "problem-decomposition",
  "tool-usage",
  "assignment-reading",
  "git-workflow",
]);

const allowedStatuses = new Set<UnderstandingStatus>(["clear", "partial", "stuck"]);

const allowedLessonConfidence = new Set<LessonConfidence>(["high", "medium", "low"]);

const allowedTriggers = new Set<TriggerReason>([
  "idle_timeout",
  "lesson_switch",
  "manual",
  "session_end",
]);

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseNumberLike(value: unknown, fieldName: string) {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());

    if (!Number.isNaN(parsed)) {
      return Math.round(parsed);
    }
  }

  throw new Error(`${fieldName} must be a number.`);
}

function parseInteger(value: unknown, fieldName: string, min: number, max: number) {
  const parsed = parseNumberLike(value, fieldName);

  if (parsed < min || parsed > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}.`);
  }

  return parsed;
}

function parseString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function parseOptionalString(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Optional path fields must be strings when provided.");
  }

  return value.trim() || null;
}

function parseStringArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array of strings.`);
  }

  const parsed = value.map((item) => parseString(item, fieldName));

  return Array.from(new Set(parsed));
}

function parseOptionalBoundedInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
) {
  if (value == null) {
    return null;
  }

  try {
    return parseInteger(value, fieldName, min, max);
  } catch {
    return null;
  }
}

function inferCurriculumPosition(...paths: Array<string | null>) {
  const joined = paths.filter(Boolean).join(" / ");

  if (!joined) {
    return {
      month: null,
      week: null,
      day: null,
    };
  }

  const monthMatch = joined.match(/month[\s_-]*(\d+)/i);
  const weekMatch = joined.match(/week[\s_-]*(\d+)/i);
  const dayMatch = joined.match(/day[\s_-]*(\d+)/i);

  return {
    month: monthMatch ? Number(monthMatch[1]) : null,
    week: weekMatch ? Number(weekMatch[1]) : null,
    day: dayMatch ? Number(dayMatch[1]) : null,
  };
}

function parseRepeatedTopicSignals(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  return parseInteger(value, "repeatedTopicSignals", 0, 20);
}

export function ensureDateParam(value: string | null) {
  if (!value || !isIsoDate(value)) {
    throw new Error("Query parameter 'date' must be provided in YYYY-MM-DD format.");
  }

  return value;
}

export function parseFeedbackPayload(value: unknown): FeedbackPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Feedback payload must be an object.");
  }

  const payload = value as Record<string, unknown>;
  const reportDate = parseString(payload.reportDate, "reportDate");

  if (!isIsoDate(reportDate)) {
    throw new Error("reportDate must use YYYY-MM-DD format.");
  }

  const lessonConfidence = parseString(payload.lessonConfidence, "lessonConfidence");
  const understandingStatus = parseString(
    payload.understandingStatus,
    "understandingStatus",
  );
  const triggerReason = parseString(payload.triggerReason, "triggerReason");
  const gapCategories = parseStringArray(payload.gapCategories, "gapCategories");
  const lessonPath = parseOptionalString(payload.lessonPath);
  const assignmentPath = parseOptionalString(payload.assignmentPath);
  const inferredPosition = inferCurriculumPosition(lessonPath, assignmentPath);

  if (!allowedLessonConfidence.has(lessonConfidence as LessonConfidence)) {
    throw new Error("lessonConfidence is invalid.");
  }

  if (!allowedStatuses.has(understandingStatus as UnderstandingStatus)) {
    throw new Error("understandingStatus is invalid.");
  }

  if (!allowedTriggers.has(triggerReason as TriggerReason)) {
    throw new Error("triggerReason is invalid.");
  }

  const parsedGapCategories = gapCategories.map((gap) => {
    if (!allowedGapCategories.has(gap as GapCategory)) {
      throw new Error(`gapCategories contains an unsupported value: ${gap}`);
    }

    return gap as GapCategory;
  });

  const month =
    parseOptionalBoundedInteger(payload.month, "month", 1, 12) ??
    inferredPosition.month;
  const week =
    parseOptionalBoundedInteger(payload.week, "week", 1, 5) ??
    inferredPosition.week;
  const day =
    parseOptionalBoundedInteger(payload.day, "day", 1, 7) ?? inferredPosition.day;

  if (month == null) {
    throw new Error("month is invalid and could not be inferred from the lesson path.");
  }

  if (week == null) {
    throw new Error("week is invalid and could not be inferred from the lesson path.");
  }

  if (day == null) {
    throw new Error("day is invalid and could not be inferred from the lesson path.");
  }

  return {
    studentId: parseString(payload.studentId, "studentId"),
    studentName: parseString(payload.studentName, "studentName"),
    reportDate,
    month,
    week,
    day,
    lessonPath,
    assignmentPath,
    lessonConfidence: lessonConfidence as LessonConfidence,
    understandingStatus: understandingStatus as UnderstandingStatus,
    progressScore: parseInteger(payload.progressScore, "progressScore", 0, 100),
    confidenceScore: parseInteger(payload.confidenceScore, "confidenceScore", 0, 100),
    gapCategories: parsedGapCategories,
    summary: parseString(payload.summary, "summary"),
    likelyCauses: parseStringArray(payload.likelyCauses, "likelyCauses"),
    recommendedTutorAction: parseString(
      payload.recommendedTutorAction,
      "recommendedTutorAction",
    ),
    repeatedTopicSignals: parseRepeatedTopicSignals(payload.repeatedTopicSignals),
    triggerReason: triggerReason as TriggerReason,
  };
}
