import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Segmented, Select } from '@/components/ui/Controls';
import { TrendChart, type ChartKind, type SeriesDef } from '@/components/charts/TrendChart';
import { Empty } from '@/components/ui/Feedback';
import { useFilteredNotes } from '@/hooks/useFiltered';
import { groupBy, momSeries, monthsOf, pivotForChart } from '@/lib/aggregate';
import { METRICS, getMetric } from '@/lib/metrics';
import { colorAt, fmtByUnit, fmtCompact, fmtSignedPercent } from '@/lib/format';

/** 六宫格默认展示的核心指标，对齐原版的 6 张对比图 */
const GRID_METRICS = ['readRate', 'ctr', 'likeRate', 'collectRate', 'engageRate', 'followers'];

const SUMMARY_COLS = [
  'notes',
  'impressions',
  'views',
  'readRate',
  'ctr',
  'engageRate',
  'followers',
  'followRate',
];

export function AccountView() {
  const notes = useFilteredNotes();
  const [mode, setMode] = useState<'single' | 'grid'>('single');
  const [metricKey, setMetricKey] = useState('engageRate');
  const [kind, setKind] = useState<ChartKind>('line');
  const [pivotKey, setPivotKey] = useState('followers');
  const [sortKey, setSortKey] = useState('views');

  const metric = getMetric(metricKey);
  const months = useMemo(() => monthsOf(notes), [notes]);

  const accountRows = useMemo(() => {
    const sortMetric = getMetric(sortKey);
    return groupBy(notes, (n) => n.account).sort(
      (a, b) => (sortMetric.calc(b.totals) ?? 0) - (sortMetric.calc(a.totals) ?? 0)
    );
  }, [notes, sortKey]);

  const single = useMemo(() => {
    const { data, series } = pivotForChart(notes, metricKey, 'account');
    return {
      data: data.map((d) => ({ ...d, x: d.ym })),
      series: series.map((s, i) => ({
        key: s,
        name: s,
        color: colorAt(i),
        unit: metric.unit,
      })) as SeriesDef[],
    };
  }, [notes, metricKey, metric.unit]);

  const gridCharts = useMemo(
    () =>
      GRID_METRICS.map((k) => {
        const m = getMetric(k);
        const { data, series } = pivotForChart(notes, k, 'account');
        return {
          metric: m,
          data: data.map((d) => ({ ...d, x: d.ym })),
          series: series.map((s, i) => ({
            key: s,
            name: s,
            color: colorAt(i),
            unit: m.unit,
          })) as SeriesDef[],
        };
      }),
    [notes]
  );

  /* --------------------------- 环比透视表 --------------------------- */
  const pivot = useMemo(() => {
    const rows = momSeries(notes, pivotKey);
    const map = new Map<string, Map<string, { value: number | null; mom: number | null }>>();
    for (const r of rows) {
      if (!map.has(r.account)) map.set(r.account, new Map());
      map.get(r.account)!.set(r.ym, { value: r.value, mom: r.mom });
    }
    return map;
  }, [notes, pivotKey]);

  if (!notes.length) return <Empty title="当前筛选条件下没有数据" desc="请放宽全局筛选条件" />;

  const accounts = [...new Set(notes.map((n) => n.account))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const pivotMetric = getMetric(pivotKey);
  const metricOptions = METRICS.map((m) => ({ value: m.key, label: m.label, group: m.group }));

  return (
    <div className="space-y-5">
      <SectionTitle
        icon={<Users className="h-4 w-4" />}
        title="账号对比"
        desc={`${accounts.length} 个账号 · ${months.length} 个月的横向对比与环比追踪`}
      />

      {accounts.length < 2 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          当前只筛选出 1 个账号。上传多个 Excel（每个文件代表一个账号）后，本页可进行多账号横向对比。
        </div>
      )}

      {/* 账号横向汇总 */}
      <Card
        title="账号综合表现"
        subtitle="点击表头指标可切换排序依据"
        right={
          <Select
            className="w-40"
            value={sortKey}
            onChange={setSortKey}
            options={metricOptions}
          />
        }
        bodyClassName="p-0 sm:p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
                <th className="table-cell">账号</th>
                {SUMMARY_COLS.map((k) => (
                  <th key={k} className="table-cell text-right">
                    <button
                      onClick={() => setSortKey(k)}
                      className={`transition hover:text-ink-900 ${sortKey === k ? 'text-brand-600' : ''}`}
                    >
                      {getMetric(k).label}
                      {sortKey === k && ' ↓'}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accountRows.map((row, i) => (
                <tr key={row.key} className="border-b border-ink-100 transition last:border-0 hover:bg-brand-50/40">
                  <td className="table-cell font-medium text-ink-900">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: colorAt(i) }} />
                    {row.key}
                  </td>
                  {SUMMARY_COLS.map((k) => {
                    const m = getMetric(k);
                    return (
                      <td key={k} className="table-cell text-right tabular-nums">
                        {fmtByUnit(m.calc(row.totals), m.unit, true)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 多账号趋势 */}
      <Card
        title="多账号趋势对比"
        subtitle={mode === 'single' ? metric.desc : '六个核心指标的月度走势总览，每条线是一个账号'}
        right={
          <>
            <Segmented
              size="sm"
              options={[
                { value: 'single', label: '单指标大图' },
                { value: 'grid', label: '六宫格' },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'single' && (
              <>
                <Select className="w-36" value={metricKey} onChange={setMetricKey} options={metricOptions} />
                <Segmented
                  size="sm"
                  options={[
                    { value: 'line', label: '折线' },
                    { value: 'area', label: '面积' },
                    { value: 'bar', label: '柱状' },
                  ]}
                  value={kind}
                  onChange={setKind}
                />
              </>
            )}
          </>
        }
      >
        {mode === 'single' ? (
          <TrendChart data={single.data} xKey="x" series={single.series} kind={kind} height={380} xLabel="月份" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {gridCharts.map((g) => (
              <div key={g.metric.key} className="rounded-xl border border-ink-200/70 p-3">
                <p className="mb-1 text-[13px] font-semibold text-ink-900">{g.metric.label}</p>
                <p className="mb-2 text-[11px] text-ink-400">{g.metric.desc}</p>
                <TrendChart data={g.data} xKey="x" series={g.series} kind="line" height={210} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 环比透视表 */}
      <Card
        title="月度环比透视表"
        subtitle="每格上方为当月数值，下方为相较上月的环比变化"
        right={
          <Select className="w-40" value={pivotKey} onChange={setPivotKey} options={metricOptions} />
        }
        bodyClassName="p-0 sm:p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
                <th className="table-cell sticky left-0 bg-ink-50/60">账号 \ 月份</th>
                {months.map((m) => (
                  <th key={m} className="table-cell text-right">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc} className="border-b border-ink-100 last:border-0">
                  <td className="table-cell sticky left-0 bg-white font-medium text-ink-900">{acc}</td>
                  {months.map((m) => {
                    const cell = pivot.get(acc)?.get(m);
                    const mom = cell?.mom ?? null;
                    return (
                      <td key={m} className="table-cell text-right">
                        <div className="tabular-nums text-ink-900">
                          {fmtByUnit(cell?.value ?? null, pivotMetric.unit, true)}
                        </div>
                        <div
                          className={`text-[11px] tabular-nums ${
                            mom === null ? 'text-ink-300' : mom >= 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {mom === null ? '--' : fmtSignedPercent(mom)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400">
          合计：{accounts.length} 个账号 · {months.length} 个月 ·{' '}
          {fmtCompact(notes.length)} 篇笔记（红色为环比上升，绿色为下降）
        </div>
      </Card>
    </div>
  );
}
