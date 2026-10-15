# 小红书内部数据分析看板

React + Vite 看板继续部署在 Vercel，Supabase 提供邮箱登录、历史数据与数据库权限。

## 使用方式

- 访客：点击「查看演示数据」，公开体验虚构数据的全部筛选、分析和导出功能。
- 管理员：注册并确认预先配置的管理员邮箱，登录后打开「管理数据与授权」。填写稳定的账号名称、数据归属月份，选择 Excel，核对解析提示后确认入库。
- 授权成员：管理员在页面添加邮箱；对方以该邮箱注册、确认邮箱并登录，即可查看全部历史记录、筛选、分析和下载报告。注册本身不会授予数据访问权。
- 数据自动保存在云端，重新登录后自动加载；「数据明细」与分析页使用同一份历史数据。
- 支持每月 1 日采集后上传和补录历史月份，不限制只能在 1 日操作。归属月份请按业务口径明确填写；默认上一自然月。
- 同一账号同一归属月份只允许一个文件批次；同一账号重复文件也会拒绝。纠错时管理员先确认撤销原批次，再重新导入。撤销是删除该批次，不可在页面恢复，请保留原始 Excel。
- 累计指标按 Excel 原值保存，不做差分。原看板的趋势和「发布起始/结束月份」仍按笔记发布时间聚合，另有「数据归属月份」筛选。若同一笔记存在于多个归属批次，全部批次汇总会计入多条记录，请先按归属月份筛选再比较。
- 每批最多 20,000 条，原始文件最多 10MB，解析后前端限制 3MB（为 Vercel 4.5MB 请求上限预留空间）。按完整月度文件上传，不支持同月拆成多个批次。

## 部署

1. 在 Vercel 项目连接 Supabase Marketplace 集成，确认环境变量覆盖 Production、Preview、Development。
2. `npm ci`。运行 `vercel env pull .env.local` 拉取本地配置。不要提交 `.env.local` 或数据库凭据。
3. `npm run db:migrate` 创建数据库表、RPC 与 RLS 策略。迁移执行记录保存在 `dashboard_migrations`，重复执行跳过已应用文件。不要将此命令放入每次 Vercel 构建。
4. `node --env-file=.env.local scripts/bootstrap-admin.mjs YOUR_EMAIL` 初始化管理员。仅此受信任脚本/SQL 能授予管理员角色，页面只能授予查看者。
5. 在 Supabase Authentication / URL Configuration 中，将 Site URL 设置为正式网站域名，将正式域名和需要的预览域名加入 Redirect URLs。保持邮箱确认开启，按需要配置 SMTP（内置邮件服务有速率和收件限制）。
6. `npm test`、`npm run build`，通过后将分支合并到主分支，由 Vercel Git 集成发布。

`vite.config.ts` 兼容 Marketplace 注入的 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（或 publishable key），也支持手动的 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`。只有 URL 和公开 key 会进入前端产物，service-role key 和数据库密码绝不能设置 `VITE_` 前缀。

数据库脚本使用 Supabase 官方 CA，保持 TLS 主机名和证书校验开启。证书来源：<https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt>。证书更换时应从提供商可信渠道更新，不应关闭证书验证。

生产页面通过 `/api/supabase/*` 同域接口转发 Auth / REST 请求。接口只使用公开 key 或请求原有凭据，不使用 service-role 密钥提权；响应禁止缓存。所有权限仍由 Supabase 校验。此接口不支持 Storage / Realtime；当前版本无需这些服务。

## 权限与存储

`dashboard_members` 保存授权邮箱和角色，`dashboard_batches` 按账号和月份保存解析后的笔记 JSON 与文件名、SHA-256、上传人、上传时间。不会保存原始 Excel 二进制。此版本面向月度内部数据量，客户端按批次读取全部可见历史数据；大量年份/账号的数据应后续迁移为逐条明细表并在数据库分页聚合。

真实数据查询通过 Supabase RLS 限制；所有写入只通过检查管理员身份的数据库函数执行。身份从 Auth 的已确认邮箱与 `auth.uid()` 获取，不信任客户端传入的角色或可编辑用户元数据。未授权注册账号无法读取数据，数据库会立即拒绝已撤销账号的新请求。

页面退出登录会清除已加载真实数据；每 60 秒及页面重新获得焦点时复查权限。撤销授权不能收回对方已下载的报告，也不能抹除其已经接收到的内容。真实数据不写入本地持久化缓存。

旧版本 `datasets` 表不会被迁移脚本读取、公开或删除。如果旧环境曾启用该功能，请先审计旧表权限，再由管理员把源文件导入新系统。数据库备份/恢复策略需在 Supabase 项目中另外配置。

## 验证

`npm test` 在真实 PostgreSQL 引擎 PGlite 上执行迁移及 RLS/RPC 测试，覆盖匿名、未授权、邮箱未确认、管理员、查看者、撤销权限、重复批次、重复文件、非法数据和批次纠错。测试不依赖生产密钥。

集成测试可运行 `node --env-file=.env.local scripts/verify-live.mjs`（需已启动本地服务及 Chrome）。`E2E_BASE_URL` 可指向预览部署；如果环境不能直连 Supabase，设置 `E2E_SUPABASE_PROXY=https://YOUR_PREVIEW/api/supabase`。脚本使用临时 Auth 用户和虚构数据，完成后清理；请优先在独立测试数据库中运行。
