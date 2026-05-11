# Supabase Setup

This project can run in demo mode without Supabase, but real telemetry needs a live Supabase project.

## 1. Create the project

1. Create a new Supabase project.
2. Open the SQL editor.
3. Run the SQL from `supabase/schema.sql`.

## 2. Find the environment values

In Supabase project settings, collect:

- Project URL
- Service role key

Then place them in `.env.local`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TELEMETRY_INGEST_TOKEN=your_random_shared_secret
```

## 3. Why service role is used here

This app currently uses server-side REST calls from Next.js to Supabase.
That means the service role key stays on the server and is never exposed to the browser.

## 4. Recommendation for the telemetry client

Do not give the VS Code telemetry client direct Supabase credentials.
Send reports to your own `POST /api/feedback` endpoint instead.

Use:

- `Authorization: Bearer <TELEMETRY_INGEST_TOKEN>`

That keeps the extension flow simpler and avoids exposing your database credentials.

## 5. Suggested next hardening step

For the next iteration, add:

- mentor authentication for dashboard access
- per-student or per-course ingest tokens
- audit fields such as source client version
