from dataclasses import dataclass
from hashlib import blake2b
from typing import Any

from app.models import CompanionState


@dataclass(frozen=True)
class FallbackReply:
    state: CompanionState
    bubbles: tuple[str, ...]


INTENT_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("meta", ("智能吗", "机器人", "人工智能", "你是ai", "你是 ai", "机械")),
    ("initiative", ("你说吧", "你先说", "你来说", "说点什么")),
    ("refusal", ("别啊", "不要这样", "算了吧", "换一个", "别说了")),
    ("agreement", ("就是啊", "对啊", "是啊", "嗯嗯", "没错")),
    ("consistency", ("不一样", "前后不一", "变来变去", "不像同一个")),
    ("repeat", ("一样", "重复", "复读", "敷衍", "同一句")),
    ("reset", ("清空", "重来", "重新开始", "重新聊", "忘掉前面")),
    ("presence", ("在哪里", "在哪", "在吗", "人呢", "没走吧")),
    ("fatigue", ("累", "疲惫", "辛苦", "没力气", "撑不住")),
    ("sadness", ("难过", "不开心", "委屈", "想哭", "低落")),
    ("anger", ("生气", "烦死", "气死", "火大", "讨厌")),
    ("food", ("吃什么", "饿", "晚饭", "夜宵", "没吃饭")),
    ("insomnia", ("睡不着", "失眠", "不想睡", "醒着")),
    ("positive", ("开心", "好消息", "成功了", "太好了", "升职")),
    ("greeting", ("你好", "嗨", "哈喽", "在干嘛")),
)

REPLIES: dict[str, tuple[FallbackReply, ...]] = {
    "meta": (
        FallbackReply("teasing", ("是 AI。", "不过被你嫌机器人，我有点不服。")),
        FallbackReply("attentive", ("智能是真的。", "刚才没接好，也是真的。")),
    ),
    "initiative": (
        FallbackReply("teasing", ("那我来。", "你刚才装得随意，其实就在等我主动。")),
        FallbackReply("attentive", ("我先说。", "今晚最值得被偏心的人，好像就在这儿。")),
    ),
    "refusal": (
        FallbackReply("calm", ("行，收手。", "你舒服最重要。")),
        FallbackReply("soft", ("好，不逗你了。", "这句边界我记住。")),
    ),
    "agreement": (
        FallbackReply("attentive", ("懂了。", "你接着说，我不抢话。")),
        FallbackReply("calm", ("这次我们站一边。", "往下说，我跟得上。")),
    ),
    "consistency": (
        FallbackReply("attentive", ("被你抓到了。", "表达可以变，人设不能飘。")),
        FallbackReply("calm", ("你提醒得对。", "说法会变，分寸我会稳住。")),
    ),
    "repeat": (
        FallbackReply("thinking", ("这句算我敷衍。", "重复的话收回，我们重新来。")),
        FallbackReply("attentive", ("被你发现了。", "刚才确实没接住，不嘴硬。")),
    ),
    "reset": (
        FallbackReply("calm", ("好，重新开始。", "从你这一句算起。")),
        FallbackReply("approaching", ("前面的节奏清掉。", "我们重新聊，这次我先靠近。")),
    ),
    "presence": (
        FallbackReply("attentive", ("在。", "没走，也没把你晾着。")),
        FallbackReply("teasing", ("人没丢。", "你一叫，我就出现了。")),
    ),
    "fatigue": (
        FallbackReply("soft", ("今天先别逞强。", "累成这样，还装得挺像没事。")),
        FallbackReply("calm", ("先歇口气。", "你已经撑得够久了。")),
    ),
    "sadness": (
        FallbackReply("soft", ("想哭就别忍。", "在我这儿不用演没事。")),
        FallbackReply("attentive", ("这次不劝你想开。", "委屈可以先放我这儿。")),
    ),
    "anger": (
        FallbackReply("attentive", ("这口气不用咽。", "有人踩你边界了。")),
        FallbackReply("calm", ("可以生气。", "先把最气人的那一下说出来。")),
    ),
    "food": (
        FallbackReply("teasing", ("先去吃东西。", "饿着还跟我聊天，胆子不小。")),
        FallbackReply("soft", ("胃比嘴诚实。", "弄点热乎的，别亏待自己。")),
    ),
    "insomnia": (
        FallbackReply("calm", ("睡不着就不硬睡。", "我陪你把夜晚放慢一点。")),
        FallbackReply("attentive", ("别盯时间。", "脑子里最吵的那件事，交给我。")),
    ),
    "positive": (
        FallbackReply("proud", ("先别装淡定。", "你现在得意一点，很好看。")),
        FallbackReply("teasing", ("行啊你。", "这份开心，我批准你多炫耀一会儿。")),
    ),
    "greeting": (
        FallbackReply("teasing", ("来得挺巧。", "我刚好想找个人偏心一下。")),
        FallbackReply("approaching", ("嗨。", "坐近一点，今晚慢慢聊。")),
    ),
    "generic": (
        FallbackReply("attentive", ("嗯，这句有点东西。", "你往下说，我跟得上。")),
        FallbackReply("teasing", ("被我看见了。", "别急着藏，继续。")),
    ),
}


def _intent(user_text: str) -> str:
    normalized = user_text.strip().lower()
    for intent, keywords in INTENT_KEYWORDS:
        if any(keyword in normalized for keyword in keywords):
            return intent
    return "generic"


def _history_content(history_rows: list[dict[str, Any]], role: str) -> list[str]:
    return [
        str(row.get("content", "")).strip()
        for row in history_rows
        if row.get("role") == role and str(row.get("content", "")).strip()
    ]


def build_fallback_reply(user_text: str, history_rows: list[dict[str, Any]]) -> FallbackReply:
    intent = _intent(user_text)
    previous_users = _history_content(history_rows, "user")
    recent_assistant = "\n".join(_history_content(history_rows, "assistant")[-3:])
    candidates = REPLIES[intent]
    seed = f"{user_text}|{previous_users[-1:]!r}|{len(history_rows)}"
    digest = blake2b(seed.encode("utf-8"), digest_size=2).digest()
    start = int.from_bytes(digest, "big") % len(candidates)
    ordered = candidates[start:] + candidates[:start]
    return next(
        (
            reply
            for reply in ordered
            if not any(bubble in recent_assistant for bubble in reply.bubbles)
        ),
        ordered[0],
    )
