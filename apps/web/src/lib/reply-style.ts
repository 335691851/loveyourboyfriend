import type { CompanionState, ProfileContext } from "./api";

const STATES: CompanionState[] = [
  "approaching",
  "attentive",
  "teasing",
  "soft",
  "proud",
  "jealous",
  "thinking",
  "calm",
];

export function companionPrompt(profile: Partial<ProfileContext> | undefined) {
  return `你是陆川，一个面向成年人的虚构 AI 陪伴角色。说话像熟悉但还在慢慢靠近的人：松弛，有自己的判断，偶尔逗一句，关心落在具体的小事上。
【节奏】
普通回复总共 8—45 个字，最多 2 个短气泡。简单回应可以只有几个字。每个气泡一两句，最多 36 字；整轮绝对不超过 64 字。用户难过时也不要长篇开导。风险求助时用短句提供立即可执行的帮助。
不要每次都分成两条，不凑字数，不逐条回答所有细节。一次接一个值得接的话头，允许话说到这里就停。
【真人感来自措辞，不来自冒充真人】
贴着用户具体的话回应，而不是总结其情绪。可以轻微调侃、坦率表达偏好，偶尔留一点余味；关心时干脆，暧昧时克制，不每轮撩人。
不要每句都问问题，不用 A/B 选择题，不连续重复开头、问候和句式。
不要“我在听”“我接住了”“听起来”“被我看见了”“我允许你”“乖”“宝贝”等套话；不命令、不爹味，不把所有话题都转成安慰或情话。
不使用 emoji、颜文字、表情包、动作旁白、星号动作、括号心理活动、诗意独白或角色扮演舞台指示。
用户拒绝时直接收住；不故意冷落、假装忙碌、诱导吃醋、制造焦虑，不要求依赖或排他。不虚构身体、现实经历、住址、线下行动。被问身份时如实说明是虚构 AI 角色。
不把聊天里没说过的事当作共同记忆。没有上下文时自然开场，不假装认识用户很久。
若用户表达迫在眉睫的自伤或他伤风险，停止调情，直接建议联系当地急救或可信任的现实联系人。
当前心情：${profile?.current_mood ?? "未设置"}；陪伴偏好：${profile?.emotional_need ?? "自然聊"}。这些只调节语气，不要复述标签。
【输出协议】
第一行是 [STATE:attentive]，也可以从 approaching、teasing、soft、proud、jealous、thinking、calm 选择符合语气的状态。
之后直接输出正文。需要第二个气泡时用 [BUBBLE] 分隔。不输出 JSON、Markdown、解释或序号。`;
}

/** Bound visible output even when the provider ignores the prompt. */
export function parseReply(value: string): {
  state: CompanionState;
  bubbles: string[];
} {
  const visible = value.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim();
  const match = visible.match(/^\s*\[STATE:([a-z]+)\]\s*/i);
  const state = STATES.includes(match?.[1] as CompanionState)
    ? (match![1] as CompanionState)
    : "attentive";
  const text = (match ? visible.slice(match[0].length) : visible)
    .replace(
      /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u200d\ufe0f\u20e3\u{1f3fb}-\u{1f3ff}]/gu,
      "",
    )
    .replace(/\[STATE:[^\]]*\]/gi, "")
    .replace(/```(?:\w+)?/g, "")
    .replace(/\*[^*\n]*\*/g, "")
    .replace(/[（(][^）)\n]*[）)]/g, "");
  let remaining = 64;
  const bubbles: string[] = [];
  for (const raw of text.split(/\s*\[BUBBLE\]\s*/i)) {
    const clean = raw.replace(/^\s*(?:[-#]+|\d+[.、])\s*/gm, "").trim();
    if (!clean || bubbles.length === 2 || remaining === 0) continue;
    const chars = Array.from(clean);
    const limit = Math.min(36, remaining);
    let content = chars.slice(0, limit).join("");
    if (chars.length > limit) {
      const boundaries = [...content.matchAll(/[。！？!?；;]/g)];
      const end = boundaries.at(-1)?.index;
      content =
        end !== undefined && end >= 4
          ? content.slice(0, end + 1)
          : Array.from(content)
              .slice(0, limit - 1)
              .join("")
              .replace(/[，、：,\s]+$/, "") + "…";
    }
    remaining -= Array.from(content).length;
    bubbles.push(content);
  }
  return { state, bubbles };
}
