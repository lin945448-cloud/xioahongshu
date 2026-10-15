import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import handler from '../api/supabase.ts';

test('same-origin proxy forwards user credentials, bodies and queries without elevating permissions', async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://database.example.test';
  process.env.SUPABASE_ANON_KEY = 'public-key';
  let forwarded: { url: URL; options: RequestInit } | undefined;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://database.example.test')) {
      forwarded = { url: new URL(String(url)), options: options! };
      return new Response('[{"value":1}]', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' } });
    }
    return originalFetch(url, options);
  };
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const root = `http://127.0.0.1:${port}`;
  try {
    const response = await originalFetch(`${root}/api/supabase?path=rest/v1/rpc/dashboard_import&select=id`, {
      method: 'POST', headers: { Authorization: 'Bearer viewer-session', 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: '{"p_account":"test"}',
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('content-range'), '0-0/1');
    assert.equal(forwarded!.url.pathname, '/rest/v1/rpc/dashboard_import');
    assert.equal(forwarded!.url.search, '?select=id');
    const headers = new Headers(forwarded!.options.headers);
    assert.equal(headers.get('authorization'), 'Bearer viewer-session');
    assert.equal(headers.get('apikey'), 'public-key');
    assert.equal(String(forwarded!.options.body), '{"p_account":"test"}');
    await originalFetch(`${root}/api/supabase?path=rest/v1/dashboard_batches`);
    assert.equal(new Headers(forwarded!.options.headers).has('authorization'), false);
    for (const path of ['https://evil.example', 'storage/v1/object', 'auth/v1/../../private', 'rest\\v1\\users']) {
      assert.equal((await originalFetch(`${root}/api/supabase?path=${encodeURIComponent(path)}`)).status, 404);
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = oldKey;
  }
});
