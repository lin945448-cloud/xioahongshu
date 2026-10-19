import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStore } from '@/store/useStore';
import { refreshWorkspace, useWorkspace } from '@/hooks/useWorkspace';
import { deleteBatch, importBatch, isSupabaseConfigured, listMembers, setPasswordAndVerify, setViewer, supabase, type Member } from '@/lib/supabase';
import { parseWorkbook, type ParseResult } from '@/lib/parseExcel';

const errorText = (error: unknown) => error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);

export function WorkspacePanel() {
  const { email, role, checking, error, batches, needsPasswordSetup, passwordSetupUserId } = useWorkspace();
  const demo = useStore(s => s.isDemo);
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const toast = useStore(s => s.pushToast);
  const expanded = open || needsPasswordSetup;

  const authenticate = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('');
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password });
        if (error) throw error;
        setPassword('');
      } else {
        const { data, error } = await supabase.auth.signUp({ email: loginEmail.trim(), password,
          options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setPassword('');
        setMessage(data.session ? '注册成功，只有管理员授权后才能读取内部数据。' : '请到邮箱确认注册，再回来登录。只有管理员授权后才能读取内部数据。');
      }
    } catch (e) { setMessage(errorText(e)); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    setBusy(true);
    // Clear immediately, even if a network failure delays remote sign-out.
    useStore.getState().clearAll();
    useWorkspace.setState({ role: null, email: null, batches: [] });
    try {
      const { error } = await supabase!.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setMessage('已退出登录');
    } catch (e) { toast('error', errorText(e)); }
    finally { setBusy(false); }
  };

  return <section className="no-print mx-auto max-w-[1600px] px-4 pt-4 sm:px-6">
    <div className="card card-pad space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold">{demo ? '公开演示数据' : '内部数据工作区'}</p>
          <p className="mt-1 text-xs text-ink-500">{checking ? '正在验证访问权限…' : email ? `${email} · ${role === 'admin' ? '管理员' : role === 'viewer' ? '获授权查看者' : '尚未获授权'}` : '真实数据需登录并获得管理员授权；演示数据向所有人开放。'}</p></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={checking || busy} onClick={() => { useStore.getState().loadDemo(); setOpen(false); }}>公开演示</button>
          {email && <button className="btn" disabled={checking || busy} onClick={() => void refreshWorkspace()}>打开 / 刷新内部数据</button>}
          <button className="btn btn-primary" onClick={() => setOpen(!open)} aria-expanded={expanded}>{expanded ? '收起' : role === 'admin' ? '管理数据与授权' : email ? '账号信息' : '登录内部工作区'}</button>
          {email && <button className="btn" disabled={busy} onClick={() => void logout()}>退出</button>}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">内部数据读取失败：{error}。请重试或联系管理员，演示数据仍可使用。</p>}
      {expanded && <div className="border-t border-ink-100 pt-4">
        {!isSupabaseConfigured ? <p className="text-sm text-ink-500">内部数据库尚未配置，请联系管理员完成部署设置。公开演示可正常使用。</p> : needsPasswordSetup && !passwordSetupUserId ?
          <p role="status" className="text-sm text-ink-500">正在验证密码设置链接，请稍候…</p> : !email ?
          <form onSubmit={authenticate} className="max-w-md space-y-3">
            <label className="block text-sm">邮箱<input className="input mt-1 w-full" type="email" autoComplete="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required /></label>
            <label className="block text-sm">密码<input className="input mt-1 w-full" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
            <div className="flex gap-2"><button className="btn btn-primary" disabled={busy || checking}>{busy ? '处理中…' : authMode === 'login' ? '登录' : '注册账号'}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setMessage(''); }}>{authMode === 'login' ? '首次使用：注册' : '已有账号：登录'}</button></div>
            <p className="text-xs text-ink-500">注册不会自动获得内部数据权限，请使用管理员授权的邮箱注册。</p>
          </form> : needsPasswordSetup ? <PasswordForm setup /> : role === 'admin' && !checking ? <AdminPanel /> :
          <p className="text-sm text-ink-500">{role === 'viewer' ? `你可以查看 ${batches.length} 个历史批次，使用全部筛选、分析和报告下载功能。` : checking ? '正在验证权限…' : '当前邮箱尚未获授权。请让管理员在授权管理中添加此邮箱，再点击刷新内部数据。'}</p>}
        {message && <p role="status" className="mt-3 text-sm text-ink-600">{message}</p>}
        {email && !needsPasswordSetup && <details className="mt-4"><summary className="cursor-pointer text-sm text-ink-500">修改我的登录密码</summary><PasswordForm /></details>}
      </div>}
    </div>
  </section>;
}

function PasswordForm({ setup = false }: { setup?: boolean }) {
  const setupUserId = useWorkspace(s => s.passwordSetupUserId);
  const email = useWorkspace(s => s.email);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (setup && !setupUserId) return <p role="status" className="text-sm text-ink-500">正在验证密码设置链接，请稍候…</p>;
  return <form className="mt-3 max-w-md space-y-3" onSubmit={e => {
    e.preventDefault();
    if (password !== confirmation) { setMessage('两次输入的密码不一致'); return; }
    setBusy(true); setMessage('');
    void setPasswordAndVerify(password, setup ? setupUserId! : undefined).then(() => {
      setPassword(''); setConfirmation('');
      useWorkspace.setState({ needsPasswordSetup: false, passwordSetupUserId: null });
      setMessage('密码已保存，并已验证可以用新密码重新登录。');
      useStore.getState().pushToast('success', '密码已保存，并已验证可以重新登录');
    }).catch(e => {
      setMessage(errorText(e));
      useStore.getState().pushToast('error', errorText(e));
    }).finally(() => setBusy(false));
  }}>
    <h2 className="text-base font-semibold">{setup ? '设置你的登录密码' : '修改登录密码'}</h2>
    <p className="text-sm font-medium">账号：{email}</p>
    <p className="text-xs text-ink-500">请设置至少 10 位密码。密码只提交给登录服务，不需要告诉任何人。</p>
    <label className="block text-sm">新密码<input className="input mt-1 w-full" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e => setPassword(e.target.value)} /></label>
    <label className="block text-sm">确认新密码<input className="input mt-1 w-full" type="password" autoComplete="new-password" minLength={10} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
    <button className="btn btn-primary" disabled={busy}>{busy ? '正在保存并验证登录…' : '保存密码'}</button>
    {message && <p role="status" className="text-sm text-ink-600">{message}</p>}
  </form>;
}

