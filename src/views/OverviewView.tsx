import { useMemo, useState } from 'react';
import { ChevronDown, Database, LayoutDashboard, PieChart } from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Segmented, PillToggle } from '@/components/ui/Controls';
import { KpiCard } from '@/components/KpiCard';
import { TrendChart, type ChartKind, type SeriesDef } from '@/components/charts/TrendChart';
import { DonutChart } from '@/components/charts/DistributionCharts';
import { DropZone, FileManager } from '@/components/DataSource';
import { useFilteredNotes, useFilterOptions } from '@/hooks/useFiltered';
import {
  distribution,
  lastMonthDelta,
  monthlyArithmeticMean,
  monthlyTotals,
} from '@/lib/aggregate';
import { DEFAULT_KPI_KEYS, getMetric, noteMetric, totalsOf } from '@/lib/metrics';
import { fmtByUnit, fmtCompact, fmtDate } from '@/lib/format';
import { useStore } from '@/store/useStore';

type Scope = 'total' | 'perNote' | 'perMonth';

const SCOPE_OPTIONS = [
  { value: 'total' as const, label: '总量', title: '所有笔记汇总口径' },
  { value: 'perNote' as const, label: '篇均', title: '按笔记数平均' },
  { value: 'perMonth' as const, label: '月均', title: '各月份数值的算术平均（剔除单月流量畸高的倾斜）' },
];

const TREND_METRIC_POOL = [
  'impressions',
  'views',
  'readRate',
  'ctr',
  'engageRate',
  'likeRate',
  'collectRate',
  'followers',
  'followRate',
  'notes',
];

