from app.config import Settings


def test_settings_have_safe_non_secret_defaults() -> None:
    settings = Settings(_env_file=None)

    assert settings.environment == "development"
    assert settings.openai_base_url == "https://api.siliconflow.cn/v1"
    assert settings.chat_model == "Qwen/Qwen3.5-35B-A3B"
    assert settings.memory_model == "Qwen/Qwen3.5-9B"
    assert settings.transcription_model == "FunAudioLLM/SenseVoiceSmall"
    assert settings.speech_model == "FunAudioLLM/CosyVoice2-0.5B"
    assert settings.speech_voice == "FunAudioLLM/CosyVoice2-0.5B:david"
    assert settings.data_retention_days == 90
    assert settings.openai_api_key is None
    assert settings.supabase_secret_key is None
