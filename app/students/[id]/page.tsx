import { StudentHistory } from "@/components/student-history";
export default async function StudentProgressPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ batch?: string; date?: string; demo?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  return <StudentHistory studentId={id} batchId={query.batch || "batch-1"} demo={query.demo === "1"}/>;
}
