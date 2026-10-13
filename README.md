# Telemetry Mentor Dashboard

## Mentor sign-in

Both the website and Flutter app use Supabase Auth with remembered sessions. Live student data requires an administrator-approved mentor account. See [account setup and authentication](docs/MENTOR-AUTH.md).

## Batch 2 workspace

See [student reporting setup](docs/STUDENT-REPORTING.md) for mentor-assigned student identities and agent-named projects. One student can complete many separate projects without editing the device's student configuration each time.

The [student history and summary guide](docs/STUDENT-HISTORY-AND-SUMMARIES.md) covers the implemented report timeline, calculated overview, and optional saved Gemini summaries with source links and mentor review. Live use requires the summary migration and backend credentials described there.

The cross-platform [Flutter client](docs/FLUTTER-CLIENT.md) is in `mobile/`, with Android, iOS, and web projects. Both clients use the purple/yellow brand and light/dark/system themes. Read the [identity and token tracking design](docs/IDENTITY-AND-TOKEN-TRACKING.md) for per-student attribution on separate computers sharing an account.

Follow the [live pilot guide](docs/LIVE-PILOT.md) to prepare the combined database migration, check Supabase readiness, and connect the website and a physical Android phone over USB. See [pilot verification](docs/PILOT-VERIFICATION.md) for completed checks and remaining prerequisites.

The UI now separates batches and includes student projects, per-student token usage, and shared accounts with 2 or 4 seats. See [Batch 2 setup](docs/BATCH-2-SETUP.md) for the migration, roster setup, and measured usage ingestion contract. The [logic review](docs/LOGIC-REVIEW.md) preserves all 38 original findings.

Preview the labeled sample design at `/?batch=batch-2&demo=1`. Real usage requires an identified session data source; account totals are never divided among students.

This app is the first working version of the mentor dashboard for the AI-assisted programming course telemetry workflow.

It is designed around 4 API routes:

- `POST /api/feedback`
- `GET /api/reports?date=YYYY-MM-DD`
- `GET /api/summary?date=YYYY-MM-DD`
- `GET /api/students/:id/progress`

The app works in two modes:

- Demo mode: open `/?demo=1` for explicitly labelled sample telemetry.
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

Live access requires Supabase configuration and a mentor account. Use `/?demo=1` to preview sample data.
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
