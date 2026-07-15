"use client";

import { useState } from "react";

import type { EntryMode } from "@/hooks/use-chat";
import type { EmotionalNeed, Mood, ProfileContext } from "@/lib/api";

const MOODS: Array<{ value: Mood; emoji: string }> = [
  { value: "轻松", emoji: "☁️" },
  { value: "开心", emoji: "✨" },
  { value: "疲惫", emoji: "🌙" },
  { value: "委屈", emoji: "🥺" },
  { value: "心烦", emoji: "🌧️" },
  { value: "心动", emoji: "💗" },
];

const NEEDS: EmotionalNeed[] = [
  "听我说",
  "哄哄我",
  "逗我开心",
  "陪我吐槽",
  "暧昧一点",
];

type EmotionCheckinProps = {
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
}: EmotionCheckinProps) {
  const [mood, setMood] = useState<Mood | null>(profile?.current_mood ?? null);
  const [need, setNeed] = useState<EmotionalNeed | null>(
    profile?.emotional_need ?? null,
  );
  const returning = mode === "returning";
  const editing = mode === "checkin";

  return (
    <section className="checkin-card" aria-label="此刻的情绪与陪伴需求">
      <div className="checkin-orbit" aria-hidden="true">
        <span>川</span>
        <i>{mood ? MOODS.find((item) => item.value === mood)?.emoji : "✦"}</i>
      </div>
      <span className="eyebrow">JUST FOR THIS MOMENT</span>
      <h1>
        {returning ? "你回来了。先让我看看你。" : "现在的你，是什么天气？"}
      </h1>
      <p>
        {returning
          ? "不必从头解释。告诉我此刻的感觉，我会换一种方式靠近。"
          : "不用组织好语言。给我两个信号，剩下的开场交给陆川。"}
      </p>

      <div className="choice-block">
        <span>此刻心情</span>
        <div className="mood-grid">
          {MOODS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={mood === item.value ? "selected" : ""}
              aria-pressed={mood === item.value}
              onClick={() => setMood(item.value)}
            >
              <i aria-hidden="true">{item.emoji}</i>
              {item.value}
            </button>
          ))}
        </div>
      </div>

      <div className="choice-block">
        <span>今晚希望他</span>
        <div className="need-row">
          {NEEDS.map((item) => (
            <button
              key={item}
              type="button"
              className={need === item ? "selected" : ""}
              aria-pressed={need === item}
              onClick={() => setNeed(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <button
        className="checkin-primary"
        type="button"
        disabled={!mood || !need || busy}
        onClick={() => mood && need && onConfirm(mood, need)}
      >
        {busy ? "正在让他靠近…" : "让陆川来找我"}
        <span aria-hidden="true">↗</span>
      </button>
      {returning && (
        <button
          className="checkin-secondary"
          type="button"
          onClick={onContinue}
        >
          直接继续上次
        </button>
      )}
      {editing && (
        <button className="checkin-secondary" type="button" onClick={onClose}>
          保持现在的状态
        </button>
      )}
      <small>状态只影响当下的语气，随时可以重新选择</small>
    </section>
  );
}
