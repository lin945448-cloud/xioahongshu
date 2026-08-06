import clsx from 'clsx';
import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/* ----------------------------- 分段切换器 ----------------------------- */
export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'inline-flex shrink-0 items-center gap-0.5 rounded-xl bg-ink-100 p-1',
        className
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-lg font-medium transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === o.value
              ? 'bg-white text-ink-900 shadow-sm'
              : 'text-ink-500 hover:text-ink-700'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ 下拉单选 ------------------------------ */
export function Select({
  value,
  onChange,
  options,
  className,
  placeholder = '请选择',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; group?: string }[];
  className?: string;
  placeholder?: string;
}) {
  const groups = [...new Set(options.map((o) => o.group).filter(Boolean))] as string[];
  return (
    <div className={clsx('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input cursor-pointer appearance-none pr-9"
      >
        {!value && <option value="">{placeholder}</option>}
        {groups.length ? (
          groups.map((g) => (
            <optgroup key={g} label={g}>
              {options
                .filter((o) => o.group === g)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
          ))
        ) : (
          options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
    </div>
  );
}

/* ------------------------------ 下拉多选 ------------------------------ */
export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = '全部',
  className,
  emptyMeansAll = true,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  emptyMeansAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;
  const summary =
    value.length === 0
      ? emptyMeansAll
        ? `${placeholder}（${options.length}）`
        : placeholder
      : value.length <= 2
        ? value.join('、')
        : `已选 ${value.length} 项`;

  return (
    <div className={clsx('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'input flex cursor-pointer items-center justify-between gap-2 text-left',
          value.length > 0 && 'border-brand-300 bg-brand-50/40'
        )}
      >
        <span className={clsx('truncate', value.length === 0 && 'text-ink-500')}>{summary}</span>
        <ChevronDown
          className={clsx('h-4 w-4 shrink-0 text-ink-400 transition', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">
          {options.length > 7 && (
            <div className="border-b border-ink-100 p-2">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索…"
                className="w-full rounded-lg bg-ink-100 px-2.5 py-1.5 text-sm outline-none"
              />
            </div>
          )}
          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-1.5 text-xs">
            <button className="text-brand-600 hover:underline" onClick={() => onChange([...options])}>
              全选
            </button>
            <button className="text-ink-500 hover:underline" onClick={() => onChange([])}>
              清空
            </button>
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map((o) => {
              const active = value.includes(o);
              return (
                <li key={o}>
                  <button
                    type="button"
                    onClick={() => toggle(o)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-ink-50"
                  >
                    <span
                      className={clsx(
                        'grid h-4 w-4 shrink-0 place-items-center rounded border',
                        active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200'
                      )}
                    >
                      {active && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{o}</span>
                  </button>
                </li>
              );
            })}
            {!filtered.length && (
              <li className="px-3 py-4 text-center text-xs text-ink-400">无匹配项</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ 指标多选药丸 ------------------------------ */
export function PillToggle({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition',
        active
          ? 'border-transparent text-white shadow-sm'
          : 'border-ink-200 bg-white text-ink-500 hover:border-ink-400 hover:text-ink-700'
      )}
      style={active && color ? { backgroundColor: color } : undefined}
    >
      {color && !active && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {children}
    </button>
  );
}

/* ------------------------------ 可移除标签 ------------------------------ */
export function RemovableTag({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="chip gap-1.5 pr-1.5">
      {children}
      <button
        onClick={onRemove}
        className="grid h-4 w-4 place-items-center rounded-full text-ink-400 transition hover:bg-ink-200 hover:text-ink-700"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
