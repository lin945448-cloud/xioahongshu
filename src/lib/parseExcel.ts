import * as XLSX from 'xlsx';
import type { Note, UploadedFile } from '@/types';

/* ------------------------------------------------------------------ */
/* 列名归一化：完整继承 Python 版的 rename_map，并额外扩充常见别名        */
/* ------------------------------------------------------------------ */
const RENAME: Record<string, string> = {
  曝光量: '曝光',
  曝光数: '曝光',
  展现量: '曝光',
  阅读量: '观看量',
  播放量: '观看量',
  观看数: '观看量',
  浏览量: '观看量',
  点赞数: '点赞',
  获赞: '点赞',
  获赞数: '点赞',
  点赞次数: '点赞',
  收藏数: '收藏',
  评论数: '评论',
  涨粉数: '涨粉',
  净涨粉: '涨粉',
  新增粉丝: '涨粉',
  分享数: '分享',
  发布形式: '体裁',
  笔记类型: '体裁',
  内容形式: '体裁',
  标题: '笔记标题',
  笔记名称: '笔记标题',
  发布时间: '首次发布时间',
  首次发布日期: '首次发布时间',
  分类: '品类',
  类目: '品类',
  内容品类: '品类',
  点击率: '封面点击率',
  封面点击率: '封面点击率',
};

/** 参与解析的标准列 */
const NUMERIC_COLS = ['曝光', '观看量', '点赞', '评论', '收藏', '涨粉', '分享'] as const;

export interface ParseResult {
  notes: Note[];
  file: UploadedFile;
  warnings: string[];
}

/* ---------------------------- 值解析工具 ---------------------------- */

const toNumber = (raw: unknown): number => {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let s = String(raw).trim().replace(/,/g, '').replace(/\s/g, '');
  if (!s || s === '-' || s === '--' || s === 'NaN') return 0;
  let mult = 1;
  if (/[万w]$/i.test(s)) {
    mult = 1e4;
    s = s.slice(0, -1);
  } else if (/亿$/.test(s)) {
    mult = 1e8;
    s = s.slice(0, -1);
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n * mult : 0;
};

/** 比率列解析：支持 0.1234 / "12.34%" / 12.34（百分点） */
const toRate = (raw: unknown): number => {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'string' && raw.includes('%')) {
    const n = parseFloat(raw.replace(/[%,\s]/g, ''));
    return Number.isFinite(n) ? n / 100 : 0;
  }
  const n = toNumber(raw);
  // Excel 中若已存为百分数值（如 12.34 表示 12.34%），做一次纠偏
  return n > 1 ? n / 100 : n;
};

/** 时间解析：支持中文格式、Excel 序列号、Date、ISO 字符串 */
const toTimestamp = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime();
  if (typeof raw === 'number') {
    // Excel 日期序列号
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      return new Date(
        parsed.y,
        (parsed.m || 1) - 1,
        parsed.d || 1,
        parsed.H || 0,
        parsed.M || 0,
        Math.floor(parsed.S || 0)
      ).getTime();
    }
    return null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // 2025年01月02日10时30分00秒 / 2025-01-02 10:30 / 2025/1/2
  const m = s.match(
    /(\d{4})\D{1,2}(\d{1,2})\D{1,2}(\d{1,2})(?:\D{1,2}(\d{1,2})\D{1,2}(\d{1,2})(?:\D{1,2}(\d{1,2}))?)?/
  );
  if (m) {
    const t = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
      Number(m[6] ?? 0)
    ).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
};

const ymOf = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/* ---------------------------- 主解析流程 ---------------------------- */

const normalizeRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = String(k).trim();
    out[RENAME[key] ?? key] = v;
  }
  return out;
};

/** 小红书后台导出通常首行是说明行，表头在第 2 行；这里自动探测最佳表头行 */
const readRows = (ws: XLSX.WorkSheet): Record<string, unknown>[] => {
  const candidates = [1, 0, 2];
  let best: Record<string, unknown>[] = [];
  let bestScore = -1;
  for (const range of candidates) {
    try {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        range,
        defval: null,
        raw: true,
      });
      if (!rows.length) continue;
      const cols = Object.keys(normalizeRow(rows[0]));
      const score =
        ['笔记标题', '首次发布时间', '曝光', '观看量', '点赞', '收藏'].filter((c) =>
          cols.includes(c)
        ).length * 100 +
        rows.length;
      if (score > bestScore) {
        bestScore = score;
        best = rows;
      }
    } catch {
      /* 忽略该候选行 */
    }
  }
  return best;
};

export async function parseWorkbook(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('未找到可读取的工作表');

  const rawRows = readRows(ws);
  if (!rawRows.length) throw new Error('表格中没有数据行');

  const rows = rawRows.map(normalizeRow);
  const cols = new Set(Object.keys(rows[0]));

  const warnings: string[] = [];
  if (!cols.has('首次发布时间')) throw new Error('缺少必要列：首次发布时间');
  if (!cols.has('曝光') && !cols.has('观看量'))
    throw new Error('缺少必要列：曝光 / 观看量（至少需要一个）');

  for (const c of ['封面点击率', '体裁', '品类', '分享', '涨粉']) {
    if (!cols.has(c)) warnings.push(`未找到「${c}」列，相关指标按 0 / 未分类处理`);
  }

  const account = file.name.replace(/\.(xlsx|xls|csv)$/i, '');
  const fileId = `${account}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 1. 转换 + 过滤无效时间
  const parsed: Omit<Note, 'seq'>[] = [];
  let dropped = 0;
  rows.forEach((r, i) => {
    const ts = toTimestamp(r['首次发布时间']);
    if (ts === null) {
      dropped += 1;
      return;
    }
    const nums = Object.fromEntries(
      NUMERIC_COLS.map((c) => [c, toNumber(r[c])])
    ) as Record<(typeof NUMERIC_COLS)[number], number>;

    parsed.push({
      id: `${fileId}-${i}`,
      fileId,
      account,
      title: String(r['笔记标题'] ?? `未命名笔记 ${i + 1}`).trim() || `未命名笔记 ${i + 1}`,
      publishAt: ts,
      ym: ymOf(ts),
      month: new Date(ts).getMonth() + 1,
      genre: String(r['体裁'] ?? '未标注').trim() || '未标注',
      category: String(r['品类'] ?? '未分类').trim() || '未分类',
      impressions: nums['曝光'],
      views: nums['观看量'],
      ctr: toRate(r['封面点击率']),
      likes: nums['点赞'],
      comments: nums['评论'],
      collects: nums['收藏'],
      followers: nums['涨粉'],
      shares: nums['分享'],
    });
  });

  if (!parsed.length) throw new Error('没有解析到任何有效的「首次发布时间」');
  if (dropped) warnings.push(`有 ${dropped} 行因时间格式无法识别被忽略`);

  // 2. 按时间排序，生成每月序号（对齐 Python：groupby('年月').cumcount()+1）
  parsed.sort((a, b) => a.publishAt - b.publishAt);
  const counter = new Map<string, number>();
  const notes: Note[] = parsed.map((n) => {
    const c = (counter.get(n.ym) ?? 0) + 1;
    counter.set(n.ym, c);
    return { ...n, seq: c };
  });

  return {
    notes,
    warnings,
    file: {
      id: fileId,
      fileName: file.name,
      account,
      noteCount: notes.length,
      minDate: notes[0].publishAt,
      maxDate: notes[notes.length - 1].publishAt,
    },
  };
}
