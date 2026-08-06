import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Cloud,
  Database,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { parseWorkbook } from '@/lib/parseExcel';
import { fmtDate } from '@/lib/format';
import {
  isSupabaseConfigured,
  getCurrentUser,
  signIn,
  signUp,
  signOut,
  onAuthChange,
  listDatasets,
  saveDataset,
  loadDataset,
  deleteDataset,
  renameDataset,
  type CloudDatasetMeta,
} from '@/lib/supabase';

export function useUploader() {
  const addDataset = useStore((s) => s.addDataset);
  const pushToast = useStore((s) => s.pushToast);
  const setLoading = useStore((s) => s.setLoading);

  return async (fileList: FileList | File[]) => {
    const files = [...fileList].filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (!files.length) {
      pushToast('error', '请上传 .xlsx / .xls / .csv 格式的文件');
      return;
    }
    setLoading(true);
    for (const f of files) {
      try {
        const res = await parseWorkbook(f);
        addDataset(res.notes, res.file);
        pushToast('success', `「${res.file.account}」解析成功，共 ${res.notes.length} 篇笔记`);
        res.warnings.forEach((w) => pushToast('info', `${res.file.account}：${w}`));
      } catch (e) {
        pushToast('error', `${f.name} 解析失败：${(e as Error).message}`);
      }
    }
    setLoading(false);
  };
}

export function DropZone({ compact = false }: { compact?: boolean }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploader();
  const loadDemo = useStore((s) => s.loadDemo);
  const loading = useStore((s) => s.loading);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void upload(e.dataTransfer.files);
      }}
      className={clsx(
        'rounded-2xl border-2 border-dashed text-center transition',
        compact ? 'p-5' : 'p-10',
        drag ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-white hover:border-brand-300'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void upload(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Upload className={clsx('h-6 w-6', loading && 'animate-bounce')} />
      </div>
      <p className={clsx('font-semibold text-ink-900', compact ? 'mt-2 text-sm' : 'mt-3 text-base')}>
        {loading ? '正在解析…' : '拖拽 Excel 到此处，或点击选择文件'}
      </p>
      <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-ink-500">
        支持小红书后台导出的 .xlsx / .xls / .csv，可一次选择多个文件；
        <b className="text-ink-700">每个文件视为一个账号</b>（账号名默认取文件名，可修改）。
        全部计算在浏览器本地完成，数据不会上传到任何服务器。
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={loading}>
          <Upload className="h-4 w-4" />
          选择文件
        </button>
        <button className="btn" onClick={loadDemo} disabled={loading}>
          <Sparkles className="h-4 w-4" />
          载入演示数据
        </button>
      </div>
    </div>
  );
}

