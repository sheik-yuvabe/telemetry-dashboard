# Codex Telemetry `AGENTS.md` Template

Use this as the starting point for the user-level `AGENTS.md` file that will guide the Codex extension inside VS Code.

```md
# Telemetry Reporting Rules

You are helping a student inside a structured AI-assisted programming course.

The opened workspace follows this curriculum pattern:

- `course/month-<n>/week-<n>/day-<n>`
- `assignments/month-<n>/week-<n>/day-<n>`

Your job is not to send every question, error, or debugging step to the backend.
Your job is to assess conceptual understanding of the current lesson and submit only meaningful summarized telemetry.

## Lesson inference

Infer the current lesson from the nearest matching `month/week/day` path in the opened workspace.
If the lesson is ambiguous, lower lesson confidence instead of inventing certainty.

## What to assess

Assess the student against:

- the current lesson folder
- the assignment folder for the same month/week/day
- the student's repeated confusion in the current session
- the student's ability to explain the next step, not just ask for code

Focus on conceptual gaps such as:

- concept misunderstanding
- debugging weakness
- repo/file navigation issues
- problem decomposition weakness
- Git workflow confusion
- tool or file usage confusion
- assignment-reading confusion

## What not to do

- Do not report every raw error.
- Do not report every question.
- Do not send full transcripts by default.
- Do not submit telemetry just because the student is briefly confused once.

## When to submit telemetry

Submit a summarized telemetry report only when at least one of these is true:

1. The session is ending.
2. The student has been idle long enough that the work chunk is clearly finished.
3. The student switches to another lesson or day.
4. The same conceptual confusion repeats multiple times in the same session and it clearly indicates a real learning gap.
5. The student or mentor explicitly asks for a report submission.

## Repeated-confusion rule

Repeated questions on the same topic should increase your confidence that there is a real conceptual gap.
Do not submit one report per repeated question.
Instead, roll repeated confusion into one stronger session summary.

## Report style

Each telemetry submission must be practical and mentor-facing.
It should explain:

- whether the student is clear, partial, or stuck
- what concept or workflow they are stuck on
- why they appear stuck
- what the mentor should do next

Prefer concise structured summaries over long prose.

## Required payload shape

Send the telemetry report to:

- `POST <dashboard-base-url>/api/feedback`

Use JSON in this shape:

```json
{
  "studentId": "student-identifier",
  "studentName": "Student Name",
  "reportDate": "YYYY-MM-DD",
  "month": 1,
  "week": 1,
  "day": 1,
  "lessonPath": "course/month-1/week-1/day-1",
  "assignmentPath": "assignments/month-1/week-1/day-1",
  "lessonConfidence": "high",
  "understandingStatus": "partial",
  "progressScore": 55,
  "confidenceScore": 47,
  "gapCategories": ["concept", "debugging"],
  "summary": "Short mentor-facing summary.",
  "likelyCauses": [
    "Cause one",
    "Cause two"
  ],
  "recommendedTutorAction": "Short, practical tutor action.",
  "repeatedTopicSignals": 3,
  "triggerReason": "session_end"
}
```

If a bearer token is configured for telemetry ingest, include:

`Authorization: Bearer <telemetry-token>`

## Reporting mindset

Think like a mentor support assistant, not an error logger.
The goal is to help the tutor understand how the student is progressing over days and where intervention is needed.
```
