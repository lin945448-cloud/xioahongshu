import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui/Card';
import { PillToggle, Segmented, Select } from '@/components/ui/Controls';
import { TrendChart, type ChartKind, type SeriesDef } from '@/components/charts/TrendChart';
import { RankChart } from '@/components/charts/DistributionCharts';
import { Empty } from '@/components/ui/Feedback';
import { useFilteredNotes, useFilterOptions } from '@/hooks/useFiltered';
import { METRIC_GROUPS, METRICS, getMetric, metricsByGroup, totalsOf, pctChange } from '@/lib/metrics';
import { groupBy, monthlyArithmeticMean, monthlyTotals, pivotForChart } from '@/lib/aggregate';
import { colorAt, fmtByUnit } from '@/lib/format';

type Dim = 'total' | 'account' | 'category' | 'genre';

export function MetricView() {
  const notes = useFilteredNotes();
  const opts = useFilterOptions();

  const [group, setGroup] = useState<string>('转化效率');
  const [metricKey, setMetricKey] = useState('readRate');
  const [compareKey, setCompareKey] = useState('ctr');
  const [dim, setDim] = useState<Dim>('total');
  const [kind, setKind] = useState<ChartKind>('line');

  const metric = getMetric(metricKey);
  const compare = getMetric(compareKey);
  const months = useMemo(() => monthlyTotals(notes), [notes]);

  /* ---------------- 指标概况 ---------------- */
  const stats = useMemo(() => {
    const totals = totalsOf(notes);
    const vals = months
      .map((m) => ({ ym: m.key, v: metric.calc(m.totals) }))
      .filter((x): x is { ym: string; v: number } => x.v !== null);
    const sorted = [...vals].sort((a, b) => b.v - a.v);
    const last = vals[vals.length - 1];
    const prev = vals[vals.length - 2];
    return {
      overall: metric.calc(totals),
      monthAvg: monthlyArithmeticMean(notes, metricKey),
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      mom: last && prev ? pctChange(last.v, prev.v) : null,
      latest: last,
    };
  }, [notes, months, metric, metricKey]);

  /* ---------------- 趋势图数据 ---------------- */
  const trend = useMemo(() => {
    if (dim === 'total') {
      const data = months.map((m) => ({ x: m.key, [metricKey]: metric.calc(m.totals) }));
      const series: SeriesDef[] = [
        { key: metricKey, name: metric.label, color: metric.color, unit: metric.unit },
      ];
      return { data, series };
    }
    const { data, series } = pivotForChart(notes, metricKey, dim);
    return {
      data: data.map((d) => ({ ...d, x: d.ym })),
      series: series.map((s, i) => ({
        key: s,
        name: s,
        color: colorAt(i),
        unit: metric.unit,
      })) as SeriesDef[],
    };
  }, [dim, months, notes, metricKey, metric]);

  /* ---------------- 双指标对比 ---------------- */
  const dualData = useMemo(
    () =>
      months.map((m) => ({
        x: m.key,
        [metricKey]: metric.calc(m.totals),
        [compareKey]: compare.calc(m.totals),
      })),
    [months, metricKey, compareKey, metric, compare]
  );

  const dualSeries: SeriesDef[] = [
    { key: metricKey, name: metric.label, color: metric.color, unit: metric.unit, kind: 'area' },
    {
      key: compareKey,
      name: compare.label,
      color: compare.color,
      unit: compare.unit,
      axis: compare.unit === metric.unit ? 'left' : 'right',
      kind: 'line',
    },
  ];

  /* ---------------- 维度排行 ---------------- */
  const rankDim: Exclude<Dim, 'total'> = dim === 'total' ? 'account' : dim;
  const rankData = useMemo(() => {
    const keyOf = (n: (typeof notes)[number]) =>
      rankDim === 'account' ? n.account : rankDim === 'category' ? n.category : n.genre;
    return groupBy(notes, keyOf)
      .map((g) => ({ name: g.key, value: metric.calc(g.totals) ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [notes, rankDim, metric]);

  if (!notes.length) return <Empty title="当前筛选条件下没有数据" desc="请放宽全局筛选条件" />;

  const dimOptions = [
    { value: 'total' as const, label: '整体' },
    { value: 'account' as const, label: '按账号' },
    ...(opts.hasCategory ? [{ value: 'category' as const, label: '按品类' }] : []),
    { value: 'genre' as const, label: '按体裁' },
  ];

  return (
    <div className="space-y-5">
      <SectionTitle
        icon={<TrendingUp className="h-4 w-4" />}
        title="指标分析"
        desc="先选指标，再选拆分维度与图表形态，所有图表随筛选实时联动"
      />

      {/* 指标选择器 */}
      <Card title="① 选择要分析的指标" subtitle={metric.desc}>
        <div className="space-y-3">
          <Segmented
            options={METRIC_GROUPS.map((g) => ({ value: g, label: g }))}
            value={group}
            onChange={setGroup}
          />
          <div className="flex flex-wrap gap-2">
            {metricsByGroup(group).map((m) => (
              <PillToggle
                key={m.key}
                active={metricKey === m.key}
                onClick={() => setMetricKey(m.key)}
                color={m.color}
              >
                {m.label}
              </PillToggle>
            ))}
          </div>
        </div>
      </Card>

      {/* 指标概况 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: '整体水平', value: fmtByUnit(stats.overall, metric.unit, true), tone: 'text-ink-900' },
          { label: '月均水平', value: fmtByUnit(stats.monthAvg, metric.unit, true), tone: 'text-ink-900' },
          {
            label: `最高月${stats.best ? ` · ${stats.best.ym}` : ''}`,
            value: stats.best ? fmtByUnit(stats.best.v, metric.unit, true) : '--',
            tone: 'text-emerald-600',
          },
          {
            label: `最低月${stats.worst ? ` · ${stats.worst.ym}` : ''}`,
            value: stats.worst ? fmtByUnit(stats.worst.v, metric.unit, true) : '--',
            tone: 'text-brand-600',
          },
          {
            label: `最新月环比${stats.latest ? ` · ${stats.latest.ym}` : ''}`,
            value:
              stats.mom === null
                ? '--'
                : `${stats.mom >= 0 ? '+' : ''}${(stats.mom * 100).toFixed(1)}%`,
            tone: stats.mom === null ? 'text-ink-400' : stats.mom >= 0 ? 'text-rose-600' : 'text-emerald-600',
          },
        ].map((s) => (
          <div key={s.label} className="card card-pad animate-fade-up">
            <p className="text-[11px] text-ink-500">{s.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 趋势图 */}
      <Card
        title={`② ${metric.label} · 月度趋势`}
        subtitle="切换维度即可看到该指标在不同账号 / 品类 / 体裁下的走势差异"
        right={
          <>
            <Segmented size="sm" options={dimOptions} value={dim} onChange={setDim} />
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
        <TrendChart data={trend.data} xKey="x" series={trend.series} kind={kind} height={360} xLabel="月份" />
      </Card>

      {/* 对比图 */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="③ 双指标对比"
          subtitle="观察两个指标是否同向变化，快速定位「流量涨了但互动没跟上」这类问题"
          right={
            <Select
              className="w-40"
              value={compareKey}
              onChange={setCompareKey}
              options={METRICS.filter((m) => m.key !== metricKey).map((m) => ({
                value: m.key,
                label: m.label,
                group: m.group,
              }))}
            />
          }
        >
          <TrendChart data={dualData} xKey="x" series={dualSeries} height={320} xLabel="月份" />
        </Card>

        <Card
          title={`④ ${metric.label} · ${rankDim === 'account' ? '账号' : rankDim === 'category' ? '品类' : '体裁'}排行`}
          subtitle="同一指标在不同主体间的横向对比，取前 12 位"
        >
          <RankChart data={rankData} unit={metric.unit} color={metric.color} />
        </Card>
      </div>
    </div>
  );
}
