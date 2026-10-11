import { NextResponse } from "next/server";
import { getReportsByDate } from "@/lib/store";
import { ensureDateParam } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = ensureDateParam(searchParams.get("date"));
    const batchId = searchParams.get("batch") || "batch-2";
    const reports = await getReportsByDate(date, batchId);

    return NextResponse.json({
      ok: true,
      date,
      batchId,
      reports,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load reports.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 400 },
    );
  }
}
