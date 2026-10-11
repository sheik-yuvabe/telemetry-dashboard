import { requireMentorPage } from '@/lib/mentor-page';
import { MentorAccount } from '@/components/mentor-account';
export const dynamic = 'force-dynamic';
export default async function Account() { const user = await requireMentorPage('/account'); return <MentorAccount email={user.email}/>; }
