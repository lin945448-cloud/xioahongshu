import * as XLSX from 'xlsx';
import type { MetricUnit, Note } from '@/types';
import { DETAIL_METRIC_KEYS, getMetric, noteMetric, pctChange, totalsOf } from './metrics';
import { accountMonthly, groupBy, monthlyTotals, monthsOf, uniqSorted } from './aggregate';
import { fmtByUnit, fmtDate, fmtDateTime, colorAt } from './format';
import { escapeXml, svgLineChart } from './svgChart';

/* ------------------------------------------------------------------ */
/* 通用下载                                                             */
/* ------------------------------------------------------------------ */
export function downloadBlob(data: BlobPart, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const numFmt = (unit: MetricUnit): string =>
  unit === 'percent' ? '0.00%' : unit === 'ratio' ? '0.00' : '#,##0';

interface Col<T> {
  header: string;
  get: (row: T) => number | string | null;
  z?: string;
  w?: number;
}

function makeSheet<T>(rows: T[], cols: Col<T>[]): XLSX.WorkSheet {
  const aoa: (string | number | null)[][] = [
    cols.map((c) => c.header),
    ...rows.map((r) => cols.map((c) => c.get(r))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws['!ref'] as string);
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const z = cols[c]?.z;
    if (!z) continue;
    for (let r = 1; r <= range.e.r; r += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'number') cell.z = z;
    }
  }
  ws['!cols'] = cols.map((c) => ({ wch: c.w ?? Math.max(10, c.header.length * 2 + 2) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  return ws;
}

/* ------------------------------------------------------------------ */
/* Excel 导出                                                           */
/* ------------------------------------------------------------------ */
export interface ExcelOptions {
  detail: boolean;
  perAccount: boolean;
  monthly: boolean;
  category: boolean;
}

export function exportExcel(notes: Note[], options: ExcelOptions, filename = '小红书分析汇总报告.xlsx') {
  const wb = XLSX.utils.book_new();

  const detailCols: Col<Note>[] = [
    { header: '账号名', get: (n) => n.account, w: 18 },
    { header: '数据归属月份', get: (n) => n.reportingMonth ?? n.ym, w: 16 },
    { header: '年月', get: (n) => n.ym, w: 10 },
    { header: '月份', get: (n) => n.month, w: 7 },
    { header: '序号', get: (n) => n.seq, w: 7 },
    { header: '笔记标题', get: (n) => n.title, w: 42 },
    { header: '首次发布时间', get: (n) => fmtDateTime(n.publishAt), w: 18 },
    { header: '体裁', get: (n) => n.genre, w: 9 },
    { header: '品类', get: (n) => n.category, w: 12 },
    ...DETAIL_METRIC_KEYS.map((k) => {
      const m = getMetric(k);
      return {
        header: m.label,
        get: (n: Note) => noteMetric(n, k),
        z: numFmt(m.unit),
        w: 12,
      };
    }),
  ];

  if (options.detail) {
    XLSX.utils.book_append_sheet(wb, makeSheet(notes, detailCols), '所有数据明细汇总');
  }

  if (options.perAccount) {
    const used = new Set<string>();
    for (const g of groupBy(notes, (n) => n.account)) {
      let name = g.key.replace(/[\\/*?:[\]]/g, '').slice(0, 28) || 'Sheet';
      let i = 1;
      while (used.has(name)) name = `${name.slice(0, 26)}_${i++}`;
      used.add(name);
      XLSX.utils.book_append_sheet(wb, makeSheet(g.notes, detailCols), name);
    }
  }

  if (options.monthly) {
    const rows = accountMonthly(notes);
    const withMom = rows.map((r, i) => {
      const prev = i > 0 && rows[i - 1].account === r.account ? rows[i - 1] : null;
      const val = (k: string) => getMetric(k).calc(r.totals);
      const prevVal = (k: string) => (prev ? getMetric(k).calc(prev.totals) : null);
      return {
        ...r,
        momFollowers: pctChange(val('followers'), prevVal('followers')),
        momEngage: pctChange(val('engageRate'), prevVal('engageRate')),
        momCtr: pctChange(val('ctr'), prevVal('ctr')),
      };
    });

    const momFmt = '+0.0%;-0.0%;0.0%';
    XLSX.utils.book_append_sheet(
      wb,
      makeSheet(withMom, [
        { header: '账号名', get: (r) => r.account, w: 18 },
        { header: '年月', get: (r) => r.ym, w: 10 },
        { header: '笔记数', get: (r) => r.totals.notes, z: '#,##0', w: 9 },
        { header: '曝光', get: (r) => r.totals.impressions, z: '#,##0', w: 13 },
        { header: '观看量', get: (r) => r.totals.views, z: '#,##0', w: 13 },
        { header: '点赞', get: (r) => r.totals.likes, z: '#,##0', w: 11 },
        { header: '收藏', get: (r) => r.totals.collects, z: '#,##0', w: 11 },
        { header: '评论', get: (r) => r.totals.comments, z: '#,##0', w: 11 },
        { header: '涨粉', get: (r) => r.totals.followers, z: '#,##0', w: 11 },
        { header: '阅读率', get: (r) => getMetric('readRate').calc(r.totals), z: '0.00%', w: 11 },
        { header: '封面点击率', get: (r) => getMetric('ctr').calc(r.totals), z: '0.00%', w: 12 },
        { header: '点赞率', get: (r) => getMetric('likeRate').calc(r.totals), z: '0.00%', w: 11 },
        { header: '收藏率', get: (r) => getMetric('collectRate').calc(r.totals), z: '0.00%', w: 11 },
        { header: '互动率', get: (r) => getMetric('engageRate').calc(r.totals), z: '0.00%', w: 11 },
        { header: '转粉率', get: (r) => getMetric('followRate').calc(r.totals), z: '0.00%', w: 11 },
        { header: '涨粉环比', get: (r) => r.momFollowers, z: momFmt, w: 12 },
        { header: '互动率环比', get: (r) => r.momEngage, z: momFmt, w: 12 },
        { header: '点击率环比', get: (r) => r.momCtr, z: momFmt, w: 12 },
      ]),
      '月度统计(含环比)'
    );
  }

  if (options.category) {
    const rows = groupBy(notes, (n) => n.category);
    XLSX.utils.book_append_sheet(
      wb,
      makeSheet(rows, [
        { header: '品类', get: (g) => g.key, w: 16 },
        { header: '笔记数', get: (g) => g.totals.notes, z: '#,##0', w: 9 },
        { header: '曝光', get: (g) => g.totals.impressions, z: '#,##0', w: 13 },
        { header: '观看量', get: (g) => g.totals.views, z: '#,##0', w: 13 },
        { header: '阅读率', get: (g) => getMetric('readRate').calc(g.totals), z: '0.00%', w: 11 },
        { header: '封面点击率', get: (g) => getMetric('ctr').calc(g.totals), z: '0.00%', w: 12 },
        { header: '互动率', get: (g) => getMetric('engageRate').calc(g.totals), z: '0.00%', w: 11 },
        { header: '转粉率', get: (g) => getMetric('followRate').calc(g.totals), z: '0.00%', w: 11 },
        { header: '涨粉', get: (g) => g.totals.followers, z: '#,##0', w: 11 },
      ]),
      '品类汇总'
    );
  }

  if (!wb.SheetNames.length) throw new Error('请至少勾选一项导出内容');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(out, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* ------------------------------------------------------------------ */
/* CSV 导出                                                             */
/* ------------------------------------------------------------------ */
export function exportCsv(notes: Note[], filename = '小红书数据明细.csv') {
  const headers = [
    '账号名',
    '年月',
    '序号',
    '笔记标题',
    '首次发布时间',
    '体裁',
    '品类',
    ...DETAIL_METRIC_KEYS.map((k) => getMetric(k).label),
  ];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(',')];
  for (const n of notes) {
    lines.push(
      [
        n.account,
        n.ym,
        n.seq,
        n.title,
        fmtDateTime(n.publishAt),
        n.genre,
        n.category,
        ...DETAIL_METRIC_KEYS.map((k) => {
          const v = noteMetric(n, k);
          return v === null ? '' : v;
        }),
      ]
        .map(esc)
        .join(',')
    );
  }
  // BOM 保证 Excel 打开不乱码
  downloadBlob('\uFEFF' + lines.join('\r\n'), filename, 'text/csv;charset=utf-8');
}

/* ------------------------------------------------------------------ */
/* HTML 可视化报告（自包含，可离线打开 / 打印为 PDF）                     */
/* ------------------------------------------------------------------ */
const KPI_KEYS = ['impressions', 'views', 'readRate', 'ctr', 'engageRate', 'followers', 'followRate', 'notes'];

function tableHtml(headers: string[], rows: string[][]): string {
  return `<table><thead><tr>${headers
    .map((h) => `<th>${escapeXml(h)}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? 'left' : ''}">${escapeXml(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

export function buildHtmlReport(notes: Note[], title = '小红书数据分析报告'): string {
  const months = monthlyTotals(notes);
  const labels = months.map((m) => m.key);
  const totals = totalsOf(notes);
  const accounts = uniqSorted(notes.map((n) => n.account));
  const categories = uniqSorted(notes.map((n) => n.category));
  const hasCat = !(categories.length === 1 && categories[0] === '未分类');

  const kpiHtml = KPI_KEYS.map((k) => {
    const m = getMetric(k);
    return `<div class="kpi"><span class="dot" style="background:${m.color}"></span>
      <p class="kpi-label">${m.label}</p>
      <p class="kpi-value">${escapeXml(fmtByUnit(m.calc(totals), m.unit, true))}</p></div>`;
  }).join('');

  const chart = (keys: string[], bars = false) =>
    svgLineChart({
      labels,
      unit: getMetric(keys[0]).unit,
      bars,
      series: keys.map((k) => {
        const m = getMetric(k);
        return { name: m.label, color: m.color, values: months.map((mo) => m.calc(mo.totals)) };
      }),
    });

  const accountChart = (key: string) => {
    const m = getMetric(key);
    const byAcc = accountMonthly(notes);
    return svgLineChart({
      labels,
      unit: m.unit,
      series: accounts.map((a, i) => ({
        name: a,
        color: colorAt(i),
        values: labels.map((ym) => {
          const hit = byAcc.find((r) => r.account === a && r.ym === ym);
          return hit ? m.calc(hit.totals) : null;
        }),
      })),
    });
  };

  const monthTable = tableHtml(
    ['月份', '笔记数', '曝光', '观看量', '阅读率', '封面点击率', '互动率', '涨粉', '转粉率'],
    months.map((mo) => [
      mo.key,
      String(mo.totals.notes),
      fmtByUnit(mo.totals.impressions, 'count', true),
      fmtByUnit(mo.totals.views, 'count', true),
      fmtByUnit(getMetric('readRate').calc(mo.totals), 'percent'),
      fmtByUnit(getMetric('ctr').calc(mo.totals), 'percent'),
      fmtByUnit(getMetric('engageRate').calc(mo.totals), 'percent'),
      fmtByUnit(mo.totals.followers, 'count', true),
      fmtByUnit(getMetric('followRate').calc(mo.totals), 'percent'),
    ])
  );

  const accountTable = tableHtml(
    ['账号', '笔记数', '曝光', '观看量', '阅读率', '封面点击率', '互动率', '涨粉', '转粉率'],
    groupBy(notes, (n) => n.account)
      .sort((a, b) => b.totals.views - a.totals.views)
      .map((g) => [
        g.key,
        String(g.totals.notes),
        fmtByUnit(g.totals.impressions, 'count', true),
        fmtByUnit(g.totals.views, 'count', true),
        fmtByUnit(getMetric('readRate').calc(g.totals), 'percent'),
        fmtByUnit(getMetric('ctr').calc(g.totals), 'percent'),
        fmtByUnit(getMetric('engageRate').calc(g.totals), 'percent'),
        fmtByUnit(g.totals.followers, 'count', true),
        fmtByUnit(getMetric('followRate').calc(g.totals), 'percent'),
      ])
  );

  const catTable = hasCat
    ? tableHtml(
        ['品类', '笔记数', '曝光', '观看量', '封面点击率', '互动率', '转粉率'],
        groupBy(notes, (n) => n.category)
          .sort((a, b) => b.totals.views - a.totals.views)
          .map((g) => [
            g.key,
            String(g.totals.notes),
            fmtByUnit(g.totals.impressions, 'count', true),
            fmtByUnit(g.totals.views, 'count', true),
            fmtByUnit(getMetric('ctr').calc(g.totals), 'percent'),
            fmtByUnit(getMetric('engageRate').calc(g.totals), 'percent'),
            fmtByUnit(getMetric('followRate').calc(g.totals), 'percent'),
          ])
      )
    : '';

  const range = notes.length
    ? `${fmtDate(notes[0].publishAt)} ~ ${fmtDate(notes[notes.length - 1].publishAt)}`
    : '--';

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeXml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:32px 20px 60px;background:#f8fafc;color:#0f172a;
       font-family:'PingFang SC','Microsoft YaHei','Source Han Sans SC',system-ui,sans-serif;line-height:1.6}
  .wrap{max-width:960px;margin:0 auto}
  h1{font-size:26px;margin:0 0 6px}
  .meta{color:#64748b;font-size:13px;margin-bottom:24px}
  .meta b{color:#0f172a}
  h2{font-size:18px;margin:36px 0 14px;padding-bottom:8px;border-bottom:2px solid #e11d48}
  h3{font-size:14px;color:#475569;margin:22px 0 8px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:16px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:8px}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px}
  .kpi .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
  .kpi-label{margin:0;font-size:12px;color:#64748b;display:inline}
  .kpi-value{margin:6px 0 0;font-size:21px;font-weight:700;letter-spacing:-.02em}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#f1f5f9;color:#475569;font-weight:600;text-align:right;padding:8px 10px;white-space:nowrap}
  th:first-child{text-align:left}
  td{padding:7px 10px;text-align:right;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums;white-space:nowrap}
  td.left{text-align:left;font-weight:500}
  tr:last-child td{border-bottom:none}
  .empty{color:#94a3b8;font-size:13px;text-align:center;padding:24px}
  footer{margin-top:40px;text-align:center;color:#94a3b8;font-size:12px}
  @media print{body{background:#fff;padding:0}.card{break-inside:avoid}}
  @media (max-width:640px){.kpis{grid-template-columns:repeat(2,1fr)}}
</style></head>
<body><div class="wrap">
  <h1>📊 ${escapeXml(title)}</h1>
  <p class="meta">生成时间：<b>${fmtDateTime(Date.now())}</b> ｜ 数据范围：<b>${range}</b> ｜
     覆盖 <b>${accounts.length}</b> 个账号 · <b>${months.length}</b> 个月 · <b>${notes.length}</b> 篇笔记</p>

  <h2>一、核心指标总览</h2>
  <div class="kpis">${kpiHtml}</div>

  <h2>二、流量趋势</h2>
  <div class="card"><h3>曝光 vs 观看量（月度）</h3>${chart(['impressions', 'views'], true)}</div>
  <div class="card"><h3>阅读率 / 封面点击率（月度）</h3>${chart(['readRate', 'ctr'])}</div>

  <h2>三、互动与转化趋势</h2>
  <div class="card"><h3>互动率 / 点赞率 / 收藏率（月度）</h3>${chart(['engageRate', 'likeRate', 'collectRate'])}</div>
  <div class="card"><h3>涨粉数（月度）</h3>${chart(['followers'], true)}</div>

  ${
    accounts.length > 1
      ? `<h2>四、账号横向对比</h2>
  <div class="card"><h3>各账号互动率走势</h3>${accountChart('engageRate')}</div>
  <div class="card"><h3>各账号涨粉走势</h3>${accountChart('followers')}</div>
  <div class="card"><h3>账号综合表现</h3>${accountTable}</div>`
      : `<h2>四、账号表现</h2><div class="card">${accountTable}</div>`
  }

  <h2>五、月度明细</h2>
  <div class="card">${monthTable}</div>

  ${catTable ? `<h2>六、品类表现</h2><div class="card">${catTable}</div>` : ''}

  <footer>由「小红书数据分析看板」生成 · 所有计算均在本地浏览器完成</footer>
</div></body></html>`;
}

export function exportHtmlReport(notes: Note[], filename = '小红书数据分析报告.html') {
  downloadBlob(buildHtmlReport(notes), filename, 'text/html;charset=utf-8');
}

export function previewHtmlReport(notes: Note[]) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(buildHtmlReport(notes));
  w.document.close();
  return true;
}

/** 导出摘要，用于界面提示 */
export function exportSummary(notes: Note[]) {
  return {
    notes: notes.length,
    accounts: uniqSorted(notes.map((n) => n.account)).length,
    months: monthsOf(notes).length,
    range: notes.length
      ? `${fmtDate(notes[0].publishAt)} ~ ${fmtDate(notes[notes.length - 1].publishAt)}`
      : '--',
  };
}
