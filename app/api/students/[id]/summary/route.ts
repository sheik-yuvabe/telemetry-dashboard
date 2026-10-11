import { NextResponse } from "next/server";
import { apiFailure, authorizeMentor, historyScope, mentorHeaders, ApiError } from "@/lib/mentor-api";
import { studentContext } from "@/lib/student-history-store";
import { generateStudentSummary, reviewStudentSummary, summaryState } from "@/lib/student-summaries";
export const maxDuration = 180;
export async function OPTIONS(request: Request) { return new Response(null, { status: 204, headers: mentorHeaders(request) }); }
async function handle(request: Request, ctx: { params: Promise<{ id: string }> }, generate: boolean) {
  try {
    const demo = new URL(request.url).searchParams.get("demo") === "1";
    if (generate && demo) throw new ApiError("Sample mode does not generate AI summaries.");
    if (!demo) await authorizeMentor(request);
    const scope = historyScope(request, (await ctx.params).id), context = await studentContext(scope, demo);
    const review = new URL(request.url).searchParams.get("action") === "review";
    const result = generate ? review ? await reviewStudentSummary(context, scope) : await generateStudentSummary(context, scope) : await summaryState(context, scope);
    return NextResponse.json({ ok: true, ...result }, { headers: mentorHeaders(request) });
  } catch (error) { return apiFailure(error, request); }
}
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) { return handle(request, ctx, false); }
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) { return handle(request, ctx, true); }
