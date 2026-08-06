import type { MetricUnit } from '@/types';

const isBad = (v: unknown): boolean =>
  v === null || v === undefined || typeof v !== 'number' || !Number.isFinite(v);

export const fmtPercent = (v: number | null | undefined, digits = 2): string =>
  isBad(v) ? '--' : `${((v as number) * 100).toFixed(digits)}%`;

export const fmtSignedPercent = (v: number | null | undefined, digits = 1): string => {
  if (isBad(v)) return '--';
  const n = (v as number) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
};

export const fmtInt = (v: number | null | undefined): string =>
  isBad(v) ? '--' : Math.round(v as number).toLocaleString('zh-CN');

export const fmtFloat = (v: number | null | undefined, digits = 2): string =>
  isBad(v) ? '--' : (v as number).toFixed(digits);

/** 大数字紧凑显示：12.3万 / 1.24亿 */
export const fmtCompact = (v: number | null | undefined): string => {
  if (isBad(v)) return '--';
  const n = v as number;
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(n / 1e4).toFixed(abs >= 1e6 ? 1 : 2)}万`;
  return Math.round(n).toLocaleString('zh-CN');
};

/** 按指标单位统一格式化 */
export const fmtByUnit = (
  v: number | null | undefined,
  unit: MetricUnit,
  compact = false
): string => {
  if (isBad(v)) return '--';
  if (unit === 'percent') return fmtPercent(v, 2);
  if (unit === 'ratio') return fmtFloat(v, 2);
  return compact ? fmtCompact(v) : fmtInt(v);
};

/** 坐标轴刻度（更短） */
export const fmtAxis = (v: number, unit: MetricUnit): string => {
  if (isBad(v)) return '';
  if (unit === 'percent') {
    const p = v * 100;
    return `${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
  }
  if (unit === 'ratio') return v.toFixed(1);
  return fmtCompact(v);
};

export const fmtDate = (ts: number): string => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const fmtDateTime = (ts: number): string => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fmtDate(ts)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const CHART_COLORS = [
  '#e11d48',
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#f97316',
  '#4f46e5',
];

export const colorAt = (i: number): string => CHART_COLORS[i % CHART_COLORS.length];
