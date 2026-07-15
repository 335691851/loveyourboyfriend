from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage


def normalize_chat_history(
    rows: list[dict[str, Any]],
    *,
    max_messages: int = 6,
) -> list[BaseMessage]:
    merged: list[tuple[str, str]] = []
    for row in rows:
        role = row.get("role")
        content = str(row.get("content", "")).strip()
        if role not in {"user", "assistant"} or not content:
            continue
        if merged and merged[-1][0] == role:
            merged[-1] = (role, f"{merged[-1][1]}\n{content}")
        else:
            merged.append((role, content))

    bounded = merged[-max_messages:]
    while bounded and bounded[0][0] != "user":
        bounded.pop(0)

    return [
        HumanMessage(content=content) if role == "user" else AIMessage(content=content)
        for role, content in bounded
    ]
