const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f);
const { resolveReportProject } = require('../lib/report-project.ts');
const { parseFeedbackPayload } = require('../lib/types.ts');
const { loadConfig, buildPayload, resolveProject, verifyProjectSupport } = require('../tools/telemetry.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mentor-project-test-'));
const originalFetch = global.fetch;
async function run() {
  let supported = false;
  const server = http.createServer((req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.headers.authorization, 'Bearer test-credential');
    res.writeHead(supported ? 200 : 405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agentProjects: supported }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const c = { endpoint: `http://127.0.0.1:${server.address().port}/api/feedback`, token: 'test-credential', timeoutSeconds: 2 };
    await assert.rejects(() => verifyProjectSupport(c), /No report was sent/);
    supported = true;
    await verifyProjectSupport(c);
  } finally { await new Promise(resolve => server.close(resolve)); }
  const config = { batchId: 'batch-2', studentId: 'student-1', studentName: 'Enrolled Learner', projectMode: 'agent' };
  const args = { projectRoot: temp, projectTitle: 'Recipe Planner' };
  const preview = resolveProject({ ...args, dryRun: true }, config);
  assert.equal(preview.title, args.projectTitle);
  assert.equal(fs.existsSync(path.join(temp, '.yuvabe-project.json')), false);
  const first = resolveProject(args, config);
  assert.deepEqual(resolveProject({ projectRoot: temp }, config), first, 'Reopening a project preserves its key');
  assert.throws(() => resolveProject({ ...args, projectTitle: 'Another name' }, config), /already has a project/);
  const second = resolveProject({ ...args, projectTitle: 'Budget Tracker', newProject: true }, config);
  assert.notEqual(second.key, first.key);
  assert.ok(fs.existsSync(path.join(temp, `.yuvabe-project.json.${first.key}.backup`)));
  assert.throws(() => resolveProject(args, { ...config, projectId: 'fixed' }), /fixed project_id/);
  assert.throws(() => resolveProject({}, config), /project-root/);
  const disabled = path.join(temp, 'config.json');
  fs.writeFileSync(disabled, JSON.stringify({ reporting_enabled: false }));
  assert.throws(() => loadConfig(disabled), /disabled/);
  const reportArgs = { trigger: 'manual', status: 'clear', summary: 'Understands the feature', action: 'Continue', gaps: [], causes: [], month: 1, week: 1, day: 1, progress: 65, confidence: 80 };
  assert.throws(() => buildPayload({ ...reportArgs, studentId: 'another' }, config), /mentor-managed/);
  assert.throws(() => buildPayload({ ...reportArgs, batchId: 'batch-1' }, config), /mentor-managed/);
  const payload = parseFeedbackPayload({ ...buildPayload(reportArgs, config), project: first });
  assert.equal(payload.project.title, 'Recipe Planner');
  assert.throws(() => parseFeedbackPayload({ ...payload, project: { key: 'x', title: 'a'.repeat(161) } }), /Invalid project/);
  assert.throws(() => parseFeedbackPayload({ ...payload, projectId: 'other' }), /not both/);
  process.env.SUPABASE_URL = 'https://projects.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-test-key';
  const projects = new Map();
  let enrolled = true, corruptOwner = false, writes = 0;
  global.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/batch_students')) {
      assert.equal(u.searchParams.get('student_id'), `eq.${payload.studentId}`);
      return Response.json(enrolled ? [{ student_id: payload.studentId, name: 'Mentor Assigned Name' }] : []);
    }
    assert.ok(u.pathname.endsWith('/student_projects'));
    if (init.method === 'POST') {
      writes++;
      const row = JSON.parse(init.body);
      assert.match(init.headers.Prefer, /ignore-duplicates/);
      if (!projects.has(row.id)) projects.set(row.id, row);
      return new Response(null, { status: 201 });
    }
    const row = projects.get(u.searchParams.get('id').slice(3));
    return Response.json(row ? [{ ...row, ...(corruptOwner ? { student_id: 'other' } : {}) }] : []);
  };
  enrolled = false;
  await assert.rejects(() => resolveReportProject(payload), /enroll/);
  assert.equal(writes, 0, 'Unenrolled students cannot create projects');
  enrolled = true;
  const id = await resolveReportProject(payload);
  assert.equal(payload.studentName, 'Mentor Assigned Name');
  projects.get(id).progress = 70;
  assert.equal(await resolveReportProject({ ...payload, project: { ...first, title: 'Later agent wording' } }), id);
  assert.equal(projects.get(id).name, 'Recipe Planner');
  assert.equal(projects.get(id).progress, 70, 'A report retry cannot reset milestone progress');
  for (let i = 2; i <= 14; i++) await resolveReportProject({ ...payload, project: { key: `course-project-${i}`, title: `Project ${i}` } });
  assert.equal(projects.size, 14);
  const otherBatch = await resolveReportProject({ ...payload, batchId: 'batch-3' });
  assert.notEqual(otherBatch, id, 'Project IDs are scoped to student and batch');
  corruptOwner = true;
  await assert.rejects(() => resolveReportProject(payload), /ownership/);
  console.log('PASS: persistent project identities, 14 sequential projects, retries, mentor identity, enrollment, ownership, dry runs and disabled reporting.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  const target = path.resolve(temp);
  assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
  assert.ok(path.basename(target).startsWith('mentor-project-test-'));
  fs.rmSync(target, { recursive: true, force: true });
});
