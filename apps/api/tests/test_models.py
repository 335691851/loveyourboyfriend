import pytest
from pydantic import ValidationError

from app.models import (
    ChatRequest,
    MemoryCandidate,
    OpeningRequest,
    ProfileContext,
    ProfileContextUpdate,
)


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


def test_profile_context_accepts_supported_values() -> None:
    context = ProfileContext(
        current_mood="心动",
        emotional_need="暧昧一点",
        mood_updated_at="2026-07-15T19:00:00Z",
    )

    assert context.current_mood == "心动"
    assert context.emotional_need == "暧昧一点"


def test_profile_context_update_rejects_unknown_values() -> None:
    with pytest.raises(ValidationError):
        ProfileContextUpdate(current_mood="无聊", emotional_need="控制我")


def test_opening_request_allows_a_new_or_existing_conversation() -> None:
    assert OpeningRequest().conversation_id is None
