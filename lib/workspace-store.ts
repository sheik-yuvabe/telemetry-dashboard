import { demoWorkspace } from "./workspace-demo";
import { hasSupabaseConfig, supabaseFetch } from "./store";
import { Batch, Enrollment, SharedAccount, StudentProject, UsageEvent, WorkspaceData } from "./workspace-types";

type Row = Record<string, string | number | null>;
async function readRows(table: string, batchId?: string): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const query = new URLSearchParams({ select: "*", limit: "500", offset: String(offset), order: table === "usage_events" ? "event_id.asc" : table === "batch_students" ? "student_id.asc" : "id.asc" });
    if (batchId) query.set("batch_id", `eq.${batchId}`);
    const response = await supabaseFetch(`/rest/v1/${table}?${query}`);
    if (!response.ok) {
      if (response.status === 404) throw new Error("WORKSPACE_SCHEMA_MISSING");
      throw new Error("Could not load workspace data. Check the database connection.");
    }
    const rows = await response.json() as Row[];
    result.push(...rows);
    if (rows.length < 500) return result;
  }
}

export async function getWorkspace(batchId: string, demo = false): Promise<WorkspaceData> {
  if (demo || !hasSupabaseConfig()) return demoWorkspace();
  try {
    const [batchRows, studentRows, accountRows, projectRows, usageRows] = await Promise.all([
      readRows("batches"), readRows("batch_students", batchId), readRows("shared_accounts"), readRows("student_projects", batchId), readRows("usage_events", batchId),
    ]);
    return {
      batches: batchRows.map((r) => ({ id: r.id, name: r.name, status: r.status })) as Batch[],
      students: studentRows.map((r) => ({ batchId: r.batch_id, studentId: r.student_id, name: r.name, accountId: r.account_id })) as Enrollment[],
      accounts: accountRows.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity })) as SharedAccount[],
      projects: projectRows.map((r) => ({ id: r.id, batchId: r.batch_id, studentId: r.student_id, name: r.name, description: r.description, status: r.status, progress: r.progress, repositoryUrl: r.repository_url })) as StudentProject[],
      usage: usageRows.map((r) => ({ eventId: r.event_id, batchId: r.batch_id, studentId: r.student_id, projectId: r.project_id, accountId: r.account_id, sessionId: r.session_id, occurredAt: r.occurred_at, inputTokens: r.input_tokens, outputTokens: r.output_tokens, cachedInputTokens: r.cached_input_tokens, source: r.source })) as UsageEvent[],
      mode: "live", setupRequired: false,
    };
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "WORKSPACE_SCHEMA_MISSING") throw error;
    return { batches: [{ id: "batch-2", name: "Batch 2", status: "active" }, { id: "batch-1", name: "Batch 1", status: "archived" }], students: [], projects: [], accounts: [], usage: [], mode: "live", setupRequired: true };
  }
}

export async function insertUsage(event: UsageEvent) {
  if (!hasSupabaseConfig()) throw new Error("Usage ingestion requires persistent storage.");
  const workspace = await getWorkspace(event.batchId);
  if (workspace.setupRequired) throw new Error("Apply the Batch 2 database migration first.");
  if (!workspace.batches.some((batch) => batch.id === event.batchId)) throw new Error("Unknown batch.");
  if (!workspace.accounts.some((account) => account.id === event.accountId)) throw new Error("Unknown account.");
  if (!workspace.students.some((student) => student.accountId === event.accountId)) throw new Error("Account is not assigned to this batch.");
  if (event.studentId && !workspace.students.some((student) => student.studentId === event.studentId && student.accountId === event.accountId)) throw new Error("Student is not assigned to this account in this batch.");
  if (event.projectId && !workspace.projects.some((project) => project.id === event.projectId && project.studentId === event.studentId)) throw new Error("Project does not belong to this student in this batch.");
  const row = { event_id: event.eventId, batch_id: event.batchId, student_id: event.studentId, project_id: event.projectId, account_id: event.accountId, session_id: event.sessionId, occurred_at: event.occurredAt, input_tokens: event.inputTokens, output_tokens: event.outputTokens, cached_input_tokens: event.cachedInputTokens, source: event.source };
  const response = await supabaseFetch("/rest/v1/usage_events?on_conflict=batch_id,event_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(row) });
  if (!response.ok) throw new Error("Could not store usage. Check database constraints and availability.");
  const inserted = await response.json() as Row[];
  if (inserted.length) return { deduplicated: false };
  const query = new URLSearchParams({ select: "*", batch_id: `eq.${event.batchId}`, event_id: `eq.${event.eventId}` });
  const existingResponse = await supabaseFetch(`/rest/v1/usage_events?${query}`);
  if (!existingResponse.ok) throw new Error("Could not verify the existing usage event.");
  const [existing] = await existingResponse.json() as Row[];
  if (!existing || Object.entries(row).some(([key, value]) => key === "occurred_at" ? Date.parse(String(existing[key])) !== Date.parse(String(value)) : existing[key] !== value)) throw new Error("Event ID already exists with different usage. Retry with the original payload.");
  return { deduplicated: true };
}
