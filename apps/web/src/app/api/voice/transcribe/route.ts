import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ detail: "语音服务尚未配置" }, { status: 503 });
  const form = await request.formData(); const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > Number(process.env.MAX_AUDIO_BYTES ?? 10_000_000)) return Response.json({ detail: "音频文件不正确或过大" }, { status: 400 });
  const providerForm = new FormData(); providerForm.append("model", process.env.TRANSCRIPTION_MODEL ?? "FunAudioLLM/SenseVoiceSmall"); providerForm.append("file", audio, audio.name || "voice.webm");
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.siliconflow.cn/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: providerForm });
  if (!response.ok) return Response.json({ detail: "语音识别失败" }, { status: 502 });
  const data = await response.json() as { text?: string }; return Response.json({ text: data.text?.trim() ?? "" });
}
