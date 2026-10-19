# Cloudflare Workers 独立部署

此目录只为同一项目增加 Workers 部署。Vercel 的配置、API 文件和正式域名不变；不要为部署 Cloudflare 改动 `vercel.json`。Cloudflare 使用静态资源托管提供 `dist`，Worker 单独处理 `/api/*`，登录、数据代理、成员开通功能完整保留。

## 账号及数据

默认连接现有 Supabase 项目，因此两站共用邮箱、密码、角色、数据和报表内容；浏览器登录会话按域名分别保存，需要在新网址重新登录。Cloudflare 上新增/撤销授权和导入/删除数据，会同步反映在 Vercel 上，这是共用数据库的正常行为。

## 从本地部署

1. `npm ci`，运行 `npm run build`。
2. `npx wrangler@4.151.1 login`，用自己的 Cloudflare 账号授权。
3. 设置 Worker 名称（`wrangler.jsonc` 的 `name`）。不要填写 Vercel 域名或添加会影响现有网站的 DNS 路由。
4. 准备 `.env.production.local`（已有 Vercel 项目可运行 `vercel env pull .env.production.local --environment production`）。它只用于本地构建与读取现有配置，不能提交。
5. `node scripts/cloudflare-secrets.mjs` 从现有配置生成 Git 忽略的 `.cloudflare-secrets.json`，其中只含三个 Worker 服务端变量。
6. `npx wrangler@4.151.1 deploy --secrets-file .cloudflare-secrets.json`。代码、静态资源和 secrets 同步发布；输出类似 `https://xioahongshu-dashboard.YOUR_SUBDOMAIN.workers.dev`。
7. 按输出网址检查公开演示、登录、筛选、导出和管理员操作。部署完成后可删除本地 secrets 临时文件。

编译 Worker 类型可用 `npx tsc -p tsconfig.cloudflare.json`；预演打包可用 `npx wrangler@4.151.1 deploy --dry-run --outdir .wrangler/dry-run`。只上传 `dist` 作为静态目录，绝不能把仓库根目录设为静态资源目录。

## 在 Cloudflare 控制台连接 GitHub

需要自动部署时，在 Workers & Pages 创建 Worker 并连接本仓库的 Cloudflare 分支。构建命令为 `npm ci && npm run build`，部署命令为 `npx wrangler@4.151.1 deploy`，配置文件为根目录 `wrangler.jsonc`。构建环境需要公开的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`；运行时 Secrets 需要 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。最后一个只可放服务端 Secret，不可使用 `VITE_` 前缀。

`workers.dev` 是 Cloudflare 自动域名，普通 Workers 不等于 China Network，大陆访问可用性需要用实际运营商网络测试，不能保证任意地区稳定直连。
