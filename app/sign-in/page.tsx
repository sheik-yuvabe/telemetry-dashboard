import { MentorSignIn } from '@/components/mentor-sign-in';
export const dynamic = 'force-dynamic';
export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only known local destinations; never allow an external post-login redirect.
  const safe = next && /^\/(?:\?|$|students\/|account(?:\?|$))/.test(next) && !/[\\\r\n]/.test(next) ? next : '/';
  return <MentorSignIn next={safe}/>;
}
