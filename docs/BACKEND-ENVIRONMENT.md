# Backend environment variables

The Next.js backend makes all Supabase and Gemini requests. Flutter never needs a Supabase service-role key or Gemini key.

## Local development

Edit `.env.local` next to the backend's `package.json`, not inside `mobile/`:

```dotenv
GEMINI_API_KEY=your_key_from_google_ai_studio
GEMINI_MODEL=your_enabled_model_id
```

Use the exact model ID enabled for your Gemini project, without a URL or `models/` prefix. It must support structured output. Both variables are required by this app. Restart the Next.js backend after editing. `.env.local` is already ignored by Git.

## Vercel deployment

Open the **Next.js backend project → Settings → Environment Variables**, add `GEMINI_API_KEY` and `GEMINI_MODEL`, select Production and/or Preview as appropriate, and redeploy the backend. Editing local `.env.local` does not update an existing deployment. See [Vercel's instructions](https://vercel.com/docs/environment-variables/managing-environment-variables).

The deployed backend also needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `TELEMETRY_INGEST_TOKEN`. If Flutter web is hosted separately, add its exact origin to `MENTOR_ALLOWED_ORIGINS`.

Do not use `NEXT_PUBLIC_` for private keys or put them in Flutter assets/build defines. Keep keys on the server; see [Google's Gemini key guidance](https://ai.google.dev/gemini-api/docs/api-key).

## Supabase records versus migrations

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already configured locally. They let the backend access table records through the data API. Adding the new tables/functions requires running `supabase/pilot-setup.sql` in the existing project's SQL Editor, or configuring the optional PostgreSQL connection `SUPABASE_DB_URL` for `node tools/pilot-setup.cjs --apply`.

`SUPABASE_DB_URL` is only needed for that migration runner, not normal app operation. Running the SQL in Supabase avoids needing this extra credential locally.

## Mentor sign-in

Supabase Auth manages mentor accounts and sessions. The app connects automatically and remembers sign-in. **Account** shows your email, change-password form, and sign out. No workspace address or shared code is requested. See [mentor authentication](MENTOR-AUTH.md).

Gemini is configured on the backend. After migrations and Gemini variables are ready, sign in and use **Generate summary** in a student's history. Sample mode never calls Gemini.