export function OverviewView() {
  const notes = useFilteredNotes();
  const opts = useFilterOptions();
  const isDemo = useStore((s) => s.isDemo);

  const [scope, setScope] = useState<Scope>('total');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [trendKeys, setTrendKeys] = useState<string[]>(['views', 'engageRate']);
  const [kind, setKind] = useState<ChartKind>('area');
  const [grain, setGrain] = useState<'month' | 'note'>('month');
  const [distDim, setDistDim] = useState<'genre' | 'account' | 'category'>('genre');
  const [distMetric, setDistMetric] = useState('views');

  const months = useMemo(() => monthlyTotals(notes), [notes]);
  const totals = useMemo(() => totalsOf(notes), [notes]);

  /** 按口径计算 KPI 数值 */
  const kpiValue = (key: string): number | null => {
    const m = getMetric(key);
    if (scope === 'total') return m.calc(totals);
    if (scope === 'perMonth') {
      if (m.unit === 'count') return months.length ? (m.calc(totals) ?? 0) / months.length : null;
      return monthlyArithmeticMean(notes, key);
    }
    // 篇均
    if (m.unit === 'count') return notes.length ? (m.calc(totals) ?? 0) / notes.length : null;
    const vals = notes.map((n) => noteMetric(n, key)).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const kpis = DEFAULT_KPI_KEYS.map((key) => {
    const m = getMetric(key);
    const { delta } = lastMonthDelta(notes, key);
    const spark = months.map((mo) => m.calc(mo.totals));
    const raw = kpiValue(key);
    const scopeLabel = scope === 'total' ? '' : scope === 'perNote' ? '篇均 · ' : '月均 · ';
    return {
      key,
      label: (scope !== 'total' && m.unit === 'count' ? scopeLabel : '') + m.label,
      value: fmtByUnit(raw, m.unit === 'count' && scope !== 'total' ? 'ratio' : m.unit, m.unit === 'count'),
      desc: m.desc,
      color: m.color,
      delta,
      higherIsBetter: m.higherIsBetter ?? true,
      spark,
      sub: months.length ? `最新月 ${months[months.length - 1].key} 环比` : undefined,
    };
  });

  /** 趋势图数据 */
  const { trendData, trendSeries } = useMemo(() => {
    const series: SeriesDef[] = trendKeys.map((k, i) => {
      const m = getMetric(k);
      return {
        key: k,
        name: m.label,
        color: m.color,
        unit: m.unit,
        axis: i > 0 && getMetric(trendKeys[0]).unit !== m.unit ? 'right' : 'left',
      };
    });

    if (grain === 'month') {
      const data = months.map((mo) => {
        const row: Record<string, unknown> = { x: mo.key };
        trendKeys.forEach((k) => (row[k] = getMetric(k).calc(mo.totals)));
        return row;
      });
      return { trendData: data, trendSeries: series };
    }

    const data = notes.map((n) => {
      const row: Record<string, unknown> = { x: fmtDate(n.publishAt) };
      trendKeys.forEach((k) => (row[k] = noteMetric(n, k)));
      return row;
    });
    return { trendData: data, trendSeries: series };
  }, [trendKeys, grain, months, notes]);

  const distData = useMemo(
    () => distribution(notes, distDim, distMetric),
    [notes, distDim, distMetric]
  );
  const genreData = useMemo(() => distribution(notes, 'genre', 'notes'), [notes]);

  const toggleTrend = (k: string) =>
    setTrendKeys((prev) =>
      prev.includes(k) ? (prev.length > 1 ? prev.filter((x) => x !== k) : prev) : [...prev, k].slice(-3)
    );

  return (
    <div className="space-y-5">
      {/* 数据源管理 */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setSourceOpen((o) => !o)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50 sm:px-5"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <Database className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">
              数据源管理
              {isDemo && (
                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  当前为演示数据
                </span>
              )}
            </p>
            <p className="text-xs text-ink-500">上传 / 追加 Excel、重命名账号、移除数据</p>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition ${sourceOpen ? 'rotate-180' : ''}`} />
        </button>
        {sourceOpen && (
          <div className="space-y-4 border-t border-ink-200/70 p-4 sm:p-5">
            <FileManager />
            <DropZone compact />
            <p className="text-xs text-ink-500">真实数据由管理员在顶部工作区管理，上传后自动保存并供授权成员查看。</p>
          </div>
        )}
      </div>

      {/* KPI 卡 */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            icon={<LayoutDashboard className="h-4 w-4" />}
            title="核心指标概览"
            desc={`覆盖 ${opts.accounts.length} 个账号 · ${months.length} 个月 · ${notes.length} 篇笔记`}
          />
          <Segmented options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
          {kpis.map(({ key, ...props }) => (
            <KpiCard key={key} {...props} />
          ))}
        </div>
        {scope === 'perMonth' && (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
            月均口径说明：比率类指标取「各月份比率的算术平均值」，用于衡量常规月份的平均表现，避免某个月流量畸高导致整体口径被拉偏。
          </p>
        )}
      </div>

      {/* 趋势图 */}
      <Card
        title="趋势走势"
        subtitle="最多同时对比 3 个指标，第二个不同单位的指标会自动使用右侧坐标轴"
        right={
          <>
            <Segmented
              size="sm"
              options={[
                { value: 'month', label: '按月' },
                { value: 'note', label: '按笔记' },
              ]}
              value={grain}
              onChange={setGrain}
            />
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
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {TREND_METRIC_POOL.map((k) => {
            const m = getMetric(k);
            return (
              <PillToggle
                key={k}
                active={trendKeys.includes(k)}
                onClick={() => toggleTrend(k)}
                color={m.color}
              >
                {m.label}
              </PillToggle>
            );
          })}
        </div>
        <TrendChart
          data={trendData}
          xKey="x"
          series={trendSeries}
          kind={kind}
          height={340}
          xLabel={grain === 'month' ? '月份' : '发布日期'}
        />
      </Card>

      {/* 分布图 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="内容体裁分布"
          subtitle="图文 vs 视频的发布篇数占比"
          right={<span className="chip">共 {notes.length} 篇</span>}
        >
          <DonutChart data={genreData} unit="count" centerLabel={fmtCompact(notes.length)} />
        </Card>

        <Card
          title="流量结构分布"
          subtitle="切换维度与指标，查看流量集中在哪里"
          right={
            <>
              <Segmented
                size="sm"
                options={[
                  { value: 'account', label: '账号' },
                  ...(opts.hasCategory ? [{ value: 'category' as const, label: '品类' }] : []),
                  { value: 'genre', label: '体裁' },
                ]}
                value={distDim}
                onChange={setDistDim}
              />
              <Segmented
                size="sm"
                options={[
                  { value: 'views', label: '观看' },
                  { value: 'impressions', label: '曝光' },
                  { value: 'followers', label: '涨粉' },
                ]}
                value={distMetric}
                onChange={setDistMetric}
              />
            </>
          }
        >
          <DonutChart
            data={distData}
            unit="count"
            centerLabel={fmtCompact(distData.reduce((s, d) => s + d.value, 0))}
          />
        </Card>
      </div>

      {/* 月度速览表 */}
      <Card
        title="月度速览"
        subtitle="每月核心表现一览，点击「指标分析」可展开更细维度"
        right={
          <span className="chip">
            <PieChart className="h-3 w-3" />
            {months.length} 个月
          </span>
        }
        bodyClassName="p-0 sm:p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
                <th className="table-cell">月份</th>
                <th className="table-cell text-right">笔记数</th>
                <th className="table-cell text-right">曝光</th>
                <th className="table-cell text-right">观看量</th>
                <th className="table-cell text-right">阅读率</th>
                <th className="table-cell text-right">封面点击率</th>
                <th className="table-cell text-right">互动率</th>
                <th className="table-cell text-right">涨粉</th>
                <th className="table-cell text-right">转粉率</th>
              </tr>
            </thead>
            <tbody>
              {months.map((mo) => (
                <tr key={mo.key} className="border-b border-ink-100 transition last:border-0 hover:bg-brand-50/40">
                  <td className="table-cell font-medium text-ink-900">{mo.key}</td>
                  <td className="table-cell text-right tabular-nums">{mo.totals.notes}</td>
                  <td className="table-cell text-right tabular-nums">{fmtCompact(mo.totals.impressions)}</td>
                  <td className="table-cell text-right tabular-nums">{fmtCompact(mo.totals.views)}</td>
                  {['readRate', 'ctr', 'engageRate'].map((k) => (
                    <td key={k} className="table-cell text-right tabular-nums">
                      {fmtByUnit(getMetric(k).calc(mo.totals), 'percent')}
                    </td>
                  ))}
                  <td className="table-cell text-right tabular-nums">{fmtCompact(mo.totals.followers)}</td>
                  <td className="table-cell text-right tabular-nums">
                    {fmtByUnit(getMetric('followRate').calc(mo.totals), 'percent')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
