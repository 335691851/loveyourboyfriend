"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { EmotionCheckin } from "@/components/emotion-checkin";
import { useChat, type ChatMessage } from "@/hooks/use-chat";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

function Icon({
  name,
}: {
  name: "mood" | "more" | "voice" | "send" | "sound";
}) {
  const paths = {
    mood: (
      <path d="M12 3a9 9 0 1 0 9 9M8.5 10h.01M15.5 10h.01M8 15c1.1.8 2.4 1.2 4 1.2s2.9-.4 4-1.2M17 3v4M15 5h4" />
    ),
    more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
    voice: (
      <path d="M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5Zm-3 6a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    ),
    send: <path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14" />,
    sound: <path d="M6 10v4h3l4 3V7l-4 3H6Zm10-1a5 5 0 0 1 0 6" />,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function MessageBubble({
  message,
  onSpeak,
}: {
  message: ChatMessage;
  onSpeak: () => void;
}) {
  const time = message.createdAt
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(message.createdAt))
    : null;
  return (
    <div className={`message message-${message.role}`}>
      <div className="bubble">
        {message.messageType === "voice" && (
          <div className="voice-label">
            <span className="mini-wave">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>{message.role === "user" ? "语音已转写" : "陆川的语音"}</span>
          </div>
        )}
        <p>{message.content || "正在想怎么逗你…"}</p>
        <div className="bubble-meta">
          {message.messageType === "voice" &&
            (message.role === "assistant" || message.audioPath) &&
            !message.streaming && (
              <button type="button" onClick={onSpeak} aria-label="播放这条语音">
                <Icon name="sound" />
              </button>
            )}
          {time && <time>{time}</time>}
        </div>
      </div>
    </div>
  );
}

function LoadingScene() {
  return (
    <div className="loading-scene">
      <div className="loading-avatar">
        <span>川</span>
        <i />
      </div>
      <div className="loading-wave" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <strong>正在找回你们的默契</strong>
      <p>把上一次没说完的话，轻轻接回来</p>
    </div>
  );
}

export function ChatShell() {
  const chat = useChat();
  const [input, setInput] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recorder = useVoiceRecorder(chat.sendVoice);
  const busy = chat.sending || chat.transcribing;
  const showCheckin = ["new", "returning", "checkin"].includes(chat.entryMode);

  useEffect(() => {
    if (
      chat.entryMode === "chat" &&
      typeof endRef.current?.scrollIntoView === "function"
    ) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [chat.entryMode, chat.messages, busy]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = input;
    setInput("");
    void chat.send(content);
  }

  return (
    <main className="app-stage">
      <section
        className={`phone-shell state-${chat.companionMood.state} ${
          recorder.recording
            ? "state-listening"
            : busy
              ? "state-responding"
              : ""
        }`}
        aria-label="沉浸式聊天页面"
      >
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="grain" />

        <header className="chat-header">
          <button
            className="icon-button mood-button"
            type="button"
            aria-label="调整我的当前状态"
            disabled={chat.entryMode === "loading"}
            onClick={chat.showCheckin}
          >
            <Icon name="mood" />
          </button>
          <div className="character">
            <div className="avatar" aria-hidden="true">
              <span>川</span>
              <i />
            </div>
            <div>
              <div className="character-name">
                <strong>陆川</strong>
                <span>AI</span>
              </div>
              <p className="companion-status" key={chat.companionMood.state}>
                <b>{chat.companionMood.emoji}</b>
                {busy ? "正在回应你" : chat.companionMood.label}
              </p>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="更多选项"
            onClick={() => setShowInfo(true)}
          >
            <Icon name="more" />
          </button>
        </header>

        <div
          className={`conversation conversation-${chat.entryMode}`}
          aria-live="polite"
        >
          {chat.entryMode === "loading" ? (
            <LoadingScene />
          ) : showCheckin ? (
            <EmotionCheckin
              mode={chat.entryMode}
              profile={chat.profile}
              busy={chat.sending}
              onConfirm={(mood, need) => void chat.startWithContext(mood, need)}
              onContinue={chat.continueHistory}
              onClose={chat.closeCheckin}
            />
          ) : (
            <>
              <div className="date-pill">今晚 · 只属于这段对话</div>
              {chat.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onSpeak={() => void chat.speak(message)}
                />
              ))}
              {busy && (
                <div className="activity-row">
                  <div className="typing" aria-label="陆川正在输入">
                    <span />
                    <span />
                    <span />
                  </div>
                  <small>
                    {chat.transcribing ? "正在听懂你的语音" : "陆川正在回应"}
                  </small>
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
          {chat.error && (
            <div className="error-toast" role="alert">
              {chat.error}
            </div>
          )}
        </div>

        {chat.entryMode === "chat" && (
          <footer className="composer-wrap">
            {recorder.recording && (
              <div className="recording-strip">
                <span />
                正在录音，再点一次发送
              </div>
            )}
            {recorder.error && (
              <p className="recorder-error">{recorder.error}</p>
            )}
            <form className="composer" onSubmit={submit}>
              <button
                className={`voice-button ${recorder.recording ? "is-recording" : ""}`}
                type="button"
                aria-label={recorder.recording ? "结束并发送语音" : "发送语音"}
                disabled={!chat.ready || busy}
                onClick={
                  recorder.recording
                    ? recorder.stop
                    : () => void recorder.start()
                }
              >
                <Icon name="voice" />
              </button>
              <label className="input-wrap">
                <span className="sr-only">输入消息</span>
                <input
                  aria-label="输入消息"
                  placeholder="和他说点什么…"
                  value={input}
                  maxLength={4000}
                  disabled={!chat.ready || busy || recorder.recording}
                  onChange={(event) => setInput(event.target.value)}
                />
              </label>
              <button
                className="send-button"
                type="submit"
                aria-label="发送消息"
                disabled={!input.trim() || !chat.ready || busy}
              >
                <Icon name="send" />
              </button>
            </form>
            <p className="privacy-copy">
              仅限 18+ · 匿名使用 · 对话 90 天后自动清理
            </p>
          </footer>
        )}

        {showInfo && (
          <div
            className="sheet-backdrop"
            role="presentation"
            onClick={() => setShowInfo(false)}
          >
            <aside
              className="info-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="关于陆川"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <span className="eyebrow">ABOUT LU CHUAN</span>
              <h2>有感觉，也有边界</h2>
              <p>
                陆川是虚构的 AI
                角色，不是真实的人。他会记住你明确分享的偏好，让聊天更连贯，但不会要求你依赖或只选择他。
              </p>
              <div className="trust-grid">
                <span>匿名 UUID</span>
                <span>90 天清理</span>
                <span>随时改状态</span>
              </div>
              <button type="button" onClick={() => setShowInfo(false)}>
                知道了
              </button>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
