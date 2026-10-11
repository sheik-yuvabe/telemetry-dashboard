import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dashboardData } from "@/lib/dashboard-data";

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = (process.env.MENTOR_ALLOWED_ORIGINS || "http://localhost:8080,http://127.0.0.1:8080").split(",").map((item) => item.trim());
  return origin && allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, OPTIONS", Vary: "Origin" } : { Vary: "Origin" };
}
export async function OPTIONS(request: Request) { return new Response(null, { status: 204, headers: cors(request) }); }
export async function GET(request: Request) {
  const headers = { ...cors(request), "Cache-Control": "no-store" };
  const params = new URL(request.url).searchParams;
  const batchId = params.get("batch") || "batch-2";
  const demo = params.get("demo") === "1";
  if (!demo) {
    const expected = process.env.MENTOR_READ_TOKEN;
    if (!expected) return NextResponse.json({ ok: false, message: "Configure MENTOR_READ_TOKEN on the server for the mobile client." }, { status: 503, headers });
    const provided = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1] ?? "";
    const a = Buffer.from(expected), b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false, message: "Invalid mentor access token." }, { status: 401, headers });
  }
  try {
    const result = await dashboardData(batchId, demo);
    if (!demo && result.workspace.mode !== "live") return NextResponse.json({ ok: false, message: "Configure Supabase before connecting live data." }, { status: 503, headers });
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not load the workspace. Check the database migration and connection." }, { status: 503, headers });
  }
}
