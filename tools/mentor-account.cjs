// Administrator-only provisioning. No passwords or provider keys are printed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
require('@next/env').loadEnvConfig(root, true, { info() {}, error() {} });
async function run() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Usage: node tools/mentor-account.cjs mentor@example.com');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configure the local Supabase URL and service-role key.');
  async function api(route, method='GET', body) {
    const r = await fetch(`${url}/auth/v1/admin/${route}`, { method, headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Supabase account administration failed (HTTP ${r.status}). No credentials were printed.`);
    return r.json();
  }
  let existing;
  for(let page=1;page<=100;page++) {
    const {users} = await api(`users?page=${page}&per_page=100`);
    existing = users.find(u => u.email?.toLowerCase() === email);
    if(existing || users.length<100) break;
    if(page===100) throw new Error('Too many accounts to scan; use the Supabase dashboard.');
  }
  if(existing) {
    await api(`users/${existing.id}`, 'PUT', {app_metadata:{...existing.app_metadata,role:'mentor'}});
    console.log('Mentor access assigned to the existing account. Its password was not changed.');
    return;
  }
  const password = crypto.randomBytes(24).toString('base64url');
  const output = path.join(root, '.env.mentor-login.local');
  fs.writeFileSync(output, `# Private initial login. Never commit or share this file.\n# Sign in, then use Account > Change password to set your own password.\nMENTOR_EMAIL=${email}\nMENTOR_INITIAL_PASSWORD=${password}\n`, {flag:'wx',mode:0o600});
  await api('users','POST',{email,password,email_confirm:true,app_metadata:{role:'mentor'}});
  console.log('Mentor account created. Initial login is saved in ignored .env.mentor-login.local. Change the password after signing in.');
}
run().catch(error=>{console.error(error instanceof TypeError?'Could not reach Supabase.':error.message);process.exitCode=1;});
