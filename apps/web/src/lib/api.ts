import { readConversation, writeConversation } from "@/lib/local-store";

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

type ChatInput = {
  content: string;
  conversation_id: string | null;
  input_mode: MessageMode;
  response_mode: MessageMode;
  history: StoredMessage[];
  profile: ProfileContext;
  duration_ms?: number;
  interaction_mode?: "reply" | "opening" | "proactive";
};

async function routeFetch(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(55_000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || "连接暂时走神了，请稍后再试");
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
    for (const line of lines)
      if (line.trim()) onEvent(JSON.parse(line) as StreamEvent);
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as StreamEvent);
}

export async function streamChat(
  input: ChatInput,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
) {
  const response = await routeFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.body) throw new Error("浏览器不支持流式对话");
  await consumeNdjson(response.body, onEvent);
}

export async function streamOpening(
  conversationId: string | null,
  history: StoredMessage[],
  profile: ProfileContext,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
) {
  await streamChat(
    {
      content: "请按当前状态主动自然地开场。",
      conversation_id: conversationId,
      input_mode: "text",
      response_mode: "text",
      history,
      profile,
      interaction_mode: "opening",
    },
    onEvent,
    signal,
  );
}

export async function streamProactive(
  conversationId: string,
  history: StoredMessage[],
  profile: ProfileContext,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
) {
  await streamChat(
    {
      content: "主动互动",
      conversation_id: conversationId,
      input_mode: "text",
      response_mode: "text",
      history,
      profile,
      interaction_mode: "proactive",
    },
    onEvent,
    signal,
  );
}

export async function loadLatestConversation() {
  const conversation = readConversation();
  return {
    conversationId: conversation.id || null,
    messages: conversation.messages,
  };
}

export async function loadProfileContext() {
  return readConversation().profile;
}

export async function updateProfileContext(input: {
  current_mood: Mood;
  emotional_need: EmotionalNeed;
}) {
  const conversation = readConversation();
  const profile: ProfileContext = {
    ...input,
    mood_updated_at: new Date().toISOString(),
  };
  try {
    writeConversation({ ...conversation, profile });
  } catch {
    // Browsing with storage disabled still allows this session to continue.
  }
  return profile;
}

export function saveConversation(
  messages: StoredMessage[],
  conversationId: string,
  profile: ProfileContext,
) {
  writeConversation({ id: conversationId, messages, profile });
}

export async function transcribeVoice(blob: Blob) {
  const form = new FormData();
  form.append("audio", blob, "voice.webm");
  const response = await routeFetch("/api/voice/transcribe", {
    method: "POST",
    body: form,
  });
  return ((await response.json()) as { text: string }).text;
}

export async function synthesizeVoice(content: string) {
  const response = await routeFetch("/api/voice/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return response.blob();
}
