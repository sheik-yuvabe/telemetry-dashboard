import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, AuthError, AuthSession, accessToken, authFetch, checkOrigin, cookieValue, createSession, endSession, refreshSession, requireMentor, verifyMentorToken } from '@/lib/session-auth';
import { mentorHeaders } from '@/lib/mentor-api';

export const dynamic = 'force-dynamic';
export async function OPTIONS(request: Request) { return new Response(null, { status: 204, headers: mentorHeaders(request) }); }
function setSession(response: NextResponse, request: Request, session?: AuthSession) {
  const secure = new URL(request.url).protocol === 'https:';
  const options = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  response.cookies.set(ACCESS_COOKIE, session?.access_token || '', { ...options, maxAge: session ? session.expires_in : 0 });
  response.cookies.set(REFRESH_COOKIE, session?.refresh_token || '', { ...options, maxAge: session ? 60 * 60 * 24 * 30 : 0 });
}
function sessionResponse(request: Request, session: AuthSession) {
  // Flutter stores its own session; the Next.js browser receives only HttpOnly cookies.
  const mobile = request.headers.get('x-mentor-client') === 'flutter';
  const response = NextResponse.json({ ok: true, user: session.user, ...(mobile ? { session } : {}) }, { headers: mentorHeaders(request) });
  if (!mobile) setSession(response, request, session);
  return response;
}
export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const action = (await ctx.params).action;
  try {
    checkOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AuthError('Use JSON for authentication requests.', 415);
    const raw = await request.text();
    if (raw.length > 12000) throw new AuthError('Request is too large.', 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw || '{}'); } catch { throw new AuthError('Invalid request.', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AuthError('Invalid request.', 400);
    if (action === 'sign-in') {
      if (typeof body.email !== 'string' || body.email.length > 254 || typeof body.password !== 'string' || body.password.length > 1024 || !body.password) throw new AuthError('Enter your email and password.', 400);
      return sessionResponse(request, await createSession(body.email.trim().toLowerCase(), body.password));
    }
    if (action === 'refresh') {
      const refresh = request.headers.get('x-mentor-client') === 'flutter' ? body.refresh_token : cookieValue(request, REFRESH_COOKIE);
      return sessionResponse(request, await refreshSession(typeof refresh === 'string' ? refresh : ''));
    }
    if (action === 'sign-out') {
      await endSession(accessToken(request));
      const response = NextResponse.json({ ok: true }, { headers: mentorHeaders(request) });
      setSession(response, request);
      return response;
    }
    if (action === 'password') {
      const user = await requireMentor(request);
      if (typeof body.currentPassword !== 'string' || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 1024) throw new AuthError('Use at least 12 characters for your new password.', 400);
      // Reauthenticate before changing a credential, rather than trusting a long-lived session alone.
      const verified = await createSession(user.email, body.currentPassword).catch(error => {
        if (error instanceof AuthError && error.status === 401) throw new AuthError('Your current password is incorrect.', 400);
        throw error;
      });
      try {
        if (verified.user.id !== user.id) throw new AuthError('Account mismatch.', 403);
        const changed = await authFetch('/user', { method: 'PUT', headers: { Authorization: `Bearer ${accessToken(request)}` }, body: JSON.stringify({ password: body.password }) });
        if (!changed.ok) throw new AuthError('Password could not be updated. Use a different strong password and try again.', 400);
      } finally { await endSession(verified.access_token).catch(() => {}); }
      return NextResponse.json({ ok: true }, { headers: mentorHeaders(request) });
    }
    throw new AuthError('Not found.', 404);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 503;
    const response = NextResponse.json({ ok: false, message: error instanceof AuthError ? error.message : 'Authentication is temporarily unavailable.' }, { status, headers: mentorHeaders(request) });
    if (action === 'refresh' && [401,403].includes(status)) setSession(response, request);
    return response;
  }
}
export async function GET(request: Request, ctx: { params: Promise<{ action: string }> }) {
  try {
    if ((await ctx.params).action !== 'session') throw new AuthError('Not found.', 404);
    const user = await verifyMentorToken(accessToken(request));
    return NextResponse.json({ ok: true, user }, { headers: mentorHeaders(request) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof AuthError ? error.message : 'Authentication is temporarily unavailable.' }, { status: error instanceof AuthError ? error.status : 503, headers: mentorHeaders(request) });
  }
}
