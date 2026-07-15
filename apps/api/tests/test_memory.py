from app.ai.memory import deduplicate_memories
from app.models import MemoryCandidate


def test_deduplicate_memories_keeps_highest_confidence_normalized_content() -> None:
    memories = [
        MemoryCandidate(category="preference", content="喜欢 夜跑", confidence=0.7),
        MemoryCandidate(category="preference", content="喜欢夜跑", confidence=0.95),
        MemoryCandidate(category="routine", content="周五通常加班", confidence=0.8),
    ]

    result = deduplicate_memories(memories)

    assert len(result) == 2
    assert result[0].confidence == 0.95
    assert result[1].content == "周五通常加班"


def test_deduplicate_memories_drops_uncertain_inferences() -> None:
    memories = [
        MemoryCandidate(
            category="relationship",
            content="可能刚失恋",
            confidence=0.4,
            explicitly_stated=False,
        )
    ]

    assert deduplicate_memories(memories) == []
