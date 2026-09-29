import { NextRequest } from "next/server";
import { companionPrompt, parseReply } from "@/lib/reply-style";
import type { CompanionState } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const stateMeta: Record<CompanionState, [string, string]> = {
  approaching: ["🌙", "正在靠近"],
  attentive: ["👀", "有在认真看你"],
  teasing: ["😏", "想逗你一下"],
  soft: ["🤍", "有点心软了"],
  proud: ["✨", "替你得意"],
  jealous: ["🙄", "假装没吃醋"],
  thinking: ["💭", "在想怎么接你"],
  calm: ["🙂", "陪你待一会儿"],
};

type RequestBody = {
  content?: string;
  conversation_id?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  profile?: { current_mood?: string | null; emotional_need?: string | null };
  response_mode?: "text" | "voice";
  interaction_mode?: "reply" | "opening" | "proactive";
};

async function generate(body: RequestBody) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("聊天服务尚未配置，请先设置模型密钥");
  const baseUrl = (
    process.env.OPENAI_BASE_URL ?? "https://api.siliconflow.cn/v1"
  ).replace(/\/$/, "");
  const proactiveInstruction =
    body.interaction_mode === "proactive"
      ? "\n这是一次系统触发的主动互动。结合最近对话，像刚好想到对方一样主动说一句；8—28个字，只用一个气泡。不要提等待、未回复、计时或系统触发，不催促用户。可以关心一个具体细节、轻轻逗一句，或自然延续没说完的话。"
      : "";
  const userMessage =
    body.interaction_mode === "proactive"
      ? "请现在自然地主动说一句。"
      : body.content;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: process.env.CHAT_MODEL ?? "Qwen/Qwen3.5-35B-A3B",
      temperature: 0.85,
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            companionPrompt(
              body.profile as Parameters<typeof companionPrompt>[0],
            ) + proactiveInstruction,
        },
        ...(body.history ?? [])
          .slice(-8)
          .map(({ role, content }) => ({ role, content })),
        { role: "user", content: userMessage },
      ],
      stream: false,
    }),
  });
  if (!response.ok) throw new Error("语言模型服务暂时不可用");
  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = parseReply(result.choices?.[0]?.message?.content ?? "");
  if (!reply.bubbles.length) throw new Error("这条回复没有接通，请再试一次");
  return reply;
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ detail: "请求格式错误" }, { status: 400 });
  }
  if (
    !body ||
    typeof body.content !== "string" ||
    !body.content.trim() ||
    body.content.length > 4000
  )
    return Response.json({ detail: "消息长度不正确" }, { status: 400 });
  if (
    body.history !== undefined &&
    (!Array.isArray(body.history) ||
      body.history.length > 200 ||
      body.history.some(
        (item) =>
          !item ||
          !["user", "assistant"].includes(item.role) ||
          typeof item.content !== "string" ||
          item.content.length > 4000,
      ))
  )
    return Response.json({ detail: "历史消息格式错误" }, { status: 400 });
  try {
    const reply = await generate(body);
    const conversationId = body.conversation_id ?? crypto.randomUUID();
    const encoder = new TextEncoder();
    const event = (data: unknown) =>
      encoder.encode(`${JSON.stringify(data)}\n`);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          event({ type: "start", conversation_id: conversationId }),
        );
        const [emoji, label] = stateMeta[reply.state];
        controller.enqueue(
          event({ type: "companion_state", state: reply.state, emoji, label }),
        );
        reply.bubbles.forEach((bubble, index) => {
          const id = crypto.randomUUID();
          controller.enqueue(event({ type: "bubble_start", index }));
          controller.enqueue(event({ type: "delta", index, content: bubble }));
          controller.enqueue(
            event({
              type: "message",
              index,
              id,
              conversation_id: conversationId,
              content: bubble,
              message_type:
                index === reply.bubbles.length - 1
                  ? (body.response_mode ?? "text")
                  : "text",
              companion_state:
                index === reply.bubbles.length - 1 ? reply.state : null,
            }),
          );
        });
        controller.enqueue(event({ type: "done" }));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { detail: error instanceof Error ? error.message : "对话服务暂时不可用" },
      { status: 502 },
    );
  }
}
