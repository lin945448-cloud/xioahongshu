import type { Note, UploadedFile } from '@/types';

/** 生成一份可交互演示用的模拟数据（不上传文件也能看到完整看板） */
export function buildDemoData(): { notes: Note[]; files: UploadedFile[] } {
  const accounts = [
    { name: '示例账号·家居好物', base: 62000, quality: 1.15 },
    { name: '示例账号·职场干货', base: 38000, quality: 0.95 },
    { name: '示例账号·美食日常', base: 88000, quality: 1.02 },
  ];
  const categories = ['家居收纳', '好物测评', '干货教程', '生活方式', '美食探店'];
  const genres = ['图文', '视频'];

  // 固定随机种子，保证每次演示数据一致
  let seed = 20260806;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const notes: Note[] = [];
  const files: UploadedFile[] = [];
  const startYear = 2025;
  const startMonth = 9; // 2025-09 ~ 2026-06

  accounts.forEach((acc, ai) => {
    const fileId = `demo-${ai}`;
    let min = Infinity;
    let max = -Infinity;
    let count = 0;

    for (let mi = 0; mi < 10; mi += 1) {
      const date = new Date(startYear, startMonth - 1 + mi, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const ym = `${year}-${String(month).padStart(2, '0')}`;
      const perMonth = 6 + Math.floor(rnd() * 5);
      // 账号成长曲线 + 随机波动
      const growth = 1 + mi * 0.08 + (rnd() - 0.5) * 0.18;

      for (let i = 0; i < perMonth; i += 1) {
        const day = 1 + Math.floor((28 / perMonth) * i + rnd() * 2);
        const ts = new Date(year, month - 1, Math.min(day, 28), 9 + Math.floor(rnd() * 12), Math.floor(rnd() * 60)).getTime();
        const viral = rnd() > 0.9 ? 3.2 + rnd() * 4 : 1; // 偶发爆款
        const impressions = Math.round(acc.base * growth * (0.55 + rnd() * 0.9) * viral);
        const ctr = 0.06 + rnd() * 0.07 * acc.quality;
        const readRate = 0.14 + rnd() * 0.12 * acc.quality;
        const views = Math.round(impressions * readRate);
        const likeRate = 0.028 + rnd() * 0.035 * acc.quality;
        const collectRate = 0.014 + rnd() * 0.03 * acc.quality;
        const commentRate = 0.003 + rnd() * 0.008;
        const followRate = 0.002 + rnd() * 0.006 * acc.quality;

        notes.push({
          id: `${fileId}-${notes.length}`,
          fileId,
          account: acc.name,
          title: `${categories[Math.floor(rnd() * categories.length)]}｜第 ${i + 1} 篇示例笔记（${ym}）`,
          publishAt: ts,
          ym,
          month,
          seq: i + 1,
          genre: genres[rnd() > 0.62 ? 1 : 0],
          category: categories[Math.floor(rnd() * categories.length)],
          impressions,
          views,
          ctr,
          likes: Math.round(views * likeRate),
          comments: Math.round(views * commentRate),
          collects: Math.round(views * collectRate),
          followers: Math.round(views * followRate),
          shares: Math.round(views * (0.002 + rnd() * 0.004)),
        });

        min = Math.min(min, ts);
        max = Math.max(max, ts);
        count += 1;
      }
    }

    files.push({
      id: fileId,
      fileName: `${acc.name}.xlsx`,
      account: acc.name,
      noteCount: count,
      minDate: min,
      maxDate: max,
    });
  });

  notes.sort((a, b) => a.publishAt - b.publishAt);
  return { notes, files };
}
