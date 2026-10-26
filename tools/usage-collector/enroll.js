#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function readEnrollment(configPath, accountId) {
  const c = JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
  if (c.reporting_enabled !== true || c.project_mode !== 'agent') throw Error('Enable student reporting with project_mode "agent" in the mentor configuration.');
  const student = { studentId: c.student_id, studentName: c.student_name, batchId: c.batch_id, accountId };
  for (const [key,value] of Object.entries(student)) {
    if (typeof value !== 'string' || !value.trim() || value.length > (key === 'studentName' ? 160 : 200) || /[\x00-\x1f\x7f]/.test(value)) throw Error(`Set a valid ${key} before installing.`);
    student[key] = value.trim();
  }
  if (typeof c.token !== 'string' || !c.token.trim() || /^(?:REPLACE_WITH_|YOUR[_ -]|<)/i.test(c.token)) throw Error('The mentor must configure the private upload key before installing.');
  const endpoint = new URL('/api/enrollment', c.endpoint);
  if (endpoint.username || endpoint.password || !(endpoint.protocol === 'https:' || (endpoint.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))) throw Error('Enrollment requires HTTPS (HTTP allowed only on localhost for tests).');
  return { endpoint: endpoint.href, token: c.token.trim(), student };
}

async function enroll(config, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(config.endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(config.student) });
  } catch { throw Error('Could not connect to enrollment. Check the internet and backend address, then rerun installation.'); }
  if (response.status === 404) throw Error('Enrollment endpoint is unavailable. Deploy the updated backend before installing.');
  if (response.status === 401) throw Error('Upload key rejected. Ask the mentor to check the private configuration.');
  let result;
  try { result = await response.json(); } catch { throw Error(`Enrollment returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok || result.ok !== true) throw Error(`Enrollment failed (HTTP ${response.status}). ${result.message || 'Check the student, batch and shared account configuration.'}`);
  if (typeof result.created !== 'boolean' || !result.student || Object.entries(config.student).some(([k,v]) => result.student[k] !== v)) throw Error('Backend returned a different enrollment. Installation stopped.');
  return result;
}

async function main(argv) {
  let configPath = path.join(os.homedir(),'.codex','telemetry_config.json'), accountId;
  if (argv.includes('--help')) { console.log('Usage: node enroll.js --account-id ID [--config TELEMETRY_CONFIG_PATH]\nRegisters/verifies the mentor-configured student. Creates no report, project, token usage or student login.'); return; }
  for (let i=0;i<argv.length;i++) {
    const key=argv[i],value=argv[++i];
    if (!value || !['--config','--account-id'].includes(key)) throw Error('Use --account-id ID and optionally --config PATH.');
    if (key==='--config') configPath=path.resolve(value); else accountId=value;
  }
  const result=await enroll(readEnrollment(configPath,accountId));
  console.log(`Enrollment ${result.created ? 'created' : 'already correct'}: ${result.student.studentName} (${result.student.studentId}), ${result.student.batchId}, ${result.student.accountId}.`);
}
module.exports={readEnrollment,enroll};
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
