import type { MetricUnit } from '@/types';
import { fmtAxis, fmtByUnit } from './format';

export interface SvgSeries {
  name: string;
  color: string;
  values: (number | null)[];
}

/**
 * 生成自包含的 SVG 折线图字符串（用于离线 HTML 报告，不依赖任何图表库）
 */
export function svgLineChart(opts: {
  labels: string[];
  series: SvgSeries[];
  unit: MetricUnit;
  width?: number;
  height?: number;
  bars?: boolean;
}): string {
  const { labels, series, unit, width = 880, height = 340, bars = false } = opts;
  if (!labels.length || !series.length) return '<p class="empty">暂无数据</p>';

  const padL = 68;
  const padR = 24;
  const padT = series.length > 1 ? 40 : 20;
  const padB = 48;
  const W = width - padL - padR;
  const H = height - padT - padB;

  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
  if (!all.length) return '<p class="empty">暂无数据</p>';

  let min = Math.min(...all);
  let max = Math.max(...all);
  if (unit === 'count' || min > 0) min = Math.min(0, min);
  if (max === min) max = min + (Math.abs(min) || 1);
  const span = max - min;
  min -= span * 0.06;
  max += span * 0.12;

  const n = labels.length;
  const x = (i: number) => padL + (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => padT + H - ((v - min) / (max - min)) * H;

  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 ${width} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="'PingFang SC','Microsoft YaHei',sans-serif">`
  );

  // 网格 + Y 轴刻度
  for (let g = 0; g <= 4; g += 1) {
    const v = min + ((max - min) * g) / 4;
    const yy = y(v);
    parts.push(
      `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${padL + W}" y2="${yy.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4"/>`,
      `<text x="${padL - 8}" y="${(yy + 4).toFixed(1)}" font-size="11" fill="#94a3b8" text-anchor="end">${fmtAxis(v, unit)}</text>`
    );
  }

  // X 轴标签
  const stepLabel = Math.ceil(n / 14);
  labels.forEach((l, i) => {
    if (i % stepLabel !== 0 && i !== n - 1) return;
    parts.push(
      `<text x="${x(i).toFixed(1)}" y="${padT + H + 20}" font-size="11" fill="#94a3b8" text-anchor="middle">${escapeXml(l)}</text>`
    );
  });
  parts.push(
    `<line x1="${padL}" y1="${padT + H}" x2="${padL + W}" y2="${padT + H}" stroke="#cbd5e1" stroke-width="1"/>`
  );

  // 数据
  const barW = bars ? Math.max(4, Math.min(30, (W / Math.max(n, 1) / series.length) * 0.62)) : 0;
  series.forEach((s, si) => {
    if (bars) {
      s.values.forEach((v, i) => {
        if (v === null) return;
        const cx = x(i) - ((series.length - 1) * barW) / 2 + si * barW;
        const top = y(v);
        const h = padT + H - top;
        parts.push(
          `<rect x="${(cx - barW / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${s.color}" fill-opacity="0.85"/>`
        );
      });
    } else {
      const segs: string[] = [];
      let started = false;
      s.values.forEach((v, i) => {
        if (v === null) return;
        segs.push(`${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
        started = true;
      });
      if (segs.length) {
        parts.push(
          `<path d="${segs.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`
        );
      }
      s.values.forEach((v, i) => {
        if (v === null) return;
        parts.push(`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2" fill="${s.color}"/>`);
      });
    }

    // 数值标签（点数不多时才画，避免拥挤）
    if (n <= 13) {
      s.values.forEach((v, i) => {
        if (v === null) return;
        parts.push(
          `<text x="${x(i).toFixed(1)}" y="${(y(v) - 9).toFixed(1)}" font-size="10.5" fill="${s.color}" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="3">${escapeXml(fmtByUnit(v, unit, true))}</text>`
        );
      });
    }
  });

  // 图例
  if (series.length > 1) {
    let lx = padL;
    series.forEach((s) => {
      parts.push(
        `<circle cx="${lx + 4}" cy="16" r="4" fill="${s.color}"/>`,
        `<text x="${lx + 13}" y="20" font-size="11.5" fill="#334155">${escapeXml(s.name)}</text>`
      );
      lx += 22 + s.name.length * 12;
    });
  }

  parts.push('</svg>');
  return parts.join('');
}

export function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
