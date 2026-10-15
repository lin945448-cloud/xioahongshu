import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }
  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = req.headers.authorization;
  if (!url || !publicKey || !secret) { res.writeHead(503).end('{"message":"账号开通服务尚未配置"}'); return; }
  if (!authorization?.startsWith('Bearer ')) { res.writeHead(401).end('{"message":"请先登录"}'); return; }
  try {
    const userClient = createClient(url, publicKey, { global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false } });
    const { data: identity, error } = await userClient.auth.getUser(authorization.slice(7));
    if (error || !identity.user) { res.writeHead(401).end('{"message":"登录已失效"}'); return; }
    const access = await userClient.rpc('dashboard_role');
    if (access.error || access.data !== 'admin') { res.writeHead(403).end('{"message":"仅管理员可以开通查看者账号"}'); return; }
    let body = req.body;
    if (!body) {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 2048) { res.writeHead(413).end(); return; }
        chunks.push(Buffer.from(chunk));
      }
      body = Buffer.concat(chunks).toString('utf8');
    }
    if (typeof body === 'string') body = JSON.parse(body);
    const email = String((body as { email?: unknown })?.email ?? '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.writeHead(400).end('{"message":"请输入有效邮箱"}'); return;
    }
    // This RPC also rejects administrator targets; this endpoint can only issue viewer access.
    const granted = await userClient.rpc('dashboard_set_viewer', { p_email: email, p_allowed: true });
    if (granted.error) { res.writeHead(400).end('{"message":"不能修改管理员账号，或邮箱无效"}'); return; }
    const operator = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    // A magic-link is a one-time credential handed privately to the intended recipient by the admin.
    // generateLink does not send email and can create a new account without SMTP.
    const link = await operator.auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error) { res.writeHead(502).end('{"message":"开通链接生成失败，请稍后重试"}'); return; }
    res.end(JSON.stringify({ tokenHash: link.data.properties.hashed_token, type: link.data.properties.verification_type }));
  } catch { res.writeHead(502).end('{"message":"账号服务暂时不可用，请稍后重试"}'); }
}
