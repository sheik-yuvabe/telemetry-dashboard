import { NextResponse } from "next/server";
import { verifyIngestToken } from "@/lib/auth";
import { createFeedbackReport } from "@/lib/store";
import { parseFeedbackPayload } from "@/lib/types";
import { validateReportEnrollment } from "@/lib/dashboard-data";
import { resolveReportProject } from '@/lib/report-project';

export async function GET(request: Request) {
  const auth = verifyIngestToken(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ ok: true, agentProjects: auth.mode === 'protected', protocolVersion: 2 }, { headers: { 'Cache-Control': 'no-store' } });
}

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
    if (payload.project && authResult.mode !== 'protected') throw new Error('Configure authenticated ingestion before registering projects.');
    await validateReportEnrollment(payload);
    payload.projectId = await resolveReportProject(payload);
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
