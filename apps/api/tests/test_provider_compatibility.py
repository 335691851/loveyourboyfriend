from unittest.mock import Mock

from langchain_core.runnables import RunnableLambda

from app.ai.memory import build_memory_extractor
from app.config import Settings
from app.models import MemoryExtraction
from app.routes.voice import _openai


def test_voice_client_uses_configured_openai_compatible_endpoint() -> None:
    client = _openai(
        Settings(
            _env_file=None,
            openai_api_key="test-key",
            openai_base_url="https://api.siliconflow.cn/v1",
        )
    )

    assert str(client.base_url) == "https://api.siliconflow.cn/v1/"


def test_memory_extractor_requests_json_mode_for_compatible_provider() -> None:
    model = Mock()
    model.with_structured_output.return_value = RunnableLambda(
        lambda _: MemoryExtraction(memories=[])
    )

    build_memory_extractor(model=model)

    model.with_structured_output.assert_called_once_with(
        MemoryExtraction,
        method="json_mode",
    )
