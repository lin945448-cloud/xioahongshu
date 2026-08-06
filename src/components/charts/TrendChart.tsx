import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MetricUnit } from '@/types';
import { fmtAxis, fmtByUnit } from '@/lib/format';
import { Empty } from '@/components/ui/Feedback';

export type ChartKind = 'line' | 'area' | 'bar';

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
  unit: MetricUnit;
  axis?: 'left' | 'right';
  kind?: ChartKind;
}

interface Props {
  data: Record<string, unknown>[];
  xKey: string;
  series: SeriesDef[];
  kind?: ChartKind;
  height?: number;
  smooth?: boolean;
  stacked?: boolean;
  xLabel?: string;
}

function ChartTooltip({ active, payload, label, series }: any) {
  if (!active || !payload?.length) return null;
  const unitOf = (key: string) => series.find((s: SeriesDef) => s.key === key)?.unit ?? 'count';
  return (
    <div className="rounded-xl border border-ink-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-1.5 text-xs font-semibold text-ink-900">{label}</p>
      <ul className="space-y-1">
        {payload.map((p: any) => (
          <li key={p.dataKey} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="mr-2 text-ink-500">{p.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink-900">
              {fmtByUnit(p.value, unitOf(p.dataKey), true)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrendChart({
  data,
  xKey,
  series,
  kind = 'line',
  height = 320,
  smooth = true,
  stacked = false,
  xLabel,
}: Props) {
  if (!data.length || !series.length) {
    return <Empty title="暂无可绘制的数据" desc="请调整筛选条件或选择至少一个指标" />;
  }

  const hasRight = series.some((s) => s.axis === 'right');
  const leftUnit = series.find((s) => s.axis !== 'right')?.unit ?? 'count';
  const rightUnit = series.find((s) => s.axis === 'right')?.unit ?? 'count';

  const renderSeries = (s: SeriesDef, i: number) => {
    const k = s.kind ?? kind;
    const common = {
      key: s.key,
      dataKey: s.key,
      name: s.name,
      yAxisId: s.axis ?? 'left',
      stroke: s.color,
      connectNulls: true,
      animationDuration: 650,
      animationBegin: i * 80,
    } as const;

    if (k === 'bar')
      return (
        <Bar
          {...common}
          fill={s.color}
          radius={[6, 6, 0, 0]}
          maxBarSize={38}
          stackId={stacked ? 'a' : undefined}
        />
      );

    if (k === 'area')
      return (
        <Area
          {...common}
          type={smooth ? 'monotone' : 'linear'}
          fill={s.color}
          fillOpacity={0.16}
          strokeWidth={2.2}
          stackId={stacked ? 'a' : undefined}
          activeDot={{ r: 4 }}
        />
      );

    return (
      <Line
        {...common}
        type={smooth ? 'monotone' : 'linear'}
        strokeWidth={2.4}
        dot={{ r: 2.6, strokeWidth: 0, fill: s.color }}
        activeDot={{ r: 5 }}
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: hasRight ? 8 : 16, bottom: xLabel ? 18 : 4, left: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
          tickMargin={8}
          minTickGap={12}
          label={
            xLabel
              ? { value: xLabel, position: 'insideBottom', offset: -12, fontSize: 11, fill: '#94a3b8' }
              : undefined
          }
        />
        <YAxis
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          width={58}
          tickFormatter={(v: number) => fmtAxis(v, leftUnit)}
        />
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={(v: number) => fmtAxis(v, rightUnit)}
          />
        )}
        <Tooltip content={<ChartTooltip series={series} />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
        {series.length > 1 && (
          <Legend
            verticalAlign="top"
            align="right"
            height={30}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ paddingBottom: 8 }}
          />
        )}
        {series.map(renderSeries)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
