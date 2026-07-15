from langchain_core.messages import AIMessage, HumanMessage

from app.ai.history import normalize_chat_history


def test_history_merges_consecutive_assistant_bubbles() -> None:
    history = normalize_chat_history(
        [
            {"role": "user", "content": "在吗"},
            {"role": "assistant", "content": "在。"},
            {"role": "assistant", "content": "还挺想你的。"},
        ]
    )

    assert isinstance(history[0], HumanMessage)
    assert isinstance(history[1], AIMessage)
    assert history[1].content == "在。\n还挺想你的。"


def test_history_drops_leading_assistant_and_ignores_empty_or_system_rows() -> None:
    history = normalize_chat_history(
        [
            {"role": "assistant", "content": "孤立回复"},
            {"role": "system", "content": "内部消息"},
            {"role": "user", "content": "  继续  "},
            {"role": "assistant", "content": ""},
        ]
    )

    assert len(history) == 1
    assert isinstance(history[0], HumanMessage)
    assert history[0].content == "继续"


def test_history_keeps_latest_bounded_messages_starting_with_user() -> None:
    rows = [
        {"role": "user" if index % 2 == 0 else "assistant", "content": str(index)}
        for index in range(12)
    ]

    history = normalize_chat_history(rows, max_messages=6)

    assert len(history) <= 6
    assert isinstance(history[0], HumanMessage)
    assert history[-1].content == "11"
