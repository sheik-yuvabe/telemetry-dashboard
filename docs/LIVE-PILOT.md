# Live pilot: Supabase, web, and Android

## Prepare and update the existing database

Run from the repository root:

```powershell
node tools/pilot-setup.cjs --prepare
```

This generates `supabase/pilot-setup.sql` from the two source migrations. It does not change Supabase or create credentials.

Choose one migration method:

- Open the existing project's Supabase SQL Editor and run **all** of `supabase/pilot-setup.sql`.
- Or add `SUPABASE_DB_URL` to local `.env.local`, then run `node tools/pilot-setup.cjs --apply`. Use the project's **Connect → Session pooler** PostgreSQL URI with the database password, not a service-role API key. Percent-encode special characters in URI credentials. Keep the credential out of chat and version control. See [Supabase PostgreSQL connection instructions](https://supabase.com/docs/guides/database/psql). The runner verifies the project matches `SUPABASE_URL` and requires TLS. Set `PSQL_PATH` if PostgreSQL is installed elsewhere.

The SQL applies both migrations in one transaction, briefly locks reports while checking them, retains all original report fields, attributes previously unscoped reports to Batch 1, and creates historical enrollment. Any preservation-check failure rolls back the transaction. It does not seed fictional Batch 2 students. An existing batch assignment is preserved when rerunning.

```powershell
node tools/pilot-setup.cjs --check
```

The check reads required columns and counts without printing student records or secrets. Exit code 2 means migration/schema setup is incomplete. It does not certify credentials, function permissions, or end-to-end ingestion beyond the checks printed.

## Enroll the pilot students

Use the real names, a distinct student ID for each computer, the shared-account label/capacity, and each student's project. See `BATCH-2-SETUP.md` for enrollment SQL and `docs/telemetry-config.batch-2.example.json` for the per-computer report configuration. Do not use the bundled sample roster as live enrollment.

## Website

Run the backend with `npm run dev -- --webpack`. The Flutter preview at `http://127.0.0.1:8080` can be served with:

```powershell
python -m http.server 8080 --bind 127.0.0.1 --directory mobile/build/web
```

Open `https://aipbc.vercel.app` or the installed app and sign in with your mentor account. Both use the same Supabase identity; see [MENTOR-AUTH.md](MENTOR-AUTH.md). To test a local backend with Flutter web, first rebuild with `flutter build web --release --dart-define=API_BASE_URL=http://127.0.0.1:3000`, then serve the build above. The normal build uses production automatically.

## Physical Android phone over USB

1. Enable Developer options and USB debugging on the phone, connect it by USB, and accept its computer authorization prompt.
2. Run the commands below from the repository root. `adb devices -l` must show exactly the intended phone as `device`, not `unauthorized`. With multiple devices, specify `-s SERIAL` for subsequent commands.

```powershell
$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adbPath devices -l
& $adbPath install -r mobile/build/app/outputs/flutter-apk/app-debug.apk
& $adbPath reverse tcp:3000 tcp:3000
```

3. Open the installed app. Sample mode can be tested immediately.
4. Normal builds connect directly to production. For a USB/local-backend test, build the APK with `--dart-define=API_BASE_URL=http://127.0.0.1:3000` before installation, keep the backend running and USB connected, then sign in. Recreate the reverse mapping after reconnecting. No address or token is entered in the app.
5. Test light/dark mode, each batch, student history, same-day reports, filters, projects, and usage. Compare the same student's records on web and phone.

For non-USB access use an HTTPS backend; the app does not allow arbitrary LAN HTTP URLs. Repeat installation and runtime checks for each target phone; [pilot verification](PILOT-VERIFICATION.md) records the device already tested. See [Android device connection and installation](https://developer.android.com/tools/adb).

## What counts as a successful live pilot

- Batch 1 retains its historical reports. Batch 2 contains only real pilot enrollment.
- Each student's computer submits a real report with its own student ID, Batch 2, and project ID. Both reports appear only under their owners, and all daily reports remain accessible.
- One measured usage event per student is attributed correctly. Retrying the same event does not add tokens again; shared-account totals equal attributed plus unattributed usage. Cached input is not added twice.
- Automatic token collection is a separate unfinished integration. The mentor app alone does not read desktop usage; do not label manually invented token counts as measured usage.
- Optional Gemini: configure server-only `GEMINI_API_KEY` and `GEMINI_MODEL`, generate one summary, inspect its cited reports, and verify reopening uses the saved result. Gemini credentials are not needed for report browsing.

Current readiness is reported by the check command, not by the presence of these instructions. Local setup does not update a deployed server's environment or publish a website.
