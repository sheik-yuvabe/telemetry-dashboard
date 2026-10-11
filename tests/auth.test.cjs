const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(name,...args){ return originalResolve.call(this,name.startsWith('@/') ? path.join(__dirname,'..',name.slice(2)) : name,...args); };
const auth = require('../lib/session-auth.ts');
const route = require('../app/api/auth/[action]/route.ts');
const { authorizeMentor } = require('../lib/mentor-api.ts');
process.env.SUPABASE_URL='https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY='server-only-test-key';
process.env.MENTOR_READ_TOKEN='old-shared-secret';
const originalFetch=global.fetch;
let role='mentor',confirmed=true,revoked=false,refreshes=0,logout=0,passwordUpdates=0,calls=0;
const user=()=>({id:'mentor-1',email:'mentor@example.com',email_confirmed_at:confirmed?'2026-10-11':null,app_metadata:{role},user_metadata:{role:'mentor'}});
const session=()=>({access_token:'valid-access',refresh_token:'valid-refresh',expires_in:3600,user:user()});
global.fetch=async(url,init={})=>{
  calls++;
  const target=new URL(url),body=init.body?JSON.parse(init.body):{};
  const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
  if(target.pathname.endsWith('/user')) {
    if(init.headers.Authorization!=='Bearer valid-access'||revoked)return json({},401);
    if(init.method==='PUT') {passwordUpdates++;assert.ok(body.password.length>=12);}
    return json(user());
  }
  if(target.pathname.endsWith('/token')) {
    if(target.searchParams.get('grant_type')==='refresh_token'){refreshes++;return body.refresh_token==='valid-refresh'?json(session()):json({},400);}
    return body.password==='correct-password'?json(session()):json({},400);
  }
  if(target.pathname.endsWith('/logout')){logout++;return new Response(null,{status:204});}
  throw new Error('Unexpected external request');
};
const post=(action,body={},headers={})=>route.POST(new Request(`https://app.test/api/auth/${action}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://app.test',...headers},body:JSON.stringify(body)}),{params:Promise.resolve({action})});
async function run(){
  await assert.rejects(()=>authorizeMentor(new Request('https://app.test')),/sign in/);
  await assert.rejects(()=>authorizeMentor(new Request('https://app.test',{headers:{Authorization:'Bearer old-shared-secret'}})),/expired/);
  let r=await post('sign-in',{email:'mentor@example.com',password:'wrong'});assert.equal(r.status,401);
  r=await post('sign-in',{email:'mentor@example.com',password:'correct-password'});
  assert.equal(r.status,200);const body=await r.json();assert.equal(body.user.email,'mentor@example.com');assert.equal(body.session,undefined);
  assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);assert.match(r.headers.get('set-cookie'),/SameSite=lax/i);
  assert.equal(r.headers.get('cache-control'),'no-store');
  const cookie='yuvabe_access=valid-access; yuvabe_refresh=valid-refresh';
  assert.equal((await authorizeMentor(new Request('https://app.test',{headers:{Cookie:cookie}}))).id,'mentor-1');
  const before=calls;
  r=await post('sign-in',{email:'mentor@example.com',password:'correct-password'},{Origin:'https://evil.test'});assert.equal(r.status,403);assert.equal(calls,before);
  r=await post('refresh',{}, {Cookie:cookie});assert.equal(r.status,200);assert.equal(refreshes,1);
  r=await post('refresh',{}, {Cookie:'yuvabe_refresh=expired'});assert.equal(r.status,401);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
  r=await post('sign-in',{email:'mentor@example.com',password:'correct-password'},{'X-Mentor-Client':'flutter'});assert.equal(r.headers.get('set-cookie'),null);assert.equal((await r.json()).session.refresh_token,'valid-refresh');
  role='student';
  await assert.rejects(()=>authorizeMentor(new Request('https://app.test',{headers:{Cookie:cookie}})),/mentor access/);
  r=await post('sign-in',{email:'mentor@example.com',password:'correct-password'});assert.equal(r.status,403);assert.equal(r.headers.get('set-cookie'),null);
  role='mentor';confirmed=false;await assert.rejects(()=>auth.verifyMentorToken('valid-access'),/mentor access/);confirmed=true;
  revoked=true;await assert.rejects(()=>auth.verifyMentorToken('valid-access'),/expired/);revoked=false;
  r=await post('password',{currentPassword:'wrong',password:'new-strong-password'},{Cookie:cookie});assert.equal(r.status,400);assert.equal(passwordUpdates,0);
  r=await post('password',{currentPassword:'correct-password',password:'new-strong-password'},{Cookie:cookie});assert.equal(r.status,200);assert.equal(passwordUpdates,1);
  r=await post('sign-out',{}, {Cookie:cookie});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);assert.ok(logout>=1);
  // Every old and new live read must reject before querying student storage.
  const preflight = await require('../app/api/workspace/route.ts').OPTIONS(new Request('https://app.test/api/workspace', {method:'OPTIONS', headers:{Origin:'http://localhost:8080'}}));
  assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers'),/X-Mentor-Client/);
  for(const file of ['reports','summary','workspace','students/[id]/progress','students/[id]/history','students/[id]/summary']) {
    const handler=require(`../app/api/${file}/route.ts`);
    const before=calls;
    r=await handler.GET(new Request('https://app.test/api/anything?batch=batch-2'),{params:Promise.resolve({id:'learner'})});
    assert.equal(r.status,401,file);assert.equal(calls,before,`${file} must not touch storage before authentication`);
  }
  console.log('PASS: cookie and Flutter sessions, refresh, logout, CSRF origins, revoked/unconfirmed/non-mentor accounts, password reauthentication, rejection of old tokens, and all report API access boundaries.');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.fetch=originalFetch;Module._resolveFilename=originalResolve});
