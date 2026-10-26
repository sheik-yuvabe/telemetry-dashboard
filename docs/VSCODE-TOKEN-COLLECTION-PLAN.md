# VS Code student token collection

Updated: 2026-10-13. Students use the Codex extension in VS Code on separate computers.

## First checkpoint: source inspection completed

Read-only inspection found local Codex session JSONL records with `session_meta` and `event_msg` / `token_count` data. A primary VS Code session from the installed 0.160.0 runtime contained 21 numeric usage snapshots. In that sample, counters were non-negative, cumulative counters never decreased, cached input did not exceed input, and total tokens equalled input plus output. Reasoning output was already included in output.

This establishes a candidate source on this computer, not complete collection coverage or a stable public file-format contract. The inspected session is not being attributed to a student or uploaded. Other files showed resumed sessions sharing a session ID and separate guardian sessions; summing files would be unsafe.

Official [Codex app-server documentation](https://learn.chatgpt.com/docs/app-server) describes `thread/tokenUsage/updated` notifications. Those notifications apply to an attached client. Starting a separate app-server does not establish access to the existing VS Code client's stream. The local-file adapter below is a proposed integration based on observed files, not a documented extension API.

## Intended student workflow

The mentor enrolls each computer once with student ID, batch, and shared account assignment. The student then uses VS Code normally. A separate collector runs while the computer is on; sending usage must not depend on the student asking the agent for a report.

```text
Codex usage on the student's computer
  -> numeric counters + session identity + project mapping
  -> durable local queue
  -> authenticated /api/usage
  -> Supabase usage_events
  -> web and Flutter student/day/project totals
```

Keep learning assessments in the existing telemetry helper. An assessment and a token event have different triggers and must not be fabricated to test each other.

## Implementation checkpoints

1. Build a read-only adapter and dry-run command. Stream complete JSONL records and retain only usage numbers, timestamps and required identifiers. Ignore conversation contents. Validate known counter fields; flag unsupported schemas, truncated records and counter resets. Inspect an actual student VS Code session before claiming end-to-end compatibility.
2. Add explicit device enrollment and project/session attribution. Bind the device credential to its student and batch on the server. Resolve its shared account from mentor-managed enrollment. Only opt-in course project folders may be collected; mentor work in another folder must not be attributed to the configured student. Use the existing project manifest and server project identity, never the folder name or shared login. Unknown or ambiguous project mappings remain pending rather than being guessed.
3. Add a persistent queue and checkpoints. Derive increments from cumulative counters; repeated snapshots add nothing. Track session identity across resumed/overlapping files. Persist each immutable event with its original timestamp, student, batch, account and project before sending it. Keep the same event ID for retries. Recover safely after a crash, loss of connectivity or restart. A first observed cumulative total with unknown history is a baseline, not a new day's usage.
4. Resolve child-session accounting with a controlled test. Verify whether parent counters include guardian/child usage before combining them. Until verified, declare coverage partial; do not present a main-thread-only total as complete usage.
5. Add an explicit start date and project association history. Do not automatically import historical mentor sessions. When a project changes in a reused folder, freeze old event attribution and start a new association. If a manifest was created after usage occurred, do not silently assign all earlier usage to it.
6. Package one-time Windows setup with a visible enabled/disabled state, start/stop commands and a background startup mechanism. Avoid requiring students to run an upload command each day. Display last successful sync, pending events and errors so missing collection cannot look like zero usage.
7. Test one fresh student session through Supabase and both clients. Then test two students using the same account, retries, offline recovery, midnight in IST, resumed sessions and project switching. Release to the batch only after totals reconcile with the observed source counters.

## Counting and display rules

- Total = input + output. Cached input is displayed separately and not added again. Do not add reasoning output a second time.
- Count per-student events directly; never divide shared account usage by the number of students.
- Group by the original event timestamp in IST, not upload time. Course month/week/day are separate fields.
- Record unknown usage as not recorded or partial coverage, not zero.
- Subscription limits and billed cost are different metrics; token counts alone cannot determine them.

## Other audit fixes, separate from token collection

- Show readable project titles, assignment paths and repeated-topic counts in web/mobile report details.
- Keep assessed learning progress separate from project milestone completion. Add an explicit milestone update workflow before expecting the project percentage to change.
- Project descriptions and repository links need their own update workflow.
- Generate a Gemini student summary from available learning reports on mentor request. Keep its API usage separate from student Codex usage.

## Current status

Updated 2026-10-21: a Windows pilot collector, installer, persistent queue, duplicate protection, automatic project discovery and primary-session coverage notices are implemented. See [installation and live testing](../tools/usage-collector/README.md). Project folder lists are no longer required. Tests cover separate Desktop/course folders, nested directories and moves/renames. Batch 2 Account 1 was created and assigned to the existing Sheik Noorullah enrollment; the collector was installed and its scheduled run completed successfully. The backend connection check passed. Fresh student-to-Supabase usage delivery still requires real student activity; no fabricated usage was uploaded. Unidentified or ambiguous usage remains local for review. Per-device restricted authentication, complete child-session reconciliation and dashboard collector-health reporting remain future work; this pilot reports partial coverage.
