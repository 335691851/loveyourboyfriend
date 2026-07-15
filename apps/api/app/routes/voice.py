from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from openai import AsyncOpenAI, OpenAIError

from app.config import Settings, get_settings
from app.dependencies import CurrentUser
from app.models import VoiceSynthesisRequest

router = APIRouter(prefix="/v1/voice", tags=["voice"])
SUPPORTED_AUDIO_TYPES = {
    "audio/aac",
    "audio/m4a",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
}


def _openai(settings: Settings) -> AsyncOpenAI:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice service is not configured",
        )
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        timeout=30,
        max_retries=2,
    )


@router.post("/transcribe")
async def transcribe_voice(
    user: CurrentUser,
    audio: Annotated[UploadFile, File()],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    del user
    if audio.content_type not in SUPPORTED_AUDIO_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported audio format")
    content = await audio.read(settings.max_audio_bytes + 1)
    if len(content) > settings.max_audio_bytes:
        raise HTTPException(status_code=413, detail="Audio message is too large")
    try:
        result = await _openai(settings).audio.transcriptions.create(
            model=settings.transcription_model,
            file=(audio.filename or "voice.webm", content, audio.content_type),
        )
    except OpenAIError as error:
        raise HTTPException(status_code=502, detail="Voice transcription failed") from error
    return {"text": result.text.strip()}


@router.post("/speech")
async def synthesize_voice(
    request: VoiceSynthesisRequest,
    user: CurrentUser,
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    del user
    try:
        speech = await _openai(settings).audio.speech.create(
            model=settings.speech_model,
            voice=settings.speech_voice,
            input=request.content,
            response_format="mp3",
            speed=1.08,
        )
    except OpenAIError as error:
        raise HTTPException(status_code=502, detail="Voice synthesis failed") from error
    return Response(
        content=speech.content,
        media_type="audio/mpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )
