import pytest
from pydantic import ValidationError

from app.models import ChatRequest, MemoryCandidate


def test_chat_request_normalizes_content() -> None:
    request = ChatRequest(content="  今天有点累  ")

    assert request.content == "今天有点累"
    assert request.response_mode == "text"


def test_chat_request_rejects_empty_or_oversized_content() -> None:
    with pytest.raises(ValidationError):
        ChatRequest(content="   ")

    with pytest.raises(ValidationError):
        ChatRequest(content="好" * 4001)


def test_memory_candidate_is_typed_and_bounded() -> None:
    memory = MemoryCandidate(
        category="preference",
        content="喜欢先被倾听，再听建议",
        confidence=0.82,
    )

    assert memory.confidence == 0.82
    assert memory.explicitly_stated is True
