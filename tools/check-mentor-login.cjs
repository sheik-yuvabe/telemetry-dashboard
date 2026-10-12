// Read-only data smoke test plus disposable login/refresh/logout sessions.
// Initial password is loaded from the ignored provisioning file, never printed.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const base=process.argv[2]||'http://127.0.0.1:3000';
if(!['http://127.0.0.1:3000','https://aipbc.vercel.app'].includes(base))throw new Error('Unexpected backend target.');
const entries=Object.fromEntries(fs.readFileSync(path.join(root,'.env.mentor-login.local'),'utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
async function run(){
  const first=await fetch(base+'/',{redirect:'manual'});assert.equal(first.status,307);assert.ok(first.headers.get('location').startsWith('/sign-in'));console.log('Anonymous homepage redirects to sign-in.');
  for(const route of ['/api/workspace?batch=batch-2','/api/reports?date=2026-10-11','/api/summary?date=2026-10-11','/api/students/unknown/history','/api/students/unknown/progress','/api/students/unknown/summary'])assert.equal((await fetch(base+route)).status,401);
  console.log('All live report APIs reject anonymous access.');
  const post=(route,body,cookie='')=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});
  let cookie='';
  try{
    const login=await post('/api/auth/sign-in',{email:entries.MENTOR_EMAIL,password:entries.MENTOR_INITIAL_PASSWORD});
    if(login.status!==200)throw new Error(`Sign-in failed: HTTP ${login.status}`);
    cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
    assert.ok(cookie.includes('yuvabe_refresh='));console.log('Real Supabase mentor sign-in passed.');
    for(const batch of ['batch-1','batch-2']){
      const r=await fetch(base+'/api/workspace?batch='+batch,{headers:{Cookie:cookie}});assert.equal(r.status,200);const b=await r.json();assert.equal(b.workspace.mode,'live');
      console.log(JSON.stringify({batch,status:r.status,students:b.workspace.students.length,reports:b.reports.length}));
      for (const student of b.workspace.students) {
        const history = await fetch(base+'/api/students/'+encodeURIComponent(student.studentId)+'/history?batch='+batch,{headers:{Cookie:cookie}});
        assert.equal(history.status,200,'Enrolled student history must be readable');
      }
      console.log(`${batch}: every enrolled student history opened successfully.`);
    }
    const refreshed=await post('/api/auth/refresh',{},cookie);assert.equal(refreshed.status,200);cookie=refreshed.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');console.log('Session refresh passed.');
    const html=await fetch(base+'/',{headers:{Cookie:cookie},redirect:'manual'});assert.equal(html.status,200);console.log('Signed-in dashboard passed.');
  }finally{
    if(cookie){const logout=await post('/api/auth/sign-out',{},cookie);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);console.log('Sign out and cookie clearing passed.');}
  }
}
run().catch(error=>{console.error(error.message.startsWith('Sign-in failed')?error.message:'Login verification failed. Check backend availability and configuration.');process.exitCode=1});
