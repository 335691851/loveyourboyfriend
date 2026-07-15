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

    assert chat_model.extra_body == {"enable_thinking": False}
    assert chat_model.max_tokens == 320
    assert memory_model.extra_body == {"enable_thinking": False}
    assert memory_model.max_tokens == 256
