from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException

from app.auth import verify_supabase_token
from app.config import Settings


@pytest.mark.asyncio
async def test_verify_supabase_token_returns_anonymous_user() -> None:
    response = httpx.Response(
        200,
        json={"id": "20419c0a-140c-4b21-a633-a90285432d02", "is_anonymous": True},
        request=httpx.Request("GET", "https://example.supabase.co/auth/v1/user"),
    )
    http_client = AsyncMock()
    http_client.get.return_value = response
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="publishable-key",
    )

    user = await verify_supabase_token("valid-token", settings, http_client)

    assert str(user.id) == "20419c0a-140c-4b21-a633-a90285432d02"
    assert user.is_anonymous is True


@pytest.mark.asyncio
async def test_verify_supabase_token_rejects_invalid_session() -> None:
    response = httpx.Response(
        401,
        json={"message": "invalid JWT"},
        request=httpx.Request("GET", "https://example.supabase.co/auth/v1/user"),
    )
    http_client = AsyncMock()
    http_client.get.return_value = response
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="publishable-key",
    )

    with pytest.raises(HTTPException) as exc:
        await verify_supabase_token("bad-token", settings, http_client)

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_verify_supabase_token_requires_supabase_configuration() -> None:
    with pytest.raises(HTTPException) as exc:
        await verify_supabase_token("token", Settings(), AsyncMock())

    assert exc.value.status_code == 503
