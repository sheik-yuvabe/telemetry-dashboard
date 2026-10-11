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

The deployed backend also needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEMETRY_INGEST_TOKEN`, and `MENTOR_READ_TOKEN`. If Flutter web is hosted separately, add its exact origin to `MENTOR_ALLOWED_ORIGINS`.

Do not use `NEXT_PUBLIC_` for private keys or put them in Flutter assets/build defines. Keep keys on the server; see [Google's Gemini key guidance](https://ai.google.dev/gemini-api/docs/api-key).

## Supabase records versus migrations

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already configured locally. They let the backend access table records through the data API. Adding the new tables/functions requires running `supabase/pilot-setup.sql` in the existing project's SQL Editor, or configuring the optional PostgreSQL connection `SUPABASE_DB_URL` for `node tools/pilot-setup.cjs --apply`.

`SUPABASE_DB_URL` is only needed for that migration runner, not normal app operation. Running the SQL in Supabase avoids needing this extra credential locally.

## Workspace page

The labelled **Workspace** action replaces the old gear popup. It explains sample versus live records, with the workspace address and mentor access code under **Advanced connection setup**. The code is the backend's `MENTOR_READ_TOKEN`, kept in memory for the app session. This remains a pilot connection mechanism, not individual mentor sign-in.

Gemini is configured only on the backend. After migrations and Gemini variables are ready, connect to live data and use **Generate summary** in a student's history. Sample mode never calls Gemini.