function previousMonth() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  now.setDate(1); now.setMonth(now.getMonth() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function AdminPanel() {
  const batches = useWorkspace(s => s.batches);
  const [account, setAccount] = useState('');
  const [month, setMonth] = useState(previousMonth);
  const [preview, setPreview] = useState<{ result: ParseResult; hash: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [setupLink, setSetupLink] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [memberError, setMemberError] = useState('');
  const toast = useStore(s => s.pushToast);
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const accounts = [...new Set(batches.map(b => b.account))];

  useEffect(() => {
    let active = true;
    void listMembers().then(rows => { if (active) setMembers(rows); }).catch(e => { if (active) setMemberError(errorText(e)); });
    return () => { active = false; };
  }, []);

  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } catch (e) { toast('error', errorText(e)); }
    finally { lock.current = false; setBusy(false); }
  };

  const read = (file?: File) => {
    if (!file) return;
    void run(async () => {
      setPreview(null);
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('请选择 Excel 或 CSV 文件');
      if (file.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10MB');
      const result = await parseWorkbook(file);
      if (result.notes.length > 20000) throw new Error('单批次最多 20000 条，请分月份整理后上传');
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('');
      setPreview({ result, hash });
    });
  };

  const save = () => void run(async () => {
    if (!preview || !account.trim() || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('请填写账号、归属月份并选择文件');
    const bytes = new TextEncoder().encode(JSON.stringify(preview.result.notes)).length;
    if (bytes > 3_000_000) throw new Error('解析后的数据超过 3MB（Vercel 请求大小限制），请精简表格后上传或联系管理员调整导入方案');
    await importBatch(account, month, preview.result.file.fileName, preview.hash, preview.result.notes);
    setPreview(null);
    toast('success', '已保存至历史数据库，数据明细及全部看板已更新');
    await refreshWorkspace();
  });

  return <div className="space-y-6">
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">导入月度数据</h2>
      <p className="text-xs leading-relaxed text-ink-500">每月 1 号收集后上传，选择数据实际归属的月份，支持补录历史月份。保留 Excel 中的累计指标，不计算两次采集的差值。发布时间筛选与数据归属月份分别保留。</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">账号名称<input className="input mt-1 block" list="workspace-accounts" maxLength={100} value={account} onChange={e => setAccount(e.target.value)} disabled={busy} placeholder="例如：品牌主账号" /></label>
        <datalist id="workspace-accounts">{accounts.map(a => <option key={a} value={a} />)}</datalist>
        <label className="text-sm">数据归属月份<input className="input mt-1 block" type="month" min="2000-01" max="2100-12" value={month} onChange={e => setMonth(e.target.value)} disabled={busy} /></label>
        <input ref={input} aria-label="选择月度 Excel 文件" className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={e => { read(e.target.files?.[0]); e.target.value = ''; }} disabled={busy} />
        <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? '处理中…' : '选择 Excel / CSV'}</button>
      </div>
      {preview && <div className="rounded-xl bg-ink-50 p-4 text-sm space-y-2">
        <p>待导入：{preview.result.file.fileName} · {preview.result.notes.length} 条</p>
        <p>归档到：{account || '请填写账号'} / {month || '请选择月份'}</p>
        {preview.result.warnings.map((w, i) => <p key={i} className="text-amber-700">{w}</p>)}
        <p className="text-xs text-ink-500">同一账号同一月份仅保留一个批次；请确认该文件覆盖本月所需数据。</p>
        <button className="btn btn-primary" disabled={busy || !account.trim() || !month} onClick={save}>确认并保存到数据库</button>
        <button className="btn ml-2" disabled={busy} onClick={() => setPreview(null)}>取消</button>
      </div>}
    </div>
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">历史上传批次（{batches.length}）</h2>
      {!batches.length && <p className="text-sm text-ink-500">还没有数据，上传后会自动出现在数据明细。</p>}
      <div className="max-h-72 overflow-y-auto space-y-2">{batches.map(b => <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-100 p-3 text-sm">
        <div><p>{b.account} · {b.reporting_month.slice(0, 7)} · {b.note_count} 条</p><p className="text-xs text-ink-500">{b.file_name} · 上传于 {new Date(b.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p></div>
        {pendingDelete === b.id ? <div className="flex items-center gap-2"><span className="text-xs text-red-700">撤销后该批次数据会删除</span><button className="btn" disabled={busy} onClick={() => void run(async () => { await deleteBatch(b.id); setPendingDelete(null); await refreshWorkspace(); toast('success', '批次已撤销，可重新上传'); })}>确认撤销</button><button className="btn" disabled={busy} onClick={() => setPendingDelete(null)}>取消</button></div> : <button className="btn" disabled={busy} onClick={() => setPendingDelete(b.id)}>撤销批次</button>}
      </div>)}</div>
    </div>
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">查看权限管理</h2>
      <p className="text-xs text-ink-500">可以添加已有账号的邮箱授权，也可以生成一次性开通链接，私下交给同事设置密码，无需注册邮件。查看者可查看全部内部数据、筛选分析及下载报告，不能上传、删除或管理授权。</p>
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void run(async () => { await setViewer(memberEmail, true); setMemberEmail(''); setMembers(await listMembers()); setMemberError(''); toast('success', '已授予查看权限'); }); }}>
        <input className="input min-w-[240px]" aria-label="要授权的邮箱" type="email" required value={memberEmail} onChange={e => setMemberEmail(e.target.value)} disabled={busy} placeholder="同事的邮箱" />
        <button className="btn btn-primary" disabled={busy}>授权查看</button>
        <button className="btn" type="button" disabled={busy || !memberEmail.trim()} onClick={() => void run(async () => {
          setSetupLink('');
          const { data, error } = await supabase!.auth.getSession();
          if (error || !data.session) throw new Error('请重新登录');
          const response = await fetch('/api/member-setup', { method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
            body: JSON.stringify({ email: memberEmail }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || '账号开通失败');
          const link = new URL(window.location.origin);
          link.hash = new URLSearchParams({ setup_token: result.tokenHash, setup_type: result.type }).toString();
          setSetupLink(link.toString()); setMembers(await listMembers());
        })}>生成查看者开通链接</button>
      </form>
      {setupLink && <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
        <p>一次性开通链接：仅私下交给该邮箱对应的同事，通常 1 小时有效。对方打开后设置自己的密码。不要公开发布。</p>
        <textarea className="input w-full text-xs" aria-label="查看者开通链接" readOnly value={setupLink} onFocus={e => e.target.select()} />
        <button className="btn" onClick={() => setSetupLink('')}>隐藏链接</button>
      </div>}
      {memberError && <p role="alert" className="text-sm text-red-700">授权列表读取失败：{memberError}</p>}
      <div className="max-h-64 overflow-y-auto space-y-2">{members.map(m => <div key={m.email} className="flex items-center justify-between gap-2 text-sm"><span>{m.email} · {m.role === 'admin' ? '管理员' : '查看者'}</span>{m.role === 'viewer' && <button className="btn" disabled={busy} onClick={() => void run(async () => { await setViewer(m.email, false); setMembers(await listMembers()); toast('success', '已撤销查看权限'); })}>撤销授权</button>}</div>)}</div>
      <p className="text-xs text-ink-500">撤销后数据库立即拒绝新的读取请求；对方已打开的页面会在刷新或权限复查时清除数据。已下载的报告无法收回。</p>
    </div>
  </div>;
}
