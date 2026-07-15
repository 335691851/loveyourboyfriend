"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { useChat, type ChatMessage } from "@/hooks/use-chat";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

function Icon({
  name,
}: {
  name: "back" | "more" | "voice" | "send" | "sound";
}) {
  const paths = {
    back: <path d="m15 18-6-6 6-6" />,
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
            <span>
              {message.role === "user" ? "语音已转写" : "陆屿的语音"}
              {message.durationMs
                ? ` · ${Math.ceil(message.durationMs / 1000)}″`
                : ""}
            </span>
          </div>
        )}
        <p>{message.content || "正在组织想说的话…"}</p>
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

const MOODS = ["有点累", "想被哄", "分享好消息"];

export function ChatShell() {
  const chat = useChat();
  const [input, setInput] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recorder = useVoiceRecorder(chat.sendVoice);

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === "function") {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [chat.messages, chat.sending, chat.transcribing]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = input;
    setInput("");
    void chat.send(content);
  }

  const hasConversation = chat.messages.some(
    (message) => message.role === "user",
  );
  const busy = chat.sending || chat.transcribing;

  return (
    <main className="app-stage">
      <section
        className={`phone-shell ${
          recorder.recording
            ? "state-listening"
            : chat.sending
              ? "state-responding"
              : "state-resting"
        }`}
        aria-label="沉浸式聊天页面"
      >
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="grain" />

        <header className="chat-header">
          <button className="icon-button" type="button" aria-label="返回">
            <Icon name="back" />
          </button>
          <div className="character">
            <div className="avatar" aria-hidden="true">
              <span>屿</span>
              <i />
            </div>
            <div>
              <div className="character-name">
                <strong>陆屿</strong>
                <span>AI</span>
              </div>
              <p>
                <i />{" "}
                {chat.connecting
                  ? "正在靠近"
                  : busy
                    ? "正在回应你"
                    : "此刻在线"}
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

        <div className="conversation" aria-live="polite">
          <div className="date-pill">今晚 · 只属于这段对话</div>
          {!hasConversation && (
            <>
              <section className="welcome-card">
                <span className="eyebrow">JUST BETWEEN US</span>
                <h1>今晚想聊点什么？</h1>
                <p>不用想好怎么开口。说生活、情绪，或者只是来待一会儿。</p>
                <div className="mood-row">
                  <span className="pulse-dot" />
                  <span>情绪靠近中</span>
                  <div className="wave">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </section>
              <div className="mood-prompts" aria-label="快速开始">
                {MOODS.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => void chat.send(mood)}
                  >
                    {mood}
                  </button>
                ))}
              </div>
              <div className="memory-note">
                <span>✦</span>
                <p>聊久一点，我会记住你明确告诉我的偏好和边界。</p>
              </div>
            </>
          )}

          {chat.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onSpeak={() => void chat.speak(message)}
            />
          ))}
          {(chat.sending || chat.transcribing) && (
            <div className="activity-row">
              <div className="typing" aria-label="陆屿正在输入">
                <span />
                <span />
                <span />
              </div>
              <small>
                {chat.transcribing ? "正在听懂你的语音" : "陆屿正在回应"}
              </small>
            </div>
          )}
          {chat.error && (
            <div className="error-toast" role="alert">
              {chat.error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <footer className="composer-wrap">
          {recorder.recording && (
            <div className="recording-strip">
              <span />
              正在录音，再点一次发送
            </div>
          )}
          {recorder.error && <p className="recorder-error">{recorder.error}</p>}
          <form className="composer" onSubmit={submit}>
            <button
              className={`voice-button ${recorder.recording ? "is-recording" : ""}`}
              type="button"
              aria-label={recorder.recording ? "结束并发送语音" : "发送语音"}
              disabled={!chat.ready || busy}
              onClick={
                recorder.recording ? recorder.stop : () => void recorder.start()
              }
            >
              <Icon name="voice" />
            </button>
            <label className="input-wrap">
              <span className="sr-only">输入消息</span>
              <input
                aria-label="输入消息"
                placeholder={
                  chat.ready ? "和他说点什么…" : "正在连接你们的对话…"
                }
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
              aria-label="关于陆屿"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <span className="eyebrow">ABOUT LU YU</span>
              <h2>温柔，也有边界</h2>
              <p>
                陆屿是虚构的 AI
                角色，不是真实的人。他会记住你明确分享的偏好，让聊天更连贯，但不会要求你依赖或只选择他。
              </p>
              <div className="trust-grid">
                <span>匿名 UUID</span>
                <span>90 天清理</span>
                <span>随时离开</span>
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
