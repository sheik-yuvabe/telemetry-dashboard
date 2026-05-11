import { NextResponse } from "next/server";
import { getReportsByDate } from "@/lib/store";
import { buildDailySummary } from "@/lib/summary";
import { ensureDateParam } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = ensureDateParam(searchParams.get("date"));
    const reports = await getReportsByDate(date);
    const summary = buildDailySummary(reports, date);

    return NextResponse.json({
      ok: true,
      date,
      summary,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build daily summary.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 400 },
    );
  }
}
