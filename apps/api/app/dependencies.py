from typing import Annotated

import httpx
from fastapi import Depends, Header, HTTPException, status

from app.auth import verify_supabase_token
from app.config import Settings, get_settings
from app.models import AuthenticatedUser


async def get_http_client() -> httpx.AsyncClient:
    async with httpx.AsyncClient(timeout=10) as client:
        yield client


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    settings: Annotated[Settings, Depends(get_settings)] = None,
    http_client: Annotated[httpx.AsyncClient, Depends(get_http_client)] = None,
) -> AuthenticatedUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer session is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token")
    return await verify_supabase_token(token, settings, http_client)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
