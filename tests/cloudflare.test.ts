import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { type Env } from '../cloudflare/worker.ts';

test('Workers routes assets and proxies user-scoped requests without leaking service credentials', async () => {
  const original = globalThis.fetch;
  const calls: { url: string; headers: Headers; body: unknown }[] = [];
  const env: Env = { SUPABASE_URL: 'https://database.example.test', SUPABASE_ANON_KEY: 'public-key',
    SUPABASE_SERVICE_ROLE_KEY: 'server-only-key', ASSETS: { fetch: async () => new Response('public demo') } };
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: init?.body });
    return Response.json([{ views: 123 }], { headers: { 'Content-Range': '0-0/1' } });
  };
  try {
    assert.equal(await (await worker.fetch(new Request('https://site.workers.dev/'), env)).text(), 'public demo');
    assert.equal((await worker.fetch(new Request('https://site.workers.dev/api/unknown'), env)).status, 404);
    assert.equal((await worker.fetch(new Request('https://site.workers.dev/api/supabase/storage/v1/object'), env)).status, 404);
    assert.equal(calls.length, 0);
    const response = await worker.fetch(new Request('https://site.workers.dev/api/supabase/rest/v1/dashboard_batches?select=id',
      { headers: { Authorization: 'Bearer viewer-session', Range: '0-99' } }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('Content-Range'), '0-0/1');
    assert.equal(calls[0].url, 'https://database.example.test/rest/v1/dashboard_batches?select=id');
    assert.equal(calls[0].headers.get('Authorization'), 'Bearer viewer-session');
    assert.equal(calls[0].headers.get('apikey'), 'public-key');
    assert.equal(calls[0].headers.get('Range'), '0-99');
    await worker.fetch(new Request('https://site.workers.dev/api/supabase/auth/v1/health'), env);
    assert.equal(calls[1].headers.has('Authorization'), false);
    assert.ok(calls.every(c => ![...c.headers.values()].join().includes('server-only-key')));
    const oversized = await worker.fetch(new Request('https://site.workers.dev/api/supabase/rest/v1/rpc/dashboard_import',
      { method: 'POST', headers: { 'Content-Length': '4000001' }, body: '{}' }), env);
    assert.equal(oversized.status, 413);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = original; }
});

test('Workers viewer onboarding requires administrator role and protects administrator targets', async () => {
  const original = globalThis.fetch;
  let role = 'viewer'; let grantOK = true;
  const calls: { path: string; headers: Headers; body: string }[] = [];
  const env: Env = { SUPABASE_URL: 'https://database.example.test', SUPABASE_ANON_KEY: 'public-key',
    SUPABASE_SERVICE_ROLE_KEY: 'server-only-key', ASSETS: { fetch: async () => new Response('demo') } };
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    calls.push({ path, headers: new Headers(init?.headers), body: String(init?.body ?? '') });
    if (path === '/auth/v1/user') return Response.json({ id: 'verified-user' });
    if (path.endsWith('dashboard_role')) return Response.json(role);
    if (path.endsWith('dashboard_set_viewer')) return Response.json(null, { status: grantOK ? 200 : 400 });
    if (path.endsWith('generate_link')) return Response.json({ hashed_token: 'one-time-token', verification_type: 'signup' });
    throw new Error('unexpected outbound request');
  };
  const request = (authenticated = true) => new Request('https://site.workers.dev/api/member-setup', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer user-session' } : {}) },
    body: JSON.stringify({ email: 'COLLEAGUE@example.com' }),
  });
  try {
    assert.equal((await worker.fetch(request(false), env)).status, 401);
    assert.equal(calls.length, 0);
    assert.equal((await worker.fetch(request(), env)).status, 403);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(c => c.headers.get('apikey') === 'public-key'));
    calls.length = 0; role = 'admin'; grantOK = false;
    assert.equal((await worker.fetch(request(), env)).status, 400);
    assert.equal(calls.length, 3);
    assert.ok(calls.every(c => c.headers.get('apikey') === 'public-key'));
    calls.length = 0; grantOK = true;
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { tokenHash: 'one-time-token', type: 'signup' });
    assert.equal(calls[2].body, JSON.stringify({ p_email: 'colleague@example.com', p_allowed: true }));
    assert.equal(calls[3].headers.get('Authorization'), 'Bearer server-only-key');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  } finally { globalThis.fetch = original; }
});
