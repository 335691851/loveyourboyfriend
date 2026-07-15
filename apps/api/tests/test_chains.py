import json

import httpx
import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.ai.chains import build_chat_chain, build_chat_model, build_memory_model
from app.config import Settings


def test_chat_chain_returns_plain_text() -> None:
    model = FakeListChatModel(responses=["先别急着坚强，和我说说发生了什么。"])
    chain = build_chat_chain(model)

    result = chain.invoke(
        {
            "history": [],
            "memories": "她喜欢先被倾听",
            "user_input": "今天很累",
        }
    )

    assert result == "先别急着坚强，和我说说发生了什么。"


def test_chat_model_uses_configured_openai_compatible_endpoint() -> None:
    model = build_chat_model(
        Settings(
            _env_file=None,
            openai_api_key="test-key",
            openai_base_url="https://api.siliconflow.cn/v1",
            chat_model="Qwen/Qwen3.5-35B-A3B",
        )
    )

    assert model.openai_api_base == "https://api.siliconflow.cn/v1"
    assert model.model_name == "Qwen/Qwen3.5-35B-A3B"


def test_siliconflow_models_disable_thinking_for_low_latency_output() -> None:
    settings = Settings(
        _env_file=None,
        openai_api_key="test-key",
        openai_base_url="https://api.siliconflow.cn/v1",
        chat_model="Qwen/Qwen3.5-35B-A3B",
        memory_model="Qwen/Qwen3.5-9B",
    )

    chat_model = build_chat_model(settings)
    memory_model = build_memory_model(settings)

    assert chat_model.extra_body == {"enable_thinking": False, "max_tokens": 320}
    assert chat_model.max_tokens is None
    assert chat_model.stream_chunk_timeout == 8
    assert chat_model.max_retries == 0
    assert memory_model.extra_body == {"enable_thinking": False, "max_tokens": 256}
    assert memory_model.max_tokens is None


@pytest.mark.asyncio
async def test_chat_model_sends_siliconflow_compatible_token_field() -> None:
    captured: dict = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        stream = (
            'data: {"id":"test","object":"chat.completion.chunk",'
            '"created":1,"model":"Qwen/Qwen3.5-35B-A3B",'
            '"choices":[{"index":0,"delta":{"content":"好"},'
            '"finish_reason":null}]}\n\n'
            "data: [DONE]\n\n"
        )
        return httpx.Response(
            200,
            text=stream,
            headers={"content-type": "text/event-stream"},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        model = build_chat_model(
            Settings(
                _env_file=None,
                openai_api_key="test-key",
                openai_base_url="https://api.siliconflow.cn/v1",
                chat_model="Qwen/Qwen3.5-35B-A3B",
            ),
            http_async_client=client,
        )
        chunks = [chunk async for chunk in model.astream("今天有点累")]

    assert "".join(str(chunk.content) for chunk in chunks) == "好"
    assert captured["max_tokens"] == 320
    assert captured["enable_thinking"] is False
    assert "max_completion_tokens" not in captured


@pytest.mark.asyncio
async def test_chat_chain_sends_only_one_leading_system_message() -> None:
    captured: dict = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        stream = (
            'data: {"id":"test","object":"chat.completion.chunk",'
            '"created":1,"model":"Qwen/Qwen3.5-35B-A3B",'
            '"choices":[{"index":0,"delta":{"content":"收到"},'
            '"finish_reason":null}]}\n\n'
            "data: [DONE]\n\n"
        )
        return httpx.Response(
            200,
            text=stream,
            headers={"content-type": "text/event-stream"},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        settings = Settings(
            _env_file=None,
            openai_api_key="test-key",
            openai_base_url="https://api.siliconflow.cn/v1",
            chat_model="Qwen/Qwen3.5-35B-A3B",
        )
        chain = build_chat_chain(model=build_chat_model(settings, http_async_client=client))
        chunks = [
            chunk
            async for chunk in chain.astream(
                {"history": [], "memories": "喜欢夜跑", "user_input": "晚上好"}
            )
        ]

    assert "".join(chunks) == "收到"
    assert [message["role"] for message in captured["messages"]] == [
        "system",
        "user",
    ]
    assert "喜欢夜跑" in captured["messages"][0]["content"]
