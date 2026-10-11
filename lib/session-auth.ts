export class AuthError extends Error {
  constructor(message: string, public status = 401) { super(message); }
}
export const ACCESS_COOKIE = 'yuvabe_access';
export const REFRESH_COOKIE = 'yuvabe_refresh';
export type MentorUser = { id: string; email: string };
type AuthUser = { id?: string; email?: string; email_confirmed_at?: string; app_metadata?: { role?: string }; banned_until?: string };
export type AuthSession = { access_token: string; refresh_token: string; expires_in: number; user: MentorUser };

export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const host = request.headers.get('host');
  return !origin || origin === url.origin || (host !== null && origin === `${url.protocol}//${host}`) ||
    (process.env.MENTOR_ALLOWED_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080').split(',').map(x => x.trim()).includes(origin);
}
export function checkOrigin(request: Request) {
  if (!allowedOrigin(request) || request.headers.get('sec-fetch-site') === 'cross-site' && !request.headers.get('origin')) {
    throw new AuthError('This origin is not allowed.', 403);
  }
}
export function cookieValue(request: Request, name: string) {
  const value = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1);
  try { return value ? decodeURIComponent(value) : ''; } catch { return ''; }
}
export function accessToken(request: Request) {
  return request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1] || cookieValue(request, ACCESS_COOKIE);
}
function config() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AuthError('Sign-in is not configured on the server.', 503);
  return { url: url.replace(/\/$/, ''), key };
}
export async function authFetch(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  try {
    return await fetch(`${url}/auth/v1${path}`, {
      ...init, headers: { apikey: key, 'Content-Type': 'application/json', ...init.headers },
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
  } catch { throw new AuthError('Sign-in service is temporarily unavailable. Try again.', 503); }
}
export function mentorUser(user: AuthUser): MentorUser {
  if (!user.id || !user.email || !user.email_confirmed_at || user.app_metadata?.role !== 'mentor' ||
      user.banned_until && Date.parse(user.banned_until) > Date.now()) {
    throw new AuthError('This account does not have mentor access. Contact your administrator.', 403);
  }
  return { id: user.id, email: user.email };
}
export async function verifyMentorToken(token: string): Promise<MentorUser> {
  if (!token || token.length > 16000) throw new AuthError('Please sign in to continue.');
  const response = await authFetch('/user', { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new AuthError(response.status >= 500 ? 'Sign-in service is temporarily unavailable.' : 'Your session has expired. Please sign in again.', response.status >= 500 ? 503 : 401);
  return mentorUser(await response.json()); // Server-validated user, never decoded JWT or user-editable metadata.
}
export async function requireMentor(request: Request) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) checkOrigin(request);
  return verifyMentorToken(accessToken(request));
}
export async function createSession(email: string, password: string): Promise<AuthSession> {
  return exchange('password', { email, password });
}
export async function refreshSession(refresh_token: string): Promise<AuthSession> {
  if (!refresh_token || refresh_token.length > 4096) throw new AuthError('Please sign in to continue.');
  return exchange('refresh_token', { refresh_token });
}
async function exchange(grant: string, payload: Record<string, string>): Promise<AuthSession> {
  const response = await authFetch(`/token?grant_type=${grant}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!response.ok) throw new AuthError(response.status === 429 ? 'Too many attempts. Please wait before trying again.' : response.status >= 500 ? 'Sign-in service is temporarily unavailable.' : grant === 'password' ? 'Email or password is incorrect, or the account is not confirmed.' : 'Your session has expired. Please sign in again.', response.status === 429 ? 429 : response.status >= 500 ? 503 : 401);
  const value = await response.json();
  const user = await verifyMentorToken(value.access_token);
  return { access_token: value.access_token, refresh_token: value.refresh_token, expires_in: value.expires_in, user };
}
export async function endSession(token: string) {
  if (!token) return;
  const r = await authFetch('/logout?scope=local', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok && ![401,403,404].includes(r.status)) throw new AuthError('Could not end the session. Please try again.', 503);
}
