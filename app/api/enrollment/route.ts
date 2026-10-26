import { NextResponse } from 'next/server';
import { verifyIngestToken } from '@/lib/auth';
import { EnrollmentError, enrollStudent, parseEnrollment } from '@/lib/student-enrollment';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!process.env.TELEMETRY_INGEST_TOKEN) return NextResponse.json({ ok: false, message: 'Configure authenticated ingestion before enrolling students.' }, { status: 503, headers });
  const auth = verifyIngestToken(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401, headers });
  try {
    const text = await request.text();
    if (text.length > 4096) throw new EnrollmentError('Enrollment request is too large.', 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new EnrollmentError('Enrollment must be valid JSON.', 400); }
    const result = await enrollStudent(parseEnrollment(body));
    return NextResponse.json({ ok: true, ...result }, { status: result.created ? 201 : 200, headers });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof EnrollmentError ? error.message : 'Enrollment could not be completed. Please retry.' }, { status: error instanceof EnrollmentError ? error.status : 503, headers });
  }
}
