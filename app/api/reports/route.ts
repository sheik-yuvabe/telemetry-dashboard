import { NextResponse } from "next/server";
import { getReportsByDate } from "@/lib/store";
import { ensureDateParam } from "@/lib/types";
import { apiFailure, authorizeMentor, mentorHeaders } from '@/lib/mentor-api';

export async function GET(request: Request) {
  try {
    await authorizeMentor(request);
    const { searchParams } = new URL(request.url);
    const date = ensureDateParam(searchParams.get("date"));
    const batchId = searchParams.get("batch") || "batch-2";
    const reports = await getReportsByDate(date, batchId);

    return NextResponse.json({
      ok: true,
      date,
      batchId,
      reports,
    }, { headers: mentorHeaders(request) });
  } catch (error) {
    return apiFailure(error, request);
  }
}
