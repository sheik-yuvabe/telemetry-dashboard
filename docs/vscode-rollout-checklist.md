# VS Code Rollout Checklist

Use this when moving from local dashboard development to the real student workflow.

## Dashboard side

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Fill `.env.local` with:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEMETRY_INGEST_TOKEN`
4. Run the dashboard locally and verify:
   - `GET /api/reports?date=...`
   - `GET /api/summary?date=...`
   - `GET /api/students/:id/progress`

## VS Code student side

1. Install the ChatGPT Codex extension.
2. Put the adapted `AGENTS.md` in:
   - `C:\Users\<student-user>\.codex\AGENTS.md`
3. Replace the deployed dashboard base URL in `docs/AGENTS.ready.md`.
4. Paste the telemetry ingest token into the final user-folder `AGENTS.md`.
5. Let student identity default from `USERNAME` or `USER` for v1.
6. Test one manual telemetry submission from a student workspace.

## First manual test

Use one student workspace and verify:

1. Codex can infer the correct `month/week/day`.
2. The report is submitted only after a meaningful work chunk.
3. The report uses the machine username as `studentId` and `studentName`.
4. The dashboard shows the report on the correct day.
5. The daily summary changes after the new report appears.

## What to review with the teaching team

- Are reports too noisy or too sparse?
- Are the gap categories actually useful to mentors?
- Is the tutor action specific enough to change tomorrow's teaching?
- Is repeated confusion being rolled into one report instead of many?
