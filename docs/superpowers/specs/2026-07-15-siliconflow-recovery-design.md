# SiliconFlow 主模型恢复与连贯兜底设计

## 背景与根因

生产日志持续出现 `BadRequestError`。对 LangChain 最终 HTTP 请求抓包后确认：`ChatOpenAI(max_tokens=320)` 被 `langchain-openai` 转换成了 `max_completion_tokens`，而 SiliconFlow Chat Completions 接口只接受 `max_tokens`。此外，SiliconFlow 当前接口最多接受 10 条 messages；现有服务最多传入 40 条历史消息，也需要同时收紧，避免长对话再次触发 400。

## 目标

- 主链继续使用 LangChain `ChatOpenAI` 与 `Qwen/Qwen3.5-35B-A3B`。
- 最终 HTTP JSON 使用 `max_tokens`，不得出现 `max_completion_tokens`。
- 关闭 Qwen 思考模式，优先快速输出自然正文。
- 模型上下文总消息数不超过 SiliconFlow 的 10 条限制。
- 上游失败时不重复固定一句话；兜底应结合当前输入、最近对话和角色边界，保持最低限度的连贯性。
- 正常主模型回复恢复后，继续执行结构化长期记忆抽取。

## 请求适配

`ChatOpenAI` 不再设置 `max_tokens` 属性，而是通过 `extra_body` 原样传递：

```python
extra_body={"enable_thinking": False, "max_tokens": 320}
```

记忆模型同样使用原始 `max_tokens: 256`。聊天服务只读取最近 7 条历史消息；加上两个 system message 和当前 human message，最终最多 10 条。

测试必须通过 `httpx.MockTransport` 捕获 OpenAI SDK 最终发送的 JSON，而不是只检查 LangChain 模型属性。

## 连贯兜底

新增独立模块 `app/ai/fallback.py`，提供：

```python
build_fallback_reply(user_text: str, history_rows: list[dict]) -> str
```

模块按当前输入识别疲惫、难过、生气、吃饭、失眠、位置/在不在、重新开始、质疑重复、分享好消息和普通陪伴等意图。每个意图提供多条符合“陆川”人设的短回复，并利用最近 assistant 文本排除重复候选。候选选择由当前文本、最近一条用户消息和对话轮次稳定决定，既避免随机跳脱，也不会连续复读。

兜底不得虚构现实身体或位置；不得把模板伪装成深度理解；不得在上游失败后执行记忆抽取。

## 验收

- 单元测试证明最终请求字段正确、消息数不超限。
- 相同意图连续出现时，兜底回复不与最近 assistant 回复重复。
- “你在哪里呀”“清空”“怎么每次都一样”等输入得到语义匹配的回应。
- 全量测试、Ruff、ESLint、TypeScript 和 Next.js build 通过。
- 生产不再出现 `BadRequestError`，回复内容来自主模型且不等于本地兜底文案。
- 用户与 assistant 消息写入 Supabase，刷新后历史恢复。
