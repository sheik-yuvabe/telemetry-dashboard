#!/usr/bin/env node
'use strict';
// Pilot adapter for locally observed Codex VS Code JSONL records. No chat is exported.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');
const DEFAULT_CONFIG = path.join(os.homedir(), '.codex', 'usage-collector', 'config.json');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const stamp = value => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const canonical = value => { const p = fs.realpathSync(value); return process.platform === 'win32' ? p.toLowerCase() : p; };
function within(root, value) {
  const rel = path.relative(root, value);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}
function save(file, data) {
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}
function loadConfig(file = DEFAULT_CONFIG) {
  const c = json(file), mentor = json(c.telemetry_config || path.join(os.homedir(), '.codex', 'telemetry_config.json'));
  if (c.enabled !== true || mentor.reporting_enabled !== true) throw Error('Collector or student reporting is disabled.');
  for (const key of ['student_id', 'batch_id', 'token']) if (typeof mentor[key] !== 'string' || !mentor[key].trim()) throw Error(`Missing mentor configuration: ${key}.`);
  if (/^(?:REPLACE_WITH_|YOUR[_ -]|<)/i.test(mentor.token)) throw Error('Install the private ingestion credential first.');
  if (mentor.project_mode !== 'agent') throw Error('Agent-managed project identity is required.');
  if (typeof c.account_id !== 'string' || !c.account_id.trim()) throw Error('A mentor-assigned account_id is required.');
  if (!stamp(c.started_at)) throw Error('started_at must be an ISO timestamp with timezone.');
  const discovery = c.discovery || (c.project_roots?.length ? 'folders' : 'auto');
  if (!['auto','folders'].includes(discovery)) throw Error('Unknown project discovery mode.');
  if (discovery === 'folders' && (!Array.isArray(c.project_roots) || !c.project_roots.length)) throw Error('Select at least one student project folder.');
  const roots = discovery === 'auto' ? [] : [...new Set(c.project_roots.map(canonical))].sort((a,b) => b.length-a.length);
  const url = new URL('/api/usage', mentor.endpoint);
  if (url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))) throw Error('Usage requires HTTPS (HTTP allowed only on localhost for tests).');
  return { endpoint: url.href, token: mentor.token, studentId: mentor.student_id, batchId: mentor.batch_id,
    accountId: c.account_id.trim(), startedAt: new Date(c.started_at).toISOString(), roots, discovery,
    sessionsDir: canonical(c.sessions_dir || path.join(os.homedir(), '.codex', 'sessions')),
    stateDir: path.resolve(c.state_dir || path.join(path.dirname(file), 'state')) };
}
function identity(c) { return hash([c.endpoint, c.studentId, c.batchId, c.accountId, c.startedAt, c.sessionsDir]); }
function initialState(c) {
  return { version: 1, identity: identity(c), files: {}, sessions: {}, projects: {}, held: [], queue: [], uploaded: 0, lastSuccess: null, lastError: null };
}
function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesIn(path.join(dir,e.name)) : e.isFile() && e.name.endsWith('.jsonl') ? [path.join(dir,e.name)] : []);
}
function counters(info) {
  const t = info?.total_token_usage;
  if (!t) return null; // Rate-limit-only records are not token measurements.
  const keys = ['input_tokens', 'output_tokens', 'cached_input_tokens'];
  if (!keys.every(k => Number.isSafeInteger(t[k]) && t[k] >= 0) || t.cached_input_tokens > t.input_tokens || !Number.isSafeInteger(t.total_tokens) || t.total_tokens !== t.input_tokens + t.output_tokens) throw Error('Unsupported token counter schema.');
  return keys.map(k => t[k]);
}
async function readNew(file, cursor, diagnostics) {
  const size = fs.statSync(file).size;
  if (size < cursor.offset) throw Error('Session file was truncated. Collection stopped; preserve state for review.');
  if (size === cursor.offset) return [];
  let pending = Buffer.alloc(0), offset = cursor.offset;
  const snapshots = [];
  for await (const chunk of fs.createReadStream(file, { start: offset, end: size-1 })) {
    pending = Buffer.concat([pending,chunk]);
    let end;
    while ((end = pending.indexOf(10)) !== -1) {
      const line = pending.subarray(0,end); pending = pending.subarray(end+1); offset += end+1;
      let r;
      try { r = JSON.parse(line.toString('utf8')); } catch { throw Error('Invalid complete session record. Collection stopped without advancing state.'); }
      const p = r.payload;
      if (r.type === 'session_meta') {
        cursor.meta = { id: p.id, source: p.source === 'vscode' ? 'vscode' : 'excluded', cwd: p.cwd };
        cursor.cwd = p.cwd;
      }
      if (cursor.meta?.source !== 'vscode') continue;
      if (r.type === 'turn_context' && typeof p?.cwd === 'string') cursor.cwd = p.cwd;
      if (r.type !== 'event_msg' || p?.type !== 'token_count') continue;
      if (!stamp(r.timestamp) || typeof cursor.meta.id !== 'string' || !cursor.meta.id) throw Error('Missing session identity or usage timestamp.');
      const total = counters(p.info);
      if (total) snapshots.push({ session: cursor.meta.id, cwd: cursor.cwd, at: new Date(r.timestamp).toISOString(), total });
    }
    if (pending.length > 16*1024*1024) throw Error('Oversized session record. Adapter needs review.');
  }
  cursor.offset = offset; // Partial trailing JSON remains unread until completed.
  if (pending.length) diagnostics.partialRecords++;
  return snapshots;
}
function discoverProjectRoot(cwd) {
  let dir;
  try { dir = canonical(cwd); } catch { return null; }
  // A manifest in a shared container must not claim all of its unrelated children.
  const home = canonical(os.homedir());
  const containers = new Set([home, ...['Desktop','Documents','Downloads'].map(name => {
    const p = path.join(home,name); return process.platform === 'win32' ? p.toLowerCase() : p;
  })]);
  while (true) {
    const normalized = process.platform === 'win32' ? dir.toLowerCase() : dir;
    if (path.dirname(dir) === dir || containers.has(normalized)) return null;
    if (fs.existsSync(path.join(dir,'.yuvabe-project.json'))) return dir;
    // A nested repository is a separate project, even if its parent has an identity.
    if (fs.existsSync(path.join(dir,'.git'))) return null;
    dir = path.dirname(dir);
  }
}
function refreshProjects(c, state, now, diagnostics) {
  for (const root of c.roots) {
    const file = path.join(root, '.yuvabe-project.json');
    if (!fs.existsSync(file)) { delete state.projects[root]; diagnostics.missingManifests++; continue; }
    const m = json(file);
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(m.key || '') || typeof m.title !== 'string' || !m.title.trim()) throw Error('Invalid project manifest. Restore the saved identity.');
    if (state.projects[root]?.key !== m.key) {
      // No retrospective attribution across a newly detected project boundary.
      const moved = !state.projects[root] && Object.values(state.projects).find(p => p.key === m.key);
      state.projects[root] = { key: m.key, since: moved?.since || now };
      diagnostics.projectBaselines++;
    }
  }
}
function processSnapshots(c, state, snapshots, diagnostics) {
  snapshots.sort((a,b) => a.at.localeCompare(b.at) || a.session.localeCompare(b.session) || a.total[0]-b.total[0] || a.total[1]-b.total[1]);
  for (const s of snapshots) {
    const previous = state.sessions[s.session];
    if (previous && s.at < previous.at) continue; // Overlap in a resumed file.
    if (previous && s.total.every((n,i) => n === previous.total[i])) continue;
    if (previous?.blocked) { diagnostics.blockedSnapshots++; continue; }
    if (previous && s.total.some((n,i) => n < previous.total[i])) {
      state.sessions[s.session].blocked = true; diagnostics.counterResets++; continue;
    }
    state.sessions[s.session] = { at: s.at, total: s.total };
    if (!previous) { diagnostics.sessionBaselines++; continue; } // Unknown history is never uploaded as new usage.
    if (previous.at < c.startedAt || s.at < c.startedAt) continue;
    const delta = s.total.map((n,i) => n-previous.total[i]);
    if (delta[2] > delta[0] || delta.some(n => n > 1_000_000_000)) {
      state.sessions[s.session].blocked = true; diagnostics.counterResets++; continue;
    }
    if (!delta[0] && !delta[1]) continue;
    const event = { eventId: 'codex-' + hash([state.identity, s.session, s.total]), batchId: c.batchId, studentId: c.studentId,
      accountId: c.accountId, sessionId: s.session,
      occurredAt: s.at, inputTokens: delta[0], outputTokens: delta[1], cachedInputTokens: delta[2], source: 'codex-vscode-primary-local-v1' };
    let cwd;
    try { cwd = canonical(s.cwd); } catch { cwd = null; }
    const root = cwd && (c.discovery === 'auto' ? discoverProjectRoot(cwd) : c.roots.find(r => within(r,cwd)));
    const project = root && state.projects[root];
    if (!project || previous.at < project.since || s.at < project.since) {
      state.held.push({ event, cwd: s.cwd, reason: project ? 'project-boundary' : 'project-not-identified' });
      diagnostics.unmappedSnapshots++; continue;
    }
    state.queue.push({ ...event, projectId: 'agent-' + hash([c.batchId,c.studentId,project.key]) });
    diagnostics.newEvents++;
  }
}
function lock(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'collector.lock');
  try { fs.writeFileSync(file, String(process.pid), { flag: 'wx', mode: 0o600 }); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const pid = Number(fs.readFileSync(file,'utf8'));
    if (!Number.isSafeInteger(pid) || pid <= 0) throw Error('Invalid collector lock; review it before restarting.');
    try { process.kill(pid,0); } catch (err) {
      if (err.code === 'ESRCH') { fs.unlinkSync(file); return lock(dir); }
    }
    throw Error('Another collector is running.');
  }
  return () => fs.unlinkSync(file);
}
async function run(c, { dryRun = false, fetchImpl = fetch, now = new Date().toISOString() } = {}) {
  const file = path.join(c.stateDir,'state.json');
  const release = dryRun ? () => {} : lock(c.stateDir);
  try {
    const state = fs.existsSync(file) ? json(file) : initialState(c);
    if (state.version !== 1 || state.identity !== identity(c)) throw Error('Enrollment changed. Preserve the old queue/state and use a separate state directory for the new enrollment.');
    const d = { newEvents: 0, projectBaselines: 0, sessionBaselines: 0, missingManifests: 0, partialRecords: 0, counterResets: 0, blockedSnapshots: 0, unmappedSnapshots: 0 };
    state.held ||= [];
    const snapshots = [];
    for (const f of filesIn(c.sessionsDir)) {
      if (!state.files[f] && fs.statSync(f).mtimeMs < Date.parse(c.startedAt)) continue;
      const cursor = state.files[f] || (state.files[f] = { offset: 0 });
      for (const snapshot of await readNew(f,cursor,d)) snapshots.push(snapshot);
    }
    d.snapshotsRead = snapshots.length;
    const scoped = c.discovery === 'auto' ? { ...c, roots: [...new Set(
      [...snapshots.map(s => s.cwd), ...Object.values(state.files).map(f => f.cwd)]
        .filter(v => typeof v === 'string').map(discoverProjectRoot).filter(Boolean)
    )].sort((a,b) => b.length-a.length) } : c;
    refreshProjects(scoped,state,now,d);
    processSnapshots(scoped,state,snapshots,d);
    state.lastScan = now;
    state.diagnostics = d;
    state.coverage = 'partial: primary VS Code sessions only; initial baseline and ambiguous project intervals excluded';
    if (!dryRun) {
      save(file,state); // Persist queue + cursors together BEFORE upload.
      for (let sent = 0; state.queue.length && sent < 50; sent++) {
        try {
          const response = await fetchImpl(c.endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(state.queue[0]) });
          if (!response.ok) throw Error(`Usage upload HTTP ${response.status}. Check enrollment, account/project registration and credential.`);
          const result = await response.json();
          if (result.ok !== true) throw Error('Usage endpoint did not acknowledge storage.');
        } catch (e) {
          state.lastError = /^Usage (upload HTTP|endpoint)/.test(e.message) ? e.message : 'Usage upload failed or timed out. Pending events will retry.';
          save(file,state); break;
        }
        state.queue.shift(); state.uploaded++; state.lastSuccess = new Date().toISOString(); state.lastError = null;
        save(file,state); // Interrupted acknowledgements retry with the same event ID.
      }
    }
    return { dryRun, discovery: c.discovery, ...d, identifiedProjects: scoped.roots.length, heldForReview: state.held.length, blockedSessions: Object.values(state.sessions).filter(s => s.blocked).length, pending: state.queue.length, uploaded: state.uploaded, lastSuccess: state.lastSuccess, lastError: state.lastError, coverage: state.coverage };
  } finally { release(); }
}
async function main(argv) {
  if (argv.includes('--help')) { console.log('Usage: node collector.js [--config PATH] [--dry-run | --status | --watch]\nDefault: collect/upload once. --dry-run never writes or uploads. --watch checks every 60 seconds. --status reads local sync status.'); return; }
  let file = DEFAULT_CONFIG;
  for (let i=0;i<argv.length;i++) {
    if (argv[i] === '--config' && argv[i+1]) file = path.resolve(argv[++i]);
    else if (!['--dry-run','--status','--watch'].includes(argv[i])) throw Error('Unknown or incomplete collector option. Use --help.');
  }
  if (argv.includes('--status')) {
    const cfg = json(file), stateFile = path.join(cfg.state_dir || path.join(path.dirname(file),'state'), 'state.json');
    if (!fs.existsSync(stateFile)) { console.log('Collector has not run yet.'); return; }
    const s = json(stateFile); console.log(JSON.stringify({ enabled: cfg.enabled, discovery: cfg.discovery || 'folders', lastScan: s.lastScan, lastSuccess: s.lastSuccess, pending: s.queue.length, heldForReview: s.held?.length || 0, blockedSessions: Object.values(s.sessions).filter(v => v.blocked).length, uploaded: s.uploaded, lastError: s.lastError, coverage: s.coverage, diagnostics: s.diagnostics },null,2)); return;
  }
  do {
    try {
      const result = await run(loadConfig(file), { dryRun: argv.includes('--dry-run') });
      console.log(JSON.stringify(result));
      if (result.lastError && !argv.includes('--watch')) process.exitCode = 1;
    } catch (e) { if (!argv.includes('--watch')) throw e; console.error(e.message); }
    if (!argv.includes('--watch') || argv.includes('--dry-run')) break;
    await new Promise(resolve => setTimeout(resolve,60000));
  } while (true);
}
module.exports = { run, loadConfig, counters, processSnapshots, initialState, hash, within, discoverProjectRoot };
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode=1; });
