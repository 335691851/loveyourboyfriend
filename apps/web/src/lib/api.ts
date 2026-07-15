export type MessageMode = "text" | "voice";
export type Mood = "轻松" | "开心" | "疲惫" | "委屈" | "心烦" | "心动";
export type EmotionalNeed =
  "听我说" | "哄哄我" | "逗我开心" | "陪我吐槽" | "暧昧一点";
export type CompanionState =
  | "approaching"
  | "attentive"
  | "teasing"
  | "soft"
  | "proud"
  | "jealous"
  | "thinking"
  | "calm";

export type ProfileContext = {
  current_mood: Mood | null;
  emotional_need: EmotionalNeed | null;
  mood_updated_at: string | null;
};

export type StreamEvent =
  | { type: "start"; conversation_id: string }
  | {
      type: "companion_state";
      state: CompanionState;
      emoji: string;
      label: string;
    }
  | { type: "bubble_start"; index: number }
  | { type: "delta"; index: number; content: string }
  | {
      type: "message";
      index: number;
      id: string;
      conversation_id: string;
      content: string;
      message_type: MessageMode;
      companion_state: CompanionState | null;
    }
  | { type: "done" };

export type StoredMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  message_type: MessageMode;
  content: string;
  audio_path: string | null;
  duration_ms: number | null;
  companion_state: CompanionState | null;
  created_at: string;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let detail = "连接暂时走神了，请稍后再试";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {}
    throw new Error(detail);
  }
  return response;
}

export async function consumeNdjson(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as StreamEvent);
    }
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as StreamEvent);
}

export async function streamChat(
  token: string,
  input: {
    content: string;
    conversation_id: string | null;
    input_mode: MessageMode;
    response_mode: MessageMode;
    audio_path?: string;
    duration_ms?: number;
  },
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
) {
  const response = await apiFetch("/v1/chat/stream", token, {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  });
  if (!response.body) throw new Error("浏览器不支持流式对话");
  await consumeNdjson(response.body, onEvent);
}

export async function streamOpening(
  token: string,
  conversationId: string | null,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
) {
  const response = await apiFetch("/v1/chat/opening", token, {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId }),
    signal,
  });
  if (!response.body) throw new Error("浏览器不支持流式对话");
  await consumeNdjson(response.body, onEvent);
}

export async function loadProfileContext(token: string) {
  const response = await apiFetch("/v1/profile/context", token);
  return (await response.json()) as ProfileContext;
}

export async function updateProfileContext(
  token: string,
  input: { current_mood: Mood; emotional_need: EmotionalNeed },
) {
  const response = await apiFetch("/v1/profile/context", token, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return (await response.json()) as ProfileContext;
}

export async function loadLatestConversation(token: string) {
  const conversationsResponse = await apiFetch("/v1/conversations", token);
  const conversations = (await conversationsResponse.json()) as Array<{
    id: string;
  }>;
  if (!conversations[0])
    return { conversationId: null, messages: [] as StoredMessage[] };
  const conversationId = conversations[0].id;
  const messagesResponse = await apiFetch(
    `/v1/conversations/${conversationId}/messages`,
    token,
  );
  return {
    conversationId,
    messages: (await messagesResponse.json()) as StoredMessage[],
  };
}

export async function transcribeVoice(token: string, blob: Blob) {
  const form = new FormData();
  form.append("audio", blob, "voice.webm");
  const response = await apiFetch("/v1/voice/transcribe", token, {
    method: "POST",
    body: form,
  });
  return ((await response.json()) as { text: string }).text;
}

export async function synthesizeVoice(token: string, content: string) {
  const response = await apiFetch("/v1/voice/speech", token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return response.blob();
}

export async function attachMessageAudio(
  token: string,
  messageId: string,
  audioPath: string,
  durationMs?: number,
) {
  await apiFetch(`/v1/messages/${messageId}/audio`, token, {
    method: "PATCH",
    body: JSON.stringify({ audio_path: audioPath, duration_ms: durationMs }),
  });
}
