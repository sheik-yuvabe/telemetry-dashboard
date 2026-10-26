# Student machine: setup and test

Use the student's Windows login. Keep the internet connected.

## 1. Mentor setup

- Install Node.js 20+ and the Codex extension in VS Code.
- **No manual student entry in Supabase is needed.** The installer registers the student automatically. Batch 2 and Batch 2 Account 1 (`batch-2-account-1`) already exist. Other batches/accounts must be created once by the mentor before use.
- In `C:\Users\<student>\.codex`, keep these course files:
  ```text
  AGENTS.md
  FRONTEND_PHASE_WEEKS_1_4.md
  BACKEND_PHASE_WEEKS_5_8.md
  FINAL_PROJECT_PHASE_WEEKS_9_12.md
  telemetry.js
  telemetry_config.json
  ```
- In `telemetry_config.json`, set this student's own `student_id` and `student_name`, plus `batch_id: "batch-2"`, `project_mode: "agent"`, and `reporting_enabled: true`. Do not leave Sheik's ID/name on another student's computer, or their work will be recorded under Sheik.
- The `token` field is a secret upload key matching Vercel's `TELEMETRY_INGEST_TOKEN`. It lets the helper send data to our backend. The mentor sets it once; there is no extra token program to install. The current pilot uses the same upload key on enrolled computers. It is not a Gemini key, Supabase admin key, or student ID. Sheik's test computer already has it.
- Copy the common program/instruction files, but do not copy another student's collector `state` folder or publish the private config.

## 2. Copy the collector

Extract the latest **yuvabe-usage-collector.zip** into:

```text
C:\Users\<student>\.codex\usage-collector\
```

Check that `install.ps1`, `enroll.js`, `collector.js`, `run.ps1` and `launch-hidden.vbs` are directly inside that folder.

## 3. Install once

Open PowerShell and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\.codex\usage-collector\install.ps1" -AccountId "batch-2-account-1"
```

Expected: **Enrollment created** (or **Enrollment already correct**), then **Installed in...**, with no error. The student now appears in Batch 2 on the dashboard, even before their first report. Windows runs the collector silently every minute while the student is signed in. No daily command is needed.

If enrollment fails, stop and correct the error. Rerunning the installer does not duplicate the student or overwrite conflicting details. This creates a roster record, not a student login.

## 4. Do real project work

1. Open the actual project folder in VS Code. Projects can be anywhere.
2. Complete a small task with Codex, then ask it to review the work and send a learning report if enough evidence exists.
3. Confirm the report appears in the dashboard. The helper creates `.yuvabe-project.json` inside the project automatically; do not create it manually.
4. Wait one minute, complete **two more Codex interactions**, then wait another minute.

## 5. Check the result

Run in PowerShell:

```powershell
node "$HOME\.codex\usage-collector\collector.js" --status
```

Success: `uploaded` is above 0, `lastSuccess` has a time, `pending` is 0 and `lastError` is null.

Open **https://aipbc.vercel.app/**, sign in, then choose **Batch 2 → student → Usage**. Include today in the date filter. Confirm tokens appear for the correct project.

## If tokens do not appear

Read the latest error:

```powershell
Get-Content "$HOME\.codex\usage-collector\last-run.log"
```

Send the mentor the error and status output—not the private config. `heldForReview` means some usage could not be safely linked to a project; it was not uploaded. Do not delete state to retry.

**Pilot limit:** initial baselines and separate child-agent sessions are excluded. These are partial usage totals.
