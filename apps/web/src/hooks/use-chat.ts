"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAnonymousSession } from "@/hooks/use-anonymous-session";
import type { VoiceRecording } from "@/hooks/use-voice-recorder";
import {
  attachMessageAudio,
  type CompanionState,
  type EmotionalNeed,
  loadLatestConversation,
  loadProfileContext,
  type MessageMode,
  type Mood,
  type ProfileContext,
  type StoredMessage,
  streamChat,
  streamOpening,
  synthesizeVoice,
  transcribeVoice,
  updateProfileContext,
} from "@/lib/api";
import { createVoiceSignedUrl, uploadVoiceObject } from "@/lib/supabase";

export type EntryMode = "loading" | "new" | "returning" | "chat" | "checkin";

export type CompanionMood = {
  state: CompanionState;
  emoji: string;
  label: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  messageType: MessageMode;
  createdAt: string | null;
  streaming?: boolean;
  streamIndex?: number;
  audioUrl?: string;
  audioPath?: string;
  durationMs?: number;
  companionState?: CompanionState;
};

const STATE_META: Record<CompanionState, Omit<CompanionMood, "state">> = {
  approaching: { emoji: "🌙", label: "正在靠近" },
  attentive: { emoji: "👀", label: "有在认真看你" },
  teasing: { emoji: "😏", label: "想逗你一下" },
  soft: { emoji: "🤍", label: "有点心软了" },
  proud: { emoji: "✨", label: "替你得意" },
  jealous: { emoji: "🙄", label: "假装没吃醋" },
  thinking: { emoji: "💭", label: "在想怎么接你" },
  calm: { emoji: "🙂", label: "陪你待一会儿" },
};

const DEFAULT_COMPANION_MOOD: CompanionMood = {
  state: "approaching",
  ...STATE_META.approaching,
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
    companionState: message.companion_state ?? undefined,
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<ProfileContext | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>("loading");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [companionMood, setCompanionMood] = useState<CompanionMood>(
    DEFAULT_COMPANION_MOOD,
  );
  const [sending, setSending] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token || loadedToken.current === token) return;
    loadedToken.current = token;
    let active = true;
    Promise.all([loadLatestConversation(token), loadProfileContext(token)])
      .then(([history, context]) => {
        if (!active) return;
        const restored = history.messages
          .map(fromStored)
          .filter(Boolean) as ChatMessage[];
        setConversationId(history.conversationId);
        setMessages(restored);
        setProfile(context);
        const lastState = [...restored]
          .reverse()
          .find((message) => message.companionState)?.companionState;
        if (lastState) {
          setCompanionMood({ state: lastState, ...STATE_META[lastState] });
        }
        setEntryMode(restored.length ? "returning" : "new");
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "对话加载失败");
        setEntryMode("new");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const speak = useCallback(
    async (message: ChatMessage, spokenContent = message.content) => {
      if (!token) return;
      try {
        let url = message.audioUrl;
        let audioPath = message.audioPath;
        if (!url) {
          if (audioPath) {
            url = await createVoiceSignedUrl(audioPath);
          } else {
            if (!userId || message.role !== "assistant") return;
            const blob = await synthesizeVoice(token, spokenContent);
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

  const consumeAssistantStream = useCallback(
    async (
      run: (onEvent: Parameters<typeof streamChat>[2]) => Promise<void>,
      responseMode: MessageMode,
    ) => {
      const streamKey = crypto.randomUUID();
      const completed: ChatMessage[] = [];
      await run((event) => {
        if (event.type === "start") setConversationId(event.conversation_id);
        if (event.type === "companion_state") {
          setCompanionMood({
            state: event.state,
            emoji: event.emoji,
            label: event.label,
          });
        }
        if (event.type === "bubble_start") {
          setMessages((current) => [
            ...current,
            {
              id: `assistant-${streamKey}-${event.index}`,
              role: "assistant",
              content: "",
              messageType: "text",
              createdAt: new Date().toISOString(),
              streaming: true,
              streamIndex: event.index,
            },
          ]);
        }
        if (event.type === "delta") {
          setMessages((current) =>
            current.map((message) =>
              message.id === `assistant-${streamKey}-${event.index}`
                ? { ...message, content: message.content + event.content }
                : message,
            ),
          );
        }
        if (event.type === "message") {
          const finalMessage: ChatMessage = {
            id: event.id,
            role: "assistant",
            content: event.content,
            messageType: "text",
            createdAt: new Date().toISOString(),
            companionState: event.companion_state ?? undefined,
          };
          completed.push(finalMessage);
          setMessages((current) =>
            current.map((message) =>
              message.id === `assistant-${streamKey}-${event.index}`
                ? finalMessage
                : message,
            ),
          );
        }
      });
      if (responseMode === "voice" && completed.length) {
        const last = completed.at(-1) as ChatMessage;
        const joined = completed.map((message) => message.content).join("。 ");
        last.messageType = "voice";
        setMessages((current) =>
          current.map((message) =>
            message.id === last.id
              ? { ...message, messageType: "voice" }
              : message,
          ),
        );
        await speak(last, joined);
      }
    },
    [speak],
  );

  const startWithContext = useCallback(
    async (mood: Mood, emotionalNeed: EmotionalNeed) => {
      if (!token || sending) return;
      setError(null);
      setSending(true);
      setEntryMode("chat");
      try {
        const context = await updateProfileContext(token, {
          current_mood: mood,
          emotional_need: emotionalNeed,
        });
        setProfile(context);
        await consumeAssistantStream(
          (onEvent) => streamOpening(token, conversationId, onEvent),
          "text",
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "陆川刚刚走神了");
        setEntryMode(messages.length ? "returning" : "new");
      } finally {
        setSending(false);
      }
    },
    [consumeAssistantStream, conversationId, messages.length, sending, token],
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
      setEntryMode("chat");
      const now = new Date().toISOString();
      setMessages((current) => [
        ...current,
        {
          id: `user-${crypto.randomUUID()}`,
          role: "user",
          content: normalized,
          messageType: inputMode,
          createdAt: now,
          audioPath,
          durationMs,
        },
      ]);
      try {
        await consumeAssistantStream(
          (onEvent) =>
            streamChat(
              token,
              {
                content: normalized,
                conversation_id: conversationId,
                input_mode: inputMode,
                response_mode: inputMode === "voice" ? "voice" : "text",
                audio_path: audioPath,
                duration_ms: durationMs,
              },
              onEvent,
            ),
          inputMode === "voice" ? "voice" : "text",
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "消息发送失败");
      } finally {
        setSending(false);
      }
    },
    [consumeAssistantStream, conversationId, sending, token],
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
    profile,
    entryMode,
    companionMood,
    ready: Boolean(token) && entryMode === "chat",
    connecting: sessionLoading || entryMode === "loading",
    sending,
    transcribing,
    error: error ?? sessionError,
    send,
    sendVoice,
    speak,
    startWithContext,
    continueHistory: () => setEntryMode("chat"),
    showCheckin: () => setEntryMode("checkin"),
    closeCheckin: () => setEntryMode("chat"),
  };
}
