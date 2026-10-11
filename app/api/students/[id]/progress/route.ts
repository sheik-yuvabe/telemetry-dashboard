import { NextResponse } from "next/server";
import { findLatestReportForStudent, getStudentProgress } from "@/lib/store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
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
  });
}
