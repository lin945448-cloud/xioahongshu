import { useMemo, useState } from 'react';
import { FolderTree } from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Segmented, Select } from '@/components/ui/Controls';
import { TrendChart, type ChartKind, type SeriesDef } from '@/components/charts/TrendChart';
import { RankChart, ScatterMatrix } from '@/components/charts/DistributionCharts';
import { Empty } from '@/components/ui/Feedback';
import { useFilteredNotes, useFilterOptions } from '@/hooks/useFiltered';
import { groupBy, monthlyArithmeticMean, pivotForChart, uniqSorted } from '@/lib/aggregate';
import { METRICS, getMetric, totalsOf } from '@/lib/metrics';
import { colorAt, fmtByUnit } from '@/lib/format';
import { useStore } from '@/store/useStore';

const TABLE_COLS = ['notes', 'impressions', 'views', 'ctr', 'engageRate', 'followRate'];

export function CategoryView() {
  const notes = useFilteredNotes();
  const opts = useFilterOptions();
  const setTab = useStore((s) => s.setTab);

  const [dim, setDim] = useState<'category' | 'genre'>(opts.hasCategory ? 'category' : 'genre');
  const [rankKey, setRankKey] = useState('views');
  const [trendKey, setTrendKey] = useState('engageRate');
  const [kind, setKind] = useState<ChartKind>('bar');
  const [xKey, setXKey] = useState('ctr');
  const [yKey, setYKey] = useState('engageRate');

  const dimLabel = dim === 'category' ? '品类' : '体裁';
  const dimOf = (n: (typeof notes)[number]) => (dim === 'category' ? n.category : n.genre);

  const groups = useMemo(() => groupBy(notes, dimOf), [notes, dim]);

  const rankMetric = getMetric(rankKey);
  const rankData = useMemo(
    () =>
      groups
        .map((g) => ({ name: g.key, value: rankMetric.calc(g.totals) ?? 0 }))
        .sort((a, b) => b.value - a.value),
    [groups, rankMetric]
  );

  const trendMetric = getMetric(trendKey);
  const trend = useMemo(() => {
    const { data, series } = pivotForChart(notes, trendKey, dim);
    return {
      data: data.map((d) => ({ ...d, x: d.ym })),
      series: series.map((s, i) => ({
        key: s,
        name: s,
        color: colorAt(i),
        unit: trendMetric.unit,
      })) as SeriesDef[],
    };
  }, [notes, trendKey, dim, trendMetric.unit]);

  const scatter = useMemo(() => {
    const mx = getMetric(xKey);
    const my = getMetric(yKey);
    return groups
      .map((g) => ({
        name: g.key,
        x: mx.calc(g.totals) ?? 0,
        y: my.calc(g.totals) ?? 0,
        size: g.totals.views,
      }))
      .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
  }, [groups, xKey, yKey]);

  /* 品类 × 体裁 交叉表 */
  const cross = useMemo(() => {
    const cats = uniqSorted(notes.map((n) => n.category));
    const genres = uniqSorted(notes.map((n) => n.genre));
    const m = getMetric(trendKey);
    const map = new Map<string, number | null>();
    for (const g of groupBy(notes, (n) => `${n.category}||${n.genre}`)) {
      map.set(g.key, m.calc(g.totals));
    }
    const values = [...map.values()].filter((v): v is number => v !== null);
    return {
      cats,
      genres,
      map,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1,
      metric: m,
    };
  }, [notes, trendKey]);

  if (!notes.length) return <Empty title="当前筛选条件下没有数据" desc="请放宽全局筛选条件" />;

  const metricOptions = METRICS.map((m) => ({ value: m.key, label: m.label, group: m.group }));
  const overall = totalsOf(notes);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          icon={<FolderTree className="h-4 w-4" />}
          title="品类分析"
          desc={`按${dimLabel}拆解流量与互动表现，定位高潜力内容方向`}
        />
        <Segmented
          options={[
            ...(opts.hasCategory ? [{ value: 'category' as const, label: '按品类' }] : []),
            { value: 'genre' as const, label: '按体裁' },
          ]}
          value={dim}
          onChange={setDim}
        />
      </div>

      {!opts.hasCategory && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          上传的表格中没有识别到「品类 / 分类 / 类目」列，已自动切换为按体裁分析。
          若需要品类维度，请在原始 Excel 中新增一列并命名为「品类」，再重新上传。
        </div>
      )}

      {/* 排行榜 */}
      <div className="grid gap-5 xl:grid-cols-5">
        <Card
          className="xl:col-span-2"
          title={`${dimLabel}排行榜`}
          subtitle={rankMetric.desc}
          right={<Select className="w-32" value={rankKey} onChange={setRankKey} options={metricOptions} />}
        >
          <RankChart data={rankData} unit={rankMetric.unit} color={rankMetric.color} />
        </Card>

        <Card
          className="xl:col-span-3"
          title={`${dimLabel}趋势`}
          subtitle="每条线代表一个品类 / 体裁，用于观察内容方向的此消彼长"
          right={
            <>
              <Select className="w-32" value={trendKey} onChange={setTrendKey} options={metricOptions} />
              <Segmented
                size="sm"
                options={[
                  { value: 'bar', label: '柱状' },
                  { value: 'line', label: '折线' },
                  { value: 'area', label: '面积' },
                ]}
                value={kind}
                onChange={setKind}
              />
            </>
          }
        >
          <TrendChart data={trend.data} xKey="x" series={trend.series} kind={kind} height={300} xLabel="月份" />
        </Card>
      </div>

      {/* 汇总表 */}
      <Card
        title={`${dimLabel}核心指标汇总`}
        subtitle="总体口径 + 月均口径并列展示，便于判断某个方向是「一次性爆款」还是「持续稳定」"
        bodyClassName="p-0 sm:p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
                <th className="table-cell">{dimLabel}</th>
                {TABLE_COLS.map((k) => (
                  <th key={k} className="table-cell text-right">
                    {getMetric(k).label}
                  </th>
                ))}
                <th className="table-cell text-right">月均互动率</th>
                <th className="table-cell text-right">流量占比</th>
              </tr>
            </thead>
            <tbody>
              {[...groups]
                .sort((a, b) => b.totals.views - a.totals.views)
                .map((g, i) => {
                  const share = overall.views ? g.totals.views / overall.views : 0;
                  return (
                    <tr key={g.key} className="border-b border-ink-100 transition last:border-0 hover:bg-brand-50/40">
                      <td className="table-cell font-medium text-ink-900">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: colorAt(i) }} />
                        {g.key}
                      </td>
                      {TABLE_COLS.map((k) => {
                        const m = getMetric(k);
                        return (
                          <td key={k} className="table-cell text-right tabular-nums">
                            {fmtByUnit(m.calc(g.totals), m.unit, true)}
                          </td>
                        );
                      })}
                      <td className="table-cell text-right tabular-nums">
                        {fmtByUnit(monthlyArithmeticMean(g.notes, 'engageRate'), 'percent')}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="tabular-nums text-ink-700">{(share * 100).toFixed(1)}%</span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${share * 100}%`, background: colorAt(i) }}
                            />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 交叉分析 */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="交叉分析 · 四象限气泡图"
          subtitle="虚线为全部主体的均值线，右上象限即「双高」优质方向；气泡大小代表观看量"
          right={
            <>
              <Select className="w-32" value={xKey} onChange={setXKey} options={metricOptions} />
              <span className="text-xs text-ink-400">×</span>
              <Select className="w-32" value={yKey} onChange={setYKey} options={metricOptions} />
            </>
          }
        >
          <ScatterMatrix
            data={scatter}
            xUnit={getMetric(xKey).unit}
            yUnit={getMetric(yKey).unit}
            xLabel={getMetric(xKey).label}
            yLabel={getMetric(yKey).label}
          />
        </Card>

        <Card
          title="交叉分析 · 品类 × 体裁热力表"
          subtitle={`颜色越深表示 ${cross.metric.label} 越高，用于判断「哪种品类更适合做视频 / 图文」`}
          bodyClassName="p-0 sm:p-0"
        >
          {cross.cats.length && cross.genres.length ? (
            <div className="overflow-x-auto p-4 sm:p-5">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold text-ink-500">
                    <th className="table-cell">品类 \ 体裁</th>
                    {cross.genres.map((g) => (
                      <th key={g} className="table-cell text-center">
                        {g}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cross.cats.map((c) => (
                    <tr key={c}>
                      <td className="table-cell font-medium text-ink-900">{c}</td>
                      {cross.genres.map((g) => {
                        const v = cross.map.get(`${c}||${g}`) ?? null;
                        const t =
                          v === null || cross.max === cross.min
                            ? 0
                            : (v - cross.min) / (cross.max - cross.min);
                        return (
                          <td key={g} className="px-1.5 py-1.5 text-center">
                            <div
                              className="rounded-lg py-2 text-xs font-semibold tabular-nums"
                              style={{
                                background:
                                  v === null ? '#f8fafc' : `rgba(225, 29, 72, ${0.08 + t * 0.62})`,
                                color: v === null ? '#cbd5e1' : t > 0.55 ? '#fff' : '#334155',
                              }}
                            >
                              {fmtByUnit(v, cross.metric.unit, true)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="维度不足，无法生成交叉表" />
          )}
        </Card>
      </div>

      <p className="text-center text-xs text-ink-400">
        想看具体是哪几篇笔记拉高了某个品类？
        <button onClick={() => setTab('detail')} className="ml-1 text-brand-600 hover:underline">
          前往数据明细 →
        </button>
      </p>
    </div>
  );
}
