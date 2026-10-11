# Batch 2 mentor workspace

The redesigned workspace defaults to Batch 2. Views: Overview, Students, Projects, Token usage, Shared accounts, and Setup. Batch selection is part of the URL and database filters. Batch 1 reports are retained as Batch 1.

## Preview and live data

- Run `npm run dev` and visit `http://localhost:3000/?batch=batch-2&demo=1` for an explicitly labeled sample workspace. If Turbopack cannot access the filesystem on Windows, use `npm run dev -- --webpack`.
- Without Supabase configuration, the workspace uses clearly labeled sample data.
- With Supabase configured, the normal URL uses live data. Missing workspace tables show setup instructions, not fictional live records.
- Existing `GET /api/reports`, `GET /api/summary`, and student progress APIs accept `?batch=batch-2`. Their default is Batch 2. Historical clients should explicitly request `batch-1`.
- Older feedback payloads without `batchId` remain Batch 1 for compatibility. Batch 2 clients must send `batchId: "batch-2"` and an enrolled `studentId`.

## Database setup

1. Run `supabase/schema.sql` if the original schema does not exist.
2. Run `supabase/batch-2-migration.sql` in Supabase SQL Editor.
3. Add real shared accounts, enrollment records, and projects. No fictional Batch 2 records are inserted by the migration.

Example only — replace identifiers and names with the real roster:

```sql
insert into public.shared_accounts(id, name, capacity)
values ('account-01', 'Course account 01', 4);

insert into public.batch_students(batch_id, student_id, name, account_id)
values
  ('batch-2', 'student-001', 'Student One', 'account-01'),
  ('batch-2', 'student-002', 'Student Two', 'account-01');

insert into public.student_projects(id, batch_id, student_id, name, description, status, progress)
values ('project-001', 'batch-2', 'student-001', 'Project name', 'What the student is building', 'building', 20);
```

Manage enrollment, account assignments, and project milestones in Supabase for this version. The UI provides browsing/filtering, not an administration editor. Account capacities are 2 or 4; an over-capacity assignment is highlighted. Project progress is an explicit milestone percentage and is separate from a learning assessment's progress score.

## Shared accounts and student identities

An account is not a student. Use a unique student ID for every learner even if four learners sign into the same account. Every student device/workspace needs its own configured identity. Do not infer a person's identity from a shared provider account or divide shared totals equally.

The feedback helper now reads `student_id`, `student_name`, `batch_id`, and `project_id` from its config. It also accepts `--student-id`, `--student-name`, `--batch`, and `--project` overrides. Batch 2 requires an explicit student identity. Existing Batch 1 fallback identity behavior remains available for compatibility.

Use `docs/telemetry-config.batch-2.example.json` as the new config example. Keep the existing helper endpoint at `/api/feedback`; usage events use the separate API below.

## Token ingestion contract

`POST /api/usage` requires `Authorization: Bearer <TELEMETRY_INGEST_TOKEN>` and persistent Supabase storage. An example measured increment:

```json
{
  "eventId": "unique-provider-event-or-stable-local-event-id",
  "batchId": "batch-2",
  "studentId": "student-001",
  "projectId": "project-001",
  "accountId": "account-01",
  "sessionId": "session-001",
  "occurredAt": "2026-10-10T10:30:00+05:30",
  "inputTokens": 1500,
  "outputTokens": 400,
  "cachedInputTokens": 500,
  "source": "measured-session-log"
}
```

- This event totals **1,900 tokens**. Cached input is already part of input and must not be added again.
- Each event is a measured increment. Do not submit cumulative session snapshots repeatedly; a collector must calculate deltas first.
- Retry with the original `eventId` and payload. Identical retries do not add tokens again; conflicting reuse of an event ID is rejected.
- Unknown student usage uses `studentId: null` and `projectId: null`. It stays in the selected batch's account total and is not assigned to anyone.
- A known student can have `projectId: null`; those tokens count toward the student but no project.
- Batch attribution must be known. An account-wide total covering multiple batches cannot be assigned to one batch without supporting evidence.
- The API validates enrolled students, their current account assignment, and project ownership. Account reassignment history is not modeled yet; replay historical events before changing assignments or add temporal membership support.
- Counts are observations, not billing amounts or subscription quota estimates. There is no automatic provider collector or account reconciliation in this version.
- Dates and filters use Asia/Kolkata. Exports include event IDs, observation timestamps, attribution, and source.
- Missing usage displays **Not recorded**, not zero. Actual observed zero is supported.

## What is still required for real token reporting

Choose the available measurement source and implement/connect a collector that knows which student is active in each session. Account-level totals alone cannot establish individual usage. No personal Codex logs or account credentials were accessed to populate this redesign.

Provide the real Batch 2 roster, account assignments, project details, and usage source. Apply the migration and verify one real report and one usage event per student.

## Access boundary

The original app has no mentor sign-in. This redesign does not claim to solve that deployment issue or provide per-student ingestion credentials. Usage ingestion requires the existing server-side ingest token. Add mentor authentication and scoped credentials before exposing student records beyond the intended environment; see `LOGIC-REVIEW.md` items 34–36.

## Verification

Run `node tests/workspace.test.cjs` for batch isolation, token arithmetic, attribution validation, retry idempotency, and selected feedback/summary regressions. Run `npm run build -- --webpack` for the production build.
