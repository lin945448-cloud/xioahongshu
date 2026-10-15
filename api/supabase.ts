import type { IncomingMessage, ServerResponse } from 'node:http';

// Same-origin transport only. All authorization remains with Supabase Auth + database RLS.
// Never add a service-role/secret key here or rewrite user Authorization headers.
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!origin || !publicKey) { res.writeHead(503).end('{"message":"内部数据库尚未配置"}'); return; }
  const input = new URL(req.url || '/', 'http://localhost');
  const path = input.searchParams.get('path') || '';
  if (!/^(auth|rest)\/v1(?:\/|$)/.test(path) || path.includes('..') || /[\\?#]/.test(path)) {
    res.writeHead(404).end(); return;
  }
  input.searchParams.delete('path');
  const target = new URL(`/${path}`, origin);
  target.search = input.searchParams.toString();
  if (target.origin !== new URL(origin).origin) { res.writeHead(400).end(); return; }
  const headers = new Headers({ apikey: publicKey });
  for (const name of ['authorization', 'apikey', 'content-type', 'accept', 'prefer', 'range', 'range-unit', 'x-client-info', 'x-supabase-api-version']) {
    const value = req.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    if (req.body !== undefined) {
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      chunks.push(buffer); size = buffer.length;
    } else {
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 4_000_000) break;
        chunks.push(buffer);
      }
    }
    if (size > 4_000_000) { res.writeHead(413).end('{"message":"请求过大，请减少单批数据量"}'); return; }
    const upstream = await fetch(target, { method: req.method, headers,
      body: size && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined,
      redirect: 'manual', signal: AbortSignal.timeout(25_000) });
    for (const name of ['content-type', 'content-range', 'range-unit', 'preference-applied', 'x-total-count', 'retry-after']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.writeHead(upstream.status);
    if (!upstream.body) { res.end(); return; }
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch {
    if (!res.headersSent) res.writeHead(502).end('{"message":"数据库连接暂时不可用，请稍后重试"}');
    else res.end();
  }
}
