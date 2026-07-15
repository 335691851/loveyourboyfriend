import json
import logging
from uuid import UUID

import pytest
from langchain_core.messages import AIMessage

from app.models import AuthenticatedUser, ChatRequest
from app.services.chat import ChatService


class FakeRepository:
    def __init__(self) -> None:
        self.saved: list[dict] = []
        self.message_limit: int | None = None

    async def ensure_profile(self) -> None:
        return None

    async def create_conversation(self) -> dict:
        return {"id": "637f90fc-9d85-4fee-aaeb-4c676aa5df14"}

    async def list_messages(self, conversation_id: UUID, limit: int = 30) -> list[dict]:
        self.message_limit = limit
        return [
            {"role": "user", "content": "我喜欢夜跑"},
            {"role": "assistant", "content": "听起来很解压。"},
        ]

    async def list_memories(self) -> list[dict]:
        return [{"category": "preference", "content": "喜欢夜跑"}]

    async def create_message(self, **message: object) -> dict:
        self.saved.append(message)
        return {"id": f"message-{len(self.saved)}", **message}

    async def touch_conversation(self, conversation_id: UUID) -> None:
        return None

    async def save_memories(self, memories: list, source_message_id: str) -> None:
        return None


class FakeChain:
    def __init__(self) -> None:
        self.input: dict | None = None

    async def astream(self, input_: dict):
        self.input = input_
        for token in ("今晚", "想聊什么？"):
            yield token


class UnavailableChain:
    async def astream(self, input_: dict):
        if False:
            yield ""
        raise TimeoutError("provider did not produce a stream chunk")


class ProviderBadRequestChain:
    async def astream(self, input_: dict):
        if False:
            yield ""
        error = RuntimeError("raw exception text must not be logged")
        error.status_code = 400
        error.request_id = "request-123"
        error.body = {
            "code": "invalid_model",
            "message": "The configured model is unavailable",
            "type": "invalid_request_error",
            "ignored": "sensitive provider detail",
        }
        raise error


class FakeMemoryExtractor:
    def __init__(self) -> None:
        self.calls = 0

    async def ainvoke(self, input_: dict):
        self.calls += 1
        return {"memories": []}


@pytest.mark.asyncio
async def test_chat_service_streams_and_persists_both_messages() -> None:
    repository = FakeRepository()
    chain = FakeChain()
    service = ChatService(repository=repository, chain=chain, memory_extractor=None)
    user = AuthenticatedUser(
        id="20419c0a-140c-4b21-a633-a90285432d02",
        access_token="token",
    )

    lines = [line async for line in service.stream(user, ChatRequest(content="陪我聊会儿"))]
    events = [json.loads(line) for line in lines]

    assert [event["type"] for event in events] == ["start", "delta", "delta", "message", "done"]
    assert events[3]["content"] == "今晚想聊什么？"
    assert repository.saved[0]["role"] == "user"
    assert repository.saved[1]["role"] == "assistant"
    assert repository.message_limit == 7
    assert isinstance(chain.input["history"][-1], AIMessage)
    assert "喜欢夜跑" in chain.input["memories"]


@pytest.mark.asyncio
async def test_chat_service_persists_a_friendly_fallback_when_provider_fails() -> None:
    repository = FakeRepository()
    memory_extractor = FakeMemoryExtractor()
    service = ChatService(
        repository=repository,
        chain=UnavailableChain(),
        memory_extractor=memory_extractor,
    )
    user = AuthenticatedUser(
        id="20419c0a-140c-4b21-a633-a90285432d02",
        access_token="token",
    )

    lines = [
        line
        async for line in service.stream(
            user,
            ChatRequest(content="今天真的有点累"),
        )
    ]
    events = [json.loads(line) for line in lines]

    assert [event["type"] for event in events] == [
        "start",
        "delta",
        "message",
        "done",
    ]
    assert "累" in events[1]["content"]
    assert repository.saved[-1]["role"] == "assistant"
    assert repository.saved[-1]["content"] == events[1]["content"]
    assert memory_extractor.calls == 0


@pytest.mark.asyncio
async def test_chat_service_logs_safe_provider_error_details(
    caplog: pytest.LogCaptureFixture,
) -> None:
    repository = FakeRepository()
    service = ChatService(
        repository=repository,
        chain=ProviderBadRequestChain(),
        memory_extractor=None,
    )
    user = AuthenticatedUser(
        id="20419c0a-140c-4b21-a633-a90285432d02",
        access_token="token",
    )

    with caplog.at_level(logging.WARNING, logger="app.services.chat"):
        _ = [
            line
            async for line in service.stream(
                user,
                ChatRequest(content="今天想聊聊"),
            )
        ]

    message = caplog.messages[-1]
    assert "status=400" in message
    assert "code=invalid_model" in message
    assert "message=The configured model is unavailable" in message
    assert "request_id=request-123" in message
    assert "raw exception text" not in message
    assert "sensitive provider detail" not in message
