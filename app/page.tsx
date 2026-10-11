import { MentorWorkspace } from "@/components/mentor-workspace";
import { dashboardData } from "@/lib/dashboard-data";
import { ensureDateParam } from "@/lib/types";
import { requireMentorPage } from '@/lib/mentor-page';

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ batch?: string; view?: string; demo?: string; student?: string; date?: string; period?: string }> }) {
  const params = await searchParams;
  const batchId = params.batch || "batch-2";
  const preview = params.demo === "1";
  if (!preview) await requireMentorPage(`/?${new URLSearchParams(Object.entries(params).filter(([,v]) => v !== undefined) as [string,string][]).toString()}`);
  const { workspace, reports } = await dashboardData(batchId, preview);
  const today = workspace.mode === "demo" ? batchId === "batch-1" ? "2026-03-18" : "2026-10-10" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  let initialDate: string | undefined;
  try { if (params.date) initialDate = ensureDateParam(params.date); } catch { /* Use current teaching day. */ }
  return <MentorWorkspace key={`${batchId}:${params.view}:${params.student ?? ""}`} data={workspace} reports={reports} batchId={batchId} initialView={params.view ?? "overview"} initialStudent={params.student} preview={preview} today={today} initialDate={initialDate} initialPeriod={params.period}/>;
}
