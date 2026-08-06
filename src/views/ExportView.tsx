import { useState } from 'react';
import { Check, Download, ExternalLink, FileSpreadsheet, FileText, Printer, Table } from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Feedback';
import { useFilteredNotes } from '@/hooks/useFiltered';
import { useStore } from '@/store/useStore';
import {
  exportCsv,
  exportExcel,
  exportHtmlReport,
  exportSummary,
  previewHtmlReport,
  type ExcelOptions,
} from '@/lib/exporters';

const SHEET_OPTIONS: { key: keyof ExcelOptions; label: string; desc: string }[] = [
  { key: 'detail', label: '所有数据明细汇总', desc: '全部笔记逐条明细 + 衍生指标' },
  { key: 'perAccount', label: '按账号分表', desc: '每个账号单独一个 Sheet' },
  { key: 'monthly', label: '月度统计（含环比）', desc: '账号 × 月份聚合，附涨粉/互动率/点击率环比' },
  { key: 'category', label: '品类汇总', desc: '按品类聚合的核心指标' },
];

export function ExportView() {
  const notes = useFilteredNotes();
  const pushToast = useStore((s) => s.pushToast);
  const [opts, setOpts] = useState<ExcelOptions>({
    detail: true,
    perAccount: true,
    monthly: true,
    category: true,
  });
  const [reportTitle, setReportTitle] = useState('小红书数据分析报告');

  const s = exportSummary(notes);

  if (!notes.length) return <Empty title="当前筛选条件下没有数据" desc="请放宽全局筛选条件后再导出" />;

  const run = (fn: () => void, okMsg: string) => {
    try {
      fn();
      pushToast('success', okMsg);
    } catch (e) {
      pushToast('error', (e as Error).message || '导出失败');
    }
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        icon={<Download className="h-4 w-4" />}
        title="报告导出"
        desc="导出内容始终跟随顶部的全局筛选条件，先筛选再导出即可得到定制化报告"
      />

      {/* 导出范围 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: '笔记数', value: s.notes },
          { label: '账号数', value: s.accounts },
          { label: '覆盖月份', value: s.months },
          { label: '时间范围', value: s.range },
        ].map((x) => (
          <div key={x.label} className="card card-pad animate-fade-up">
            <p className="text-[11px] text-ink-500">{x.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink-900">{x.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Excel */}
        <Card
          title="导出汇总 Excel"
          subtitle="多 Sheet 工作簿，数字已带千分位、百分比、环比正负号格式"
        >
          <div className="space-y-2">
            {SHEET_OPTIONS.map((o) => {
              const active = opts[o.key];
              return (
                <button
                  key={o.key}
                  onClick={() => setOpts((p) => ({ ...p, [o.key]: !p[o.key] }))}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                    active ? 'border-brand-300 bg-brand-50/50' : 'border-ink-200 hover:border-ink-400'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
                      active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300'
                    }`}
                  >
                    {active && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-900">{o.label}</span>
                    <span className="block text-xs text-ink-500">{o.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            className="btn btn-primary mt-4 w-full"
            onClick={() => run(() => exportExcel(notes, opts), 'Excel 已开始下载')}
          >
            <FileSpreadsheet className="h-4 w-4" />
            下载汇总 Excel（.xlsx）
          </button>
        </Card>

        {/* HTML 报告 */}
        <Card
          title="生成可视化 HTML 报告"
          subtitle="单文件、自包含（含 SVG 图表），可离线打开、可直接打印为 PDF"
        >
          <label className="label">报告标题</label>
          <input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            className="input"
            placeholder="小红书数据分析报告"
          />

          <ul className="mt-4 space-y-1.5 text-xs text-ink-500">
            {[
              '核心指标总览（8 项 KPI）',
              '曝光 / 观看量、阅读率 / 封面点击率 月度趋势',
              '互动率 / 点赞率 / 收藏率、涨粉月度趋势',
              '多账号横向对比图与综合表现表',
              '月度明细表 + 品类表现表',
            ].map((t) => (
              <li key={t} className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className="btn btn-primary"
              onClick={() =>
                run(
                  () => exportHtmlReport(notes, `${reportTitle || '小红书数据分析报告'}.html`),
                  'HTML 报告已开始下载'
                )
              }
            >
              <FileText className="h-4 w-4" />
              下载报告
            </button>
            <button
              className="btn"
              onClick={() => {
                const ok = previewHtmlReport(notes);
                pushToast(ok ? 'info' : 'error', ok ? '已在新标签页打开预览' : '浏览器拦截了弹窗，请允许后重试');
              }}
            >
              <ExternalLink className="h-4 w-4" />
              新窗口预览
            </button>
          </div>
        </Card>
      </div>

      {/* 其他导出 */}
      <Card title="其他导出方式" subtitle="轻量场景可直接用 CSV，或把当前页面打印为 PDF">
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => run(() => exportCsv(notes), 'CSV 已开始下载')}>
            <Table className="h-4 w-4" />
            导出明细 CSV（UTF-8 BOM，Excel 不乱码）
          </button>
          <button className="btn" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            打印 / 另存为 PDF
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-400">
          提示：所有导出均在浏览器本地生成，文件不会经过任何服务器。若需要固定的月报模板，
          建议先在顶部筛选出目标账号与月份区间，再点击「下载报告」。
        </p>
      </Card>
    </div>
  );
}
