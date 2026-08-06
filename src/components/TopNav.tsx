import clsx from 'clsx';
import {
  BarChart3,
  Download,
  FolderTree,
  LayoutDashboard,
  Table2,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { TabKey } from '@/types';
import { useStore } from '@/store/useStore';

export const TABS: { key: TabKey; label: string; icon: typeof BarChart3; desc: string }[] = [
  { key: 'overview', label: '数据总览', icon: LayoutDashboard, desc: 'KPI · 趋势 · 分布' },
  { key: 'metric', label: '指标分析', icon: TrendingUp, desc: '自选指标趋势与对比' },
  { key: 'account', label: '账号对比', icon: Users, desc: '多账号趋势与环比' },
  { key: 'category', label: '品类分析', icon: FolderTree, desc: '排行 · 趋势 · 交叉' },
  { key: 'detail', label: '数据明细', icon: Table2, desc: '逐篇笔记明细表' },
  { key: 'export', label: '报告导出', icon: Download, desc: 'Excel / HTML / CSV' },
];

export function TopNav() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const notes = useStore((s) => s.notes);
  const isDemo = useStore((s) => s.isDemo);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-ink-200/70 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base shadow-sm">
            📊
          </span>
          <div className="leading-tight">
            <h1 className="text-[15px] font-bold tracking-tight text-ink-900">小红书数据分析看板</h1>
            <p className="text-[11px] text-ink-400">
              {notes.length ? `已载入 ${notes.length} 篇笔记` : '多账号 · 多维度 · 可视化'}
              {isDemo && <span className="ml-1.5 text-amber-600">· 演示数据</span>}
            </p>
          </div>
        </div>

        <nav className="order-3 -mx-1 w-full overflow-x-auto pb-0.5 lg:order-2 lg:mx-0 lg:w-auto lg:flex-1 lg:overflow-visible">
          <ul className="flex items-center gap-1 px-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <li key={t.key}>
                  <button
                    onClick={() => setTab(t.key)}
                    title={t.desc}
                    className={clsx(
                      'group relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-medium transition',
                      active
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                    {active && (
                      <span className="absolute inset-x-3 -bottom-[9px] hidden h-0.5 rounded-full bg-brand-600 lg:block" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
