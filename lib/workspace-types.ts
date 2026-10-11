export type Batch = { id: string; name: string; status: "active" | "archived" };
export type Enrollment = { batchId: string; studentId: string; name: string; accountId: string | null };
export type SharedAccount = { id: string; name: string; capacity: 2 | 4 };
export type StudentProject = {
  id: string; batchId: string; studentId: string; name: string;
  description: string; status: "planning" | "building" | "review" | "shipped";
  progress: number; repositoryUrl: string | null;
};
// Each record is one measured increment, never a cumulative session snapshot.
// Cached input is a subset of input tokens, so it is not added to total again.
export type UsageEvent = {
  eventId: string; batchId: string; studentId: string | null; projectId: string | null;
  accountId: string; sessionId: string; occurredAt: string;
  inputTokens: number; outputTokens: number; cachedInputTokens: number;
  source: string;
};
export type WorkspaceData = {
  batches: Batch[]; students: Enrollment[]; accounts: SharedAccount[];
  projects: StudentProject[]; usage: UsageEvent[];
  mode: "demo" | "live"; setupRequired: boolean;
};

export function usageTotal(events: UsageEvent[]) {
  return events.reduce((total, event) => total + event.inputTokens + event.outputTokens, 0);
}

export function parseUsageEvent(value: unknown): UsageEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Usage must be an object.");
  const row = value as Record<string, unknown>;
  const string = (key: string) => {
    if (typeof row[key] !== "string" || !(row[key] as string).trim() || (row[key] as string).length > 200) throw new Error(`${key} is required (maximum 200 characters).`);
    return (row[key] as string).trim();
  };
  const count = (key: string) => {
    const v = row[key];
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > 1_000_000_000) throw new Error(`${key} must be a non-negative integer, at most one billion.`);
    return v;
  };
  const occurredAt = string("occurredAt");
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt))) throw new Error("occurredAt must be an ISO timestamp with timezone.");
  const inputTokens = count("inputTokens");
  const cachedInputTokens = count("cachedInputTokens");
  if (cachedInputTokens > inputTokens) throw new Error("Cached input cannot exceed input tokens.");
  const studentId = row.studentId == null ? null : string("studentId");
  const projectId = row.projectId == null ? null : string("projectId");
  if (projectId && !studentId) throw new Error("Project attribution requires a student.");
  return { eventId: string("eventId"), batchId: string("batchId"), studentId, projectId,
    accountId: string("accountId"), sessionId: string("sessionId"), occurredAt: new Date(occurredAt).toISOString(),
    inputTokens, outputTokens: count("outputTokens"), cachedInputTokens, source: string("source") };
}

export function scopeWorkspace(data: WorkspaceData, batchId: string): WorkspaceData {
  const students = data.students.filter((student) => student.batchId === batchId);
  const usage = data.usage.filter((event) => event.batchId === batchId);
  const accountIds = new Set([...students.map((student) => student.accountId), ...usage.map((event) => event.accountId)]);
  return { ...data, students, usage, projects: data.projects.filter((project) => project.batchId === batchId), accounts: data.accounts.filter((account) => accountIds.has(account.id)) };
}
