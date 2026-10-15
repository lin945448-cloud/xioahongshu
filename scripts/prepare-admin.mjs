// Trusted one-time operator action. Never run automatically in normal builds.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { databaseClient } from './database.mjs';

const email = process.env.SETUP_ADMIN_EMAIL;
if (!email) throw new Error('SETUP_ADMIN_EMAIL is required');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = await databaseClient();
try {
  await db.connect();
  const existing = await db.query('select id from auth.users where lower(email)=$1', [email.toLowerCase()]);
  if (!existing.rowCount) {
    const { error } = await admin.auth.admin.createUser({ email, password: `${randomUUID()}Aa1!`, email_confirm: true });
    if (error) throw error;
  } else {
    const { error } = await admin.auth.admin.updateUserById(existing.rows[0].id, { email_confirm: true });
    if (error) throw error;
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (error) throw error;
  await db.query('create schema if not exists dashboard_private');
  await db.query('revoke all on schema dashboard_private from public,anon,authenticated');
  await db.query('create table if not exists dashboard_private.one_time_setup(email text primary key, token_hash text not null, created_at timestamptz default now())');
  await db.query('revoke all on dashboard_private.one_time_setup from public,anon,authenticated');
  await db.query('insert into dashboard_private.one_time_setup(email,token_hash) values($1,$2) on conflict(email) do update set token_hash=excluded.token_hash,created_at=now()', [email, data.properties.hashed_token]);
  console.log('Administrator account prepared. One-time password-setup token stored privately; no email sent.');
} finally { await db.end(); }
