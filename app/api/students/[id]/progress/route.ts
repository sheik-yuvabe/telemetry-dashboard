import { NextResponse } from "next/server";
import { findLatestReportForStudent, getStudentProgress } from "@/lib/store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const progress = await getStudentProgress(id);
  const latestReport = await findLatestReportForStudent(id);

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
    student: {
      id: latestReport.studentId,
      name: latestReport.studentName,
    },
    latestReport,
    progress,
  });
}
