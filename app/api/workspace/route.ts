import { apiFailure, authorizeMentor, mentorHeaders } from '@/lib/mentor-api';
import { NextResponse } from "next/server";
import { dashboardData } from "@/lib/dashboard-data";

export async function OPTIONS(request: Request) { return new Response(null, { status: 204, headers: mentorHeaders(request) }); }
export async function GET(request: Request) {
  const headers = mentorHeaders(request);
  const params = new URL(request.url).searchParams;
  const batchId = params.get("batch") || "batch-2";
  const demo = params.get("demo") === "1";
  try {
    if (!demo) await authorizeMentor(request);
    const result = await dashboardData(batchId, demo);
    if (!demo && result.workspace.mode !== "live") return NextResponse.json({ ok: false, message: "Configure Supabase before connecting live data." }, { status: 503, headers });
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    return apiFailure(error, request);
  }
}
