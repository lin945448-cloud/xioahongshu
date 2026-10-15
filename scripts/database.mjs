import { readFile } from 'node:fs/promises';
import pg from 'pg';

export async function databaseClient() {
  const raw = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!raw) throw new Error('缺少数据库连接配置，请先拉取 Vercel 环境变量');
  const url = new URL(raw);
  // pg connection-string SSL flags override `ssl.ca`; remove them before supplying the trusted CA.
  for (const name of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(name);
  const ca = await readFile(new URL('./certs/supabase-ca.crt', import.meta.url), 'utf8');
  return new pg.Client({ connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
}
