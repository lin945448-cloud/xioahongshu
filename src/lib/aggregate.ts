import type { Note, Totals } from '@/types';
import { addNote, emptyTotals, getMetric, pctChange, totalsOf } from './metrics';

export interface GroupRow {
  key: string;
  totals: Totals;
  notes: Note[];
}

export const groupBy = (notes: Note[], keyFn: (n: Note) => string): GroupRow[] => {
  const map = new Map<string, GroupRow>();
  for (const n of notes) {
    const k = keyFn(n);
    let row = map.get(k);
    if (!row) {
      row = { key: k, totals: emptyTotals(), notes: [] };
      map.set(k, row);
    }
    addNote(row.totals, n);
    row.notes.push(n);
  }
  return [...map.values()];
};

export const uniqSorted = (values: string[]): string[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, 'zh-CN'));

export const monthsOf = (notes: Note[]): string[] =>
  [...new Set(notes.map((n) => n.ym))].sort();

/** 月度聚合（全部账号合并） */
export const monthlyTotals = (notes: Note[]): GroupRow[] =>
  groupBy(notes, (n) => n.ym).sort((a, b) => a.key.localeCompare(b.key));

/** 账号 × 月份 聚合 */
export interface AccountMonthRow {
  account: string;
  ym: string;
  totals: Totals;
}

export const accountMonthly = (notes: Note[]): AccountMonthRow[] =>
  groupBy(notes, (n) => `${n.account}||${n.ym}`)
    .map((r) => {
      const [account, ym] = r.key.split('||');
      return { account, ym, totals: r.totals };
    })
    .sort((a, b) => a.account.localeCompare(b.account, 'zh-CN') || a.ym.localeCompare(b.ym));

/**
 * 生成「指标 + 环比」的月度序列（按账号分组计算环比）
 */
export interface MomRow {
  account: string;
  ym: string;
  totals: Totals;
  value: number | null;
  mom: number | null;
}

export const momSeries = (notes: Note[], metricKey: string): MomRow[] => {
  const metric = getMetric(metricKey);
  const rows = accountMonthly(notes);
  const out: MomRow[] = [];
  let prevAccount = '';
  let prevValue: number | null = null;
  for (const r of rows) {
    const value = metric.calc(r.totals);
    const mom = r.account === prevAccount ? pctChange(value, prevValue) : null;
    out.push({ ...r, value, mom });
    prevAccount = r.account;
    prevValue = value;
  }
  return out;
};

/**
 * 把「账号 × 月份」数据整理成 recharts 需要的宽表：
 * [{ ym: '2025-01', 账号A: 0.12, 账号B: 0.09 }, ...]
 */
export const pivotForChart = (
  notes: Note[],
  metricKey: string,
  dimension: 'account' | 'category' | 'genre'
): { data: Record<string, string | number | null>[]; series: string[] } => {
  const metric = getMetric(metricKey);
  const dimOf = (n: Note) =>
    dimension === 'account' ? n.account : dimension === 'category' ? n.category : n.genre;

  const grouped = groupBy(notes, (n) => `${dimOf(n)}||${n.ym}`);
  const months = monthsOf(notes);
  const series = uniqSorted(notes.map(dimOf));

  const lookup = new Map<string, Totals>();
  for (const g of grouped) lookup.set(g.key, g.totals);

  const data = months.map((ym) => {
    const row: Record<string, string | number | null> = { ym };
    for (const s of series) {
      const t = lookup.get(`${s}||${ym}`);
      row[s] = t ? metric.calc(t) : null;
    }
    return row;
  });

  return { data, series };
};

/** 「每月比率的算术平均」——对齐原版【月均指标】口径，剔除单月流量畸高的倾斜 */
export const monthlyArithmeticMean = (notes: Note[], metricKey: string): number | null => {
  const metric = getMetric(metricKey);
  const months = monthlyTotals(notes);
  const vals = months.map((m) => metric.calc(m.totals)).filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

/** 上一期对比（用于 KPI 卡的环比徽标）：最后一个月 vs 前一个月 */
export const lastMonthDelta = (
  notes: Note[],
  metricKey: string
): { current: number | null; prev: number | null; delta: number | null; ym?: string } => {
  const metric = getMetric(metricKey);
  const months = monthlyTotals(notes);
  if (months.length === 0) return { current: null, prev: null, delta: null };
  const cur = metric.calc(months[months.length - 1].totals);
  const prev = months.length > 1 ? metric.calc(months[months.length - 2].totals) : null;
  return { current: cur, prev, delta: pctChange(cur, prev), ym: months[months.length - 1].key };
};

export const summarize = (notes: Note[]): Totals => totalsOf(notes);

/** 分布统计（体裁 / 品类 / 账号占比） */
export const distribution = (
  notes: Note[],
  dimension: 'genre' | 'category' | 'account',
  metricKey: string
): { name: string; value: number }[] => {
  const metric = getMetric(metricKey);
  const dimOf = (n: Note) =>
    dimension === 'account' ? n.account : dimension === 'category' ? n.category : n.genre;
  return groupBy(notes, dimOf)
    .map((g) => ({ name: g.key, value: metric.calc(g.totals) ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
};
