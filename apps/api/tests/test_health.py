from fastapi.testclient import TestClient


def test_health_returns_service_status(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "loveyourboyfriend-api",
        "revision": "local",
        "chat_provider": "api.siliconflow.cn",
        "chat_model": "Qwen/Qwen3.5-35B-A3B",
    }
