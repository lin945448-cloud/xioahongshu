import { databaseClient } from './database.mjs';
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('请传入管理员邮箱');
const client = await databaseClient();
try {
  await client.connect();
  await client.query("insert into public.dashboard_members(email,role) values($1,'admin') on conflict(email) do update set role='admin'", [email]);
  console.log('管理员邮箱已配置；本人注册并确认邮箱后即可登录。');
} catch (error) { console.error(`设置失败：${error.code ?? 'connection error'}`); process.exitCode = 1; }
finally { await client.end(); }
