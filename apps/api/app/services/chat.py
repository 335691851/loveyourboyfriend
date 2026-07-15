import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from langchain_core.runnables import Runnable

from app.ai.fallback import FallbackReply, build_fallback_reply
from app.ai.history import normalize_chat_history
from app.ai.segmentation import ReplySegmenter, SegmentEvent
from app.models import (
    AuthenticatedUser,
    ChatRequest,
    CompanionState,
    MemoryExtraction,
    OpeningRequest,
)
from app.repositories.chat import ChatRepository

logger = logging.getLogger(__name__)

COMPANION_STATE_META: dict[CompanionState, tuple[str, str]] = {
    "approaching": ("🌙", "正在靠近"),
    "attentive": ("👀", "有在认真看你"),
    "teasing": ("😏", "想逗你一下"),
    "soft": ("🤍", "有点心软了"),
    "proud": ("✨", "替你得意"),
    "jealous": ("🙄", "假装没吃醋"),
    "thinking": ("💭", "在想怎么接你"),
    "calm": ("🙂", "陪你待一会儿"),
}


def _safe_provider_error_field(value: Any, *, limit: int = 300) -> str:
    if value is None:
        return "unknown"
    return " ".join(str(value).split())[:limit] or "unknown"


def _provider_error_details(error: Exception) -> tuple[str, str, str, str]:
    body = getattr(error, "body", None)
    safe_body = body if isinstance(body, dict) else {}
    return (
        _safe_provider_error_field(getattr(error, "status_code", None)),
        _safe_provider_error_field(safe_body.get("code")),
        _safe_provider_error_field(safe_body.get("message")),
        _safe_provider_error_field(getattr(error, "request_id", None)),
    )


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

    @classmethod
    def _state_event(cls, state: CompanionState) -> str:
        emoji, label = COMPANION_STATE_META[state]
        return cls._event(
            "companion_state",
            state=state,
            emoji=emoji,
            label=label,
        )

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

    async def _persist_bubble(
        self,
        *,
        conversation_id: UUID,
        index: int,
        content: str,
        response_mode: str,
        companion_state: CompanionState | None,
    ) -> str:
        message = await self.repository.create_message(
            conversation_id=conversation_id,
            role="assistant",
            content=content,
            message_type=response_mode,
            companion_state=companion_state,
        )
        return self._event(
            "message",
            index=index,
            id=message["id"],
            conversation_id=str(conversation_id),
            content=content,
            message_type=response_mode,
            companion_state=companion_state,
        )

    async def _emit_fallback(
        self,
        *,
        fallback: FallbackReply,
        conversation_id: UUID,
        response_mode: str,
    ) -> AsyncIterator[str]:
        yield self._state_event(fallback.state)
        last_index = len(fallback.bubbles) - 1
        for index, bubble in enumerate(fallback.bubbles):
            bubble_mode = response_mode if index == last_index else "text"
            yield self._event("bubble_start", index=index)
            yield self._event("delta", index=index, content=bubble)
            yield await self._persist_bubble(
                conversation_id=conversation_id,
                index=index,
                content=bubble,
                response_mode=bubble_mode,
                companion_state=fallback.state if index == last_index else None,
            )

    async def _stream_assistant(
        self,
        *,
        conversation_id: UUID,
        history_rows: list[dict[str, Any]],
        memories: list[dict[str, Any]],
        profile: dict[str, Any],
        user_input: str,
        response_mode: str,
    ) -> AsyncIterator[str]:
        parser = ReplySegmenter()
        pending: SegmentEvent | None = None
        saw_text = False
        provider_failed = False
        history = normalize_chat_history(history_rows, max_messages=6)
        memory_text = "\n".join(f"- {row['content']}" for row in memories) or "暂无"

        try:
            async for chunk in self.chain.astream(
                {
                    "history": history,
                    "memories": memory_text,
                    "user_input": user_input,
                    "current_mood": profile.get("current_mood") or "未设置",
                    "emotional_need": profile.get("emotional_need") or "自然陪伴",
                }
            ):
                for event in parser.feed(chunk):
                    if event.kind == "state" and event.state:
                        yield self._state_event(event.state)
                    elif event.kind == "start" and event.index is not None:
                        if pending is not None:
                            yield await self._persist_bubble(
                                conversation_id=conversation_id,
                                index=pending.index or 0,
                                content=pending.content,
                                response_mode="text",
                                companion_state=None,
                            )
                            pending = None
                        yield self._event("bubble_start", index=event.index)
                    elif event.kind == "delta" and event.index is not None:
                        saw_text = saw_text or bool(event.content.strip())
                        yield self._event(
                            "delta",
                            index=event.index,
                            content=event.content,
                        )
                    elif event.kind == "complete":
                        pending = event
        except Exception as error:
            provider_failed = True
            status_code, error_code, error_message, request_id = _provider_error_details(error)
            logger.warning(
                "Chat provider failed; serving local fallback "
                "(type=%s status=%s code=%s message=%s request_id=%s)",
                type(error).__name__,
                status_code,
                error_code,
                error_message,
                request_id,
            )

        if saw_text:
            for event in parser.finish():
                if event.kind == "state" and event.state:
                    yield self._state_event(event.state)
                elif event.kind == "start" and event.index is not None:
                    if pending is not None:
                        yield await self._persist_bubble(
                            conversation_id=conversation_id,
                            index=pending.index or 0,
                            content=pending.content,
                            response_mode="text",
                            companion_state=None,
                        )
                        pending = None
                    yield self._event("bubble_start", index=event.index)
                elif event.kind == "delta" and event.index is not None:
                    yield self._event("delta", index=event.index, content=event.content)
                elif event.kind == "complete":
                    pending = event

            if pending is not None:
                yield await self._persist_bubble(
                    conversation_id=conversation_id,
                    index=pending.index or 0,
                    content=pending.content,
                    response_mode=response_mode,
                    companion_state=parser.state,
                )
        else:
            fallback = build_fallback_reply(user_input, history_rows)
            async for line in self._emit_fallback(
                fallback=fallback,
                conversation_id=conversation_id,
                response_mode=response_mode,
            ):
                yield line

        self._provider_failed = provider_failed

    async def stream(
        self,
        user: AuthenticatedUser,
        request: ChatRequest,
    ) -> AsyncIterator[str]:
        del user
        await self.repository.ensure_profile()
        if request.conversation_id:
            conversation_id = request.conversation_id
        else:
            conversation = await self.repository.create_conversation()
            conversation_id = UUID(conversation["id"])

        history_rows = await self.repository.list_messages(conversation_id, limit=20)
        memories = await self.repository.list_memories()
        profile = await self.repository.get_profile_context()
        user_message = await self.repository.create_message(
            conversation_id=conversation_id,
            role="user",
            content=request.content,
            message_type=request.input_mode,
            audio_path=request.audio_path,
            duration_ms=request.duration_ms,
        )

        yield self._event("start", conversation_id=str(conversation_id))
        self._provider_failed = False
        assistant_bubbles: list[str] = []
        async for line in self._stream_assistant(
            conversation_id=conversation_id,
            history_rows=history_rows,
            memories=memories,
            profile=profile,
            user_input=request.content,
            response_mode=request.response_mode,
        ):
            event = json.loads(line)
            if event["type"] == "message":
                assistant_bubbles.append(event["content"])
            yield line

        await self.repository.touch_conversation(conversation_id)
        if self.memory_extractor is not None and not self._provider_failed:
            await self._save_memory(
                request.content,
                "\n".join(assistant_bubbles),
                user_message["id"],
            )
        yield self._event("done")

    async def stream_opening(
        self,
        user: AuthenticatedUser,
        request: OpeningRequest,
    ) -> AsyncIterator[str]:
        del user
        await self.repository.ensure_profile()
        if request.conversation_id:
            conversation_id = request.conversation_id
        else:
            conversation = await self.repository.create_conversation()
            conversation_id = UUID(conversation["id"])

        history_rows = await self.repository.list_messages(conversation_id, limit=20)
        memories = await self.repository.list_memories()
        profile = await self.repository.get_profile_context()
        opening_instruction = (
            "根据用户当前情绪与需求主动发起一段自然对话。不要提及这些标签，"
            "不要说欢迎语，不要要求用户选话题，直接用具体、有吸引力的一句话靠近她。"
        )

        yield self._event("start", conversation_id=str(conversation_id))
        async for line in self._stream_assistant(
            conversation_id=conversation_id,
            history_rows=history_rows,
            memories=memories,
            profile=profile,
            user_input=opening_instruction,
            response_mode="text",
        ):
            yield line
        await self.repository.touch_conversation(conversation_id)
        yield self._event("done")
