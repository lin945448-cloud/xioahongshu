import type { MetricDef, Note, Totals } from '@/types';

/** 安全除法：分母为 0 / 非法时返回 null（对齐 Python 中 replace(0, nan)） */
export const div = (a: number, b: number): number | null =>
  b === 0 || !Number.isFinite(a) || !Number.isFinite(b) ? null : a / b;

export const emptyTotals = (): Totals => ({
  notes: 0,
  impressions: 0,
  views: 0,
  clicks: 0,
  likes: 0,
  comments: 0,
  collects: 0,
  followers: 0,
  shares: 0,
});

export const addNote = (t: Totals, n: Note): Totals => {
  t.notes += 1;
  t.impressions += n.impressions;
  t.views += n.views;
  t.clicks += n.ctr * n.impressions;
  t.likes += n.likes;
  t.comments += n.comments;
  t.collects += n.collects;
  t.followers += n.followers;
  t.shares += n.shares;
  return t;
};

export const totalsOf = (notes: Note[]): Totals => {
  const t = emptyTotals();
  for (const n of notes) addNote(t, n);
  return t;
};

/** 单篇笔记转成 Totals，使指标计算逻辑在「单篇」与「聚合」间完全一致 */
export const noteTotals = (n: Note): Totals => addNote(emptyTotals(), n);

/* ------------------------------------------------------------------ */
/* 指标注册表：所有图表 / KPI / 表格 / 导出都从这里取，保证口径唯一        */
/* ------------------------------------------------------------------ */

