import { NextResponse } from "next/server";
import { verifyIngestToken } from "@/lib/auth";
import { insertUsage } from "@/lib/workspace-store";
import { parseUsageEvent } from "@/lib/workspace-types";

export async function POST(request: Request) {
  if (!process.env.TELEMETRY_INGEST_TOKEN) return NextResponse.json({ ok: false, message: "Configure an ingest token before accepting usage." }, { status: 503 });
  const auth = verifyIngestToken(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });
  try {
    const body = await request.text();
    if (body.length > 16000) return NextResponse.json({ ok: false, message: "Usage payload is too large." }, { status: 413 });
    const event = parseUsageEvent(JSON.parse(body));
    const result = await insertUsage(event);
    return NextResponse.json({ ok: true, ...result }, { status: result.deduplicated ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not accept usage." }, { status: 400 });
  }
}
