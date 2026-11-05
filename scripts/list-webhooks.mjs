// Lists the tenant's registered webhooks. Read-only.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
	const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
	if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
}
const { KEYID: kid, SECRET: secret } = env;
const b64 = (i) => (Buffer.isBuffer(i) ? i : Buffer.from(i, 'utf8')).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid }));
const p = b64(JSON.stringify({ iat: now, nbf: now - 30, exp: now + 300 }));
const jwt = `${h}.${p}.${b64(createHmac('sha256', secret).update(`${h}.${p}`).digest())}`;

const BASE = process.env.CM_SIGN_BASE ?? 'https://api.cm.com/sign-sandbox/v1';

const res = await fetch(`${BASE}/clients/${kid}/webhooks`, {
	headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
});
const list = await res.json();
console.log(`${res.status} — ${Array.isArray(list) ? list.length : '?'} webhook(s)`);
for (const w of Array.isArray(list) ? list : []) {
	console.log(`  ${w.id}  ${w.url}  [${(w.events ?? []).join(', ')}]`);
}
