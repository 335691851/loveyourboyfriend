from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.ai.chains import build_chat_chain
from app.ai.memory import build_memory_extractor
from app.config import Settings, get_settings
from app.dependencies import CurrentUser, get_http_client
from app.models import AudioAttachmentRequest, ChatRequest
from app.repositories.chat import ChatRepository
from app.services.chat import ChatService

router = APIRouter(prefix="/v1", tags=["chat"])


def _repository(
    user: CurrentUser,
    client: httpx.AsyncClient,
    settings: Settings,
) -> ChatRepository:
    try:
        return ChatRepository(client, settings, user.id, user.access_token)
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat storage is not configured",
        ) from error


@router.post("/chat/stream")
async def stream_chat(
    request: ChatRequest,
    user: CurrentUser,
    client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> StreamingResponse:
    if request.audio_path and not request.audio_path.startswith(f"{user.id}/"):
        raise HTTPException(status_code=403, detail="Invalid voice object path")
    repository = _repository(user, client, settings)
    try:
        service = ChatService(
            repository=repository,
            chain=build_chat_chain(settings=settings),
            memory_extractor=build_memory_extractor(settings=settings),
        )
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Language model is not configured",
        ) from error
    return StreamingResponse(
        service.stream(user, request),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.patch("/messages/{message_id}/audio", status_code=204)
async def attach_message_audio(
    message_id: UUID,
    request: AudioAttachmentRequest,
    user: CurrentUser,
    client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    if not request.audio_path.startswith(f"{user.id}/"):
        raise HTTPException(status_code=403, detail="Invalid voice object path")
    await _repository(user, client, settings).attach_message_audio(
        message_id,
        request.audio_path,
        request.duration_ms,
    )


@router.get("/conversations")
async def list_conversations(
    user: CurrentUser,
    client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[dict]:
    return await _repository(user, client, settings).list_conversations()


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: UUID,
    user: CurrentUser,
    client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[dict]:
    return await _repository(user, client, settings).list_messages(conversation_id)
