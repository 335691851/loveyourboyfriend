function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m4 4 17 8-17 8 3-8-3-8Z" />
      <path d="M7 12h14" />
    </svg>
  );
}

export function ChatShell() {
  return (
    <main className="app-stage">
      <section className="phone-shell" aria-label="沉浸式聊天页面">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="grain" />

        <header className="chat-header">
          <button className="icon-button" type="button" aria-label="返回">
            <BackIcon />
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
                <i /> 正在等你
              </p>
            </div>
          </div>

          <button className="icon-button" type="button" aria-label="更多选项">
            <MoreIcon />
          </button>
        </header>

        <div className="conversation">
          <div className="date-pill">今晚 · 22:08</div>

          <section className="welcome-card">
            <span className="eyebrow">JUST BETWEEN US</span>
            <h1>今晚想聊点什么？</h1>
            <p>不用想好怎么开口。你说的每一句，我都会认真听。</p>
            <div className="mood-row" aria-label="当前情绪状态">
              <span className="pulse-dot" />
              <span>情绪靠近中</span>
              <div className="wave" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </section>

          <div className="memory-note">
            <span>✦</span>
            <p>我记得你喜欢被认真回应，而不是被敷衍。</p>
          </div>

          <div className="message message-agent">
            <div className="bubble">
              <p>你来了。今天过得怎么样？</p>
              <time>22:08</time>
            </div>
          </div>

          <div className="typing" aria-label="陆屿正在输入">
            <span />
            <span />
            <span />
          </div>
        </div>

        <footer className="composer-wrap">
          <div className="composer">
            <button
              className="voice-button"
              type="button"
              aria-label="发送语音"
            >
              <VoiceIcon />
            </button>
            <label className="input-wrap">
              <span className="sr-only">输入消息</span>
              <input aria-label="输入消息" placeholder="和他说点什么…" />
            </label>
            <button className="send-button" type="button" aria-label="发送消息">
              <SendIcon />
            </button>
          </div>
          <p className="privacy-copy">仅你可见 · 对话将在 90 天后自动清理</p>
        </footer>
      </section>
    </main>
  );
}
