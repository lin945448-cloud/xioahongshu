import { readFile, readdir } from 'node:fs/promises';
import { databaseClient } from './database.mjs';

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connectionString) throw new Error('缺少数据库连接配置，请先拉取 Vercel 环境变量');
const client = await databaseClient();
try {
  await client.connect();
  await client.query("select pg_advisory_lock(hashtext('xhs_dashboard_migrations'))");
  await client.query('create table if not exists public.dashboard_migrations (name text primary key, applied_at timestamptz not null default now())');
  for (const name of (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort()) {
    const done = await client.query('select 1 from public.dashboard_migrations where name=$1', [name]);
    if (done.rowCount) continue;
    const sql = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
    // The migration itself is transactional; record it in the same transaction.
    await client.query(sql.replace(/commit;\s*$/i, ''));
    await client.query('insert into public.dashboard_migrations(name) values($1)', [name]);
    await client.query('commit');
    console.log(`Applied ${name}`);
  }
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error(`迁移失败：${error.code ?? 'connection error'} ${error.message.replaceAll(connectionString, '[redacted]')}`);
  process.exitCode = 1;
} finally { await client.end(); }
