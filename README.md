# Telemetry Mentor Dashboard

This app is the first working version of the mentor dashboard for the AI-assisted programming course telemetry workflow.

It is designed around 4 API routes:

- `POST /api/feedback`
- `GET /api/reports?date=YYYY-MM-DD`
- `GET /api/summary?date=YYYY-MM-DD`
- `GET /api/students/:id/progress`

The app works in two modes:

- Demo mode: seeded sample telemetry is used when Supabase environment variables are missing.
- Live mode: API routes read and write summarized telemetry reports in Supabase.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres through server-side REST calls
- Deterministic daily summary logic

## Local setup

1. Install dependencies if they are not already present:

```bash
npm install
```

2. Copy `.env.example` to `.env.local`.

3. If you want live data, create a Supabase project and run the SQL in `supabase/schema.sql`.

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Environment variables

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEMETRY_INGEST_TOKEN=
```

If these values are missing, the app falls back to demo data.
If `TELEMETRY_INGEST_TOKEN` is set, `POST /api/feedback` requires `Authorization: Bearer <token>`.

## Feedback payload

`POST /api/feedback`

```json
{
  "studentId": "noor",
  "studentName": "Noor",
  "reportDate": "2026-03-18",
  "month": 1,
  "week": 2,
  "day": 4,
  "lessonPath": "course/month-1/week-2/day-4",
  "assignmentPath": "assignments/month-1/week-2/day-4",
  "lessonConfidence": "high",
  "understandingStatus": "partial",
  "progressScore": 61,
  "confidenceScore": 55,
  "gapCategories": ["concept", "debugging"],
  "summary": "The student understands the setup but still struggles to explain the concept behind the failing output.",
  "likelyCauses": [
    "Repeated confusion around the same concept during the current lesson.",
    "Debugging steps are still reactive instead of systematic."
  ],
  "recommendedTutorAction": "Run a short concept recap and then a guided debugging walkthrough.",
  "repeatedTopicSignals": 3,
  "triggerReason": "session_end"
}
```

## Notes

- The current summary route is deterministic so the app does not depend on paid model APIs.
- A future Hugging Face summarizer can be added behind the same summary abstraction if you want AI-generated cohort summaries later.
- The current app assumes the Codex agent decides when a report is important enough to submit, instead of sending every individual student doubt.
- For production, set `TELEMETRY_INGEST_TOKEN` so only approved telemetry clients can submit feedback reports.
