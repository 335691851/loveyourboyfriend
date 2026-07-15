"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAnonymousSession } from "@/hooks/use-anonymous-session";
import type { VoiceRecording } from "@/hooks/use-voice-recorder";
import {
  attachMessageAudio,
  loadLatestConversation,
  type MessageMode,
  type StoredMessage,
  streamChat,
  synthesizeVoice,
  transcribeVoice,
} from "@/lib/api";
import { createVoiceSignedUrl, uploadVoiceObject } from "@/lib/supabase";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  messageType: MessageMode;
  createdAt: string | null;
  streaming?: boolean;
  audioUrl?: string;
  audioPath?: string;
  durationMs?: number;
};

const GREETING: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "你来了。今天过得怎么样？",
  messageType: "text",
  createdAt: null,
};

function fromStored(message: StoredMessage): ChatMessage | null {
  if (message.role === "system") return null;
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    messageType: message.message_type,
    createdAt: message.created_at,
    audioPath: message.audio_path ?? undefined,
    durationMs: message.duration_ms ?? undefined,
  };
}

export function useChat() {
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
  } = useAnonymousSession();
  const token = session?.access_token ?? null;
  const userId = session?.user.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token || loadedToken.current === token) return;
    loadedToken.current = token;
    let active = true;
    loadLatestConversation(token)
      .then(({ conversationId: id, messages: stored }) => {
        if (!active) return;
        const restored = stored
          .map(fromStored)
          .filter(Boolean) as ChatMessage[];
        setConversationId(id);
        if (restored.length) setMessages(restored);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "历史对话加载失败",
          );
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const speak = useCallback(
    async (message: ChatMessage) => {
      if (!token) return;
      try {
        let url = message.audioUrl;
        let audioPath = message.audioPath;
        if (!url) {
          if (audioPath) {
            url = await createVoiceSignedUrl(audioPath);
          } else {
            if (!userId || message.role !== "assistant") return;
            const blob = await synthesizeVoice(token, message.content);
            url = URL.createObjectURL(blob);
            try {
              audioPath = await uploadVoiceObject(userId, blob);
              await attachMessageAudio(token, message.id, audioPath);
            } catch {
              setError("语音可以播放，但这次没能保存到历史记录");
            }
          }
          setMessages((current) =>
            current.map((item) =>
              item.id === message.id
                ? { ...item, audioUrl: url, audioPath }
                : item,
            ),
          );
        }
        try {
          await new Audio(url).play();
        } catch {
          setError("语音已经准备好，点气泡里的播放键就能听");
        }
      } catch {
        setError("语音生成失败，请稍后再试");
      }
    },
    [token, userId],
  );

  const send = useCallback(
    async (
      content: string,
      inputMode: MessageMode = "text",
      audioPath?: string,
      durationMs?: number,
    ) => {
      const normalized = content.trim();
      if (!normalized || !token || sending) return;
      setError(null);
      setSending(true);
      const now = new Date().toISOString();
      const localUserId = `user-${crypto.randomUUID()}`;
      const localAssistantId = `assistant-${crypto.randomUUID()}`;
      setMessages((current) => [
        ...current,
        {
          id: localUserId,
          role: "user",
          content: normalized,
          messageType: inputMode,
          createdAt: now,
          audioPath,
          durationMs,
        },
        {
          id: localAssistantId,
          role: "assistant",
          content: "",
          messageType: inputMode === "voice" ? "voice" : "text",
          createdAt: now,
          streaming: true,
        },
      ]);
      let finalMessage: ChatMessage | null = null;
      try {
        await streamChat(
          token,
          {
            content: normalized,
            conversation_id: conversationId,
            input_mode: inputMode,
            response_mode: inputMode === "voice" ? "voice" : "text",
            audio_path: audioPath,
            duration_ms: durationMs,
          },
          (event) => {
            if (event.type === "start")
              setConversationId(event.conversation_id);
            if (event.type === "delta") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === localAssistantId
                    ? { ...message, content: message.content + event.content }
                    : message,
                ),
              );
            }
            if (event.type === "message") {
              finalMessage = {
                id: event.id,
                role: "assistant",
                content: event.content,
                messageType: event.message_type,
                createdAt: new Date().toISOString(),
              };
              setMessages((current) =>
                current.map((message) =>
                  message.id === localAssistantId
                    ? (finalMessage as ChatMessage)
                    : message,
                ),
              );
            }
          },
        );
        if (inputMode === "voice" && finalMessage) await speak(finalMessage);
      } catch (reason) {
        setMessages((current) =>
          current.filter((message) => message.id !== localAssistantId),
        );
        setError(reason instanceof Error ? reason.message : "消息发送失败");
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending, speak, token],
  );

  const sendVoice = useCallback(
    async ({ blob, durationMs }: VoiceRecording) => {
      if (!token || !userId || !blob.size) return;
      setTranscribing(true);
      setError(null);
      try {
        const audioPath = await uploadVoiceObject(userId, blob);
        const text = await transcribeVoice(token, blob);
        if (text) await send(text, "voice", audioPath, durationMs);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "语音识别失败");
      } finally {
        setTranscribing(false);
      }
    },
    [send, token, userId],
  );

  return {
    messages,
    ready: Boolean(token) && !loadingHistory,
    connecting: sessionLoading || loadingHistory,
    sending,
    transcribing,
    error: error ?? sessionError,
    send,
    sendVoice,
    speak,
  };
}
