import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { HistoryScope } from "./student-history";
import { ensureDateParam } from "./types";

export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function mentorHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = (process.env.MENTOR_ALLOWED_ORIGINS || "http://localhost:8080,http://127.0.0.1:8080").split(",").map(x => x.trim());
  return { "Cache-Control": "no-store", Vary: "Origin", ...(origin && allowed.includes(origin) ? {
    "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  } : {}) };
}
export function authorizeMentor(request: Request) {
  const expected = process.env.MENTOR_READ_TOKEN;
  if (!expected) throw new ApiError("Configure MENTOR_READ_TOKEN on the backend.", 503);
  const supplied = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1] ?? "";
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError("Enter a valid mentor access token.", 401);
}
export function historyScope(request: Request, studentId: string): HistoryScope {
  const p = new URL(request.url).searchParams;
  const id = (value: string) => { if (!/^[a-zA-Z0-9_-]{1,120}$/.test(value)) throw new ApiError("Invalid student, batch, or project identifier."); return value; };
  const date = (key: string) => { const v = p.get(key) || ""; if (v) { try { ensureDateParam(v); } catch { throw new ApiError("Use a valid date in YYYY-MM-DD format."); } } return v; };
  const scope = { batchId: id(p.get("batch") || "batch-2"), studentId: id(studentId), from: date("from"), through: date("through"), project: p.get("project") || "", lesson: p.get("lesson") || "", status: p.get("status") || "" };
  if (scope.project) id(scope.project);
  if (scope.from && scope.through && scope.from > scope.through) throw new ApiError("Start date must be before the end date.");
  if (scope.lesson.length > 500 || !["", "clear", "partial", "stuck"].includes(scope.status)) throw new ApiError("Invalid report filter.");
  return scope;
}
export function apiFailure(error: unknown, request: Request) {
  return NextResponse.json({ ok: false, message: error instanceof ApiError ? error.message : "Could not load student data. Check the database connection and migrations." }, { status: error instanceof ApiError ? error.status : 503, headers: mentorHeaders(request) });
}
