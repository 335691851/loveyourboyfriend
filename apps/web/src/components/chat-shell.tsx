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
        <p>{message.content || "…"}</p>
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
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const followRef = useRef(true);
  const endRef = useRef<HTMLDivElement>(null);
  const recorder = useVoiceRecorder(chat.sendVoice);
  const busy = chat.sending || chat.transcribing;
  const showCheckin = ["new", "returning", "checkin"].includes(chat.entryMode);

  useEffect(() => {
    if (
      chat.entryMode === "chat" &&
      followRef.current &&
      conversationRef.current
    ) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [chat.entryMode, chat.messages, busy]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      if (viewport && viewport.scale === 1) {
        viewportRef.current?.style.setProperty(
          "--app-height",
          `${viewport.height}px`,
        );
        if (followRef.current && conversationRef.current) {
          conversationRef.current.scrollTop =
            conversationRef.current.scrollHeight;
        }
      }
    };
    resize();
    viewport?.addEventListener("resize", resize);
    return () => viewport?.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "24px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [input, chat.entryMode]);

  useEffect(() => {
    if (showInfo) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [showInfo]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || busy || recorder.recording || !chat.ready) return;
    followRef.current = true;
    setAwayFromBottom(false);
    const content = input;
    setInput("");
    void chat.send(content).then((sent) => {
      if (sent === false) setInput((draft) => draft || content);
    });
  }

  return (
    <main className="app-stage" ref={viewportRef}>
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
            disabled={
              chat.entryMode === "loading" || busy || recorder.recording
            }
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
                <i aria-hidden="true" />
                {recorder.recording ? "听你说" : busy ? "正在输入…" : "慢慢聊"}
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
          ref={conversationRef}
          onScroll={() => {
            const el = conversationRef.current;
            if (!el) return;
            const away = el.scrollHeight - el.scrollTop - el.clientHeight > 90;
            followRef.current = !away;
            setAwayFromBottom(away);
          }}
          className={`conversation conversation-${chat.entryMode}`}
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
              <div className="date-pill">陆川 · 与你</div>
              {chat.messages.length === 0 && !busy && (
                <div className="chat-intro">
                  <span>不必想好开场白。</span>
                  <p>一句「在吗」，也可以。</p>
                </div>
              )}
              <div
                role="log"
                aria-label="聊天记录"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {chat.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onSpeak={() => void chat.speak(message)}
                  />
                ))}
              </div>
              {busy && (
                <div className="activity-row">
                  <div className="typing" aria-label="陆川正在输入">
                    <span />
                    <span />
                    <span />
                  </div>
                  <small>
                    {chat.transcribing ? "正在转写语音…" : "正在输入…"}
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

        {awayFromBottom && chat.entryMode === "chat" && (
          <button
            className="jump-latest"
            type="button"
            onClick={() => {
              followRef.current = true;
              setAwayFromBottom(false);
              conversationRef.current?.scrollTo({
                top: conversationRef.current.scrollHeight,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              });
            }}
          >
            回到最新消息 ↓
          </button>
        )}

        {chat.entryMode === "chat" && (
          <footer className="composer-wrap">
            {recorder.recording && (
              <div className="recording-strip">
                <span>正在录音 · 再点麦克风发送</span>
                <button type="button" onClick={recorder.cancel}>
                  取消
                </button>
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
                <textarea
                  ref={textareaRef}
                  rows={1}
                  enterKeyHint="send"
                  aria-label="输入消息"
                  placeholder={
                    busy ? "可以先写下一句…" : "说点什么，或者发条语音"
                  }
                  value={input}
                  maxLength={4000}
                  disabled={!chat.ready || recorder.recording}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      event.nativeEvent.keyCode !== 229
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
              </label>
              <button
                className="send-button"
                type="submit"
                aria-label="发送消息"
                disabled={
                  !input.trim() || !chat.ready || busy || recorder.recording
                }
              >
                <Icon name="send" />
              </button>
            </form>
            <p className="privacy-copy">不赶时间，慢慢说。</p>
          </footer>
        )}

        <dialog
          ref={dialogRef}
          className="info-sheet"
          aria-label="关于陆川"
          onClose={() => setShowInfo(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              const box = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < box.left ||
                event.clientX > box.right ||
                event.clientY < box.top ||
                event.clientY > box.bottom
              )
                setShowInfo(false);
            }
          }}
        >
          <div className="sheet-handle" />
          <span className="eyebrow">ABOUT LU CHUAN</span>
          <h2>有感觉，也有边界</h2>
          <p>
            陆川是虚构的 AI
            角色。可以聊日常，也可以什么都不聊。聊天记录保存在此设备，清理浏览器数据后会丢失。
          </p>
          <div className="trust-grid">
            <span>本机保存</span>
            <span>18+ 陪伴</span>
            <span>随时改状态</span>
          </div>
          <p>发送的文字与语音会交给模型服务处理；录音不做云端存档。</p>
          <button type="button" onClick={() => setShowInfo(false)}>
            知道了
          </button>
        </dialog>
      </section>
    </main>
  );
}
