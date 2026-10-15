import { useMemo } from 'react';
import { Filter, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFilterOptions, useFilteredNotes } from '@/hooks/useFiltered';
import { MultiSelect, Select } from '@/components/ui/Controls';
import { fmtDate } from '@/lib/format';

const QUICK = [
  { label: '全部', months: 0 },
  { label: '近 3 月', months: 3 },
  { label: '近 6 月', months: 6 },
  { label: '近 12 月', months: 12 },
];

export function FilterBar() {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const reset = useStore((s) => s.resetFilters);
  const opts = useFilterOptions();
  const filtered = useFilteredNotes();
  const notes = useStore(s => s.notes);
  const reportingMonths = useMemo(() => [...new Set(notes.map(n => n.reportingMonth ?? n.ym))].sort(), [notes]);

  const monthOptions = useMemo(
    () => opts.months.map((m) => ({ value: m, label: m })),
    [opts.months]
  );

  const applyQuick = (n: number) => {
    if (n === 0 || !opts.months.length) {
      setFilters({ monthFrom: null, monthTo: null });
      return;
    }
    const tail = opts.months.slice(-n);
    setFilters({ monthFrom: tail[0], monthTo: tail[tail.length - 1] });
  };

  const activeQuick = useMemo(() => {
    if (!filters.monthFrom && !filters.monthTo) return '全部';
    const idx = opts.months.indexOf(filters.monthFrom ?? '');
    const isTail = filters.monthTo === opts.months[opts.months.length - 1];
    if (isTail && idx >= 0) {
      const n = opts.months.length - idx;
      const hit = QUICK.find((q) => q.months === n);
      if (hit) return hit.label;
    }
    return '';
  }, [filters, opts.months]);

  const dirty =
    filters.reportingMonths.length > 0 ||
    filters.accounts.length > 0 ||
    filters.categories.length > 0 ||
    filters.genres.length > 0 ||
    !!filters.monthFrom ||
    !!filters.monthTo;

  const range = filtered.length
    ? `${fmtDate(filtered[0].publishAt)} ~ ${fmtDate(filtered[filtered.length - 1].publishAt)}`
    : '--';

  return (
    <div className="no-print sticky top-[57px] z-20 border-b border-ink-200/70 bg-ink-50/90 backdrop-blur-lg lg:top-[61px]">
      <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 pb-2 text-xs font-semibold text-ink-500">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            全局筛选
          </div>

          <div className="min-w-[168px] flex-1 sm:max-w-[220px]">
            <label className="label">账号</label>
            <MultiSelect
              value={filters.accounts}
              onChange={(v) => setFilters({ accounts: v })}
              options={opts.accounts}
              placeholder="全部账号"
            />
          </div>

          <div className="min-w-[132px]">
            <label className="label">发布起始月份</label>
            <Select
              value={filters.monthFrom ?? ''}
              onChange={(v) => setFilters({ monthFrom: v || null })}
              options={[{ value: '', label: '不限' }, ...monthOptions]}
            />
          </div>

          <div className="min-w-[132px]">
            <label className="label">发布结束月份</label>
            <Select
              value={filters.monthTo ?? ''}
              onChange={(v) => setFilters({ monthTo: v || null })}
              options={[{ value: '', label: '不限' }, ...monthOptions]}
            />
          </div>

          <div className="min-w-[160px]">
            <label className="label">数据归属月份</label>
            <MultiSelect value={filters.reportingMonths} onChange={v => setFilters({ reportingMonths: v })}
              options={reportingMonths} placeholder="全部批次月份" />
          </div>
          <div className="pb-0.5">
            <label className="label">快捷区间</label>
            <div className="inline-flex items-center gap-0.5 rounded-xl bg-ink-100 p-1">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  onClick={() => applyQuick(q.months)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    activeQuick === q.label
                      ? 'bg-white text-ink-900 shadow-sm'
                      : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[130px]">
            <label className="label">体裁</label>
            <MultiSelect
              value={filters.genres}
              onChange={(v) => setFilters({ genres: v })}
              options={opts.genres}
              placeholder="全部体裁"
            />
          </div>

          {opts.hasCategory && (
            <div className="min-w-[150px]">
              <label className="label">品类</label>
              <MultiSelect
                value={filters.categories}
                onChange={(v) => setFilters({ categories: v })}
                options={opts.categories}
                placeholder="全部品类"
              />
            </div>
          )}

          <button onClick={reset} disabled={!dirty} className="btn mb-0 h-[38px]">
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </button>

          <div className="ml-auto flex items-center gap-2 pb-2 text-xs text-ink-500">
            <Filter className="h-3.5 w-3.5" />
            命中 <b className="text-ink-900">{filtered.length}</b> 篇 · {range}
          </div>
        </div>
      </div>
    </div>
  );
}
