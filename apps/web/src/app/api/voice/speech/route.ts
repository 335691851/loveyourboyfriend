import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const { content } = await request.json().catch(() => ({})) as { content?: string }; const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ detail: "语音服务尚未配置" }, { status: 503 });
  if (!content?.trim() || content.length > 2000) return Response.json({ detail: "语音文本长度不正确" }, { status: 400 });
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.siliconflow.cn/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/audio/speech`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.SPEECH_MODEL ?? "FunAudioLLM/CosyVoice2-0.5B", voice: process.env.SPEECH_VOICE ?? "FunAudioLLM/CosyVoice2-0.5B:david", input: content, response_format: "mp3", speed: 1.08 }) });
  if (!response.ok) return Response.json({ detail: "语音生成失败" }, { status: 502 });
  return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
}
