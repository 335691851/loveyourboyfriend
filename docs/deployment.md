# Vercel 部署

应用现在是单一 Next.js 项目：网页与文字聊天 API 都由 Vercel 部署。对话记录和当下情绪仅保存在用户当前浏览器的 `localStorage` 中，不使用 Supabase、Render、数据库、对象存储或语音服务。

在 Vercel 导入仓库后，配置如下：

| 设置            | 值                               |
| --------------- | -------------------------------- |
| Root Directory  | `apps/web`                       |
| Framework       | Next.js                          |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command   | `pnpm build`                     |

在 Vercel 的 Environment Variables 中设置以下服务端变量（不要使用 `NEXT_PUBLIC_` 前缀）：

| 变量              | 用途                                       |
| ----------------- | ------------------------------------------ |
| `OPENAI_API_KEY`  | OpenAI 兼容模型服务的密钥                  |
| `OPENAI_BASE_URL` | 服务地址，默认 SiliconFlow OpenAI 兼容地址 |
| `CHAT_MODEL`      | 对话模型                                   |

将 `apps/web/.env.example` 复制为本地 `.env.local` 并填入同一组变量，即可运行 `pnpm dev`。模型密钥绝不会发送至浏览器：客户端仅调用同源的 Next.js Route Handlers。

## 数据行为

- 历史对话、情绪偏好与临时匿名标识保存在当前设备的浏览器中。
- 清理浏览器站点数据或切换设备会开始新的会话。
- 应用仅支持文字聊天，不请求麦克风权限，也不上传音频。
