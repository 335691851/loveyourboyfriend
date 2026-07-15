from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

CANONICAL_WEB_ORIGINS = ("https://loveyourboyfriend.daidai634.com",)


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
    chat_model: str = "Qwen/Qwen3.5-35B-A3B"
    memory_model: str = "Qwen/Qwen3.5-9B"
    transcription_model: str = "FunAudioLLM/SenseVoiceSmall"
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
