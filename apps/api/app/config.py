from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

CANONICAL_WEB_ORIGINS = ("https://loveyourboyfriend.daidai634.com",)
DEFAULT_SILICONFLOW_CHAT_MODEL = "Qwen/Qwen3.5-35B-A3B"
DEFAULT_SILICONFLOW_MEMORY_MODEL = "Qwen/Qwen3.5-9B"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    render_git_commit: str = "local"
    allowed_origins: str = "http://localhost:3000"

    openai_api_key: str | None = None
    openai_base_url: str = "https://api.siliconflow.cn/v1"
    chat_model: str = DEFAULT_SILICONFLOW_CHAT_MODEL
    memory_model: str = DEFAULT_SILICONFLOW_MEMORY_MODEL
    # Default to a faster transcription model; can be overridden via environment.
    transcription_model: str = "FunAudioLLM/SenseVoiceFast"
    speech_model: str = "FunAudioLLM/CosyVoice2-0.5B"
    speech_voice: str = "FunAudioLLM/CosyVoice2-0.5B:david"
    max_audio_bytes: int = 10_000_000

    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_secret_key: str | None = None
    database_url: str | None = None

    data_retention_days: int = 90

    @property
    def cors_origins(self) -> list[str]:
        configured = [
            origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()
        ]
        return list(dict.fromkeys([*configured, *CANONICAL_WEB_ORIGINS]))

    @property
    def is_siliconflow(self) -> bool:
        return urlparse(self.openai_base_url).hostname == "api.siliconflow.cn"

    def _effective_model(self, configured: str, siliconflow_default: str) -> str:
        if self.is_siliconflow and "/" not in configured:
            return siliconflow_default
        return configured

    @property
    def effective_chat_model(self) -> str:
        return self._effective_model(self.chat_model, DEFAULT_SILICONFLOW_CHAT_MODEL)

    @property
    def effective_memory_model(self) -> str:
        return self._effective_model(self.memory_model, DEFAULT_SILICONFLOW_MEMORY_MODEL)


@lru_cache
def get_settings() -> Settings:
    return Settings()
