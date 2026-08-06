/** 单篇笔记（清洗 + 计算后的标准结构） */
export interface Note {
  id: string;
  account: string; // 账号名（默认取文件名）
  fileId: string;
  title: string;
  publishAt: number; // 毫秒时间戳
  ym: string; // 2025-01
  month: number; // 1-12
  seq: number; // 当月发布顺序（每月从 1 开始）
  genre: string; // 体裁：图文 / 视频
  category: string; // 品类
  impressions: number; // 曝光
  views: number; // 观看量
  ctr: number; // 封面点击率（原始值 0~1）
  likes: number; // 点赞
  comments: number; // 评论
  collects: number; // 收藏
  followers: number; // 涨粉
  shares: number; // 分享
}

/** 聚合用的累加容器 */
export interface Totals {
  notes: number;
  impressions: number;
  views: number;
  clicks: number; // 估算点击数 = Σ(封面点击率 × 曝光)
  likes: number;
  comments: number;
  collects: number;
  followers: number;
  shares: number;
}

export type MetricUnit = 'percent' | 'count' | 'ratio';
export type MetricGroup = '流量规模' | '转化效率' | '互动质量';

export interface MetricDef {
  key: string;
  label: string;
  unit: MetricUnit;
  group: MetricGroup;
  color: string;
  desc: string;
  /** 由累加容器计算出指标值；同时适用于单篇与任意维度聚合 */
  calc: (t: Totals) => number | null;
  /** 是否为「越大越好」，用于环比着色 */
  higherIsBetter?: boolean;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  account: string;
  noteCount: number;
  minDate: number;
  maxDate: number;
}

export interface Filters {
  accounts: string[];
  categories: string[];
  genres: string[];
  monthFrom: string | null;
  monthTo: string | null;
}

export type TabKey =
  | 'overview'
  | 'metric'
  | 'account'
  | 'category'
  | 'detail'
  | 'export';
