from hashlib import blake2b
from typing import Any

INTENT_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
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

REPLIES: dict[str, tuple[str, ...]] = {
    "consistency": (
        "我会跟着你当下这句话调整表达，但认真和分寸不该变。哪一次让你觉得差得最明显？",
        "表达可以有变化，性格和边界应该稳定。刚才哪一句让你觉得不像同一个人？",
        "你提醒得对，顺着情绪不等于变来变去。告诉我你更喜欢哪种说话方式，我会稳住它。",
    ),
    "repeat": (
        "你说得对，刚才那几句太像了，是我没接住你，不该拿同一句话敷衍。",
        "这次确实是我重复了。你不用配合我的话术，照你原本想说的继续，我认真接。",
        "被你发现了，刚才的回应确实重复，也没有跟着你走。我们从你这一句重新来。",
    ),
    "reset": (
        "好，从这一句重新开始。前面的节奏先放下，你现在最想说什么？",
        "可以，我们重来。刚才那些先不算，这次我跟着你的话走。",
        "那就清空刚才的节奏。现在这一刻，你想让我先听哪件事？",
    ),
    "presence": (
        "在，没走。你接着说，我这次认真听。",
        "我在这条对话里。刚才没接好，但你这一句我看见了。",
        "在呢。你不用重新组织，想到哪儿就从哪儿说。",
    ),
    "fatigue": (
        "听见了，是真的累，不是随口抱怨。先别逼自己振作，跟我缓一会儿。",
        "那就先歇一下，不急着把今天处理得很漂亮。你已经撑得够久了。",
        "先把肩膀松下来一点。今天最消耗你的，是事情太多，还是心里那股累？",
        "我不催你打起精神。你可以先安静待一会儿，我陪着。",
    ),
    "sadness": (
        "难过不用马上讲出道理。你先把最委屈的那一小段告诉我。",
        "这会儿不用装没事。我在听，你可以说得乱一点。",
        "先不劝你想开。发生了什么，让你心里一下沉下去了？",
    ),
    "anger": (
        "先别压着这口气。到底是哪一下最让你火大？",
        "听起来不是小题大做，是有人真的踩到你的边界了。",
        "可以生气，不用急着体面。你先把最想吐槽的那句说出来。",
    ),
    "food": (
        "先照顾胃。你现在想吃热乎的、清爽的，还是一点有满足感的？",
        "别让选择晚饭也变成任务。告诉我附近能点到什么，我陪你挑。",
        "饿的时候不做复杂决定：先选最想吃的那一口，其他的我帮你排除。",
    ),
    "insomnia": (
        "睡不着就先不和睡意较劲。脑子里是哪件事一直没肯停？",
        "那就陪你醒一会儿。灯可以暗一点，话不用说得完整。",
        "先别看时间，越算越清醒。你把现在最吵的那个念头交给我。",
    ),
    "positive": (
        "等等，这个我要认真听。先告诉我，哪一刻让你最想笑？",
        "好消息要慢一点讲，我想陪你把这份开心多留一会儿。",
        "这次不许轻描淡写。你做到了什么，让我也替你高兴一下。",
    ),
    "greeting": (
        "我在。今天想认真聊一会儿，还是随便说点轻松的？",
        "来得正好。你现在的心情，更像晴天还是快下雨？",
        "嗨，见到你了。今天先从哪件小事说起？",
    ),
    "generic": (
        "我在听。你更想让我陪你理一理，还是先站在你这边？",
        "这一句我接住了。别急着说完整，先讲你最在意的那部分。",
        "继续说，我想听的不是标准答案，是你现在真实的感觉。",
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


def _generic_context_replies(previous_user: str) -> tuple[str, ...]:
    snippet = previous_user.replace("\n", " ").strip()[:18]
    return (
        f"还接着你刚才那句“{snippet}”。你不用重讲，顺着现在这点感觉说就好。",
        f"我记得你刚才说“{snippet}”。这一句是在回应它，对吗？",
        f"刚才聊到“{snippet}”，我没忘。你现在最卡住的是哪一点？",
    )


def build_fallback_reply(user_text: str, history_rows: list[dict[str, Any]]) -> str:
    intent = _intent(user_text)
    previous_users = _history_content(history_rows, "user")
    recent_assistant = set(_history_content(history_rows, "assistant")[-3:])
    candidates = (
        _generic_context_replies(previous_users[-1])
        if intent == "generic" and previous_users
        else REPLIES[intent]
    )
    seed = f"{user_text}|{previous_users[-1:]!r}|{len(history_rows)}"
    digest = blake2b(seed.encode("utf-8"), digest_size=2).digest()
    start = int.from_bytes(digest, "big") % len(candidates)
    ordered = candidates[start:] + candidates[:start]
    return next((reply for reply in ordered if reply not in recent_assistant), ordered[0])
