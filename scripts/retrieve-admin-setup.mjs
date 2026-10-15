import { writeFile } from 'node:fs/promises';
import { databaseClient } from './database.mjs';
const [email, baseURL] = process.argv.slice(2);
if (!email || !baseURL?.startsWith('https://')) throw new Error('Provide the administrator email and exact HTTPS deployment URL');
const db = await databaseClient();
try {
  await db.connect();
  const result = await db.query('select token_hash from dashboard_private.one_time_setup where email=$1', [email]);
  if (!result.rowCount) throw new Error('No one-time setup token found');
  const url = new URL(baseURL); url.hash = new URLSearchParams({ setup_token: result.rows[0].token_hash }).toString();
  await writeFile('.admin-setup.local', `管理员邮箱：${email}\n\n请在自己的浏览器打开下面的一次性链接，并设置至少 10 位登录密码：\n${url}\n\n此链接仅供你本人使用，通常 1 小时内有效，使用一次即失效。请勿转发。设置完成后可删除本文件。\n`, { mode: 0o600 });
  await db.query('delete from dashboard_private.one_time_setup where email=$1', [email]);
  console.log('One-time setup link saved to .admin-setup.local and removed from the database.');
} finally { await db.end(); }
