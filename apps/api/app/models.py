from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class AuthenticatedUser(BaseModel):
    id: UUID
    is_anonymous: bool = True
    access_token: str = Field(default="", exclude=True, repr=False)


class ChatRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    conversation_id: UUID | None = None
    input_mode: Literal["text", "voice"] = "text"
    response_mode: Literal["text", "voice"] = "text"
    audio_path: str | None = Field(default=None, max_length=500)
    duration_ms: int | None = Field(default=None, ge=0, le=60_000)

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("content must not be blank")
        return normalized


class MemoryCandidate(BaseModel):
    category: Literal["identity", "preference", "relationship", "routine", "boundary"]
    content: str = Field(min_length=1, max_length=500)
    confidence: float = Field(default=1, ge=0, le=1)
    explicitly_stated: bool = True


class MemoryExtraction(BaseModel):
    memories: list[MemoryCandidate] = Field(default_factory=list, max_length=5)


class ConversationSummary(BaseModel):
    id: UUID
    title: str | None = None
    last_message_at: str


class MessageRecord(BaseModel):
    id: UUID
    conversation_id: UUID
    role: Literal["user", "assistant", "system"]
    message_type: Literal["text", "voice"]
    content: str
    audio_path: str | None = None
    duration_ms: int | None = None
    created_at: str


class VoiceSynthesisRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class AudioAttachmentRequest(BaseModel):
    audio_path: str = Field(min_length=1, max_length=500)
    duration_ms: int | None = Field(default=None, ge=0, le=60_000)
