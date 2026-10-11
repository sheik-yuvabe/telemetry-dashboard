# Flutter mentor client

The app in `mobile/` targets Android, iOS, and web using the existing Next.js/Supabase backend. The original Next.js preview remains available and now uses the same purple/yellow brand and light/dark/system theme choices.

## Branding and themes

- Primary: `rgb(89, 42, 199)` / `#592AC7`.
- Secondary: CSS `lab(89.7033 -0.480294 84.4917)`; Flutter uses its rounded sRGB equivalent `#FFDF20`.
- Select Light, Dark, or System from the theme menu. The preference is stored locally. System mode follows the device appearance.
- The supplied multicolour Yuvabe Education logo is preserved in `public/yuvabe-education-logo.svg`. Flutter and platform icons are generated from that asset using `node tools/generate-brand-assets.mjs` at the repository root.

## Run

```powershell
cd mobile
flutter pub get
flutter run -d chrome
```

For a browser preview without opening Chrome automatically:

```powershell
flutter run -d web-server --web-hostname 127.0.0.1 --web-port 8080
```

For Android, start an emulator or connect a development device and use `flutter run`. Build an installable development APK with `flutter build apk --debug`. Build web output with `flutter build web --release`.

The iOS project is generated under `mobile/ios`. Building, signing, and device testing for iOS require macOS/Xcode; they cannot be completed by this Windows environment. See [Flutter platform setup](https://docs.flutter.dev/platform-integration).

## Included functionality

- Batch switching, with no combined batch totals.
- Responsive navigation: side navigation on wide screens, bottom navigation on phones.
- Overview, student search/status filters, project cards, per-student usage, and 2/4-seat shared accounts.
- Student profiles open as native scrollable sheets.
- **Open full history** opens a dedicated student screen with Overview, Reports, Projects, and Usage tabs. Reports can be filtered by dates, project, lesson, and reported status. Optional saved Gemini summaries include source-report links and a mentor-reviewed marker; see `STUDENT-HISTORY-AND-SUMMARIES.md` for backend setup.
- Date range filters, pull-to-refresh, and copy-to-clipboard CSV export.
- Explicit sample-data mode, missing-measurement states, loading/errors, and backend connection settings.

## Connect live data

1. Follow `BATCH-2-SETUP.md` to prepare the database and roster.
2. Set `MENTOR_READ_TOKEN` on the backend. This is a separate read credential; do not use the ingest token or Supabase service-role key in the app.
3. Configure `MENTOR_ALLOWED_ORIGINS` as a comma-separated list of Flutter web origins. Development defaults include `http://localhost:8080` and `http://127.0.0.1:8080`.
4. In the app, open **Workspace → Advanced connection setup**, enter the HTTPS backend URL as the workspace address and the mentor read token as the access code, then choose **Connect to live reports**. The token stays in memory for this app session and is not saved in preferences or compiled into the app.

Gemini keys are configured on the backend, not on this page. See [backend environment setup](BACKEND-ENVIRONMENT.md) for local and Vercel instructions.

The app calls `GET /api/workspace?batch=batch-2`. `?demo=1` is an unauthenticated sample endpoint; real data requires the read token and configured Supabase. A live connection failure does not silently switch to sample records.

Local web can use `http://127.0.0.1:3000`. An Android emulator reaches the host through `10.0.2.2`; use HTTPS for production/device deployments. Native builds have no browser CORS requirement. The generated release Android manifest includes Internet permission.

The read token is a POC access mechanism, not per-mentor sign-in. Full mentor accounts and scoped authorization are still part of the recorded logic review. The existing Next.js pages/read routes retain their prior access model.

## Verification commands

```powershell
flutter analyze
flutter test
flutter test --dart-define=CAPTURE_PREVIEWS=true
flutter build web --release
flutter build apk --debug
```

Optional preview captures are written to `artifacts/flutter/` in the parent repository. They use a locally available font for test rendering and are not device screenshots. Widget tests cover narrow/wide layouts, dark mode persistence, navigation, search, student profiles, and batch separation.

See `IDENTITY-AND-TOKEN-TRACKING.md` for the separate desktop collection architecture. Installing the mentor app does not automatically collect students' Codex usage.

## Local verification

Verified on Windows with Flutter 3.41.7 / Dart 3.11.5:

- Static analysis reports no issues; all six Flutter tests pass.
- Phone and desktop widget captures were inspected in light/dark themes.
- Release web output is in `mobile/build/web`; the development Android APK is in `mobile/build/app/outputs/flutter-apk/app-debug.apk`.
- Backend regression tests, ESLint, TypeScript checking, and the Next.js build pass.
- HTTP checks confirm isolated sample batches, allowed-origin CORS, and rejection of unconfigured live access.

An Android CPH2729 phone was tested on 2026-10-11: APK installation, cold launch, dark sample dashboard, student navigation, seven-report/six-day history, same-day report grouping, and original-report expansion passed. USB connection to the authenticated backend correctly showed the live database setup message. See [pilot verification](PILOT-VERIFICATION.md) and the [live pilot guide](LIVE-PILOT.md).

The iOS target has not been tested. The user has applied the live database migration, and schema/count checks confirm the new tables and preserved reports. No student desktop collector is connected. Automatic mobile connection and remembered mentor sign-in remain unfinished; the current connection page is a pilot setup mechanism.
