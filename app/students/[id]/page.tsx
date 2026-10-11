import { StudentHistory } from "@/components/student-history";
import { requireMentorPage } from '@/lib/mentor-page';
export default async function StudentProgressPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ batch?: string; date?: string; demo?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  if (query.demo !== '1') await requireMentorPage(`/students/${encodeURIComponent(id)}?batch=${encodeURIComponent(query.batch || 'batch-1')}`);
  return <StudentHistory studentId={id} batchId={query.batch || "batch-1"} demo={query.demo === "1"}/>;
}
