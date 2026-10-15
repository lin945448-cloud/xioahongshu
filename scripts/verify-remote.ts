// Run in a trusted CI/build environment with the same configured database, never in untrusted PR builds.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import handler from '../api/supabase.ts';
import memberHandler from '../api/member-setup.ts';

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/api/member-setup') { await memberHandler(req, res); return; }
  if (url.pathname.startsWith('/api/supabase/')) {
    url.searchParams.set('path', url.pathname.slice('/api/supabase/'.length));
    req.url = `/api/supabase?${url.searchParams}`;
    await handler(req, res); return;
  }
  const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (path.includes('..')) { res.writeHead(400).end(); return; }
  try {
    const data = await readFile(fileURLToPath(new URL(`../dist/${path}`, import.meta.url)));
    const mime = path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
    res.setHeader('Content-Type', mime); res.end(data);
  } catch { res.writeHead(404).end(); }
});
server.listen(5173, '127.0.0.1');
process.env.E2E_BROWSER_CHANNEL = 'chromium';
process.env.E2E_BASE_URL = 'http://127.0.0.1:5173';
process.env.E2E_SUPABASE_PROXY = 'http://127.0.0.1:5173/api/supabase';
try { await import('./verify-live.mjs'); }
finally { server.close(); }
