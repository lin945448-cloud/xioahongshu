import { useStore } from '@/store/useStore';

// Public entry points never accept real files. Imports live in the authenticated workspace.
export function DropZone({ compact = false }: { compact?: boolean }) {
  return <div className={`rounded-2xl border border-ink-200 bg-white text-center ${compact ? 'p-5' : 'p-10'}`}>
    <p className="font-semibold text-ink-900">公开演示 · 无需登录</p>
    <p className="mt-2 text-sm text-ink-500">使用虚构数据体验筛选、分析和报告导出。内部真实数据仅向获授权账号开放。</p>
    <button className="btn btn-primary mt-4" onClick={() => useStore.getState().loadDemo()}>查看演示数据</button>
  </div>;
}

export function FileManager() {
  const files = useStore(s => s.files);
  return <div className="flex flex-wrap gap-2 text-xs text-ink-500">{files.map(f =>
    <span key={f.id} className="rounded-lg bg-ink-100 px-3 py-2">{f.account} · {f.noteCount} 条</span>)}</div>;
}
