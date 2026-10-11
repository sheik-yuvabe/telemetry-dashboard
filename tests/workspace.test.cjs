const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Compile in memory: no generated test files or external services.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { scopeWorkspace, usageTotal, parseUsageEvent } = require('../lib/workspace-types.ts');
const { demoWorkspace } = require('../lib/workspace-demo.ts');
const { parseFeedbackPayload, ensureDateParam } = require('../lib/types.ts');
const { buildDailySummary } = require('../lib/summary.ts');
const { insertUsage } = require('../lib/workspace-store.ts');
const { createFeedbackReport } = require('../lib/store.ts');
const { dashboardData } = require('../lib/dashboard-data.ts');

async function run() {
  const all = demoWorkspace();
  const batch2 = scopeWorkspace(all, 'batch-2');
  const batch1 = scopeWorkspace(all, 'batch-1');
  assert.equal(batch2.students.length, 8);
  assert.equal(batch1.students.length, 3);
  assert.equal(batch1.usage.length, 0);
  assert.ok(batch2.projects.every(p => p.batchId === 'batch-2'));
  assert.ok(!batch1.accounts.some(a => a.id === 'studio-01'));
  const shared = { ...all, students: [...all.students, { batchId: 'batch-1', studentId: 'b2-1', name: 'Different learner', accountId: 'studio-01' }] };
  assert.equal(scopeWorkspace(shared, 'batch-1').students.find(s => s.studentId === 'b2-1').name, 'Different learner');
  assert.equal(scopeWorkspace(shared, 'batch-1').usage.length, 0, 'A shared account must not pull other-batch usage into totals');
  const event = { eventId: 'event-1', batchId: 'batch-2', studentId: 'b2-1', projectId: 'project-1', accountId: 'studio-01', sessionId: 'session-1', occurredAt: '2026-10-10T10:30:00+05:30', inputTokens: 1500, outputTokens: 400, cachedInputTokens: 500, source: 'test' };
  const parsed = parseUsageEvent(event);
  assert.equal(usageTotal([parsed]), 1900, 'Cached input is not counted twice');
  assert.equal(parsed.occurredAt, '2026-10-10T05:00:00.000Z');
  for (const change of [{ inputTokens: -1 }, { outputTokens: 1.5 }, { cachedInputTokens: 1501 }, { occurredAt: 'invalid' }, { studentId: null }, { accountId: '' }]) assert.throws(() => parseUsageEvent({ ...event, ...change }));
  assert.equal(parseUsageEvent({ ...event, studentId: null, projectId: null }).studentId, null);
  const known = batch2.usage.filter(e => e.studentId !== null);
  const unknown = batch2.usage.filter(e => e.studentId === null);
  assert.equal(usageTotal(known) + usageTotal(unknown), usageTotal(batch2.usage));
  assert.equal(batch2.usage.filter(e => e.studentId === 'b2-8').length, 0, 'Missing student usage remains absent');

  const feedback = { studentId: 'a', studentName: 'A', reportDate: '2026-10-10', month: 1, week: 1, day: 1, lessonConfidence: 'high', understandingStatus: 'clear', progressScore: 90, confidenceScore: 90, gapCategories: [], summary: 'Understands the task', likelyCauses: [], recommendedTutorAction: 'Continue', repeatedTopicSignals: 0, triggerReason: 'manual' };
  const report = { ...parseFeedbackPayload(feedback), id: 'old', createdAt: '2026-10-10T09:00:00Z' };
  assert.equal(report.batchId, 'batch-1', 'Legacy reports must not move to Batch 2');
  assert.throws(() => ensureDateParam('2026-02-30'));
  assert.throws(() => parseFeedbackPayload({ ...feedback, day: 1.4 }));
  assert.throws(() => parseFeedbackPayload({ ...feedback, month: null, lessonPath: 'month-99/week-1/day-1' }));
  assert.throws(() => parseFeedbackPayload({ ...feedback, repeatedTopicSignals: Array(30).fill('x') }));
  const summary = buildDailySummary([report, { ...report, id: 'new', createdAt: '2026-10-10T10:00:00Z', progressScore: 100 }], feedback.reportDate);
  assert.equal(summary.totalStudents, 1);
  assert.equal(summary.averageProgress, 100);
  assert.equal(summary.priorityStudents.length, 0);
  assert.equal(buildDailySummary([], feedback.reportDate).recommendedActions.length, 1);

  // Fake Supabase responses to exercise ownership checks and idempotency without a network call.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const batchId of ['batch-1', 'batch-2']) {
    const submitted = await createFeedbackReport(parseFeedbackPayload({ ...feedback, batchId, studentId: 'private-submission' }));
    assert.ok((await dashboardData(batchId)).reports.some(r => r.id === submitted.report.id));
    assert.ok(!(await dashboardData(batchId, true)).reports.some(r => r.id === submitted.report.id), 'Public sample endpoint must not include submitted reports');
  }
  process.env.SUPABASE_URL = 'https://workspace.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  const saved = [];
  global.fetch = async (url, init = {}) => {
    const parsedUrl = new URL(url);
    assert.equal(parsedUrl.hostname, 'workspace.test');
    const table = parsedUrl.pathname.split('/').at(-1);
    if (table === 'usage_events' && init.method === 'POST') {
      const row = JSON.parse(init.body);
      if (saved.some(e => e.batch_id === row.batch_id && e.event_id === row.event_id)) return Response.json([]);
      saved.push(row); return Response.json([row]);
    }
    const tables = {
      batches: [{ id: 'batch-2', name: 'Batch 2', status: 'active' }],
      batch_students: [{ batch_id: 'batch-2', student_id: 'b2-1', name: 'Learner', account_id: 'studio-01' }],
      shared_accounts: [{ id: 'studio-01', name: 'Account', capacity: 4 }],
      student_projects: [{ id: 'project-1', batch_id: 'batch-2', student_id: 'b2-1', name: 'Project', description: '', status: 'building', progress: 20, repository_url: null }],
      usage_events: saved,
    };
    return Response.json(tables[table] ?? []);
  };
  assert.equal((await insertUsage(parsed)).deduplicated, false);
  assert.equal((await insertUsage(parsed)).deduplicated, true);
  assert.equal(saved.length, 1);
  await assert.rejects(insertUsage({ ...parsed, outputTokens: 999 }), /different usage/);
  await assert.rejects(insertUsage({ ...parsed, eventId: 'other', studentId: 'wrong-student' }), /not assigned/);
  await assert.rejects(insertUsage({ ...parsed, eventId: 'other', projectId: 'wrong-project' }), /does not belong/);
  await assert.rejects(insertUsage({ ...parsed, eventId: 'other', batchId: 'batch-1' }), /Unknown batch/);
  await insertUsage({ ...parsed, eventId: 'unassigned', studentId: null, projectId: null });
  assert.equal(saved.length, 2);
  console.log('PASS: batch separation, shared identities, token totals, unknown usage, validation, daily aggregation, ownership, and idempotent ingestion.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
