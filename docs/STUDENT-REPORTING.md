# Student reporting with agent-managed projects

The mentor assigns the student ID, student name and batch. For a new project, the AI coding assistant matches the student's brief and work to the relevant syllabus phase file and uses its exact title when the match is clear. Ambiguous matches require student clarification. If a required syllabus file is missing, ask the mentor for it before making a syllabus-dependent naming decision. For an approved custom project, confirm its descriptive title with the student. Saved project identities are reused across sessions; a new lesson/checkpoint is not a new project. Instructions guide naming but do not constitute a server-validated syllabus catalog.

## Mentor setup, once per computer

1. Enroll the real student in Supabase `batch_students`, using a stable student ID and the selected batch. Shared-account assignment is optional for learning reports and required for attributed token events. Rename a learner in the enrollment record as well as their local config; the server uses the enrolled name for agent-project reports.
2. Copy `tools/telemetry.js` into `~/.codex/telemetry.js`. Back up the old helper/config first.
3. Use `docs/telemetry-config.batch-2.example.json` for `~/.codex/telemetry_config.json`. Set the real student identity and batch, preserve the private ingest token, and use the production endpoint. Set `project_mode` to `agent`. Remove any fixed `project_id`. `reporting_enabled: false` disables sending until setup is complete.
4. Copy `docs/AGENTS.ready.md` to `~/.codex/AGENTS.md`. This is the single maintained instruction template and includes both teaching and reporting rules. Keep the three referenced course phase files beside it (`FRONTEND_PHASE_WEEKS_1_4.md`, `BACKEND_PHASE_WEEKS_5_8.md`, and `FINAL_PROJECT_PHASE_WEEKS_9_12.md`). Preserve any unrelated custom instructions when installing. No separate reporting-agent file is used. These are instructions to invoke the helper, not a timer/background service.
5. Have the student complete a real checkpoint, then request its report. Check the student, batch, project title and report in the mentor dashboard. Do not submit synthetic scores as a real learner's assessment.

The existing database schema supports automatic project registration. No new migration is needed. Deploy the updated backend before using agent project reports. The helper checks authenticated backend support before sending and fails without submitting a report if an old deployment is still running.

## Multiple projects

On the first report for a project, the agent passes `--project-root` and `--project-title`. The helper saves a random project key and title in `.yuvabe-project.json` inside that project folder. The first successful report automatically registers the project for the enrolled student in Supabase.

Later reports reuse the saved key and title, even in a new assistant conversation or after a folder move. Preserve this file when moving/restoring the same project. A new project normally uses another folder. When deliberately starting a different project in the same folder, pass `--new-project` and its title; the prior identity is backed up locally and all earlier server records remain attached to the prior project. Retrying a failed upload reuses the saved identity; do not repeatedly pass `--new-project` during retries. Switching back to an earlier same-folder project requires restoring its saved manifest.

There is no 13/14-project limit. Matching titles do not merge separate projects; the stable key, student and batch determine identity. A report cannot overwrite another student's project. Existing registered titles and milestones are preserved on retries. Initial project status is `building` and milestone progress is `0`; learning-assessment scores do not set project completion. Automatic completion detection and automatic token collection are separate, unfinished features.

Example command structure (replace assessment values with observations from the actual session):

```powershell
node "$HOME/.codex/telemetry.js" --project-root "C:/Projects/recipe-planner" --project-title "Recipe Planner" --trigger manual --status partial --progress 40 --confidence 60 --month 1 --week 1 --day 2 --summary "Observed learning assessment" --action "Mentor next step" --dry-run
```

`--dry-run` prints the payload without sending or creating/changing the project manifest. Remove it only for an actual report. After the first real submission attempt, later commands need `--project-root` but can omit the title.
