# Telemetry logic review and Batch 2 requirements

Reviewed: 2026-10-10. This records the source review, not a production audit. Items below are the original findings; completion must be verified separately.

## Dashboard accuracy

1. Count unique students, not reports. Define daily student aggregation while retaining report history.
2. Select the latest report by date, timestamp, and a deterministic tie-breaker.
3. Apply an intervention threshold instead of always flagging the top three reports.
4. Show insufficient evidence for empty days instead of teaching recommendations.
5. Require repeated evidence before describing a gap as recurring.
6. Maintain a roster to distinguish missing reports from healthy students.
7. Compare progress over meaningful intervals and comparable lessons; one observation is not a trend.
8. Preserve the selected historical date/report when opening student details.
9. Use an explicit primary gap and an actual update timestamp for report labels.

## Learning assessment

10. Define consistent progress and confidence scoring rubrics.
11. Separate assignment completion from independently demonstrated understanding.
12. Represent assessment uncertainty and insufficient evidence explicitly.
13. Allow successful sessions with empty gap and likely-cause arrays.
14. Calibrate risk scoring and expose the reasons for intervention.
15. Make cohort recommendations specific to affected lessons, prevalence, and tutor actions.
16. Track mentor interventions, resolution, and subsequent outcomes.

## Validation and consistency

17. Validate actual calendar dates before queries, display, or export filenames.
18. Revalidate inferred curriculum positions; do not silently substitute invalid explicit inputs.
19. Detect conflicting explicit curriculum values, lesson paths, and assignment paths.
20. Use consistent strict integer rules in the helper, API, and database.
21. Enforce repetition-count bounds even when the input is an array.
22. Bound text/array/payload sizes and align database constraints with API validation.
23. Use the course timezone for teaching dates; keep observation timestamps separately.

## Storage and submission reliability

24. Use stable event/session IDs for retries and define report revision semantics instead of relying only on content hashes.
25. Persist a retryable local queue with backoff for temporary submission failures.
26. Require expected HTTP success codes and response structures in the helper.
27. Distinguish successful server ingestion from failed local export logging.
28. Validate helper flags, protocols, and timeouts; support credential-free dry runs.
29. Encode student IDs in query strings and navigation URLs.
30. Paginate complete reads and obtain distinct teaching dates efficiently.
31. Make demo mode explicit; do not silently use temporary storage in a live deployment.
32. Distinguish validation, missing records, and service errors; use bounded network timeouts.
33. Implement reliable reporting triggers. Instructions alone do not implement idle/session monitoring, and repeated confusion lacks its own trigger enum.

## Access and identity

34. Authenticate mentor pages and read APIs; database RLS alone does not authorize server requests.
35. Require ingestion authentication for live storage.
36. Use stable enrolled student identities and individually scoped credentials, independent of machine usernames or shared accounts.
37. Scope records, summaries, URLs, and student histories by course/batch.
38. Add submission rate limits and reporting-frequency controls.

## Confirmed during the review

In-memory checks reproduced duplicate student counts, healthy students in priority lists, recommendations on empty days, invalid calendar dates accepted, out-of-range inferred months, repetition-array bounds bypass, rejection of gap-free reports, and silent rounding of fractional days. No live database or deployed behavior was tested during the review.

## Requested redesign: Batch 2

- Keep each batch separate throughout the UI and data queries. Default the new dashboard to Batch 2; preserve Batch 1 history without relabeling it.
- Show each student's current project, its status, and associated learning reports.
- Show measured input, output, cached-input, and total tokens for each student and project.
- Model shared accounts separately from students. One account can be assigned to two or four students.
- Attribute usage using explicit batch, student, project, account, session, and event IDs. Never divide an account total equally among students.
- Treat unavailable usage as unknown, not zero. Keep unattributed account usage visible separately.
- Keep sample records clearly labeled and separate from live data.
- Provider-specific token collection and actual Batch 2 enrollment/account/project details must be connected before the dashboard can claim real usage.

## Delivery boundary

The UI redesign and supporting batch/project/usage data model are separate from completing all 38 review items. Do not interpret this checklist as a claim that every issue has been fixed.

## Redesign implementation notes

- Added separate batch views, enrollment/project/account models, student detail panels, measured usage aggregation, date filters, and CSV usage export.
- Added the Batch 2 migration and usage ingestion endpoint. Migration application, real enrollment, and the provider-specific usage collector remain setup tasks; no live database was modified during implementation.
- Feedback now accepts batch/project attribution. The helper honors configured student identity and requires it for Batch 2.
- Fixed selected validation and summary findings: gap-free reports, calendar dates, strict integers, inferred bounds, repetition-array bounds, unique student daily summaries, latest-report ordering, empty-day recommendations, and filtering healthy students out of the priority list.
- Existing access-control, assessment-rubric, retry-queue, and other unaddressed findings remain open.
- Automated verification covers batch isolation (including shared IDs/accounts), token arithmetic, unknown usage, ownership validation, duplicate-event handling, and selected feedback/summary regressions. Sample routes were checked over HTTP. Browser visual and interaction verification could not run because no browser connection was available.
