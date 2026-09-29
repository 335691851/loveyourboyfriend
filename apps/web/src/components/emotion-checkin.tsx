"use client";

import { useState } from "react";
import type { EntryMode } from "@/hooks/use-chat";
import type { EmotionalNeed, Mood, ProfileContext } from "@/lib/api";

const MOODS: Mood[] = ["轻松", "开心", "疲惫", "委屈", "心烦", "心动"];
const NEEDS: EmotionalNeed[] = [
  "听我说",
  "哄哄我",
  "逗我开心",
  "陪我吐槽",
  "暧昧一点",
];

type Props = {
  mode: EntryMode;
  profile: ProfileContext | null;
  busy: boolean;
  onConfirm: (mood: Mood, need: EmotionalNeed) => void;
  onContinue: () => void;
  onClose: () => void;
};

export function EmotionCheckin({
  mode,
  profile,
  busy,
  onConfirm,
  onContinue,
  onClose,
}: Props) {
  const [mood, setMood] = useState<Mood | null>(profile?.current_mood ?? null);
  const [need, setNeed] = useState<EmotionalNeed | null>(
    profile?.emotional_need ?? null,
  );
  const returning = mode === "returning";
  const editing = mode === "checkin";
  return (
    <section className="checkin-card" aria-label="此刻的情绪与陪伴需求">
      <div className="night-window" aria-hidden="true">
        <div className="moon" />
        <div className="window-line" />
        <span>有些话，慢慢说。</span>
      </div>
      <div className="checkin-content">
        <span className="eyebrow">A LITTLE CLOSER</span>
        <h1>
          {editing ? (
            "今天，想怎么被陪着？"
          ) : returning ? (
            "又见面了。"
          ) : (
            <>
              先坐一会儿。
              <br />
              别急着说晚安。
            </>
          )}
        </h1>
        <p>
          {returning
            ? "接着聊，或换个心情。"
            : editing
              ? "不想选也没关系，直接告诉他。"
              : "今天的事，说一点给我听。"}
        </p>
        <fieldset className="choice-block" disabled={busy}>
          <legend>
            此刻心情 <span>可以不选</span>
          </legend>
          <div className="mood-grid">
            {MOODS.map((item) => (
              <button
                key={item}
                type="button"
                className={mood === item ? "selected" : ""}
                aria-pressed={mood === item}
                onClick={() => setMood(mood === item ? null : item)}
              >
                <span className="mood-mark" aria-hidden="true" />
                {item}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="choice-block" disabled={busy}>
          <legend>
            想让他 <span>按你的节奏</span>
          </legend>
          <div className="need-row">
            {NEEDS.map((item) => (
              <button
                key={item}
                type="button"
                className={need === item ? "selected" : ""}
                aria-pressed={need === item}
                onClick={() => setNeed(need === item ? null : item)}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>
        <button
          className="checkin-primary"
          type="button"
          disabled={busy}
          onClick={() => onConfirm(mood ?? "轻松", need ?? "听我说")}
        >
          {busy ? "等一下…" : editing ? "就这样陪我" : "和陆川聊聊"}
          <span aria-hidden="true">↗</span>
        </button>
        {returning && (
          <button
            className="checkin-secondary"
            type="button"
            disabled={busy}
            onClick={onContinue}
          >
            直接继续上次
          </button>
        )}
        {editing && (
          <button
            className="checkin-secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            先不改了
          </button>
        )}
        <small>18+ · 虚构 AI 角色 · 聊天记录保存在此设备</small>
      </div>
    </section>
  );
}
