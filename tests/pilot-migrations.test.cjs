// Requires an isolated local PostgreSQL instance on port 55439, owned by pilot_test.
// Never reads .env.local or connects to Supabase. The database must be disposable.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { migrationSql } = require('../tools/pilot-setup.cjs');
const psql = process.env.PSQL_PATH || 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
function sql(input) {
  const result = spawnSync(psql, ['-X', '-w', '-h', '127.0.0.1', '-p', '55439', '-U', 'pilot_test', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input, encoding: 'utf8', windowsHide: true, timeout: 30000,
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
}
sql(`
create role service_role nologin bypassrls;
create role anon nologin;
create role authenticated nologin;
${fs.readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8')}
insert into telemetry_reports(student_id,student_name,report_date,month,week,day,lesson_confidence,understanding_status,progress_score,confidence_score,summary,recommended_tutor_action,trigger_reason)
values ('pilot-one','Pilot One','2026-10-10',1,1,1,'high','clear',70,80,'Original report one','Review','manual'),
       ('pilot-two','Pilot Two','2026-10-10',1,1,1,'medium','partial',40,60,'Original report two','Explain','manual');
create table test_original_reports as select id,to_jsonb(r) as original from telemetry_reports r;
`);
sql(migrationSql());
sql(`
do $$ begin
  if (select count(*) from telemetry_reports where batch_id='batch-1') <> 2 then raise exception 'Batch 1 preservation failed'; end if;
  if (select count(*) from batch_students where batch_id='batch-1') <> 2 then raise exception 'Enrollment missing'; end if;
  if exists(select 1 from batch_students where batch_id='batch-2') then raise exception 'Unexpected fictional enrollment'; end if;
  if exists(select 1 from test_original_reports b join telemetry_reports r using(id) where not(to_jsonb(r) @> b.original)) then raise exception 'Report content changed'; end if;
  if has_function_privilege('anon','claim_student_summary(text,text,uuid)','execute') then raise exception 'Anon can claim'; end if;
  if has_function_privilege('authenticated','finish_student_summary(text,text,uuid,text,jsonb,jsonb)','execute') then raise exception 'Authenticated can save'; end if;
  if exists(select 1 from pg_class where relname in ('batches','batch_students','shared_accounts','student_projects','usage_events','student_summaries','student_summary_locks') and not relrowsecurity) then raise exception 'RLS disabled'; end if;
end $$;
insert into batch_students values ('batch-2','pilot-one','Pilot One',null);
update telemetry_reports set batch_id='batch-2' where student_id='pilot-one';
`);
sql(migrationSql());
sql(`
set role service_role;
do $$ begin
  if (select count(*) from telemetry_reports where batch_id='batch-2') <> 1 then raise exception 'Rerun reassigned a report'; end if;
  if not claim_student_summary('batch-2','pilot-one','11111111-1111-4111-8111-111111111111') then raise exception 'First lease failed'; end if;
  if claim_student_summary('batch-2','pilot-one','22222222-2222-4222-8222-222222222222') then raise exception 'Concurrent lease accepted'; end if;
  if finish_student_summary('batch-2','pilot-one','22222222-2222-4222-8222-222222222222','test-scope','{}','{}') then raise exception 'Wrong owner saved'; end if;
  if not finish_student_summary('batch-2','pilot-one','11111111-1111-4111-8111-111111111111','test-scope','{}','{"test":true}') then raise exception 'Owner could not save'; end if;
  if (select count(*) from student_summaries where scope_key='test-scope') <> 1 then raise exception 'Summary missing'; end if;
  if claim_student_summary('batch-2','pilot-one','33333333-3333-4333-8333-333333333333') then raise exception 'Cooldown ignored'; end if;
end $$;
`);
console.log('PASS: original reports preserved, historical enrollment, no fictional Batch 2 roster, rerun preserves batch assignment, RLS/function grants, summary leases/save/cooldown.');
