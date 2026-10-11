import { NextResponse } from "next/server";
import { getReportsByDate } from "@/lib/store";
import { buildDailySummary } from "@/lib/summary";
import { ensureDateParam } from "@/lib/types";
import { apiFailure, authorizeMentor, mentorHeaders } from '@/lib/mentor-api';

export async function GET(request: Request) {
  try {
    await authorizeMentor(request);
    const { searchParams } = new URL(request.url);
    const date = ensureDateParam(searchParams.get("date"));
    const batchId = searchParams.get("batch") || "batch-2";
    const reports = await getReportsByDate(date, batchId);
    const summary = buildDailySummary(reports, date);

    return NextResponse.json({
      ok: true,
      date,
      batchId,
      summary,
    }, { headers: mentorHeaders(request) });
  } catch (error) {
    return apiFailure(error, request);
  }
}
