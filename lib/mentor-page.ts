import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE, AuthError, verifyMentorToken } from './session-auth';

export async function requireMentorPage(next = '/') {
  try { return await verifyMentorToken((await cookies()).get(ACCESS_COOKIE)?.value || ''); }
  catch (error) {
    if (error instanceof AuthError && [401, 403].includes(error.status)) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
    throw error;
  }
}
