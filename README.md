# Love Your Boyfriend

移动端优先的沉浸式虚拟陪伴 H5。当前 MVP 已包含匿名登录、流式对话、
长期记忆、私有语音收发、历史恢复和 90 天数据清理。

## 技术栈

- `apps/web`：Next.js 16、React 19、TypeScript、Tailwind CSS
- `apps/api`：Python 3.12、FastAPI、LangChain、SiliconFlow OpenAI 兼容 API
- `supabase`：匿名认证、PostgreSQL、数据库 migrations
- 部署：Vercel 前端 + Render 后端，监听 `master` 自动发布

## 本地启动

需要 Node.js 20.9+、pnpm 11 和 uv。

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/api/.env.example apps/api/.env
pnpm install
uv sync --project apps/api
```

分别启动前后端：

```powershell
pnpm dev:web
pnpm dev:api
```

Web 默认访问 `http://localhost:3000`，API 健康检查为 `http://localhost:8000/health`。

## 常用命令

```powershell
pnpm test          # 前后端测试
pnpm lint          # ESLint、TypeScript、Ruff
pnpm build         # 前端生产构建
pnpm format:check  # 格式检查
```

部署平台初始化和环境变量说明见 [docs/deployment.md](docs/deployment.md)。密钥只写入本地或平台环境变量，不要提交到 Git。

## LangChain 模块

- `app/ai/prompts.py`：陆屿角色、安全边界和记忆提取规则
- `app/ai/chains.py`：`ChatPromptTemplate → ChatOpenAI → StrOutputParser` 流式链
- `app/ai/memory.py`：Structured Output 记忆提取、置信度过滤和去重
- `app/services/chat.py`：把身份、历史、记忆、流式回复和持久化编排为一次对话

文字和语音共用同一套角色与记忆。语音采用“SenseVoice 转写 → Qwen 对话链 →
CosyVoice 男声合成”，便于首版稳定上线。
