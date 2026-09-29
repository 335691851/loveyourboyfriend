# Love Your Boyfriend

移动端 AI 陪伴聊天应用。它是一个单一的 Next.js 16 项目，可直接部署至 Vercel。

## 架构

```text
浏览器（React）
  ├─ localStorage：本机的会话、情绪偏好
  └─ /api/chat：同源文字聊天请求
       └─ Vercel Functions：安全读取模型密钥并调用 OpenAI 兼容接口
```

没有 Supabase、Render、数据库、对象存储、语音服务或独立 Python 服务。用户的历史仅保留在当前浏览器；清除站点数据或换设备会开启新会话。

## 本地开发

```bash
pnpm install
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm dev
```

在 `apps/web/.env.local` 设置 `OPENAI_API_KEY`；其余模型变量可按服务商调整。不要将密钥设为 `NEXT_PUBLIC_*`。

## 部署

在 Vercel 导入此仓库，并指定 Root Directory 为 `apps/web`。将 `.env.example` 中的变量加入 Vercel 的 Environment Variables。完整说明见 [部署文档](docs/deployment.md)。

## 验证

```bash
pnpm lint
pnpm test
pnpm build
```
