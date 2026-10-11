import { NextResponse } from "next/server";
import { findLatestReportForStudent, getStudentProgress } from "@/lib/store";
import { apiFailure, authorizeMentor, mentorHeaders } from '@/lib/mentor-api';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
  await authorizeMentor(request);
  const { id } = await context.params;
  const batchId = new URL(request.url).searchParams.get("batch") || "batch-2";
  const progress = await getStudentProgress(id, batchId);
  const latestReport = await findLatestReportForStudent(id, batchId);

  if (!latestReport) {
    return NextResponse.json(
      {
        ok: false,
        message: "Student not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    batchId,
    student: {
      id: latestReport.studentId,
      name: latestReport.studentName,
    },
    latestReport,
    progress,
  }, { headers: mentorHeaders(request) });
  } catch (error) { return apiFailure(error, request); }
}
