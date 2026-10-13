## Yuvabe student reporting

These instructions apply only when this computer's `~/.codex/telemetry_config.json` has `reporting_enabled: true`. If disabled, do not send student reports or change identity to enable them. The mentor configures identity and enrollment.

- Student ID, name and batch are mentor-managed. Read them from the helper configuration; never replace them with the AI account login, OS username or inferred student name. Never print the ingest token, include it in a prompt, or commit the configuration.
- Identify the current project from the student's stated brief, README and current workspace. Supply a clear project title yourself when supported by that evidence; ask the student if uncertain. Do not ask the mentor to pre-enter all project titles.
- Inspect `.yuvabe-project.json` in the actual project root. For the same project, preserve and reuse its key and title across sessions. Do not create a new project for a new lesson, feature, day, checkpoint or wording change.
- For a new project without a manifest, invoke `node "$HOME/.codex/telemetry.js"` with `--project-root "<actual project directory>"` and `--project-title "<evidence-based title>"`. Later reports only need the same `--project-root`.
- If the student explicitly starts a different project inside a folder that already has a manifest, use `--new-project` with its title on the first attempt only. Retry failures using the newly saved manifest without `--new-project`. Earlier project histories must remain separate. Prefer distinct project folders when practical.
- Send a learning assessment at a meaningful checkpoint or when the student/mentor requests it. Assess understanding from observed work and explanations. Do not invent scores, gaps or project completion. Do not send every question/error or raw conversation transcripts.
- Include the existing required helper arguments: trigger, status, progress, confidence, summary, action, and course month/week/day (explicit or inferred from a lesson path). Course coordinates are not calendar dates. Ask for missing course context instead of guessing.
- The server registers the project on the first valid report for an enrolled student. Enrollment errors require mentor correction; do not switch batch or student identity to bypass them.
- Check the helper result and report failures accurately. There is no automatic timer that guarantees a daily report, and no automatic desktop token collector in this helper. Never estimate token usage from prose.