export function FileManager() {
  const files = useStore((s) => s.files);
  const removeFile = useStore((s) => s.removeFile);
  const renameAccount = useStore((s) => s.renameAccount);
  const clearAll = useStore((s) => s.clearAll);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (!files.length) return null;

  const commit = (id: string) => {
    const name = draft.trim();
    if (name) renameAccount(id, name);
    setEditing(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {files.map((f) => (
          <div
            key={f.id}
            className="group flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
            {editing === f.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(f.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(f.id);
                  if (e.key === 'Escape') setEditing(null);
                }}
                className="w-36 rounded-md border border-brand-300 px-1.5 py-0.5 text-sm outline-none"
              />
            ) : (
              <span className="font-medium text-ink-900">{f.account}</span>
            )}
            <span className="text-xs text-ink-400">
              {f.noteCount} 篇 · {fmtDate(f.minDate)} ~ {fmtDate(f.maxDate)}
            </span>
            <button
              onClick={() => {
                setEditing(f.id);
                setDraft(f.account);
              }}
              className="text-ink-400 opacity-0 transition hover:text-ink-700 group-hover:opacity-100"
              title="重命名账号"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => removeFile(f.id)}
              className="text-ink-400 opacity-0 transition hover:text-brand-600 group-hover:opacity-100"
              title="移除该文件"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={clearAll} className="text-xs text-ink-400 transition hover:text-brand-600">
        清空全部数据
      </button>
    </div>
  );
}

export function CloudDatasets() {
  const files = useStore((s) => s.files);
  const notes = useStore((s) => s.notes);
  const loadCloudDataset = useStore((s) => s.loadCloudDataset);
  const pushToast = useStore((s) => s.pushToast);
  const setLoading = useStore((s) => s.setLoading);

  const [user, setUser] = useState<{ email: string } | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [list, setList] = useState<CloudDatasetMeta[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const refresh = async () => {
    try {
      setList(await listDatasets());
    } catch (e) {
      pushToast('error', `读取云端列表失败：${(e as Error).message}`);
    }
  };

  // 进入时同步登录态 + 订阅变化
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void getCurrentUser().then((u) => {
      setUser(u ? { email: u.email ?? '' } : null);
      if (u) void refresh();
    });
    const unsub = onAuthChange((u) => {
      setUser(u ? { email: u.email ?? '' } : null);
      if (u) void refresh();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 bg-white p-4 text-xs leading-relaxed text-ink-500">
        <p className="font-medium text-ink-700">云端数据集未启用</p>
        <p className="mt-1">
          在 Vercel 项目环境变量（或本地 <code className="rounded bg-ink-100 px-1">.env</code>）中设置
          <code className="mx-1 rounded bg-ink-100 px-1">VITE_SUPABASE_URL</code> 与
          <code className="mx-1 rounded bg-ink-100 px-1">VITE_SUPABASE_ANON_KEY</code> 即可开启「登录后存云、随时调取」。
        </p>
      </div>
    );
  }

  // 未登录：显示登录 / 注册表单
  if (!user) {
    const doAuth = async () => {
      const e = email.trim();
      if (!e || !password) {
        pushToast('error', '请输入邮箱和密码');
        return;
      }
      if (password.length < 6) {
        pushToast('error', '密码至少 6 位');
        return;
      }
      setAuthBusy(true);
      try {
        if (authMode === 'signin') {
          await signIn(e, password);
          pushToast('success', '登录成功');
        } else {
          const { needsConfirm } = await signUp(e, password);
          if (needsConfirm) {
            pushToast('info', '注册成功！请到邮箱点击确认链接，再回来登录');
            setAuthMode('signin');
          } else {
            pushToast('success', '注册并登录成功');
          }
        }
      } catch (err) {
        pushToast('error', (err as Error).message);
      } finally {
        setAuthBusy(false);
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          云端数据集（需登录，数据仅本人可见）
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-3">
          <div className="mb-2 flex gap-1 text-xs">
            <button
              className={clsx('rounded-md px-2.5 py-1 font-medium', authMode === 'signin' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600')}
              onClick={() => setAuthMode('signin')}
            >
              登录
            </button>
            <button
              className={clsx('rounded-md px-2.5 py-1 font-medium', authMode === 'signup' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600')}
              onClick={() => setAuthMode('signup')}
            >
              注册
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              className="w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少 6 位）"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doAuth();
              }}
              className="w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
            />
            <button className="btn btn-primary w-full" onClick={doAuth} disabled={authBusy}>
              {authMode === 'signin' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {authMode === 'signin' ? '登录' : '注册并登录'}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
            登录后才能读写云端数据。你的数据通过账号隔离，他人即使拿到密钥也无法访问。
          </p>
        </div>
      </div>
    );
  }

  const doSave = async () => {
    if (!files.length || !notes.length) {
      pushToast('error', '请先上传/载入数据，再保存到云端');
      return;
    }
    const finalName = name.trim() || `数据集 ${new Date().toLocaleString('zh-CN')}`;
    setBusy(true);
    try {
      await saveDataset(finalName, { files, notes });
      setName('');
      await refresh();
      pushToast('success', `已保存到云端：${finalName}`);
    } catch (e) {
      pushToast('error', `保存失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doLoad = async (id: string) => {
    setLoading(true);
    try {
      const payload = await loadDataset(id);
      loadCloudDataset(payload.files, payload.notes);
      pushToast('success', '已从云端调取数据集');
    } catch (e) {
      pushToast('error', `调取失败：${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteDataset(id);
      await refresh();
    } catch (e) {
      pushToast('error', `删除失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const commitRename = async (id: string) => {
    const n = draft.trim();
    if (n) {
      try {
        await renameDataset(id, n);
        await refresh();
      } catch (e) {
        pushToast('error', `重命名失败：${(e as Error).message}`);
      }
    }
    setEditing(null);
  };

  const doSignOut = async () => {
    try {
      await signOut();
      setList([]);
      pushToast('info', '已退出登录');
    } catch (e) {
      pushToast('error', (e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <ShieldCheck className="h-4 w-4 text-brand-600" />
        云端数据集
      </div>
      <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs">
        <span className="text-ink-600">
          已登录：<span className="font-medium text-ink-900">{user.email}</span>
        </span>
        <button onClick={doSignOut} className="flex items-center gap-1 text-ink-400 transition hover:text-brand-600">
          <LogOut className="h-3.5 w-3.5" />
          退出
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="给这份数据起个名（如：2025全年-主账号）"
          className="min-w-[200px] flex-1 rounded-md border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
        />
        <button className="btn btn-primary" onClick={doSave} disabled={busy}>
          <Cloud className="h-4 w-4" />
          保存当前数据到云端
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-ink-400">云端还没有数据集，上传数据后点上方按钮保存。</p>
      ) : (
        <div className="space-y-2">
          {list.map((d) => (
            <div
              key={d.id}
              className="group flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm"
            >
              <Database className="h-4 w-4 shrink-0 text-brand-500" />
              {editing === d.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(d.id);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  className="w-44 rounded-md border border-brand-300 px-1.5 py-0.5 text-sm outline-none"
                />
              ) : (
                <span className="font-medium text-ink-900">{d.name}</span>
              )}
              <span className="text-xs text-ink-400">
                {d.note_count} 篇
                {d.date_min ? ` · ${d.date_min} ~ ${d.date_max}` : ''}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => doLoad(d.id)}
                  className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
                >
                  调取
                </button>
                <button
                  onClick={() => {
                    setEditing(d.id);
                    setDraft(d.name);
                  }}
                  className="text-ink-400 opacity-0 transition hover:text-ink-700 group-hover:opacity-100"
                  title="重命名"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => doDelete(d.id)}
                  className="text-ink-400 opacity-0 transition hover:text-brand-600 group-hover:opacity-100"
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
