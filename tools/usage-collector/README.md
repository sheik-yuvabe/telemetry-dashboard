# Student token collector (Windows pilot)

This Node.js program reads numeric token counters from primary Codex VS Code session files and sends measured increments to the existing `/api/usage` endpoint. It never uploads conversations, code, raw session records or the private ingestion credential as data.

**Coverage is partial.** This pilot excludes separate guardian/child sessions because parent/child accounting has not been reconciled. It also excludes each session's first observed counter as an unknown-history baseline and intervals crossing an uncertain project boundary. It is not a complete account total or a billing meter. Web and Flutter identify this source as partial coverage.

The source is an adapter for locally observed JSONL files, not a stable public Codex extension API. A format error stops that scan; a counter decrease blocks that session. Preserve state and investigate instead of clearing checkpoints to make the error disappear.

## Before installation

- Install Node.js 20 or later and the Codex VS Code extension under the student's Windows user.
- Keep the existing mentor-managed `.codex/telemetry_config.json`. Reporting must be enabled, identity must be correct and project mode must be `agent`.
- Set the student's name, ID and batch in `telemetry_config.json`; pass their shared-account ID to the installer. The installer automatically registers the student through authenticated `POST /api/enrollment`. Create the batch and shared account once before using them; their labels and IDs may differ. No manual student row is needed.
- No project folder list is required. The collector reads the working directory from each VS Code session, then finds the nearest `.yuvabe-project.json` in that directory or its parents. The backend verifies the resulting project belongs to the configured student and batch before accepting usage.
- Students can put projects on Desktop, inside a course folder, or elsewhere. A subdirectory such as `src` inherits the nearest project identity. A nested Git repository without its own identity is kept separate. A manifest in the Windows home, Desktop, Documents, Downloads or drive root is not used as an identity for all their children.
- Each actual project needs its own saved identity, created by the reporting helper during a genuine learning report. Do not create a fake assessment to test usage. Moving or renaming a project preserves its identity when the manifest moves with it.

This pilot reuses the existing private ingestion credential. Per-device restricted credentials and server-side enrollment binding are still required before a wider rollout. Do not place Supabase service keys or OpenAI credentials in collector configuration.

## Install once

Copy this whole `usage-collector` folder to the student computer, then run its `install.ps1` in PowerShell as that student's Windows user:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\install.ps1" -AccountId "<existing shared-account ID>"
```

First, the installer runs `enroll.js` using the private upload key and mentor-configured student details. The backend verifies the batch/account, creates the roster record if absent, and reuses an identical record on retry. It rejects conflicting names/accounts without changing the existing student. New enrollments require an active batch. Failed enrollment stops installation before changing local files or tasks. No student Auth login, project, report or token event is created by enrollment.

After enrollment succeeds, the installer copies `collector.js`, `enroll.js`, `run.ps1` and `launch-hidden.vbs` to `$HOME/.codex/usage-collector`, creates its private local `config.json`, checks a dry run, and registers `Yuvabe-Usage-Collector` in Windows Task Scheduler. It runs on sign-in and every minute while the user is signed in. The task uses the windowless `wscript.exe` host to launch PowerShell hidden from the outset; the runner also sets `CreateNoWindow` for Node. Launching PowerShell directly with only `-WindowStyle Hidden` could briefly flash a console before hiding it. It can run on battery. Students do not ask the AI to start it.

A fresh computer may not have `.codex/sessions` yet. The collector reports `waitingForSessions: true` and allows installation to finish. It checks again on the next scheduled run and starts reading when the folder appears. Dry runs do not create the folder or state. Permission errors and invalid paths still fail visibly.

### Why projects have an identity file

`.yuvabe-project.json` contains a stable project key and title, not credentials or student identity. It belongs in the actual project root, not `.codex`, not each source subfolder, and not a shared parent of unrelated projects. The existing telemetry helper creates it when the agent submits the first genuine learning report for that project. Students do not need to create it manually. Preserve it when moving/renaming the project so later reports and usage retain their identity. Before that file exists, unmatched usage stays local; it is not silently assigned to another project.

Use `-WhatIf` to preview installation without changes. Use `-NoStart` to install with the task disabled. Task registration depends on Windows policy; if it fails, the installer reports failure. No successful unattended installation is implied by copying files alone.

On this test computer the configured ID is `batch-2-account-1`, displayed as **Batch 2 Account 1**. Other computers must use their own mentor-assigned student identity in `telemetry_config.json`; do not copy this computer's identity or queue to another student.

For example, to install on another student machine assigned to the same shared account:

```powershell
.\install.ps1 -AccountId "batch-2-account-1"
```

New projects are discovered automatically, with no reinstall. Discovery starts a baseline when first observed; it does not import earlier history. Changing a manifest key in a reused folder holds the uncertain interval locally before counting the new project. Queued old events retain their original project.

Usage without an identified project is retained as numeric increments in the local state's `held` list, with its original session, timestamp and working directory. It is not uploaded. A later manifest alone does not prove which project earlier work belonged to, so held history requires review instead of automatic retrospective attribution. `--status` shows `heldForReview`. Legacy configurations with explicit `project_roots` still work; the new installer uses `discovery: "auto"`.

## Check and control it

```powershell
node "$HOME/.codex/usage-collector/collector.js" --status
node "$HOME/.codex/usage-collector/collector.js" --dry-run
Get-ScheduledTaskInfo -TaskName "Yuvabe-Usage-Collector"
Get-Content "$HOME/.codex/usage-collector/last-run.log"

