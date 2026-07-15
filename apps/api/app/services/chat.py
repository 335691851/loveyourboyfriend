import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import Runnable

from app.models import AuthenticatedUser, ChatRequest, MemoryExtraction
from app.repositories.chat import ChatRepository

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(
        self,
        repository: ChatRepository,
        chain: Runnable,
        memory_extractor: Runnable | None,
    ) -> None:
        self.repository = repository
        self.chain = chain
        self.memory_extractor = memory_extractor

    @staticmethod
    def _event(event_type: str, **payload: Any) -> str:
        return json.dumps({"type": event_type, **payload}, ensure_ascii=False) + "\n"

    async def _save_memory(
        self,
        user_text: str,
        assistant_text: str,
        source_message_id: str,
    ) -> None:
        if self.memory_extractor is None:
            return
        try:
            result = await self.memory_extractor.ainvoke(
                {"user_text": user_text, "assistant_text": assistant_text}
            )
            extraction = (
                result
                if isinstance(result, MemoryExtraction)
                else MemoryExtraction.model_validate(result)
            )
            await self.repository.save_memories(extraction.memories, source_message_id)
        except Exception:
            logger.exception("Memory enrichment failed")

    async def stream(
        self,
        user: AuthenticatedUser,
        request: ChatRequest,
    ) -> AsyncIterator[str]:
        await self.repository.ensure_profile()
        if request.conversation_id:
            conversation_id = request.conversation_id
        else:
            conversation = await self.repository.create_conversation()
            conversation_id = UUID(conversation["id"])

        history_rows = await self.repository.list_messages(conversation_id)
        memories = await self.repository.list_memories()
        user_message = await self.repository.create_message(
            conversation_id=conversation_id,
            role="user",
            content=request.content,
            message_type=request.input_mode,
            audio_path=request.audio_path,
            duration_ms=request.duration_ms,
        )

        history = [
            HumanMessage(content=row["content"])
            if row["role"] == "user"
            else AIMessage(content=row["content"])
            for row in history_rows
            if row["role"] in {"user", "assistant"} and row.get("content")
        ]
        memory_text = "\n".join(f"- {row['content']}" for row in memories) or "暂无"

        yield self._event("start", conversation_id=str(conversation_id))
        chunks: list[str] = []
        async for chunk in self.chain.astream(
            {
                "history": history,
                "memories": memory_text,
                "user_input": request.content,
            }
        ):
            if chunk:
                chunks.append(chunk)
                yield self._event("delta", content=chunk)

        assistant_text = "".join(chunks).strip()
        assistant_message = await self.repository.create_message(
            conversation_id=conversation_id,
            role="assistant",
            content=assistant_text,
            message_type=request.response_mode,
        )
        await self.repository.touch_conversation(conversation_id)
        yield self._event(
            "message",
            id=assistant_message["id"],
            conversation_id=str(conversation_id),
            content=assistant_text,
            message_type=request.response_mode,
        )
        if self.memory_extractor is not None:
            await self._save_memory(request.content, assistant_text, user_message["id"])
        yield self._event("done")
