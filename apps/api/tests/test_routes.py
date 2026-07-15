from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.dependencies import get_current_user
from app.main import app
from app.models import AuthenticatedUser


def test_chat_stream_requires_anonymous_session(client: TestClient) -> None:
    response = client.post("/v1/chat/stream", json={"content": "晚上好"})

    assert response.status_code == 401


def test_voice_upload_rejects_unsupported_media_type(client: TestClient) -> None:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id="20419c0a-140c-4b21-a633-a90285432d02",
        access_token="test-token",
    )
    app.dependency_overrides[get_settings] = lambda: Settings(openai_api_key="test-key")
    try:
        response = client.post(
            "/v1/voice/transcribe",
            files={"audio": ("note.txt", b"not audio", "text/plain")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 415
