import { NextResponse } from "next/server";
import { apiFailure, authorizeMentor, historyScope, mentorHeaders } from "@/lib/mentor-api";
import { historyPage, studentContext } from "@/lib/student-history-store";
export async function OPTIONS(request: Request) { return new Response(null, { status: 204, headers: mentorHeaders(request) }); }
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const p = new URL(request.url).searchParams, demo = p.get("demo") === "1";
    if (!demo) authorizeMentor(request);
    const scope = historyScope(request, (await ctx.params).id);
    const context = await studentContext(scope, demo);
    return NextResponse.json({ ok: true, ...historyPage(context, scope, p.get("cursor"), p.get("report")) }, { headers: mentorHeaders(request) });
  } catch (error) { return apiFailure(error, request); }
}
