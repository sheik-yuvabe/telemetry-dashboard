# Pilot verification — 2026-10-11

The following is the earlier pilot record. The shared-token flow and public website have been replaced by [Supabase mentor authentication](MENTOR-AUTH.md); this historical record does not describe current access requirements.

- Generated a local mentor token in ignored `.env.local`; confirmed the backend accepts it and rejects missing credentials.
- Prepared `supabase/pilot-setup.sql`, combining both schema migrations into one transaction with report-content and enrollment checks.
- Tested the actual SQL using an isolated PostgreSQL 18 instance with synthetic records. Passed original-field preservation, Batch 1 attribution, historical enrollment, no fictional Batch 2 roster, rerun preservation of existing Batch 2 assignments, RLS flags, restricted function grants, summary ownership/locking, save, and cooldown. The temporary server was stopped after testing.
- The user subsequently applied the combined SQL in Supabase. A live schema/count check confirmed all required tables/columns, 142 preserved reports, two batches, and 12 historical enrollment records. Accounts, projects, usage, and summaries are empty. Gemini key/model and the real Batch 2 roster remain outstanding; `SUPABASE_DB_URL` is no longer needed unless running a later migration from the CLI.
- Both local web previews return HTTP 200. Authenticated `/api/workspace?batch=batch-2` returns live mode with `setupRequired: true`.
- Installed the APK on the connected Android CPH2729 phone and cold-launched successfully. Verified dark sample dashboard, student navigation, seven-report/six-day history, two reports grouped on the same day, and expansion of the original assessment.
- Connected the phone to the backend through `adb reverse tcp:3000 tcp:3000` using the session-only mentor token. The app correctly displays **Live workspace**, zero Batch 2 enrollment, and the migration/roster setup message. Sample records are not mixed into live mode.
- Device screenshots: `artifacts/flutter/android-pilot-home.png`, `android-pilot-report.png`, and `android-pilot-live-setup.png`.
- The deployed backend address is `https://aipbc.vercel.app`. Before this update is pushed, it serves the old app and `/api/workspace` returns 404. Deploy the updated backend before testing the mobile API against that address. Automatic mobile connection and remembered mentor sign-in remain unfinished; the current app still uses a pilot connection form.
- These are setup and device smoke checks. Real student ingestion, live history after migration, automatic desktop token collection, Gemini calls, and iOS testing remain unfinished.

Use [LIVE-PILOT.md](LIVE-PILOT.md) for the remaining setup and testing steps.
