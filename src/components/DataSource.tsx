import { useRef, useState } from 'react';
import clsx from 'clsx';
import { FileSpreadsheet, Pencil, Sparkles, Trash2, Upload } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { parseWorkbook } from '@/lib/parseExcel';
import { fmtDate } from '@/lib/format';

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
