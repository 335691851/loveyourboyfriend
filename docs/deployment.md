# 部署初始化

项目采用单仓库、单一 `master` 生产分支：Vercel 部署前端，Render 部署 API，Supabase 提供匿名认证和 PostgreSQL。

## Vercel

导入 GitHub 仓库 `335691851/loveyourboyfriend`，配置：

| 设置              | 值                               |
| ----------------- | -------------------------------- |
| Production Branch | `master`                         |
| Root Directory    | `apps/web`                       |
| Framework         | Next.js                          |
| Install Command   | `pnpm install --frozen-lockfile` |
| Build Command     | `pnpm build`                     |
| Auto Deploy       | 开启                             |

环境变量参考 `apps/web/.env.example`。`NEXT_PUBLIC_` 变量会暴露到浏览器，只能填写公开配置。

## Render

推荐使用仓库根目录的 `render.yaml` 创建 Blueprint，也可以按文件中的参数手动创建 Web Service。服务监听 `master` 并在每次提交后自动部署，健康检查路径为 `/health`。

环境变量参考 `apps/api/.env.example`。以下机密只填写在 Render Dashboard，不要提交到 Git：

```text
OPENAI_API_KEY
SUPABASE_SECRET_KEY
DATABASE_URL
TURNSTILE_SECRET_KEY
```

取得 Render URL 后，将它配置为 Vercel 的 `NEXT_PUBLIC_API_BASE_URL`；取得 Vercel 正式域名后，将它加入 Render 的 `ALLOWED_ORIGINS`。

## Supabase

项目引用为 `rycwnxynvlfqkfgsksrs`。

1. 在 Authentication 中开启 Anonymous Sign-Ins。
2. 在项目设置中复制 Publishable Key、Secret Key 和 pooled `DATABASE_URL`。
3. 审阅 `supabase/migrations/`，连接正式项目后先执行 dry-run，再应用 migration。
4. 前端只使用 Publishable Key；Secret Key 和数据库密码只能放在 Render。

当前 migration 已为业务表启用 RLS，并按 `auth.uid()` 隔离匿名用户数据。本地初始化不会自动修改线上数据库。

语音 Storage、Turnstile 和 90 天自动清理任务将在对应功能开发时添加。
