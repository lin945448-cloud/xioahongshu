import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { MetricUnit } from '@/types';
import { colorAt, fmtAxis, fmtByUnit } from '@/lib/format';
import { Empty } from '@/components/ui/Feedback';

export interface DistItem {
  name: string;
  value: number;
}

/* ------------------------------ 环形占比图 ------------------------------ */
export function DonutChart({
  data,
  unit = 'count',
  height = 300,
  centerLabel,
}: {
  data: DistItem[];
  unit?: MetricUnit;
  height?: number;
  centerLabel?: string;
}) {
  if (!data.length) return <Empty title="暂无分布数据" />;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="56%"
            outerRadius="82%"
            paddingAngle={2}
            animationDuration={700}
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colorAt(i)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const p = payload[0];
              const pct = total ? (p.value / total) * 100 : 0;
              return (
                <div className="rounded-xl border border-ink-200 bg-white/95 px-3 py-2 text-xs shadow-xl">
                  <p className="font-semibold text-ink-900">{p.name}</p>
                  <p className="mt-1 text-ink-600">
                    {fmtByUnit(p.value, unit, true)} · 占比 {pct.toFixed(1)}%
                  </p>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(v: string) => <span className="text-xs text-ink-700">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] -translate-y-1/2 text-center">
          <p className="text-[11px] text-ink-400">合计</p>
          <p className="text-lg font-bold text-ink-900">{centerLabel}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ 横向排行榜 ------------------------------ */
export function RankChart({
  data,
  unit = 'count',
  height,
  color = '#e11d48',
}: {
  data: DistItem[];
  unit?: MetricUnit;
  height?: number;
  color?: string;
}) {
  if (!data.length) return <Empty title="暂无排行数据" />;
  const h = height ?? Math.max(200, data.length * 42 + 30);

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tickFormatter={(v: number) => fmtAxis(v, unit)} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={104}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: '#334155' }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,.12)' }}
          content={({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-xl border border-ink-200 bg-white/95 px-3 py-2 text-xs shadow-xl">
                <p className="font-semibold text-ink-900">{label}</p>
                <p className="mt-1 font-medium text-ink-700">
                  {fmtByUnit(payload[0].value, unit, true)}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26} animationDuration={650}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? color : colorAt(i)} fillOpacity={i === 0 ? 1 : 0.82} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------- 散点式交叉分析 ---------------------------- */
export function ScatterMatrix({
  data,
  xUnit,
  yUnit,
  xLabel,
  yLabel,
  height = 340,
}: {
  data: { name: string; x: number; y: number; size: number }[];
  xUnit: MetricUnit;
  yUnit: MetricUnit;
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  if (!data.length) return <Empty title="暂无交叉分析数据" />;

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const sizes = data.map((d) => d.size);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const sMax = Math.max(...sizes, 1);
  const pad = 0.12;
  const spanX = (xMax - xMin) || Math.abs(xMax) || 1;
  const spanY = (yMax - yMin) || Math.abs(yMax) || 1;
  const x0 = xMin - spanX * pad;
  const x1 = xMax + spanX * pad;
  const y0 = yMin - spanY * pad;
  const y1 = yMax + spanY * pad;
  const xAvg = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yAvg = ys.reduce((a, b) => a + b, 0) / ys.length;

  const W = 100;
  const H = 100;
  const px = (v: number) => ((v - x0) / (x1 - x0)) * W;
  const py = (v: number) => H - ((v - y0) / (y1 - y0)) * H;

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="-14 -6 128 122" className="h-full w-full" preserveAspectRatio="none">
        {/* 网格 */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={0} y1={g} x2={W} y2={g} stroke="#e2e8f0" strokeWidth={0.3} strokeDasharray="1.5 1.5" />
            <line x1={g} y1={0} x2={g} y2={H} stroke="#e2e8f0" strokeWidth={0.3} strokeDasharray="1.5 1.5" />
          </g>
        ))}
        {/* 均值分割线（四象限） */}
        <line x1={px(xAvg)} y1={0} x2={px(xAvg)} y2={H} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="2 2" />
        <line x1={0} y1={py(yAvg)} x2={W} y2={py(yAvg)} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="2 2" />
        <text x={W - 1} y={2.5} fontSize={3} fill="#16a34a" textAnchor="end">
          双高 · 优质区
        </text>
        <text x={1} y={H - 1} fontSize={3} fill="#94a3b8">
          双低 · 待优化
        </text>
        {/* 气泡 */}
        {data.map((d, i) => (
          <g key={d.name}>
            <circle
              cx={px(d.x)}
              cy={py(d.y)}
              r={2.2 + (d.size / sMax) * 4.2}
              fill={colorAt(i)}
              fillOpacity={0.5}
              stroke={colorAt(i)}
              strokeWidth={0.5}
            />
            <text x={px(d.x)} y={py(d.y) - 4 - (d.size / sMax) * 3} fontSize={3.2} fill="#334155" textAnchor="middle">
              {d.name}
            </text>
          </g>
        ))}
        <line x1={0} y1={H} x2={W} y2={H} stroke="#cbd5e1" strokeWidth={0.4} />
        <line x1={0} y1={0} x2={0} y2={H} stroke="#cbd5e1" strokeWidth={0.4} />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-ink-500">
        <span>
          纵轴：{yLabel}（{fmtByUnit(yMin, yUnit, true)} ~ {fmtByUnit(yMax, yUnit, true)}）
        </span>
        <span>
          横轴：{xLabel}（{fmtByUnit(xMin, xUnit, true)} ~ {fmtByUnit(xMax, xUnit, true)}）
        </span>
      </div>
    </div>
  );
}
