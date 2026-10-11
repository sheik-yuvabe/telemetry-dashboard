# Student history and optional Gemini summaries

Implemented 2026-10-11 in Flutter and the Next.js client. Original report history, a calculated overview, optional Gemini summary generation, saved results, stale detection, evidence links, and a mentor-reviewed marker are included. No real student reports have been sent to Gemini during development. The database migration and server settings below are still required for live use.

## Enable live history and summaries

1. Apply `supabase/batch-2-migration.sql` if the batch schema is not installed, then `supabase/student-summaries-migration.sql` in the Supabase SQL editor. The new migration creates summary storage, a per-student generation lease, and an index; it does not modify original reports.
2. Create an approved Supabase mentor account using [MENTOR-AUTH.md](MENTOR-AUTH.md). Set `GEMINI_API_KEY` and `GEMINI_MODEL` to enable generation, using a billing-enabled Gemini project and a model supporting structured output. See `.env.example`. Restart the backend after changing its environment.
3. In Flutter, sign in with your mentor email and password, then open a student and choose **Open full history**. Web profiles use `/students/{id}?batch={batchId}` and use the remembered mentor session. Never put the Gemini key in either client.
4. Use **Generate summary**, inspect the source reports, then optionally choose **Mark reviewed**. **Refresh summary** reuses an unchanged saved result; edits, additions, deletions, model changes, or prompt changes require regeneration.

Sample web profile: `/students/b2-1?batch=batch-2&demo=1`. Flutter's sample Aarav profile contains seven reports over six dates, including two reports on the final date. Sample mode never calls Gemini.

## Current behavior and limits

- GET `/api/students/{id}/history?batch=...` accepts `from`, `through`, `project`, `lesson`, `status`, and a returned `cursor`. It returns 20 original reports per page plus an overview. `report={reportId}` resolves an evidence link while still enforcing student/batch ownership.
- GET/POST `/api/students/{id}/summary?batch=...` reads/generates a summary with the same filters. POST with `action=review` marks a current saved summary reviewed without a provider call.
- Live reads/generation/review require a server-validated Supabase account with the administrator-assigned mentor role. Mentors currently access all batches; per-mentor batch permissions and a complete audit trail remain future work.
- Original reports are never overwritten. Date/project filters apply to usage; lesson/status filters apply only to learning reports because usage has no lesson/status attribution.
- The database reader uses keyset pagination and loads only this student's records for aggregation, with an explicit 20,000-row safety limit per source. Clients paginate the report display.
- Gemini receives pseudonymous report references, numeric lesson coordinates, project aliases, and relevant assessment text. Known student names, emails, and URLs are removed from text. This is data minimization, not a guarantee that all free-text personal information is detectable; review source content before enabling real-data processing.
- Generation splits at report boundaries into at most five 24,000-character chunks, then combines grounded chunk summaries. A report/history exceeding these bounds is rejected before provider calls, with a request to reduce the scope; nothing is silently truncated.
- Generation has a two-minute overall provider deadline, a 45-second per-call timeout, and a three-minute database lease. One student cannot start another generation within 60 seconds, even with different filters. Failed requests preserve the previous saved summary.
- API usage on successful summary runs includes intermediate chunks and is shown separately from student tokens. This is not a complete billing ledger for failed provider calls.
- Mobile filters collapse on narrow screens; full history is the default. Named student routes retain student/batch identity; sessions are restored automatically on reopening.
- Scheduled summaries, exports, editable mentor notes, and persistent intermediate chunk caching are deferred. Each required regeneration starts from original reports.

## Verification

Backend tests cover ownership, same-day records, filters, pagination, source edits/deletions, invalid citations, generation caching/locking, mentor review, and preserving saved results after provider failures. Provider/persistence tests use fakes and send no external requests. Flutter tests cover phone/desktop layouts, history navigation, filtering, report expansion, and source-report dialogs. The user has applied the migration to Supabase; live schema/count checks confirm the required tables. An actual Gemini response has not been validated with production credentials.

The design notes below retain the rationale and longer-term options.

## Design rationale

Before this change, the Flutter student sheet and web profile showed only the latest learning report in the selected period. The backend already stored multiple reports with student ID, batch, date, creation time, lesson, learning scores, gaps, summary, and suggested tutor action. The new full profile exposes that history.

The dedicated student page adds history navigation while retaining the quick sheet for a brief check-in. On phones, the full profile is a normal screen with a back button.

## Proposed student page

Always show the student name, selected batch, current projects, shared account, latest report date, and report coverage. Default to the selected batch's full recorded history; make date and project filters explicit. Do not silently inherit the dashboard's one-day filter when opening "All reports".

| View | Content |
| --- | --- |
| Overview | Latest learning status, report coverage, progress by comparable lesson/project, recurring difficulties, current projects, optional AI summary |
| Reports | Every original report, grouped by teaching date, with filters and expandable details |
| Projects | Each project, its status/milestones, and reports linked to it |
| Usage | Measured tokens by date/project and collection coverage; separate from learning assessment |

For the Reports view:

- Offer all time, last 7/30 days, and custom dates within the selected batch.
- Group by report date in the course timezone (Asia/Kolkata). Show creation time within each date so several sessions remain distinguishable.
- Each row shows lesson, linked project if recorded, reported understanding status, a short summary, and "Read report".
- The detail shows the original assessment, gaps, likely causes, confidence, tutor recommendation, and report ID.
- Keep multiple reports on the same day; a day header can use the latest assessment, with "3 reports" expanding the full sequence.
- Filter by project, lesson, and reported status. Reports without a project remain visible as "Project not recorded".
- Missing days mean no report was recorded, not absence or no learning. A scheduled teaching calendar is required before counting expected-but-missing days.
- Paginate the student timeline server-side using a stable sort and cursor; do not load every student's history to render one student.

