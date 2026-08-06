import { BarChart3, Download, FolderTree, Shield, TrendingUp, Users } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { TopNav } from '@/components/TopNav';
import { FilterBar } from '@/components/FilterBar';
import { DropZone } from '@/components/DataSource';
import { Toasts } from '@/components/ui/Feedback';
import { OverviewView } from '@/views/OverviewView';
import { MetricView } from '@/views/MetricView';
import { AccountView } from '@/views/AccountView';
import { CategoryView } from '@/views/CategoryView';
import { DetailView } from '@/views/DetailView';
import { ExportView } from '@/views/ExportView';

const FEATURES = [
  { icon: BarChart3, title: '数据总览', desc: 'KPI 卡 · 趋势图 · 分布图，支持总量 / 篇均 / 月均三种口径' },
  { icon: TrendingUp, title: '指标分析', desc: '19 项指标自由选择，可按账号 / 品类 / 体裁拆分对比' },
  { icon: Users, title: '账号对比', desc: '多账号趋势叠加、六宫格总览、月度环比透视表' },
  { icon: FolderTree, title: '品类分析', desc: '排行榜 · 品类趋势 · 四象限气泡图 · 品类×体裁热力表' },
  { icon: Download, title: '报告导出', desc: '多 Sheet Excel、自包含 HTML 报告、CSV、PDF 打印' },
  { icon: Shield, title: '纯本地计算', desc: '解析与计算全部在浏览器完成，数据不上传任何服务器' },
];

function Welcome() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
      <div className="text-center">
        <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-3xl shadow-lg">
          📊
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          小红书数据分析看板
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-500">
          上传小红书后台导出的 Excel，自动完成清洗、指标计算与多维可视化。
          支持多账号横向对比、品类洞察与一键导出分析报告。
        </p>
      </div>

      <div className="mt-8">
        <DropZone />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="card card-pad animate-fade-up">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-900">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{f.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="card card-pad mt-8">
        <p className="text-sm font-semibold text-ink-900">📋 表格字段说明</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-500">
          系统会自动识别常见的列名别名（如 曝光量/曝光、阅读量/播放量/观看量、获赞/点赞数、发布形式/体裁 等），
          表头默认在第 2 行（也会自动探测第 1、3 行）。
          <br />
          <b className="text-ink-700">必需列</b>：首次发布时间、曝光 或 观看量。
          <br />
          <b className="text-ink-700">推荐列</b>：笔记标题、封面点击率、点赞、评论、收藏、涨粉、分享、体裁、品类。
          缺失的列会自动按 0 / 未分类处理，并在解析后给出提示。
        </p>
      </div>
    </div>
  );
}

const VIEWS = {
  overview: OverviewView,
  metric: MetricView,
  account: AccountView,
  category: CategoryView,
  detail: DetailView,
  export: ExportView,
} as const;

export default function App() {
  const notes = useStore((s) => s.notes);
  const tab = useStore((s) => s.tab);
  const View = VIEWS[tab];

  if (!notes.length) {
    return (
      <>
        <Welcome />
        <Toasts />
      </>
    );
  }

  return (
    <div className="min-h-full">
      <TopNav />
      <FilterBar />
      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <View />
      </main>
      <footer className="no-print border-t border-ink-200/70 py-6 text-center text-xs text-ink-400">
        小红书数据分析看板 · 全部计算在浏览器本地完成，数据不会上传服务器
      </footer>
      <Toasts />
    </div>
  );
}
