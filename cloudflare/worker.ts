export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: privateHeaders });

async function bodyWithin(request: Request, maximum: number): Promise<Uint8Array | undefined> {
  if (!request.body) return undefined;
  if (Number(request.headers.get('Content-Length')) > maximum) throw new Error('PAYLOAD_TOO_LARGE');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error('PAYLOAD_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

async function proxy(request: Request, env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json({ message: '内部数据库尚未配置' }, 503);
  const input = new URL(request.url);
  const path = input.pathname.startsWith('/api/supabase/')
    ? input.pathname.slice('/api/supabase/'.length) : input.searchParams.get('path') || '';
  if (!/^(auth|rest)\/v1(?:\/|$)/.test(path) || path.includes('..') || /[\\?#]/.test(path)) return json({ message: '接口不存在' }, 404);
  input.searchParams.delete('path');
  const target = new URL(`/${path}`, env.SUPABASE_URL);
  target.search = input.searchParams.toString();
  if (target.origin !== new URL(env.SUPABASE_URL).origin) return json({ message: '无效请求' }, 400);
  const headers = new Headers({ apikey: env.SUPABASE_ANON_KEY });
  for (const name of ['authorization', 'apikey', 'content-type', 'accept', 'prefer', 'range', 'range-unit', 'x-client-info', 'x-supabase-api-version']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await bodyWithin(request, 4_000_000);
  const upstream = await fetch(target, { method: request.method, headers, body: body as BodyInit | undefined,
    redirect: 'manual', signal: AbortSignal.timeout(25_000) });
  const responseHeaders = new Headers(privateHeaders);
  for (const name of ['content-type', 'content-range', 'range-unit', 'preference-applied', 'x-total-count', 'retry-after']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

async function memberSetup(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ message: '仅支持 POST' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ message: '账号开通服务尚未配置' }, 503);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ message: '请先登录' }, 401);
  const userHeaders = { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization, 'Content-Type': 'application/json' };
  const endpoint = (path: string) => new URL(path, env.SUPABASE_URL);
  const identity = await fetch(endpoint('/auth/v1/user'), { headers: userHeaders, signal: AbortSignal.timeout(15_000) });
  if (!identity.ok) return json({ message: '登录已失效' }, 401);
  const user = await identity.json() as { id?: string };
  if (!user.id) return json({ message: '登录已失效' }, 401);
  const role = await fetch(endpoint('/rest/v1/rpc/dashboard_role'), { method: 'POST', headers: userHeaders, body: '{}', signal: AbortSignal.timeout(15_000) });
  if (!role.ok || await role.json() !== 'admin') return json({ message: '仅管理员可以开通查看者账号' }, 403);
  let parsed: { email?: unknown };
  try { parsed = JSON.parse(new TextDecoder().decode(await bodyWithin(request, 2048))); }
  catch (error) {
    if ((error as Error).message === 'PAYLOAD_TOO_LARGE') throw error;
    return json({ message: '请求格式无效' }, 400);
  }
  const email = String(parsed?.email ?? '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ message: '请输入有效邮箱' }, 400);
  // The database rejects administrator targets. Only viewer access may be granted here.
  const granted = await fetch(endpoint('/rest/v1/rpc/dashboard_set_viewer'), { method: 'POST', headers: userHeaders,
    body: JSON.stringify({ p_email: email, p_allowed: true }), signal: AbortSignal.timeout(15_000) });
  if (!granted.ok) return json({ message: '不能修改管理员账号，或邮箱无效' }, 400);
  // The service credential is used ONLY after user identity, admin role and target checks succeed.
  const generated = await fetch(endpoint('/auth/v1/admin/generate_link'), { method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }), signal: AbortSignal.timeout(15_000) });
  if (!generated.ok) return json({ message: '开通链接生成失败，请稍后重试' }, 502);
  const result = await generated.json() as { properties?: { hashed_token?: string; verification_type?: string }; hashed_token?: string; verification_type?: string };
  const properties = result.properties ?? result;
  if (!properties.hashed_token || !['signup', 'magiclink'].includes(properties.verification_type || '')) return json({ message: '账号服务返回无效链接' }, 502);
  return json({ tokenHash: properties.hashed_token, type: properties.verification_type });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/member-setup') return await memberSetup(request, env);
      if (path === '/api/supabase' || path.startsWith('/api/supabase/')) return await proxy(request, env);
      if (path.startsWith('/api/')) return json({ message: '接口不存在' }, 404);
      return await env.ASSETS.fetch(request);
    } catch (error) {
      return (error as Error).message === 'PAYLOAD_TOO_LARGE'
        ? json({ message: '请求过大，请减少单批数据量' }, 413)
        : json({ message: '数据库连接暂时不可用，请稍后重试' }, 502);
    }
  },
};
