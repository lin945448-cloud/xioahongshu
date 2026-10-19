// Explicit integration test: uses disposable Auth users and a uniquely named batch, then cleans up.
// Run against a dedicated test database when possible. Requires local server + .env.local.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { databaseClient } from './database.mjs';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const stamp = randomUUID().slice(0, 8);
const account = `E2E-${stamp}`;
const password = `${randomUUID()}Aa1!`;
const authURL = process.env.E2E_SUPABASE_PROXY || process.env.SUPABASE_URL;
const auth = createClient(authURL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (url, options = {}) => {
    const headers = new Headers(options.headers);
    if (process.env.VERCEL_OIDC_TOKEN && new URL(url).origin === new URL(baseURL).origin)
      headers.set('x-vercel-trusted-oidc-idp-token', process.env.VERCEL_OIDC_TOKEN);
    return fetch(url, { ...options, headers });
  } },
});
const users = [];
const db = await databaseClient();
let browser;
const errors = [];
try {
  await db.connect();
  const identities = {};
  for (const role of ['admin', 'viewer', 'stranger']) {
    const email = `xhs-e2e-${stamp}-${role}@example.com`;
    const { data, error } = await auth.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`Cannot create disposable identity: ${error.message}`);
    users.push(data.user.id); identities[role] = email;
  }
  await db.query("insert into public.dashboard_members(email,role) values($1,'admin')", [identities.admin]);
  if (process.env.E2E_API_ONLY === '1') {
    const sessionClient = async email => {
      const client = createClient(authURL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await client.auth.signInWithPassword({ email, password });
      assert.equal(error, null); return client;
    };
    const admin = await sessionClient(identities.admin);
    const viewer = await sessionClient(identities.viewer);
    const stranger = await sessionClient(identities.stranger);
    assert.equal((await admin.rpc('dashboard_role')).data, 'admin');
    assert.equal((await stranger.rpc('dashboard_role')).data, null);
    assert.equal((await stranger.from('dashboard_batches').select('id')).data.length, 0);
    assert.equal((await admin.rpc('dashboard_set_viewer', { p_email: identities.viewer, p_allowed: true })).error, null);
    assert.equal((await viewer.rpc('dashboard_role')).data, 'viewer');
    const note = { title: '远程联调虚构笔记', publishAt: 1788307200000, ym: '2026-09', month: 9, seq: 1,
      genre: '图文', category: '测试', impressions: 100, views: 50, ctr: .1, likes: 5, comments: 1, collects: 2, followers: 1, shares: 1 };
    const args = { p_account: account, p_month: '2026-09-01', p_file_name: 'test.xlsx', p_hash: 'a'.repeat(64), p_notes: [note] };
    const imported = await admin.rpc('dashboard_import', args);
    assert.equal(imported.error, null);
    assert.ok((await viewer.rpc('dashboard_import', args)).error);
    assert.equal((await admin.rpc('dashboard_import', args)).error.code, '23505');
    const history = await viewer.from('dashboard_batches').select('notes,account').eq('id', imported.data).single();
    assert.equal(history.error, null); assert.equal(history.data.notes[0].views, 50);
    const fresh = await sessionClient(identities.viewer);
    assert.equal((await fresh.from('dashboard_batches').select('id').eq('id', imported.data)).data.length, 1);
    assert.ok((await viewer.rpc('dashboard_delete_batch', { p_id: imported.data })).error);
    assert.equal((await admin.rpc('dashboard_set_viewer', { p_email: identities.viewer, p_allowed: false })).error, null);
    assert.equal((await viewer.from('dashboard_batches').select('id')).data.length, 0);
    assert.equal((await admin.rpc('dashboard_delete_batch', { p_id: imported.data })).error, null);
    const adminToken = (await admin.auth.getSession()).data.session.access_token;
    const viewerToken = (await viewer.auth.getSession()).data.session.access_token;
    const setup = (email, token) => fetch(`${baseURL}/api/member-setup`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ email }) });
    assert.equal((await setup(identities.viewer)).status, 401);
    assert.equal((await setup(identities.viewer, viewerToken)).status, 403);
    assert.equal((await setup(identities.admin, adminToken)).status, 400);
    const newEmail = `xhs-e2e-${stamp}-onboarding@example.com`;
    const setupResponse = await setup(newEmail, adminToken);
    assert.equal(setupResponse.status, 200);
    const credentials = await setupResponse.json();
    const newUser = await db.query('select id from auth.users where email=$1', [newEmail]);
    users.push(newUser.rows[0].id);
    const newViewer = createClient(authURL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await newViewer.auth.verifyOtp({ token_hash: credentials.tokenHash, type: credentials.type })).error, null);
    assert.equal((await newViewer.rpc('dashboard_role')).data, 'viewer');
    assert.equal((await newViewer.auth.updateUser({ password: `${randomUUID()}Viewer1!` })).error, null);
    console.log('PASS admin-only viewer onboarding without email delivery, administrator-target rejection and password setup');
    const recovery = await auth.auth.admin.generateLink({ type: 'recovery', email: identities.admin });
    assert.equal(recovery.error, null);
    const recovered = createClient(authURL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await recovered.auth.verifyOtp({ token_hash: recovery.data.properties.hashed_token, type: 'recovery' })).error, null);
    const newPassword = `${randomUUID()}Changed1!`;
    assert.equal((await recovered.auth.updateUser({ password: newPassword })).error, null);
    assert.equal((await recovered.auth.signOut({ scope: 'local' })).error, null);
    const relogin = createClient(authURL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedInAgain = await relogin.auth.signInWithPassword({ email: identities.admin, password: newPassword });
    assert.equal(signedInAgain.error, null);
    assert.equal(signedInAgain.data.user.email, identities.admin);
    assert.equal((await relogin.rpc('dashboard_role')).data, 'admin');
    await relogin.auth.signOut({ scope: 'local' });
    console.log('PASS recovery password reset followed by actual sign-out and fresh administrator password login');
    console.log('PASS live Auth login, server proxy, administrator import, persistent history, viewer read-only, duplicate rejection, stranger isolation and immediate revocation');
  } else {
  browser = await chromium.launch({ headless: true, channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' });
  const secureContext = async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    if (process.env.VERCEL_OIDC_TOKEN) await context.route('**/*', route => {
      if (new URL(route.request().url()).origin !== new URL(baseURL).origin) return route.continue();
      return route.continue({ headers: { ...route.request().headers(),
        'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN } });
    });
    return context;
  };
  const page = await (await secureContext()).newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(baseURL);
  await page.getByRole('button', { name: '查看演示数据', exact: true }).click();
  await page.getByRole('button', { name: '数据明细', exact: true }).click();
  assert.ok(await page.getByText('数据归属月份', { exact: true }).count());
  assert.equal(await page.locator('input[type=file]').count(), 0);
  console.log('PASS public demo and anonymous upload isolation');

  const login = async (page, email) => {
    await page.goto(baseURL);
    await page.getByRole('button', { name: '登录内部工作区', exact: true }).click();
    await page.getByLabel('邮箱', { exact: true }).fill(email);
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
  };
  await login(page, identities.admin);
  await page.getByRole('heading', { name: '导入月度数据', exact: true }).waitFor();
  // Login panel stays expanded; manager is immediately available.
  await page.getByLabel('要授权的邮箱').fill(identities.viewer);
  await page.getByRole('button', { name: '授权查看', exact: true }).click();
  await page.getByText('已授予查看权限', { exact: true }).waitFor();
  await page.getByLabel('账号名称', { exact: true }).fill(account);
  await page.getByLabel('数据归属月份', { exact: true }).fill('2026-09');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { 笔记标题: `测试笔记-${stamp}`, 首次发布时间: '2026-09-02 10:00', 曝光: 1000, 观看量: 500, 点赞: 50, 评论: 10, 收藏: 30, 涨粉: 5, 分享: 3, 封面点击率: '10%', 体裁: '图文', 品类: '测试' },
    { 笔记标题: `第二篇-${stamp}`, 首次发布时间: '2026-09-03 10:00', 曝光: 2000, 观看量: 1000, 点赞: 80, 评论: 20, 收藏: 50, 涨粉: 10, 分享: 5, 封面点击率: '12%', 体裁: '视频', 品类: '测试' },
  ]), '数据');
  await page.locator('input[type=file]').setInputFiles({ name: '月度测试.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) });
  await page.getByRole('button', { name: '确认并保存到数据库', exact: true }).click();
  await page.getByText('已保存至历史数据库，数据明细及全部看板已更新', { exact: true }).waitFor();
  await page.getByRole('button', { name: '数据明细', exact: true }).click();
  await page.getByPlaceholder('搜索标题 / 账号 / 品类').fill(`测试笔记-${stamp}`);
  await page.getByText('共 1 篇笔记', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '数据明细', exact: true }).click();
  await page.getByText(`测试笔记-${stamp}`, { exact: false }).first().waitFor();
  console.log('PASS administrator Excel upload, search, cloud persistence after reload');

  const viewerContext = await secureContext();
  const viewer = await viewerContext.newPage();
  viewer.on('pageerror', e => errors.push(e.message));
  await login(viewer, identities.viewer);
  await viewer.getByText(`${identities.viewer} · 获授权查看者`, { exact: true }).waitFor();
  assert.equal(await viewer.locator('input[type=file]').count(), 0);
  await viewer.getByRole('button', { name: '数据明细', exact: true }).click();
  await viewer.getByRole('button', { name: /全部批次月份/ }).click();
  await viewer.getByRole('button', { name: '2026-09', exact: true }).click();
  await viewer.getByRole('button', { name: '报告导出', exact: true }).click();
  const downloadReady = viewer.waitForEvent('download');
  await viewer.getByRole('button', { name: '下载汇总 Excel（.xlsx）', exact: true }).click();
  const download = await downloadReady;
  const report = XLSX.readFile(await download.path());
  const rows = XLSX.utils.sheet_to_json(report.Sheets[report.SheetNames[0]]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]['账号名'], account);
  assert.equal(rows[0]['数据归属月份'], '2026-09');
  console.log('PASS authorized viewer, reporting-month filter and downloaded report content');

  const stranger = await (await secureContext()).newPage();
  await login(stranger, identities.stranger);
  await stranger.getByText(`${identities.stranger} · 尚未获授权`, { exact: true }).waitFor();
  assert.equal(await stranger.getByRole('button', { name: '数据明细', exact: true }).count(), 0);
  console.log('PASS unauthorized registered user cannot see private history');

  await db.query('delete from public.dashboard_members where email=$1', [identities.viewer]);
  await viewer.getByRole('button', { name: '打开 / 刷新内部数据', exact: true }).click();
  await viewer.getByText(`${identities.viewer} · 尚未获授权`, { exact: true }).waitFor();
  assert.equal(await viewer.getByRole('button', { name: '数据明细', exact: true }).count(), 0);
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await page.getByRole('button', { name: '登录内部工作区', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '数据明细', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS revocation, sign-out clearing and no browser runtime errors');
  }
} finally {
  await browser?.close();
  await db.query('delete from public.dashboard_batches where account=$1', [account]).catch(() => {});
  await db.query("delete from public.dashboard_members where email like $1", [`xhs-e2e-${stamp}-%@example.com`]).catch(() => {});
  for (const id of users) await auth.auth.admin.deleteUser(id);
  await db.end();
  console.log('Disposable integration-test users and data cleaned up');
}
