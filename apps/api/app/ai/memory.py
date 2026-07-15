from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable

from app.ai.chains import build_memory_model
from app.ai.prompts import MEMORY_EXTRACTION_PROMPT
from app.config import Settings
from app.models import MemoryCandidate, MemoryExtraction


def _memory_key(memory: MemoryCandidate) -> tuple[str, str]:
    normalized = "".join(memory.content.split()).casefold()
    return memory.category, normalized


def deduplicate_memories(memories: list[MemoryCandidate]) -> list[MemoryCandidate]:
    deduplicated: dict[tuple[str, str], MemoryCandidate] = {}
    for memory in memories:
        if not memory.explicitly_stated and memory.confidence < 0.7:
            continue
        key = _memory_key(memory)
        current = deduplicated.get(key)
        if current is None or memory.confidence > current.confidence:
            deduplicated[key] = memory
    return list(deduplicated.values())


def build_memory_extractor(
    model: BaseChatModel | None = None,
    settings: Settings | None = None,
) -> Runnable:
    chat_model = model or build_memory_model(settings)
    structured_model = chat_model.with_structured_output(
        MemoryExtraction,
        method="json_mode",
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", MEMORY_EXTRACTION_PROMPT),
            (
                "human",
                "用户本轮消息：{user_text}\n\nAI 本轮回复：{assistant_text}",
            ),
        ]
    )
    return prompt | structured_model


async def extract_memories(
    user_text: str,
    assistant_text: str,
    model: BaseChatModel | None = None,
    settings: Settings | None = None,
) -> list[MemoryCandidate]:
    result = await build_memory_extractor(model, settings).ainvoke(
        {"user_text": user_text, "assistant_text": assistant_text}
    )
    extraction = (
        result if isinstance(result, MemoryExtraction) else MemoryExtraction.model_validate(result)
    )
    return deduplicate_memories(extraction.memories)
