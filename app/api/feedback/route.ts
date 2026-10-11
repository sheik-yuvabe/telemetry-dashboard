import { NextResponse } from "next/server";
import { verifyIngestToken } from "@/lib/auth";
import { createFeedbackReport } from "@/lib/store";
import { parseFeedbackPayload } from "@/lib/types";
import { validateReportEnrollment } from "@/lib/dashboard-data";

export async function POST(request: Request) {
  try {
    const authResult = verifyIngestToken(request);

    if (!authResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: authResult.message,
        },
        { status: authResult.status },
      );
    }

    const body = await request.json();
    const payload = parseFeedbackPayload(body);
    await validateReportEnrollment(payload);
    const result = await createFeedbackReport(payload);

    return NextResponse.json(
      {
        ok: true,
        message: result.deduplicated
          ? "Telemetry report already existed. Returning the stored record."
          : "Telemetry report stored successfully.",
        mode: authResult.mode,
        deduplicated: result.deduplicated,
        report: result.report,
      },
      { status: result.deduplicated ? 200 : 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to store telemetry report.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 400 },
    );
  }
}
