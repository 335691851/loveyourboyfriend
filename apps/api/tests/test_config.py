from app.config import Settings


def test_settings_have_safe_non_secret_defaults() -> None:
    settings = Settings(_env_file=None)

    assert settings.environment == "development"
    assert settings.chat_model == "gpt-5.6-terra"
    assert settings.voice_model == "gpt-realtime-2.1-mini"
    assert settings.data_retention_days == 90
    assert settings.openai_api_key is None
    assert settings.supabase_secret_key is None
