from app.ai.fallback import build_fallback_reply


def test_fallback_answers_presence_without_claiming_a_physical_location() -> None:
    reply = build_fallback_reply("你在哪里呀", [])

    assert "在" in reply
    assert all(word not in reply for word in ("家里", "公司", "楼下", "路上"))


def test_fallback_recognizes_reset_and_repetition_complaints() -> None:
    reset_reply = build_fallback_reply("清空，我们重新聊", [])
    repeated_reply = build_fallback_reply("你怎么每次都说一样的话", [])

    assert any(word in reset_reply for word in ("重新", "从这一句", "重新开始"))
    assert any(word in repeated_reply for word in ("重复", "敷衍", "没接住"))


def test_fallback_distinguishes_inconsistency_from_repetition() -> None:
    reply = build_fallback_reply("你怎么每次说得都不一样", [])

    assert any(word in reply for word in ("表达", "跟着", "变"))
    assert "重复" not in reply


def test_fallback_avoids_recent_assistant_reply_for_same_intent() -> None:
    first = build_fallback_reply("今天真的很累", [])
    history = [
        {"role": "user", "content": "今天真的很累"},
        {"role": "assistant", "content": first},
    ]

    second = build_fallback_reply("还是觉得很累", history)

    assert second != first
    assert any(word in second for word in ("累", "歇", "撑", "缓"))


def test_generic_fallback_continues_the_previous_user_topic() -> None:
    history = [
        {"role": "user", "content": "最近一直加班到很晚"},
        {"role": "assistant", "content": "听起来这段时间挺辛苦。"},
    ]

    reply = build_fallback_reply("就是啊", history)

    assert "加班" in reply
    assert "刚才" in reply
