import { useMemo, useState } from 'react';
import { ArrowUpDown, Search, Settings2, Table2 } from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui/Card';
import { PillToggle, Segmented } from '@/components/ui/Controls';
import { Empty } from '@/components/ui/Feedback';
import { useFilteredNotes } from '@/hooks/useFiltered';
import { DETAIL_METRIC_KEYS, getMetric, noteMetric } from '@/lib/metrics';
import { fmtByUnit, fmtDateTime } from '@/lib/format';
import type { Note } from '@/types';

const DEFAULT_COLS = [
  'impressions',
  'views',
  'ctr',
  'likes',
  'collects',
  'comments',
  'followers',
  'engageRate',
  'followRate',
];

const PAGE_SIZES = [
  { value: '25', label: '25 行' },
  { value: '50', label: '50 行' },
  { value: '100', label: '100 行' },
];

export function DetailView() {
  const notes = useFilteredNotes();
  const [q, setQ] = useState('');
  const [cols, setCols] = useState<string[]>(DEFAULT_COLS);
  const [sortKey, setSortKey] = useState<string>('publishAt');
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState('50');
  const [showCols, setShowCols] = useState(false);

  const size = Number(pageSize);

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const filtered = kw
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(kw) ||
            n.account.toLowerCase().includes(kw) ||
            n.category.toLowerCase().includes(kw)
        )
      : notes;

    const valueOf = (n: Note): number | string => {
      if (sortKey === 'publishAt') return n.publishAt;
      if (sortKey === 'title') return n.title;
      if (sortKey === 'account') return n.account;
      return noteMetric(n, sortKey) ?? -Infinity;
    };

    return [...filtered].sort((a, b) => {
      const va = valueOf(a);
      const vb = valueOf(b);
      const r =
        typeof va === 'string' || typeof vb === 'string'
          ? String(va).localeCompare(String(vb), 'zh-CN')
          : va - vb;
      return asc ? r : -r;
    });
  }, [notes, q, sortKey, asc]);

  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pageCount - 1);
  const view = rows.slice(current * size, current * size + size);

  const sortBy = (k: string) => {
    if (sortKey === k) setAsc((a) => !a);
    else {
      setSortKey(k);
      setAsc(false);
    }
    setPage(0);
  };

  if (!notes.length) return <Empty title="当前筛选条件下没有数据" desc="请放宽全局筛选条件" />;

  return (
    <div className="space-y-5">
      <SectionTitle
        icon={<Table2 className="h-4 w-4" />}
        title="数据明细"
        desc="逐篇笔记的原始与衍生指标，支持搜索、排序、自定义列"
      />

      <Card
        title={`共 ${rows.length} 篇笔记`}
        subtitle={`第 ${current + 1} / ${pageCount} 页`}
        right={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="搜索标题 / 账号 / 品类"
                className="input w-52 pl-9"
              />
            </div>
            <button className="btn" onClick={() => setShowCols((s) => !s)}>
              <Settings2 className="h-4 w-4" />
              列设置
            </button>
            <Segmented size="sm" options={PAGE_SIZES} value={pageSize} onChange={setPageSize} />
          </>
        }
        bodyClassName="p-0 sm:p-0"
      >
        {showCols && (
          <div className="flex flex-wrap gap-2 border-b border-ink-200/70 bg-ink-50/60 p-4">
            {DETAIL_METRIC_KEYS.map((k) => {
              const m = getMetric(k);
              return (
                <PillToggle
                  key={k}
                  active={cols.includes(k)}
                  color={m.color}
                  onClick={() =>
                    setCols((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))
                  }
                >
                  {m.label}
                </PillToggle>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
                <th className="table-cell w-12 text-center">#</th>
                <th className="table-cell">
                  <button onClick={() => sortBy('account')} className="inline-flex items-center gap-1 hover:text-ink-900">
                    账号 <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="table-cell min-w-[240px]">
                  <button onClick={() => sortBy('title')} className="inline-flex items-center gap-1 hover:text-ink-900">
                    笔记标题 <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="table-cell">
                  <button onClick={() => sortBy('publishAt')} className="inline-flex items-center gap-1 hover:text-ink-900">
                    发布时间 <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="table-cell">体裁</th>
                <th className="table-cell">品类</th>
                {cols.map((k) => (
                  <th key={k} className="table-cell text-right">
                    <button
                      onClick={() => sortBy(k)}
                      className={`inline-flex items-center gap-1 hover:text-ink-900 ${
                        sortKey === k ? 'text-brand-600' : ''
                      }`}
                    >
                      {getMetric(k).label}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((n, i) => (
                <tr key={n.id} className="border-b border-ink-100 transition last:border-0 hover:bg-brand-50/40">
                  <td className="table-cell text-center text-xs text-ink-400">
                    {current * size + i + 1}
                  </td>
                  <td className="table-cell text-ink-700">{n.account}</td>
                  <td className="table-cell max-w-[380px] truncate font-medium text-ink-900" title={n.title}>
                    <span className="mr-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500">
                      {n.ym} #{n.seq}
                    </span>
                    {n.title}
                  </td>
                  <td className="table-cell text-xs text-ink-500">{fmtDateTime(n.publishAt)}</td>
                  <td className="table-cell">
                    <span className="chip py-0.5 text-[11px]">{n.genre}</span>
                  </td>
                  <td className="table-cell text-xs text-ink-600">{n.category}</td>
                  {cols.map((k) => {
                    const m = getMetric(k);
                    return (
                      <td key={k} className="table-cell text-right tabular-nums text-ink-700">
                        {fmtByUnit(noteMetric(n, k), m.unit, true)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!view.length && <Empty title="没有匹配的笔记" desc="试试换个关键词" />}

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-ink-200/70 px-4 py-3">
            <button className="btn" disabled={current === 0} onClick={() => setPage(current - 1)}>
              上一页
            </button>
            <div className="flex items-center gap-1 text-xs text-ink-500">
              第
              <input
                type="number"
                min={1}
                max={pageCount}
                value={current + 1}
                onChange={(e) => setPage(Math.max(0, Math.min(pageCount - 1, Number(e.target.value) - 1)))}
                className="w-14 rounded-lg border border-ink-200 px-2 py-1 text-center text-xs outline-none"
              />
              / {pageCount} 页
            </div>
            <button className="btn" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
              下一页
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
