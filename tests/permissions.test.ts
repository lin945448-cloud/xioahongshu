import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('database authorization and monthly import boundaries', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values
        ('00000000-0000-0000-0000-000000000001','admin@example.com',now()),
        ('00000000-0000-0000-0000-000000000002','viewer@example.com',now()),
        ('00000000-0000-0000-0000-000000000003','stranger@example.com',now()),
        ('00000000-0000-0000-0000-000000000004','admin@example.com',null);`);
    await db.exec(await readFile(new URL('../supabase/migrations/202610150001_dashboard.sql', import.meta.url), 'utf8'));
    await db.exec("insert into public.dashboard_members(email,role) values('admin@example.com','admin')");
    const identity = async (role: string, suffix = '') => {
      await db.exec(`reset role; set role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [suffix ? `00000000-0000-0000-0000-${suffix.padStart(12, '0')}` : '']);
    };
    const note = { title: '测试笔记', publishAt: 1790812800000, ym: '2026-10', month: 10, seq: 1,
      genre: '图文', category: '测试', impressions: 100, views: 50, ctr: 0.1, likes: 5, comments: 1,
      collects: 2, followers: 1, shares: 1 };
    const upload = (month = '2026-10-01', hash = 'a'.repeat(64), rows: unknown[] = [note]) => db.query(
      'select public.dashboard_import($1,$2,$3,$4,$5::jsonb) as id', ['主账号', month, 'test.xlsx', hash, JSON.stringify(rows)]);

    await identity('anon');
    await assert.rejects(db.query('select * from public.dashboard_batches'), /permission denied/);
    await assert.rejects(upload(), /permission denied/);
    await identity('authenticated', '3');
    assert.equal((await db.query('select * from public.dashboard_batches')).rows.length, 0);
    await assert.rejects(upload(), /仅管理员/);
    await assert.rejects(db.query("select public.dashboard_set_viewer('stranger@example.com',true)"), /仅管理员/);
    await assert.rejects(db.query("insert into public.dashboard_members values('stranger@example.com','admin',now())"), /permission denied/);
    await identity('authenticated', '4');
    assert.equal((await db.query<{ role: string | null }>('select public.dashboard_role() as role')).rows[0].role, null);

    await identity('authenticated', '1');
    const first = await upload();
    const id = (first.rows[0] as { id: string }).id;
    await assert.rejects(upload('2026-10-01', 'b'.repeat(64)), /duplicate key/);
    await assert.rejects(upload('2026-11-01'), /duplicate key/);
    await assert.rejects(upload('2026-11-02', 'b'.repeat(64)), /无效/);
    await assert.rejects(upload('2026-11-01', 'b'.repeat(64), [{ title: 'bad' }]), /字段/);
    await assert.rejects(upload('2026-11-01', 'b'.repeat(64), [{ ...note, views: -1 }]), /数值/);
    await db.query("select public.dashboard_set_viewer('VIEWER@example.com',true)");
    await assert.rejects(db.query("select public.dashboard_set_viewer('admin@example.com',false)"), /管理员权限/);

    await identity('authenticated', '2');
    assert.equal((await db.query('select * from public.dashboard_batches')).rows.length, 1);
    assert.equal((await db.query('select * from public.dashboard_members')).rows.length, 0);
    await assert.rejects(upload('2026-11-01', 'b'.repeat(64)), /仅管理员/);
    await assert.rejects(db.query('select public.dashboard_delete_batch($1)', [id]), /仅管理员/);
    await assert.rejects(db.query("update public.dashboard_batches set account='hacked'"), /permission denied/);

    await identity('authenticated', '1');
    await db.query("select public.dashboard_set_viewer('viewer@example.com',false)");
    await identity('authenticated', '2');
    assert.equal((await db.query('select * from public.dashboard_batches')).rows.length, 0, 'revoked user loses access without renewing JWT');
    await identity('authenticated', '1');
    await db.query('select public.dashboard_delete_batch($1)', [id]);
    assert.equal((await db.query('select * from public.dashboard_batches')).rows.length, 0);
    await upload(); // re-upload after explicit rollback is allowed
  } finally { await db.close(); }
});
