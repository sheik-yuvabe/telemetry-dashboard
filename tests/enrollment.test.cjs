const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(__dirname,'..',name.slice(2)):name,...args);};
const {POST}=require('../app/api/enrollment/route.ts');
const {readEnrollment,enroll}=require('../tools/usage-collector/enroll');
const student={studentId:'student@example.test',studentName:'Test Student',batchId:'batch-2',accountId:'account-1'};
const students=new Map();let writes=0,calls=0,available=true,active=true;
process.env.SUPABASE_URL='https://db.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-key';process.env.TELEMETRY_INGEST_TOKEN='test-ingest';
global.fetch=async(url,init={})=>{
  calls++;const u=new URL(url),table=u.pathname.split('/').at(-1);
  assert.equal(u.origin,'https://db.test');
  assert.ok(['batches','shared_accounts','batch_students'].includes(table),'Enrollment must not write reports, projects, usage or Auth users');
  if(!available)return Response.json({}, {status:503});
  if(table==='batches')return Response.json(u.searchParams.get('id')==='eq.batch-2'?[{id:'batch-2',status:active?'active':'archived'}]:[]);
  if(table==='shared_accounts')return Response.json(u.searchParams.get('id')==='eq.account-1'?[{id:'account-1'}]:[]);
  if(init.method==='POST'){
    assert.equal(u.searchParams.get('on_conflict'),'batch_id,student_id');assert.match(init.headers.Prefer,/ignore-duplicates/);
    const row=JSON.parse(init.body),key=row.batch_id+':'+row.student_id;
    if(students.has(key))return Response.json([]);
    students.set(key,row);writes++;return Response.json([row]);
  }
  const row=students.get(u.searchParams.get('batch_id').slice(3)+':'+u.searchParams.get('student_id').slice(3));return Response.json(row?[row]:[]);
};
const post=(body=student,token='test-ingest')=>POST(new Request('https://app.test/api/enrollment',{method:'POST',headers:{Authorization:'Bearer '+token},body:typeof body==='string'?body:JSON.stringify(body)}));
async function test(){
  assert.equal((await post(student,'bad-key')).status,401);assert.equal(calls,0);
  delete process.env.TELEMETRY_INGEST_TOKEN;assert.equal((await post()).status,503);assert.equal(calls,0);process.env.TELEMETRY_INGEST_TOKEN='test-ingest';
  for(const bad of [null,[],{}, {...student,studentName:''},{...student,studentId:'x\nvalue'},{...student,studentId:9}])assert.equal((await post(bad)).status,400);
  assert.equal((await post('not-json')).status,400);assert.equal((await post('x'.repeat(4097))).status,413);assert.equal(writes,0);
  assert.equal((await post({...student,batchId:'unknown'})).status,400);
  assert.equal((await post({...student,accountId:'unknown'})).status,400);assert.equal(writes,0);
  active=false;assert.equal((await post()).status,409);active=true;
  let result=await post();assert.equal(result.status,201);assert.equal((await result.json()).created,true);assert.equal(writes,1);
  result=await post();assert.equal(result.status,200);assert.equal((await result.json()).created,false);assert.equal(writes,1);
  assert.equal((await post({...student,studentName:'Other Student'})).status,409);assert.equal(writes,1);
  students.get('batch-2:'+student.studentId).account_id=null;
  assert.equal((await post()).status,409);assert.equal(students.get('batch-2:'+student.studentId).account_id,null);
  students.get('batch-2:'+student.studentId).account_id='account-1';
  const concurrent={...student,studentId:'concurrent'};
  const responses=await Promise.all([post(concurrent),post(concurrent)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);assert.equal(writes,2);
  const conflict=await Promise.all([post({...student,studentId:'conflict',studentName:'One'}),post({...student,studentId:'conflict',studentName:'Two'})]);assert.deepEqual(conflict.map(r=>r.status).sort(),[201,409]);assert.equal(writes,3);
  available=false;assert.equal((await post({...student,studentId:'offline'})).status,503);available=true;
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'enrollment-test-'));const config=path.join(temp,'telemetry.json');
  try{
    const mentor={student_id:student.studentId,student_name:student.studentName,batch_id:student.batchId,project_mode:'agent',reporting_enabled:true,endpoint:'https://app.test/api/feedback',token:'test-ingest'};
    fs.writeFileSync(config,JSON.stringify(mentor));const input=readEnrollment(config,'account-1');
    assert.equal(input.endpoint,'https://app.test/api/enrollment');assert.deepEqual(input.student,student);
    const enrolled=await enroll(input,async(url,init)=>{assert.equal(init.redirect,'error');assert.ok(!init.body.includes('test-ingest'));return POST(new Request(url,init));});assert.equal(enrolled.created,false);
    await assert.rejects(enroll(input,async()=>Response.json({}, {status:401})),/Upload key rejected/);
    await assert.rejects(enroll(input,async()=>Response.json({}, {status:404})),/Deploy the updated backend/);
    await assert.rejects(enroll(input,async()=>{throw Error('network');}),/Could not connect/);
    await assert.rejects(enroll(input,async()=>Response.json({ok:true,created:true,student:{...student,studentId:'wrong'}})),/different enrollment/);
    for(const change of [{reporting_enabled:false},{student_name:''},{token:'REPLACE_WITH_TOKEN'},{endpoint:'http://remote.test'},{project_mode:'manual'}]){
      fs.writeFileSync(config,JSON.stringify({...mentor,...change}));assert.throws(()=>readEnrollment(config,'account-1'));
    }
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
  console.log('PASS: authenticated enrollment, validation, existing batch/account checks, archived batch rejection, idempotent/concurrent install, conflict preservation, backend failures and installer enrollment client. No assessment or Auth users created.');
}
test().catch(e=>{console.error(e);process.exitCode=1;});
