"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { VoiceRecording } from "@/hooks/use-voice-recorder";
import {
  type CompanionState,
  type EmotionalNeed,
  loadLatestConversation,
  loadProfileContext,
  saveConversation,
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

function toHistory(messages: ChatMessage[]): StoredMessage[] {
  return messages
    .filter((message) => !message.streaming && message.content)
    .slice(-8)
    .map((message) => ({
      id: message.id,
      conversation_id: "",
      role: message.role,
      message_type: message.messageType,
      content: message.content,
      audio_path: null,
      duration_ms: message.durationMs ?? null,
      companion_state: message.companionState ?? null,
      created_at: message.createdAt ?? "",
    }));
}

export function useChat() {
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
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadLatestConversation(), loadProfileContext()])
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
  }, []);

  useEffect(() => {
    if (entryMode === "loading" || !conversationId || !profile) return;
    const stored = messages
      .filter((message) => !message.streaming)
      .map((message) => ({
        id: message.id,
        conversation_id: conversationId,
        role: message.role,
        message_type: message.messageType,
        content: message.content,
        audio_path: null,
        duration_ms: message.durationMs ?? null,
        companion_state: message.companionState ?? null,
        created_at: message.createdAt ?? new Date().toISOString(),
      }));
    try {
      saveConversation(stored, conversationId, profile);
    } catch {
      // Conversation stays usable when storage is disabled or full.
    }
  }, [conversationId, entryMode, messages, profile]);

  const speak = useCallback(
    async (message: ChatMessage, spokenContent = message.content) => {
      if (message.role !== "assistant") return;
      try {
        let url = message.audioUrl;
        if (!url) {
          const blob = await synthesizeVoice(spokenContent);
          url = URL.createObjectURL(blob);
          setMessages((current) =>
            current.map((item) =>
              item.id === message.id ? { ...item, audioUrl: url } : item,
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
    [],
  );

  const consumeAssistantStream = useCallback(
    async (
      run: (onEvent: Parameters<typeof streamChat>[1]) => Promise<void>,
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
      if (inFlight.current) return;
      inFlight.current = true;
      setError(null);
      setSending(true);
      setEntryMode("chat");
      try {
        const context = await updateProfileContext({
          current_mood: mood,
          emotional_need: emotionalNeed,
        });
        setProfile(context);
        await consumeAssistantStream(
          (onEvent) =>
            streamOpening(
              conversationId,
              toHistory(messages),
              context,
              onEvent,
            ),
          "text",
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "陆川刚刚走神了");
        setEntryMode(messages.length ? "returning" : "new");
      } finally {
        inFlight.current = false;
        setSending(false);
      }
    },
    [consumeAssistantStream, conversationId, messages],
  );

  const send = useCallback(
    async (
      content: string,
      inputMode: MessageMode = "text",
      audioPath?: string,
      durationMs?: number,
    ) => {
      const normalized = content.trim();
      if (!normalized || inFlight.current) return false;
      inFlight.current = true;
      setError(null);
      setSending(true);
      setEntryMode("chat");
      const now = new Date().toISOString();
      const userMessageId = `user-${crypto.randomUUID()}`;
      setMessages((current) => [
        ...current,
        {
          id: userMessageId,
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
              {
                content: normalized,
                conversation_id: conversationId,
                input_mode: inputMode,
                response_mode: inputMode === "voice" ? "voice" : "text",
                duration_ms: durationMs,
                history: toHistory(messages),
                profile: profile ?? {
                  current_mood: null,
                  emotional_need: null,
                  mood_updated_at: null,
                },
              },
              onEvent,
            ),
          inputMode === "voice" ? "voice" : "text",
        );
        return true;
      } catch (reason) {
        setMessages((current) =>
          current.filter(
            (message) => message.id !== userMessageId && !message.streaming,
          ),
        );
        setError(reason instanceof Error ? reason.message : "消息发送失败");
        return false;
      } finally {
        inFlight.current = false;
        setSending(false);
      }
    },
    [consumeAssistantStream, conversationId, messages, profile],
  );

  const sendVoice = useCallback(
    async ({ blob, durationMs }: VoiceRecording) => {
      if (!blob.size) return;
      setTranscribing(true);
      setError(null);
      try {
        const text = await transcribeVoice(blob);
        if (text) await send(text, "voice", undefined, durationMs);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "语音识别失败");
      } finally {
        setTranscribing(false);
      }
    },
    [send],
  );

  return {
    messages,
    profile,
    entryMode,
    companionMood,
    ready: entryMode === "chat",
    connecting: entryMode === "loading",
    sending,
    transcribing,
    error,
    send,
    sendVoice,
    speak,
    startWithContext,
    continueHistory: () => setEntryMode("chat"),
    showCheckin: () => setEntryMode("checkin"),
    closeCheckin: () => setEntryMode("chat"),
  };
}