# Stop future runs and any current run; queued data remains.
Disable-ScheduledTask -TaskName "Yuvabe-Usage-Collector"
Stop-ScheduledTask -TaskName "Yuvabe-Usage-Collector"

# Resume.
Enable-ScheduledTask -TaskName "Yuvabe-Usage-Collector"
Start-ScheduledTask -TaskName "Yuvabe-Usage-Collector"
```

For a visible foreground test, disable the scheduled task first, then run `node collector.js --watch`. Ctrl+C stops the foreground watcher. With no flags, the program collects/uploads once. `--config PATH` selects a private config for testing. `--dry-run` writes nothing and makes no network requests. Disabled reporting prevents both collection and pending uploads.

The local `state/state.json` stores offsets, numeric counters, project associations, pending events and sync status. Do not delete it to retry an upload or copy it to another student. An enrollment change stops collection to protect old attribution. Preserve the old queue and use a separate state directory for a different enrollment.

## Live test

1. Run installation and confirm `Enrollment created` or `Enrollment already correct`. Confirm the student appears in the dashboard with the correct shared account.
2. Install the collector, check its task status, and wait for the first baseline scan.
3. Open a project in VS Code and do a small real task. The reporting helper establishes its saved identity on a genuine learning report. Wait for a collector run to discover it, then complete two further interactions. The first observed counter and uncertain discovery interval are baselines; later increments are measured.
4. Wait for a scheduled run. `--status` should show `uploaded` increasing and a non-null `lastSuccess`, with `pending: 0` and no error. Inspect `last-run.log` if the task did not run.
5. Refresh the student's Usage tab on web/mobile. Select today's IST date and the correct batch/project. Compare input/output/cached counts with the recorded increments, not the session's entire cumulative total.
6. Run again with no new usage: the stored event count and token sum must stay unchanged. Then test offline recovery and two students sharing an account before a wider rollout.

Counters use input + output; cached input is a subset and reasoning output is not added twice. Events keep the original timestamp across retries. The backend deduplicates stable event IDs. HTTP errors remain queued; wrong account/project assignment needs mentor correction. Unidentified projects, CLI sessions and child sessions are not uploaded as student usage.

## Verification completed on 2026-10-21

- Automated collector tests with a local HTTP server: real request serialization, offline failure/retry, crash replay, duplicate prevention, resumed files, IST-midnight timestamp preservation, project isolation/switch, partial JSON, counter resets, lock and identity protection, and no chat/credential export.
- Existing workspace and student-history tests pass.
- Read-only adapter check parsed 134 snapshots from local VS Code logs without uploading or writing state.
- Automatic discovery tests pass for separate Desktop/course projects, nested directories, moved/renamed projects, repository boundaries and retention of unidentified usage.
- Installed on the test computer for Sheik Noorullah, Batch 2, with `batch-2-account-1`. Windows Task Scheduler completed a run with result 0. The installed file matches the tested source. The backend connectivity/credential check passed without creating an assessment.
- Fresh student-to-Supabase usage delivery remains to be verified with actual student activity after installation. No fabricated token events were sent to the live database.
- Windowless launcher verified on the test computer: exit code 0, successful collector log, and no new visible PowerShell/Node/console-host windows detected during the launch. The installer/package includes this fix.

## Enrollment update (2026-10-26)

Automatic enrollment uses existing tables; no SQL migration is needed. Deploy the updated backend before distributing this installer. Repeat and concurrent installations cannot duplicate `(batch_id, student_id)`, and conflicts never overwrite existing identity/account assignments. The installer stops if the upload key, batch or account is invalid. Account capacity remains the existing dashboard warning, not a transactional seat reservation.

No SQL migration is required for this pilot. The existing usage endpoint accepts its events. Dashboard coverage notices need the updated web/mobile builds.
