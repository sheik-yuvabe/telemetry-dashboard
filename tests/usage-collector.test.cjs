const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { run, loadConfig, counters, hash, discoverProjectRoot } = require('../tools/usage-collector/collector');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yuvabe-collector-test-'));
const project = path.join(root,'student-project'), sessions = path.join(root,'sessions'), stateDir = path.join(root,'state');
fs.mkdirSync(project); fs.mkdirSync(sessions);
const write = (f,v) => fs.writeFileSync(f,JSON.stringify(v));
const manifest = key => write(path.join(project,'.yuvabe-project.json'),{key,title:'Test project'});
const when = seconds => new Date(Date.parse('2026-10-21T18:29:00Z') + seconds*1000).toISOString();
const meta = (id,source='vscode',cwd=project) => ({type:'session_meta',payload:{id,source,cwd}});
const usage = (s,input,output,cached=0) => ({type:'event_msg',timestamp:when(s),payload:{type:'token_count',info:{total_token_usage:{input_tokens:input,output_tokens:output,cached_input_tokens:cached,total_tokens:input+output,reasoning_output_tokens:1}}}});
const log = path.join(sessions,'session.jsonl');
const append = (records,file=log) => {
  fs.appendFileSync(file,records.map(x=>JSON.stringify(x)).join('\n')+'\n');
  fs.utimesSync(file,new Date(when(9999)),new Date(when(9999)));
};
const mentor = path.join(root,'telemetry.json'), config = path.join(root,'config.json');
let server;
async function test() {
  const received = new Map(); let online = false, requests = 0;
  server = http.createServer(async(req,res) => {
    requests++; let text=''; for await(const chunk of req) text+=chunk;
    assert.equal(req.headers.authorization,'Bearer test-only');
    assert.equal(req.url,'/api/usage');
    if(!online){res.writeHead(503).end();return;}
    const event=JSON.parse(text);
    assert.ok(!text.includes('PRIVATE_CHAT'));
    if(received.has(event.eventId)) assert.deepEqual(received.get(event.eventId),event);
    received.set(event.eventId,event);
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  write(mentor,{endpoint:`http://127.0.0.1:${server.address().port}/api/feedback`,token:'test-only',student_id:'student@example.test',batch_id:'batch-2',reporting_enabled:true,project_mode:'agent'});
  write(config,{enabled:true,telemetry_config:mentor,account_id:'shared-1',started_at:when(0),project_roots:[project],sessions_dir:sessions,state_dir:stateDir});
  manifest('project-1'); const c=loadConfig(config);
  const scan = (second,options={}) => run(c,{now:when(second),...options});
  append([meta('thread-1'),{type:'response_item',payload:{text:'PRIVATE_CHAT'}},usage(-10,100,10,40)]);
  const dry=await scan(0,{dryRun:true});
  assert.equal(dry.pending,0);assert.equal(requests,0);assert.ok(!fs.existsSync(stateDir));
  await scan(0); // Enrollment baseline; no upload of historical usage.
  append([usage(10,110,11,45)]);await scan(11); // Crossing enrollment baseline is excluded.
  append([usage(20,160,16,65)]);
  const offline=await scan(21);assert.equal(offline.pending,1);assert.equal(offline.uploaded,0);
  let stored=JSON.parse(fs.readFileSync(path.join(stateDir,'state.json')));
  const event=stored.queue[0];assert.equal(event.inputTokens,50);assert.equal(event.outputTokens,5);assert.equal(event.cachedInputTokens,20);
  assert.equal(event.projectId,'agent-'+hash(['batch-2','student@example.test','project-1']));
  assert.equal(event.occurredAt,when(20));assert.ok(!JSON.stringify(stored).includes('PRIVATE_CHAT'));assert.ok(!JSON.stringify(stored).includes('test-only'));
  const savedBefore=fs.readFileSync(path.join(stateDir,'state.json'),'utf8');
  await scan(22,{dryRun:true});assert.equal(fs.readFileSync(path.join(stateDir,'state.json'),'utf8'),savedBefore);
  online=true;await scan(25);assert.equal(received.size,1);
  // Simulate a crash after server acknowledgement but before local acknowledgement.
  stored.queue=[event];write(path.join(stateDir,'state.json'),stored);
  await scan(26);assert.equal(received.size,1);
  append([usage(20,160,16,65)]);await scan(27);assert.equal(received.size,1);
  // Resumed file overlaps old counters. Only the unseen increment is uploaded.
  append([meta('thread-1'),usage(10,110,11,45),usage(20,160,16,65),usage(70,200,20,80)],path.join(sessions,'resume.jsonl'));
  await scan(71);assert.equal(received.size,2);
  assert.equal([...received.values()][1].occurredAt,when(70),'Preserve original date across IST midnight');
  // Child agents and CLI sessions are not silently added to primary totals.
  append([meta('child',{subagent:{other:'guardian'}}),usage(72,1000,100),usage(73,2000,200)],path.join(sessions,'child.jsonl'));
  append([meta('cli','cli'),usage(72,1000,100),usage(73,2000,200)],path.join(sessions,'cli.jsonl'));
  await scan(74);assert.equal(received.size,2);
  // Outside-course sessions do not become student usage.
  append([meta('other','vscode',root),usage(72,1000,100),usage(73,2000,200)],path.join(sessions,'other.jsonl'));
  await scan(75);assert.equal(received.size,2);
  // Partial JSON does not advance past its bytes; the completed line is collected later.
  const partial=JSON.stringify(usage(80,220,22,90));
  fs.appendFileSync(log,partial.slice(0,40));assert.equal((await scan(81)).partialRecords,1);
  fs.appendFileSync(log,partial.slice(40)+'\n');await scan(82);assert.equal(received.size,3);
  // A project switch excludes the uncertain boundary, then uses the new saved key.
  manifest('project-2');append([usage(90,250,25,100)]);await scan(91);
  append([usage(100,280,28,110)]);await scan(101);
  append([usage(110,310,31,120)]);await scan(111);assert.equal(received.size,4);
  assert.equal([...received.values()].at(-1).projectId,'agent-'+hash(['batch-2','student@example.test','project-2']));
  // Counter resets freeze the affected session, rather than adding a second lifetime total.
  append([usage(120,1,1,0),usage(130,100,10,0)]);const reset=await scan(131);assert.equal(reset.counterResets,1);assert.equal(received.size,4);
  await assert.rejects(run({...c,studentId:'different'}),/Enrollment changed/);
  fs.writeFileSync(path.join(stateDir,'collector.lock'),String(process.pid));
  await assert.rejects(scan(140),/Another collector/);fs.unlinkSync(path.join(stateDir,'collector.lock'));
  assert.throws(()=>counters({total_token_usage:{input_tokens:10,output_tokens:2,cached_input_tokens:11,total_tokens:12}}),/schema/);
  const beforeInvalid=fs.readFileSync(path.join(stateDir,'state.json'),'utf8');
  fs.appendFileSync(log,'invalid-json\n');await assert.rejects(scan(150),/Invalid complete session record/);
  assert.equal(fs.readFileSync(path.join(stateDir,'state.json'),'utf8'),beforeInvalid);
  // Auto mode needs no project list; independent Desktop/course folders are discovered.
  const autoSessions=path.join(root,'auto-sessions');fs.mkdirSync(autoSessions);
  const desktopProject=path.join(root,'Desktop','First App'),courseProject=path.join(root,'Course','Another App');
  for(const [p,key] of [[desktopProject,'desktop-project'],[courseProject,'course-project']]) {
    fs.mkdirSync(path.join(p,'src'),{recursive:true});write(path.join(p,'.yuvabe-project.json'),{key,title:key});
  }
  const autoConfig=path.join(root,'auto-config.json');
  write(autoConfig,{enabled:true,telemetry_config:mentor,account_id:'shared-1',started_at:when(200),sessions_dir:autoSessions,state_dir:path.join(root,'auto-state'),discovery:'auto'});
  const auto=loadConfig(autoConfig);assert.deepEqual(auto.roots,[]);
  const autoScan=second=>run(auto,{now:when(second)});
  const desktopLog=path.join(autoSessions,'desktop.jsonl'),courseLog=path.join(autoSessions,'course.jsonl');
  await autoScan(200);
  append([meta('desktop','vscode',desktopProject),usage(201,100,10),usage(202,200,20)],desktopLog);
  append([meta('course','vscode',path.join(courseProject,'src')),usage(201,100,10),usage(202,200,20)],courseLog);
  const firstAuto=await autoScan(203);assert.equal(firstAuto.identifiedProjects,2);assert.equal(firstAuto.heldForReview,2);
  for(const file of [desktopLog,courseLog])append([usage(204,300,30),usage(205,400,40)],file);
  await autoScan(206);
  const desktopEvent=[...received.values()].find(e=>e.sessionId==='desktop');
  assert.equal(desktopEvent.projectId,'agent-'+hash(['batch-2','student@example.test','desktop-project']));
  assert.equal([...received.values()].find(e=>e.sessionId==='course').projectId,'agent-'+hash(['batch-2','student@example.test','course-project']));
  const moved=path.join(root,'Renamed App');fs.renameSync(desktopProject,moved);
  append([{type:'turn_context',payload:{cwd:moved}},usage(207,500,50)],desktopLog);await autoScan(208);
  assert.equal([...received.values()].filter(e=>e.sessionId==='desktop').at(-1).projectId,desktopEvent.projectId);
  // Nested unrelated repositories cannot inherit their parent's identity.
  const nested=path.join(courseProject,'unrelated');fs.mkdirSync(path.join(nested,'.git'),{recursive:true});
  assert.equal(discoverProjectRoot(nested),null);
  append([meta('nested','vscode',nested),usage(210,100,10),usage(211,200,20)],path.join(autoSessions,'nested.jsonl'));
  await autoScan(212);assert.ok(![...received.values()].some(e=>e.sessionId==='nested'));
  // Unidentified usage is retained locally; new identity must not guess past attribution.
  const unknown=path.join(root,'New Folder');fs.mkdirSync(unknown);
  append([meta('unknown','vscode',unknown),usage(213,100,10),usage(214,200,20)],path.join(autoSessions,'unknown.jsonl'));
  await autoScan(215);
  write(path.join(unknown,'.yuvabe-project.json'),{key:'later-project',title:'Later project'});
  await autoScan(216);
  assert.ok(![...received.values()].some(e=>e.sessionId==='unknown'));
  const autoState=JSON.parse(fs.readFileSync(path.join(auto.stateDir,'state.json')));
  assert.ok(autoState.held.some(item=>item.event.sessionId==='unknown'));
  assert.equal(discoverProjectRoot(os.homedir()),null);
  // Fresh installation: no sessions directory yet. Validation must not create it.
  const freshConfig=path.join(root,'fresh-config.json');
  const freshSessions=path.join(root,'fresh-codex','sessions'),freshState=path.join(root,'fresh-state');
  write(freshConfig,{enabled:true,telemetry_config:mentor,account_id:'shared-1',started_at:when(300),sessions_dir:freshSessions,state_dir:freshState,discovery:'auto'});
  const validation=spawnSync(process.execPath,[path.resolve(__dirname,'../tools/usage-collector/collector.js'),'--config',freshConfig,'--dry-run'],{encoding:'utf8'});
  assert.equal(validation.status,0,validation.stderr);
  assert.equal(JSON.parse(validation.stdout).waitingForSessions,true);
  assert.ok(!fs.existsSync(freshSessions));assert.ok(!fs.existsSync(freshState));
  const requestsBeforeWaiting=requests;
  const waiting=await run(loadConfig(freshConfig),{now:when(300)});
  assert.equal(waiting.waitingForSessions,true);assert.equal(waiting.lastError,null);
  assert.equal(waiting.pending,0);assert.equal(requests,requestsBeforeWaiting);
  const waitingState=JSON.parse(fs.readFileSync(path.join(freshState,'state.json')));
  fs.mkdirSync(freshSessions,{recursive:true});
  assert.equal((await run(loadConfig(freshConfig),{now:when(301)})).waitingForSessions,false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(freshState,'state.json'))).identity,waitingState.identity);
  const freshLog=path.join(freshSessions,'first.jsonl');
  append([meta('fresh','vscode',courseProject),usage(302,100,10)],freshLog);
  await run(loadConfig(freshConfig),{now:when(303)});
  append([usage(304,200,20),usage(305,250,25)],freshLog);
  await run(loadConfig(freshConfig),{now:when(306)});
  const freshEvents=[...received.values()].filter(e=>e.sessionId==='fresh');
  assert.equal(freshEvents.length,1);assert.equal(freshEvents[0].inputTokens,50);assert.equal(freshEvents[0].outputTokens,5);
  // Other filesystem errors must still fail visibly, not look like an idle collector.
  const notDirectory=path.join(root,'not-a-directory');fs.writeFileSync(notDirectory,'test');
  await assert.rejects(run({...loadConfig(freshConfig),sessionsDir:notDirectory,stateDir:path.join(root,'invalid-state')},{dryRun:true}),e=>e.code==='ENOTDIR');
  const originalReadDir=fs.readdirSync;
  try {
    fs.readdirSync=()=>{throw Object.assign(new Error('Access denied'),{code:'EACCES'});};
    await assert.rejects(run(loadConfig(freshConfig),{dryRun:true}),e=>e.code==='EACCES');
  } finally {fs.readdirSync=originalReadDir;}
  console.log('PASS: installation before first session, dry-run without writes, idle status, stable identity and automatic collection when sessions appear; filesystem errors remain visible.');
  console.log('PASS: automatic discovery without folder lists, independent project folders, nested working directories, renamed/moved identity, repository boundaries and local retention of unidentified usage.');
  console.log('PASS: local HTTP upload, baseline, input/output/cache deltas, offline retry, crash replay, deduplication, resumed files, midnight timestamps, project isolation/switch, child exclusion, partial records, privacy, identity guard, lock and counter resets.');
}
test().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  // Only the unique temporary test directory is removed.
  fs.rmSync(root,{recursive:true,force:true});
});