## Useful summary without an AI request

Calculate reliable facts from the database first: number of reports, number of distinct report days, first/last recorded dates, latest assessed status, recorded gaps, project status, and measured token totals. Label learning scores as reported assessments, not verified measures of ability.

For daily trend calculations, take the latest report per teaching day and comparable lesson/project; a student producing more reports must not get more weight. Show earlier reports in the timeline. A change of lesson or project can change the meaning of a progress score, so do not present an overall first-to-last percentage as proven improvement. Project completion and learning confidence stay separate.

Token usage does not prove effort, understanding, independence, or attendance. Keep learner token usage separate from the administrative cost of generating a Gemini summary.

## Optional AI summary

Start with a mentor-triggered "Generate summary" action. Display a saved summary on subsequent visits, with its date range, report count, generation time, and evidence links. If reports have changed, show "New reports available" or "Source reports changed" with a refresh action. Do not make a paid request whenever a profile opens.

Recommended sections:

1. A short learning overview grounded in the supplied reports.
2. Demonstrated strengths with dated report references.
3. Recurring difficulties and whether later reports show resolution.
4. Progress over time, noting project/lesson changes and conflicting assessments.
5. Two or three suggested mentor actions, each linked to supporting reports.
6. Evidence limitations: sparse coverage, missing project attribution, or inconsistent reports.

An illustrative output, not a claim about a real learner: "The reports show clearer explanations of form handling in the second week. API error handling still appears as a difficulty in two later reports. Review one failed request together." Each factual clause should link to the actual report IDs used.

Label the result "AI-generated draft". Mentor notes and reviewed summaries should be recorded separately; generating or editing a summary must not overwrite original reports. Avoid permanent ability labels, personality judgments, or automatic grades.

## Proposed Gemini flow

1. The authenticated mentor selects the student, batch, date range, and optional project.
2. The backend verifies mentor access and selects the exact matching reports. Keep batch boundaries intact, even if student/account IDs appear in multiple cohorts.
3. Build a stable source snapshot with report IDs/content hashes and deterministic statistics. Remove names, email addresses, shared-account identifiers, credentials, and unrelated personal details from the model input.
4. Send the relevant structured report fields in chronological order to Gemini from the backend. Keep the API key in server configuration, never in Flutter or browser code. Treat report text as data, not instructions; no web-search/tool access is needed for this summary.
5. Request structured JSON with an overview and claim objects containing text plus source report IDs. Validate both the JSON and the cited IDs against this student's source snapshot. JSON structure alone does not guarantee that a conclusion is true; keep the original evidence visible.
6. Store the draft with its source hash, date range, model, prompt version, generation time, and administrative API usage. Return the stored result to Flutter/web.
7. Reuse a matching saved result. Queue or deduplicate simultaneous generation requests and apply request/token limits. A timeout or model refusal leaves the report history usable and preserves any previous successful summary with its original coverage.

Gemini supports JSON-schema structured output, which fits these defined sections and evidence references. See [Google's structured-output documentation](https://ai.google.dev/gemini-api/docs/structured-output). Model choice should remain configurable and be evaluated on representative, anonymized reports before a production choice.

For a short course history, send all relevant reports that fit the configured token budget. Do not silently truncate older evidence. For longer histories, summarize bounded chronological chunks with source IDs, then combine those summaries. Store the chunk boundaries and rebuild affected chunks when reports are corrected/deleted. Periodically regenerate from source reports to avoid repeatedly summarizing previous summaries and accumulating errors. Report the actual coverage.

## Storage and API sketch

Original API design sketch. The implementation combines the overview and timeline in the history endpoint; generation is synchronous with a database lease rather than a background job queue. The exact current routes are documented above:

- Student reports endpoint: batch + student + optional dates/project + cursor, returning original reports and pagination metadata.
- Student overview endpoint: deterministic statistics and source coverage.
- Generate-summary endpoint: mentor-only POST; returns a cached result or a queued generation job.
- Read-summary endpoint: saved result, generation status, stale state, and source references.
- Summary storage: batch ID, student ID, scope, source hash/report revisions, model, prompt version, structured output, generation status, generated time, mentor review state, and API usage.

Edits/deletions to source reports invalidate affected cached summaries. Do not cache only by report count or latest date: content can change while those values stay the same. Index history queries by batch, student, report date, creation time, and ID.

## Student data and provider configuration

Use a billing-enabled Gemini API project for real student reports and minimize identifying information. Google's terms state that unpaid-service inputs/outputs may be used to improve its products and reviewed by humans; paid-service prompts/responses are not used for product improvement, though limited abuse-monitoring retention remains. See [Gemini API data-use terms](https://ai.google.dev/gemini-api/terms). Use synthetic examples while configuring the integration.

The current shared mentor read token is a POC mechanism. Per-mentor authentication and batch-level authorization should gate production report access and summary generation.

## Recommended delivery order

1. Full student profile and original report timeline, with date/project filters.
2. Deterministic overall overview, comparable trends, and coverage indicators.
3. Optional on-demand Gemini draft with evidence links, caching, and mentor review.
4. Later, optional scheduled weekly summaries and exports if mentors find them useful.

Acceptance examples: two students on one account never share report histories; Batch 1 stays separate from Batch 2; three reports on one date remain accessible; an empty history cannot generate an assessment; corrected/deleted reports invalidate summaries; unknown report references are rejected; opening a saved summary does not call Gemini again.