export const METRICS: MetricDef[] = [
  // —— 流量规模 ——
  {
    key: 'impressions',
    label: '曝光',
    unit: 'count',
    group: '流量规模',
    color: '#6366f1',
    desc: '笔记被推荐展示的次数总和',
    calc: (t) => t.impressions,
    higherIsBetter: true,
  },
  {
    key: 'views',
    label: '观看量',
    unit: 'count',
    group: '流量规模',
    color: '#2563eb',
    desc: '笔记被实际点开阅读 / 播放的次数',
    calc: (t) => t.views,
    higherIsBetter: true,
  },
  {
    key: 'notes',
    label: '笔记数',
    unit: 'count',
    group: '流量规模',
    color: '#0891b2',
    desc: '发布的笔记篇数',
    calc: (t) => t.notes,
    higherIsBetter: true,
  },
  {
    key: 'avgImpressions',
    label: '篇均曝光',
    unit: 'count',
    group: '流量规模',
    color: '#818cf8',
    desc: '曝光总量 ÷ 笔记数',
    calc: (t) => div(t.impressions, t.notes),
    higherIsBetter: true,
  },
  {
    key: 'avgViews',
    label: '篇均观看',
    unit: 'count',
    group: '流量规模',
    color: '#60a5fa',
    desc: '观看量总和 ÷ 笔记数',
    calc: (t) => div(t.views, t.notes),
    higherIsBetter: true,
  },

  // —— 转化效率 ——
  {
    key: 'readRate',
    label: '阅读率',
    unit: 'percent',
    group: '转化效率',
    color: '#0ea5e9',
    desc: '观看量 ÷ 曝光，衡量从推荐到点开的整体转化',
    calc: (t) => div(t.views, t.impressions),
    higherIsBetter: true,
  },
  {
    key: 'ctr',
    label: '封面点击率',
    unit: 'percent',
    group: '转化效率',
    color: '#f59e0b',
    desc: '估算点击数 ÷ 曝光（按曝光加权），衡量封面与标题吸引力',
    calc: (t) => div(t.clicks, t.impressions),
    higherIsBetter: true,
  },
  {
    key: 'followRate',
    label: '转粉率',
    unit: 'percent',
    group: '转化效率',
    color: '#e11d48',
    desc: '涨粉 ÷ 观看量，衡量内容把读者转化为粉丝的能力',
    calc: (t) => div(t.followers, t.views),
    higherIsBetter: true,
  },
  {
    key: 'followers',
    label: '涨粉数',
    unit: 'count',
    group: '转化效率',
    color: '#be123c',
    desc: '净新增粉丝数',
    calc: (t) => t.followers,
    higherIsBetter: true,
  },
  {
    key: 'avgFollowers',
    label: '篇均涨粉',
    unit: 'ratio',
    group: '转化效率',
    color: '#fb7185',
    desc: '涨粉总数 ÷ 笔记数',
    calc: (t) => div(t.followers, t.notes),
    higherIsBetter: true,
  },

  // —— 互动质量 ——
  {
    key: 'engageRate',
    label: '互动率',
    unit: 'percent',
    group: '互动质量',
    color: '#059669',
    desc: '(点赞 + 评论 + 收藏) ÷ 观看量',
    calc: (t) => div(t.likes + t.comments + t.collects, t.views),
    higherIsBetter: true,
  },
  {
    key: 'likeRate',
    label: '点赞率',
    unit: 'percent',
    group: '互动质量',
    color: '#16a34a',
    desc: '点赞 ÷ 观看量',
    calc: (t) => div(t.likes, t.views),
    higherIsBetter: true,
  },
  {
    key: 'collectRate',
    label: '收藏率',
    unit: 'percent',
    group: '互动质量',
    color: '#7c3aed',
    desc: '收藏 ÷ 观看量，高收藏通常代表工具型 / 干货价值',
    calc: (t) => div(t.collects, t.views),
    higherIsBetter: true,
  },
  {
    key: 'commentRate',
    label: '评论率',
    unit: 'percent',
    group: '互动质量',
    color: '#db2777',
    desc: '评论 ÷ 观看量',
    calc: (t) => div(t.comments, t.views),
    higherIsBetter: true,
  },
  {
    key: 'likeCollectRatio',
    label: '赞藏比',
    unit: 'ratio',
    group: '互动质量',
    color: '#65a30d',
    desc: '点赞 ÷ 收藏，越低说明内容越偏「值得收藏」',
    calc: (t) => div(t.likes, t.collects),
  },
  {
    key: 'activeQuality',
    label: '有效活跃度',
    unit: 'ratio',
    group: '互动质量',
    color: '#0d9488',
    desc: '评论 ÷ (点赞 + 收藏)，越高说明内容越能激发讨论',
    calc: (t) => div(t.comments, t.likes + t.collects),
    higherIsBetter: true,
  },
  {
    key: 'likes',
    label: '点赞数',
    unit: 'count',
    group: '互动质量',
    color: '#f43f5e',
    desc: '点赞总数',
    calc: (t) => t.likes,
    higherIsBetter: true,
  },
  {
    key: 'collects',
    label: '收藏数',
    unit: 'count',
    group: '互动质量',
    color: '#a855f7',
    desc: '收藏总数',
    calc: (t) => t.collects,
    higherIsBetter: true,
  },
  {
    key: 'comments',
    label: '评论数',
    unit: 'count',
    group: '互动质量',
    color: '#ec4899',
    desc: '评论总数',
    calc: (t) => t.comments,
    higherIsBetter: true,
  },
  {
    key: 'shares',
    label: '分享数',
    unit: 'count',
    group: '互动质量',
    color: '#14b8a6',
    desc: '分享总数',
    calc: (t) => t.shares,
    higherIsBetter: true,
  },
];

export const METRIC_MAP: Record<string, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.key, m])
);

export const getMetric = (key: string): MetricDef => METRIC_MAP[key] ?? METRICS[0];

export const METRIC_GROUPS = ['流量规模', '转化效率', '互动质量'] as const;

export const metricsByGroup = (group: string): MetricDef[] =>
  METRICS.filter((m) => m.group === group);

/** 默认在 KPI 卡展示的指标 */
export const DEFAULT_KPI_KEYS = [
  'impressions',
  'views',
  'readRate',
  'ctr',
  'engageRate',
  'followers',
  'followRate',
  'notes',
];

/** 明细表默认列（对齐原 Streamlit 版本的展示列） */
export const DETAIL_METRIC_KEYS = [
  'impressions',
  'views',
  'ctr',
  'likes',
  'comments',
  'collects',
  'followers',
  'shares',
  'likeRate',
  'collectRate',
  'engageRate',
  'followRate',
  'likeCollectRatio',
  'activeQuality',
];

/** 计算单篇笔记的某个指标 */
export const noteMetric = (n: Note, key: string): number | null =>
  getMetric(key).calc(noteTotals(n));

/** 环比 */
export const pctChange = (cur: number | null, prev: number | null): number | null => {
  if (cur === null || prev === null || prev === 0 || !Number.isFinite(prev)) return null;
  const r = (cur - prev) / Math.abs(prev);
  return Number.isFinite(r) ? r : null;
};
