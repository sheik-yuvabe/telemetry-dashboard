const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f);
const { dashboardData } = require('../lib/dashboard-data.ts');
const { filterHistory, historyOverview } = require('../lib/student-history.ts');
const { historyPage, studentContext } = require('../lib/student-history-store.ts');
const { authorizeMentor, historyScope } = require('../lib/mentor-api.ts');
const { sourceHash, validateSummary, chunkInputs, modelInput, summaryState, generateStudentSummary, reviewStudentSummary } = require('../lib/student-summaries.ts');

async function run() {
  const scope = { batchId: 'batch-2', studentId: 'b2-1', from: '', through: '', project: '', lesson: '', status: '' };
  const data = await dashboardData('batch-2', true);
  const reports = filterHistory(data.reports, scope);
  assert.equal(reports.length, 7);
  assert.equal(reports.filter(r => r.reportDate === '2026-10-10').length, 2);
  assert.equal(filterHistory([...data.reports, { ...reports[0], batchId: 'batch-1' }], scope).length, 7);
  assert.equal(filterHistory(data.reports, { ...scope, project: 'someone-elses-project' }).length, 0);
  assert.equal(filterHistory(data.reports, { ...scope, from: '2026-10-10' }).length, 2);
  const overview = historyOverview(reports, data.workspace.usage, scope);
  assert.equal(overview.reportDays, 6);
  assert.equal(overview.trends[0].points.length, 6, 'Use only the latest report per day within a comparable lesson/project');
  assert.equal(overview.trends[0].points.at(-1).score, reports[0].progressScore);
  const context = await studentContext(scope, true);
  await assert.rejects(studentContext({ ...scope, studentId: 'b2-8-other' }, true), /not found/);
  assert.equal(historyPage(context, scope, null, reports[0].id).reports.length, 1);
  assert.throws(() => historyPage(context, scope, null, 'other-student-report'), /not found/);
  const many = Array.from({ length: 45 }, (_, i) => ({ ...reports[0], id: 'r' + String(i).padStart(3, '0') }));
  const page1 = historyPage({ ...context, reports: many }, scope, null, null);
  const page2 = historyPage({ ...context, reports: many }, scope, page1.nextCursor, null);
  const page3 = historyPage({ ...context, reports: many }, scope, page2.nextCursor, null);
  assert.equal(new Set([...page1.reports, ...page2.reports, ...page3.reports].map(r => r.id)).size, 45);
  assert.equal(page3.nextCursor, null);
  assert.throws(() => historyPage(context, scope, 'bad-cursor', null), /cursor/);
  assert.notEqual(sourceHash(scope, reports), sourceHash(scope, [{ ...reports[0], summary: 'Corrected assessment' }, ...reports.slice(1)]));
  assert.notEqual(sourceHash(scope, reports), sourceHash(scope, reports.slice(1)));
  const safe = modelInput([{ ...reports[0], summary: 'Aarav Kumar used https://private.test and student@example.com' }], 'Aarav Kumar');
  assert.ok(!safe[0].summary.includes('Aarav'));
  assert.ok(!safe[0].summary.includes('private.test'));
  assert.ok(!safe[0].summary.includes('student@example.com'));
  const chunks = chunkInputs(Array.from({ length: 5 }, (_, id) => ({ id, text: 'x'.repeat(90) })), 250);
  assert.equal(chunks.flat().length, 5);
  assert.throws(() => chunkInputs([{ text: 'x'.repeat(300) }], 250), /exceeds/);
  const content = { overview: [{ text: 'A supported observation', reportIds: ['R1'] }], strengths: [], difficulties: [], progress: [], nextSteps: [], limitations: ['Reported assessments only.'] };
  assert.equal(validateSummary(content, new Set(['R1'])).overview.length, 1);
  assert.throws(() => validateSummary(content, new Set(['R2'])), /supporting reports/);
  assert.throws(() => validateSummary({ ...content, overview: [{ text: 'Uncited', reportIds: [] }] }, new Set()), /supporting reports/);
  assert.throws(() => historyScope(new Request('https://local.test?batch=batch-2&from=2026-02-30'), 'b2-1'), /valid date/);
  assert.throws(() => historyScope(new Request('https://local.test?from=2026-10-10&through=2026-10-01'), 'b2-1'), /Start date/);
  await assert.rejects(() => authorizeMentor(new Request('https://local.test')), /sign in/);

  // Fake provider + persistence: no external requests, real keys, or student data.
  process.env.SUPABASE_URL = 'https://storage.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  process.env.GEMINI_API_KEY = 'test-only';
  process.env.GEMINI_MODEL = 'test-model';
  let saved = null, providerCalls = 0, claimed = true, invalid = false, sent = '';
  global.fetch = async (url, options = {}) => {
    const u = new URL(url);
    if (u.hostname === 'generativelanguage.googleapis.com') {
      providerCalls++; sent = options.body;
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(invalid ? { ...content, overview: [{ text: 'Wrong citation', reportIds: ['other-student'] }] } : content) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 25, thoughtsTokenCount: 5, totalTokenCount: 130 } });
    }
    assert.equal(u.hostname, 'storage.test');
    if (u.pathname.endsWith('/claim_student_summary')) return Response.json(claimed);
    if (u.pathname.endsWith('/finish_student_summary')) { const b = JSON.parse(options.body); if (b.p_saved) saved = b.p_saved; return Response.json(true); }
    if (u.pathname.endsWith('/student_summaries')) {
      if (options.method === 'PATCH') saved = JSON.parse(options.body).saved;
      return Response.json(saved ? [{ saved }] : []);
    }
    throw Error('Unexpected request: ' + u.pathname);
  };
  const live = { ...context, demo: false };
  const first = await generateStudentSummary(live, scope);
  assert.equal(providerCalls, 1);
  assert.equal(first.saved.apiUsage.totalTokens, 130);
  assert.equal(first.saved.apiUsage.outputTokens, 30);
  assert.ok(reports.some(r => r.id === first.saved.content.overview[0].reportIds[0]));
  assert.ok(!sent.includes('Aarav Kumar') && !sent.includes('originalId') && !sent.includes('b2-1') && !sent.includes('sample-report'));
  await generateStudentSummary(live, scope);
  assert.equal(providerCalls, 1, 'Unchanged source must reuse the saved summary');
  assert.equal((await reviewStudentSummary(live, scope)).saved.review, 'reviewed');
  assert.equal(providerCalls, 1, 'Mentor review must not call the provider');
  const changed = { ...live, reports: live.reports.map((r, i) => i ? r : { ...r, summary: 'Corrected report' }) };
  assert.equal((await summaryState(changed, scope)).stale, true);
  await assert.rejects(reviewStudentSummary(changed, scope), /up-to-date/);
  claimed = false;
  await assert.rejects(generateStudentSummary(changed, scope), /already running/);
  assert.equal(providerCalls, 1);
  claimed = true; invalid = true;
  await assert.rejects(generateStudentSummary(changed, scope), /supporting reports/);
  assert.equal(saved.generatedAt, first.saved.generatedAt, 'A provider failure must not replace a previous summary');
  await assert.rejects(generateStudentSummary({ ...live, reports: [] }, scope), /No reports/);
  await assert.rejects(generateStudentSummary(context, scope), /live data/);
  console.log('PASS: student/batch isolation, same-day history, filters, cursor pagination, source invalidation, evidence validation, provider redaction, authorization, caching, locking and failure preservation.');
}
run().catch(e => { console.error(e); process.exitCode = 1; });
