"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeSwitch } from "./theme-switch";
import type { HistoryResponse, SummaryState } from "@/lib/student-history";
import type { TelemetryReport } from "@/lib/types";

const sectionLabels = { overview: "Learning overview", strengths: "Strengths", difficulties: "Recurring difficulties", progress: "Changes over time", nextSteps: "Suggested mentor actions" } as const;
const time = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
export function ReportDetail({ report }: { report: TelemetryReport }) {
  return <article className="history-report" id={report.id}><h3>{report.reportDate} · {report.understandingStatus}</h3><p className="muted">{time(report.createdAt)} IST · {report.lessonPath || `Month ${report.month}, week ${report.week}, day ${report.day}`}</p><p>{report.summary}</p><dl><dt>Reported learning progress</dt><dd>{report.progressScore}%</dd><dt>Reported confidence</dt><dd>{report.confidenceScore}%</dd><dt>Lesson detection confidence</dt><dd>{report.lessonConfidence}</dd><dt>Recorded gaps</dt><dd>{report.gapCategories.join(", ") || "None recorded"}</dd><dt>Likely causes reported</dt><dd>{report.likelyCauses.join("; ") || "None recorded"}</dd><dt>Suggested tutor action</dt><dd>{report.recommendedTutorAction}</dd><dt>Trigger</dt><dd>{report.triggerReason}</dd><dt>Project</dt><dd>{report.projectId || "Project not recorded"}</dd></dl><small>Report ID: {report.id}</small></article>;
}
export function StudentHistory({ studentId, batchId, demo }: { studentId: string; batchId: string; demo: boolean }) {
  const [token, setToken] = useState(""), [credential, setCredential] = useState(""), [tab, setTab] = useState("Overview");
  const [filters, setFilters] = useState({ from: "", through: "", project: "", lesson: "", status: "" });
  const [data, setData] = useState<HistoryResponse | null>(null), [summary, setSummary] = useState<SummaryState | null>(null);
  const [error, setError] = useState(""), [summaryError, setSummaryError] = useState(""), [busy, setBusy] = useState(false), [generating, setGenerating] = useState(false);
  const [detail, setDetail] = useState<TelemetryReport | null>(null), [evidenceBusy, setEvidenceBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const epoch = useRef(0);
  const query = new URLSearchParams({ batch: batchId, ...filters, ...(demo ? { demo: "1" } : {}) }).toString();
  const api = useCallback(async (kind: string, extra = "", method = "GET") => {
    const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/${kind}?${query}${extra}`, { method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(method === "POST" ? 150000 : 30000) });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.message || "Request failed.");
    return body;
  }, [studentId, query, token]);
  useEffect(() => {
    const id = ++epoch.current;
    if (!demo && !token) return;
    let cancelled = false;
    async function load() {
      setBusy(true); setError(""); setData(null); setSummary(null); setSummaryError(""); setDetail(null); setGenerating(false);
      try {
        const result = await api("history");
        if (!cancelled && id === epoch.current) setData(result);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setBusy(false); }
      try { const result = await api("summary"); if (!cancelled && id === epoch.current) setSummary(result); }
      catch (e) { if (!cancelled) setSummaryError((e as Error).message); }
    }
    void load();
    return () => { cancelled = true; };
  }, [api, demo, token, reload]);
  async function more() {
    if (!data?.nextCursor) return;
    const id = epoch.current; setBusy(true); setError("");
    try {
      const next = await api("history", `&cursor=${encodeURIComponent(data.nextCursor)}`);
      if (id === epoch.current) setData(current => current ? { ...next, reports: [...current.reports, ...next.reports.filter((r: TelemetryReport) => !current.reports.some(x => x.id === r.id))] } : next);
    } catch (e) { if (id === epoch.current) setError((e as Error).message); }
    finally { if (id === epoch.current) setBusy(false); }
  }
  async function generate(review = false) {
    const id = epoch.current; setGenerating(true); setSummaryError("");
    try {
      await api("summary", review ? "&action=review" : "", "POST");
      const fresh = await api("summary");
      if (id === epoch.current) setSummary(fresh);
    } catch (e) { if (id === epoch.current) setSummaryError((e as Error).message); }
    finally { if (id === epoch.current) setGenerating(false); }
  }
  async function evidence(id: string) {
    const current = epoch.current; setEvidenceBusy(true);
    try { const result = await api("history", `&report=${encodeURIComponent(id)}`); if (current === epoch.current) setDetail(result.reports[0]); }
    catch (e) { if (current === epoch.current) setSummaryError((e as Error).message); }
    finally { if (current === epoch.current) setEvidenceBusy(false); }
  }
  const overview = data?.overview;
  return <main className="student-history-page">
    <header className="history-header"><Link href={`/?batch=${encodeURIComponent(batchId)}&view=students${demo ? "&demo=1" : ""}`}><Image src="/yuvabe-education-logo.svg" width={38} height={38} alt="" unoptimized/> Back to students</Link><ThemeSwitch/></header>
    <div className="page-heading"><div><p className="eyebrow">{data?.context.batch.name || batchId} / STUDENT HISTORY</p><h1>{data?.context.student.name || "Student profile"}</h1><p>Every report, with the context behind the progress.</p></div></div>
    {demo && <div className="notice neutral">Sample student history. These reports are fictional; no Gemini requests are made.</div>}
    {!demo && !token ? <form className="panel history-card" onSubmit={e => { e.preventDefault(); setToken(credential); setCredential(""); }}><h2>Open student history</h2><p>Use the mentor access token configured on your backend. It stays in memory for this page.</p><label>Mentor access token<input type="password" value={credential} onChange={e => setCredential(e.target.value)} required autoComplete="off"/></label><button className="primary-button" type="submit">Connect</button></form> : <>
      <section className="panel history-filters" aria-label="History filters">
        <label>From<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })}/></label>
        <label>Through<input type="date" value={filters.through} onChange={e => setFilters({ ...filters, through: e.target.value })}/></label>
        <label>Project<select value={filters.project} onChange={e => setFilters({ ...filters, project: e.target.value })}><option value="">All projects</option><option value="unassigned">Project not recorded</option>{data?.context.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Lesson<select value={filters.lesson} onChange={e => setFilters({ ...filters, lesson: e.target.value })}><option value="">All lessons</option>{data?.lessons.map(l => <option key={l}>{l}</option>)}</select></label>
        <label>Reported status<select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{["clear", "partial", "stuck"].map(s => <option key={s}>{s}</option>)}</select></label>
        <button className="secondary-button" onClick={() => setFilters({ from: "", through: "", project: "", lesson: "", status: "" })}>All history</button>
      </section>
      <nav className="history-tabs" aria-label="Student sections">{["Overview", "Reports", "Projects", "Usage"].map(t => <button key={t} className={tab === t ? "primary-button" : "secondary-button"} onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined}>{t}</button>)}</nav>
      {error && <div className="notice" role="alert">{error}<button onClick={() => setReload(x => x + 1)}>Retry</button>{!demo && <button onClick={() => setToken("")}>Change token</button>}</div>}
      {busy && <p role="status">Loading reports…</p>}
      {overview && data && <>
      {tab === "Overview" && <>
        <div className="metric-grid">{[[overview.reportCount, "Reports"], [overview.reportDays, "Days with reports"], [overview.latestStatus || "Not assessed", "Latest reported status"], [overview.tokenTotal === null ? "Not recorded" : overview.tokenTotal.toLocaleString(), "Measured tokens"]].map(([value, label]) => <article key={label} className="metric"><div>{label}</div><strong>{value}</strong></article>)}</div>
        <p className="history-caption">{overview.firstDate ? `Reports from ${overview.firstDate} through ${overview.lastDate}.` : "No reports in this scope."} Missing reports do not establish attendance. Tokens use date/project filters, independent of lesson/status filters.</p>
        <section className="panel history-card"><h2>Recorded learning gaps</h2><p>Counts use the latest matching report per day.</p>{overview.gaps.length ? <ul>{overview.gaps.map(g => <li key={g.name}>{g.name}: {g.days} report day(s)</li>)}</ul> : <p>No gaps recorded in this scope.</p>}</section>
        <section className="panel history-card"><h2>Learning progress by lesson and project</h2><p>Reported assessments; scores from different lessons are not combined.</p>{overview.trends.map((trend, i) => <div key={i} className="history-trend"><h3>{trend.lesson}</h3><p>{data.context.projects.find(p => p.id === trend.projectId)?.name || "Project not recorded"}</p><div className="history-points">{trend.points.map(point => <button key={point.reportId} className="secondary-button" onClick={() => evidence(point.reportId)}>{point.date}: {point.score}%</button>)}</div></div>)}</section>
        <section className="panel history-card"><div className="history-header"><h2>AI learning summary</h2><button className="primary-button" disabled={generating || !summary?.available || !overview.reportCount} onClick={() => generate()}>{generating ? "Generating…" : summary?.saved ? "Refresh summary" : "Generate summary"}</button></div>
          <p>AI-generated draft for mentor review. Every claim links to its source reports.</p>
          {summary?.message && <div className="notice neutral">{summary.message}</div>}
          {summaryError && <p role="alert">{summaryError}</p>}
          {summary?.saved && <><p><strong>{summary.saved.review === "reviewed" ? "Reviewed by mentor" : "AI-generated draft"}</strong></p>{summary.saved.review !== "reviewed" && <button className="secondary-button" disabled={generating || summary.stale} onClick={() => generate(true)}>Mark reviewed</button>}<p className="muted">{summary.saved.reportCount} reports · Generated {time(summary.saved.generatedAt)} IST · {summary.saved.model}{summary.stale ? " · OUT OF DATE" : ""}</p>{Object.entries(sectionLabels).map(([key, label]) => <section key={key}><h3>{label}</h3>{summary.saved!.content[key as keyof typeof sectionLabels].map((claim, i) => <div key={i} className="history-claim"><p>{claim.text}</p><div className="history-points">{claim.reportIds.map((id, j) => <button className="text-link" key={id} disabled={evidenceBusy} onClick={() => evidence(id)}>Source report {j + 1}</button>)}</div></div>)}</section>)}<h3>Evidence limitations</h3><ul>{summary.saved.content.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul><small>Summary generation used {summary.saved.apiUsage.totalTokens.toLocaleString()} API tokens, tracked separately from student usage.</small></>}
        </section>
      </>}
      {tab === "Reports" && <section className="panel history-card"><h2>All reports · {overview.reportCount}</h2><p>Expand a report to read the original assessment. Times are IST.</p>{!data.reports.length && <p>No reports match these filters.</p>}{data.reports.map((report, i) => <div key={report.id}>{(!i || data.reports[i - 1].reportDate !== report.reportDate) && <h3 className="history-day">{report.reportDate}</h3>}<details className="history-report-row"><summary>{time(report.createdAt)} · {report.understandingStatus} · {report.summary.slice(0, 110)}</summary><ReportDetail report={report}/></details></div>)}{data.nextCursor && <button className="secondary-button" onClick={more} disabled={busy}>Load more reports</button>}</section>}
      {tab === "Projects" && <div className="project-grid">{data.context.projects.map(p => <article className="panel history-card" key={p.id}><h2>{p.name}</h2><p>{p.description}</p><p>{p.status} · Project progress {p.progress}%</p><button className="text-link" onClick={() => { setFilters({ from: "", through: "", project: p.id, lesson: "", status: "" }); setTab("Reports"); }}>View project reports</button></article>)}</div>}
      {tab === "Usage" && <section className="panel history-card"><h2>Individual measured usage</h2><p>Input + output; cached input is already included. Date/project filters apply; lesson/status filters do not. No events means usage was not recorded.</p><div className="table-wrap"><table><thead><tr><th>Date (IST)</th><th>Project</th><th>Input</th><th>Output</th><th>Cached input</th></tr></thead><tbody>{overview.usage.map(e => <tr key={e.eventId}><td>{time(e.occurredAt)}</td><td>{data.context.projects.find(p => p.id === e.projectId)?.name || "Not recorded"}</td><td>{e.inputTokens.toLocaleString()}</td><td>{e.outputTokens.toLocaleString()}</td><td>{e.cachedInputTokens.toLocaleString()}</td></tr>)}</tbody></table></div>{!overview.usage.length && <p>Not recorded in this scope.</p>}</section>}
      </>}
    </>}
    {detail && <div className="drawer-overlay" onClick={() => setDetail(null)}><section className="student-drawer" role="dialog" aria-modal="true" aria-label="Source report" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") setDetail(null); if (e.key === "Tab") { e.preventDefault(); e.currentTarget.querySelector("button")?.focus(); } }}><button className="secondary-button" autoFocus onClick={() => setDetail(null)}>Close report</button><ReportDetail report={detail}/></section></div>}
  </main>;
}
