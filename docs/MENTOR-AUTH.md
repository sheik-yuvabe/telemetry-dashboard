# Mentor authentication

The website and Flutter app use the existing project's Supabase Auth. Open the app, sign in once with email and password, and return to the saved session. The production backend is `https://aipbc.vercel.app`; there is no workspace-address or shared-code form. **Account** provides password changes and sign out.

## Accounts and storage

- Supabase manages user identities, password hashes, refresh tokens, and sessions in its Auth schema. Do not create a custom plaintext-password table. See [Supabase Auth](https://supabase.com/docs/guides/auth) and [session lifecycle](https://supabase.com/docs/guides/auth/sessions).
- Authorization requires confirmed email and administrator-controlled `app_metadata.role = "mentor"`. User-editable metadata cannot grant access. Every live page/API validates the token against Supabase's user endpoint before reading student data.
- Next.js stores access/refresh tokens in HttpOnly, SameSite=Lax cookies, with Secure on HTTPS. The refresh cookie lasts up to 30 days and is renewed on refresh; Supabase session settings can end access sooner. Refresh after access expiry restores the requested page.
- Native Flutter stores session tokens using `flutter_secure_storage` (Android encrypted storage and iOS Keychain), and refreshes expired access automatically. Android backup is disabled. Passwords are never stored by the app. Flutter web uses the plugin's browser storage, which is not equivalent to HttpOnly cookies; the production Next.js website uses cookies.
- Live-data responses use no-store. Cross-origin writes are restricted; separately hosted Flutter web must be explicitly allowed in `MENTOR_ALLOWED_ORIGINS`. Samples remain public only through explicit demo routes and never contain live records.
- Mentors currently access all batches. Per-mentor batch restrictions, MFA, a complete activity audit, and self-service email password recovery are not included. Session logout revokes refresh capability; an already issued JWT may remain valid until expiry under Supabase's token lifecycle. Removing the mentor role is checked against the current user on subsequent API requests.

## Provision an approved mentor

Configure server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` locally. Then:

```powershell
node tools/mentor-account.cjs sheik@yuvabe.com
```

The tool creates a confirmed user with the mentor role, or grants that role to an existing user without resetting their password. New-user credentials are saved in Git-ignored `.env.mentor-login.local`; the password is never printed. Sign in and change it from **Account**, then remove this local provisioning file. The tool refuses to overwrite an existing file. When provisioning another new account, first finish using and remove the previous provisioning file.

The initial mentor `sheik@yuvabe.com` has been provisioned. No email was sent. Administrators can reset forgotten passwords through Supabase user administration. There is no public sign-up UI; users created by other paths still need the administrator-assigned role. Supabase dashboard signup settings can additionally disable public account creation.

No new SQL migration is required for this login implementation. Existing student/report migrations and records are unchanged. `MENTOR_READ_TOKEN` is no longer accepted or required. `TELEMETRY_INGEST_TOKEN` remains a separate collector credential. Gemini keys remain server-only in Vercel/local environment variables.

## Verification

Run `node tests/auth.test.cjs`, the other backend regression scripts, `npm run lint`, and `npm run build -- --webpack`. In `mobile/`, run `flutter analyze`, `flutter test`, and platform builds. Authentication tests cover cookie/native response separation, refresh, sign out, administrator roles, denied accounts, CSRF origins, password reauthentication, old-token rejection, and all legacy/new report API boundaries.

`node tools/check-mentor-login.cjs` runs a real local login/read/refresh/logout smoke test using the ignored initial credentials. Pass `https://aipbc.vercel.app` to test production. It reads the workspace and opens each enrolled student's history, printing only aggregate counts; it does not modify reports or call Gemini. After changing the initial password, use normal client sign-in rather than the provisioning-file smoke test.

Android and web can be tested from this Windows workspace. iOS still requires macOS/Xcode, signing, and a real-device verification; generated configuration is not proof of a working iOS build.

Verified locally on 2026-10-11: real Supabase sign-in, refresh and logout; anonymous dashboard redirect and denial at all six report APIs; authenticated Batch 1 with 12 students/142 reports and empty Batch 2; backend authentication/history/workspace regressions, ESLint and Next.js production build; Flutter analysis, 11 tests, Android debug APK and release web build. The unchanged migration integration suite requires its disposable PostgreSQL server, which was stopped during this auth run; its earlier results are in PILOT-VERIFICATION.md. Physical-device testing of this login update is pending reconnection of the Android phone.

Production verification on 2026-10-12 confirmed the authentication deployment, anonymous access rejection, real mentor login, both batch dashboards, session refresh, logout, and Flutter web preflight support. There is no sign-up screen or application sign-up endpoint; mentor provisioning remains administrator-only. Live history testing exposed legacy student IDs containing email addresses/spaces, now accepted without changing stored identities. Historical ID regression coverage and checks of every enrolled student's history have been added. Android device installation remains pending because no phone is connected.
