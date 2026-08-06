import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, Inbox, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useStore } from '@/store/useStore';

export function Empty({
  title = '暂无数据',
  desc,
  icon,
  action,
}: {
  title?: string;
  desc?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-400">
        {icon ?? <Inbox className="h-7 w-7" />}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink-700">{title}</p>
        {desc && <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  if (!toasts.length) return null;

  const iconOf = (t: string) =>
    t === 'success' ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : t === 'error' ? (
      <AlertCircle className="h-4 w-4 text-brand-600" />
    ) : (
      <Info className="h-4 w-4 text-blue-600" />
    );

  return (
    <div className="no-print fixed bottom-5 right-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'animate-fade-up flex items-start gap-2.5 rounded-xl border bg-white px-3.5 py-3 shadow-xl',
            t.type === 'error' ? 'border-brand-200' : 'border-ink-200'
          )}
        >
          <span className="mt-0.5 shrink-0">{iconOf(t.type)}</span>
          <p className="flex-1 text-[13px] leading-relaxed text-ink-700">{t.text}</p>
          <button onClick={() => dismiss(t.id)} className="shrink-0 text-ink-400 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
