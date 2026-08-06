import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { fmtSignedPercent } from '@/lib/format';

/** 轻量内联 sparkline（不引入图表库，保证 KPI 区域渲染开销极低） */
function Spark({ values, color }: { values: (number | null)[]; color: string }) {
  const pts = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (pts.length < 2) return <div className="h-8" />;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || Math.abs(max) || 1;
  const W = 100;
  const H = 28;
  const step = W / (pts.length - 1);
  const coords = pts.map((v, i) => [i * step, H - ((v - min) / span) * (H - 4) - 2]);
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(2)},${c[1].toFixed(2)}`).join(' ');
  const area = `${d} L${W},${H} L0,${H} Z`;
  const id = `sp-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r={1.8} fill={color} />
    </svg>
  );
}

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  desc?: string;
  color: string;
  delta?: number | null;
  higherIsBetter?: boolean;
  spark?: (number | null)[];
  onClick?: () => void;
  active?: boolean;
}

export function KpiCard({
  label,
  value,
  sub,
  desc,
  color,
  delta,
  higherIsBetter = true,
  spark,
  onClick,
  active,
}: KpiCardProps) {
  const good = delta === null || delta === undefined ? null : higherIsBetter ? delta >= 0 : delta <= 0;

  return (
    <div
      onClick={onClick}
      title={desc}
      className={clsx(
        'card card-pad animate-fade-up flex flex-col gap-2 transition',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg',
        active && 'ring-2 ring-brand-300'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="text-[13px] font-medium text-ink-500">{label}</span>
        </div>
        {delta !== null && delta !== undefined && (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
              good === null
                ? 'bg-ink-100 text-ink-500'
                : good
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-emerald-50 text-emerald-600'
            )}
          >
            {delta === 0 ? (
              <Minus className="h-3 w-3" />
            ) : delta > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {fmtSignedPercent(delta)}
          </span>
        )}
      </div>

      <p className="text-2xl font-bold leading-none tracking-tight text-ink-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-ink-400">{sub}</p>}
      {spark && <Spark values={spark} color={color} />}
    </div>
  );
}
