import { DailySummary, GapCategory, TelemetryReport } from "./types";

const gapLabels: Record<GapCategory, string> = {
  concept: "Concept understanding",
  debugging: "Debugging process",
  "repo-navigation": "Repo navigation",
  "problem-decomposition": "Problem decomposition",
  "tool-usage": "Tool and file usage",
  "assignment-reading": "Assignment interpretation",
  "git-workflow": "Git workflow",
};

function round(value: number) {
  return Math.round(value);
}

export function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function resolveSelectedDate(
  requestedDate: string | undefined,
  availableDates: string[],
) {
  if (requestedDate && availableDates.includes(requestedDate)) {
    return requestedDate;
  }

  if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return requestedDate;
  }

  if (availableDates[0]) {
    return availableDates[0];
  }

  return new Date().toISOString().slice(0, 10);
}

export function getProgressDirectionLabel(delta: number) {
  if (delta >= 15) {
    return "Clear upward trend across recent days.";
  }

  if (delta > 0) {
    return "Gradual improvement, but still worth watching.";
  }

  if (delta === 0) {
    return "Stable, with no meaningful movement yet.";
  }

  return "Progress has slipped and needs mentor attention.";
}

export function buildDailySummary(
  reports: TelemetryReport[],
  reportDate: string,
): DailySummary {
  const latestByStudent = new Map<string, TelemetryReport>();
  for (const report of [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))) {
    const key = `${report.batchId ?? "batch-1"}:${report.studentId}`;
    if (!latestByStudent.has(key)) latestByStudent.set(key, report);
  }
  reports = [...latestByStudent.values()];
  const totalStudents = reports.length;
  const statusBreakdown = {
    clear: reports.filter((report) => report.understandingStatus === "clear").length,
    partial: reports.filter((report) => report.understandingStatus === "partial").length,
    stuck: reports.filter((report) => report.understandingStatus === "stuck").length,
  };

  const averageProgress =
    totalStudents === 0
      ? 0
      : round(
          reports.reduce((sum, report) => sum + report.progressScore, 0) / totalStudents,
        );

  const averageConfidence =
    totalStudents === 0
      ? 0
      : round(
          reports.reduce((sum, report) => sum + report.confidenceScore, 0) / totalStudents,
        );

  const gapCounts = new Map<GapCategory, number>();
  for (const report of reports) {
    for (const gap of report.gapCategories) {
      gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
    }
  }

  const topGaps = [...gapCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([gap, count]) => ({
      key: gap,
      label: gapLabels[gap],
      count,
    }));

  const priorityStudents = [...reports]
    .filter((report) => report.understandingStatus !== "clear" || report.progressScore < 40 || report.confidenceScore < 40)
    .sort((left, right) => {
      const leftRisk =
        (left.understandingStatus === "stuck"
          ? 40
          : left.understandingStatus === "partial"
            ? 20
            : 0) +
        (100 - left.progressScore) +
        (100 - left.confidenceScore) +
        left.repeatedTopicSignals * 4;
      const rightRisk =
        (right.understandingStatus === "stuck"
          ? 40
          : right.understandingStatus === "partial"
            ? 20
            : 0) +
        (100 - right.progressScore) +
        (100 - right.confidenceScore) +
        right.repeatedTopicSignals * 4;

      return rightRisk - leftRisk;
    })
    .slice(0, 3);

  const recommendedActions = totalStudents === 0 ? ["No reports are available for this day. There is not enough evidence to recommend a teaching change."] : [
    topGaps[0]
      ? `Open tomorrow with a short targeted clinic on ${topGaps[0].label.toLowerCase()}.`
      : "No recurring gap was detected today, so keep the current pacing.",
    statusBreakdown.stuck > 0
      ? `Schedule direct intervention for ${statusBreakdown.stuck} student${statusBreakdown.stuck === 1 ? "" : "s"} marked as stuck.`
      : "No students are currently flagged as stuck.",
    averageConfidence < 60
      ? "Add a guided walkthrough so students can explain the next step before they ask Codex to act."
      : "Confidence is holding up well enough to keep using the current project flow.",
  ];

  const narrative =
    totalStudents === 0
      ? "No telemetry reports have been submitted for this day yet."
      : `${statusBreakdown.stuck} student${statusBreakdown.stuck === 1 ? "" : "s"} are currently stuck, ${statusBreakdown.partial} are partially confident, and ${statusBreakdown.clear} look clear on the day’s lesson. Average progress is ${averageProgress}% with ${averageConfidence}% confidence, so the strongest tutor leverage is to address ${topGaps[0]?.label.toLowerCase() ?? "the main recurring gap"} before moving on.`;

  return {
    reportDate,
    totalStudents,
    averageProgress,
    averageConfidence,
    statusBreakdown,
    topGaps,
    priorityStudents,
    recommendedActions,
    narrative,
  };
}
