# Batches, shared accounts, and individual token usage

Updated 2026-10-10. Confirmed operating setup: every student uses a separate computer; 2–4 students may share the same provider account.

Update 2026-10-21: a [Windows VS Code pilot collector](../tools/usage-collector/README.md) now implements local counter parsing, automatic project discovery, durable retry state and scheduled setup. Local tests pass and the test computer's scheduled run succeeded for Batch 2 Account 1; fresh student usage delivery remains to be tested. Its coverage is explicitly partial (primary sessions, with initial/ambiguous baselines excluded). The design below still describes the requirements for complete production collection, including scoped device credentials and child-session reconciliation.

## What a batch means

A batch is an explicit enrollment group, not a calculated token metric or an app version. Create a stable record such as `batch-2` with the display name `Batch 2`, then enroll students into it. A student's reports, projects, and usage carry that batch ID. Creating Batch 3 must not move old records out of Batch 2.

Keep these concepts independent:

| Concept | Example | Meaning |
| --- | --- | --- |
| Batch | `batch-2` | The teaching cohort |
| Curriculum version (future field) | `2026-v2` | Which revision of the course is taught |
| Application version | `1.0.0+1` | Which Flutter build is installed |
| Student | `student-001` | A learner, independent of provider login |
| Device enrollment (collector work) | `device-001` | The computer assigned to that learner |
| Shared account | `account-01` | The provider account used by several learners |
| Project | `project-001` | What the learner is working on |
| Session | provider thread/session ID | One attributed working session |

## Proposed collection flow

```text
Student's computer
  Enrolled identity: batch + student + device + shared account
  Active workspace: project
  Measured Codex usage events: session + input/output/cached input
           |
           v
  Local collector -> retry queue -> authenticated ingestion API
           |
           v
  Immutable usage events in Supabase
           |
           v
  Flutter / web dashboard: student, project, account, batch totals
```

On a separate computer, the configured student identity supplies attribution. Sharing a provider login does not require merging student IDs. If a student changes computers, enroll the replacement device to the same learner. If someone borrows another student's computer, the active identity must change before starting a new session. Never infer identity from a shared email address.

Batch and account membership must be recorded at the time of an event. For a production collector, bind a device credential to enrollment server-side rather than trusting arbitrary IDs posted with a shared ingest token. The current POC validates posted membership but does not yet issue those device credentials or model historical account assignments.

## Where actual counts come from

The mentor Flutter app displays usage; it does not measure desktop Codex sessions. The existing `telemetry.js` helper submits learning assessments, not token measurements. The model must not estimate its own usage in prose.

Official Codex non-interactive documentation shows `turn.completed` JSON events containing usage counts. The app-server documentation exposes `thread/tokenUsage/updated` notifications. These are suitable integration points when we control the Codex client/run. A separately started app-server is not automatically a listener for someone else's existing VS Code session.

For the existing VS Code workflow, first validate the installed extension's available session usage source on one enrolled student computer. A local session-log adapter may be possible, but its schema and coverage need verification; it is not implemented or assumed stable here. Collect numeric usage and identifiers only, not conversations or source code. If no reliable source exists, use a controlled Codex client/run with documented usage events or retain “Not recorded”.

Sources checked:

- [Codex non-interactive JSON usage events](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Codex app-server usage notifications](https://learn.chatgpt.com/docs/app-server)

## Calculation rules

For the current ingestion contract:

```text
event total = inputTokens + outputTokens
student total = sum of unique events for this batch + student + date range
project total = sum of unique events for this batch + project + date range
account total in a batch = attributed student events + unattributed events in that batch
batch total = sum of all unique events in the batch and date range
```

`cachedInputTokens` is a subset of input in our normalized contract and is displayed separately, never added twice. A collector must verify the source semantics, including reasoning-output fields, before mapping them into this contract. Token counts do not establish subscription quota remaining or exact billing cost.

Example: four students sharing Account 01 record 120,000, 80,000, 45,000, and 55,000 tokens. The recorded account total is 300,000. Each student's own number stays intact; the total is not divided by four. If another 10,000 tokens cannot be linked to a student, show 310,000 at account level and 10,000 as unattributed. An account total spanning multiple batches must not be assigned entirely to Batch 2.

## Avoid duplicate and missing usage

- Use a stable event ID across retries. The existing ingestion endpoint rejects conflicting reuse and does not count identical retries again.
- For cumulative provider counters, calculate the increment since the last accepted snapshot and persist the checkpoint. Do not repeatedly add the whole thread total.
- Count separate turns, concurrent threads, and child-agent sessions exactly once. Verify whether source counters already include child usage before combining them.
- Persist events locally before upload and retry when connectivity returns. This queue is collector work, not implemented by the display client.
- Keep historical batch/project attribution on the original event; project switches start a new mapping.
- Track last collector heartbeat and collection coverage. No observed event means “Not recorded”; it does not prove zero usage.

## Current delivery versus remaining work

Implemented: separate batch views, shared-account/student/project model, attributed token displays, cached-input handling, usage ingestion with duplicate protection, sample data, Flutter client, and read API.

Remaining before real automatic usage: enroll the real computers and students; validate the VS Code usage source; implement the source-specific desktop collector, local retry/checkpoint storage, and scoped device authentication; connect the live database and roster. The current sample token counts are not measurements from student accounts.

Start with two students on separate computers sharing one account. Record known sessions, retry one event, work offline briefly, and change one project. Confirm student totals remain separate and that their sum plus unattributed usage matches the recorded account total.
