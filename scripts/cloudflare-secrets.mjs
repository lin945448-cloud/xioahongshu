import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

// Only generate a local, git-ignored file. Never put these values in wrangler.jsonc or assets.
const values = parseEnv(await readFile('.env.production.local', 'utf8'));
const keys = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of keys) if (!values[key]) throw new Error(`Missing ${key} in .env.production.local`);
await writeFile('.cloudflare-secrets.json', JSON.stringify(Object.fromEntries(keys.map(key => [key, values[key]]))), { mode: 0o600 });
console.log('Cloudflare secrets prepared in a git-ignored local file. No values printed.');
