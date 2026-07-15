from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx

from app.config import Settings
from app.models import MemoryCandidate


class ChatRepository:
    def __init__(
        self,
        client: httpx.AsyncClient,
        settings: Settings,
        user_id: UUID,
        access_token: str,
    ) -> None:
        if not settings.supabase_url or not settings.supabase_publishable_key:
            raise RuntimeError("Supabase is not configured")
        self.client = client
        self.base_url = f"{settings.supabase_url.rstrip('/')}/rest/v1"
        self.user_id = user_id
        self.headers = {
            "apikey": settings.supabase_publishable_key,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, str] | None = None,
        json: Any = None,
        prefer: str | None = None,
    ) -> list[dict[str, Any]]:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        response = await self.client.request(
            method,
            f"{self.base_url}/{table}",
            params=params,
            headers=headers,
            json=json,
        )
        response.raise_for_status()
        if not response.content:
            return []
        payload = response.json()
        return payload if isinstance(payload, list) else [payload]

    async def ensure_profile(self) -> None:
        await self._request(
            "POST",
            "profiles",
            json={
                "user_id": str(self.user_id),
                "last_seen_at": datetime.now(UTC).isoformat(),
            },
            prefer="resolution=merge-duplicates,return=minimal",
        )

    async def create_conversation(self) -> dict[str, Any]:
        rows = await self._request(
            "POST",
            "conversations",
            json={"user_id": str(self.user_id)},
            prefer="return=representation",
        )
        return rows[0]

    async def list_conversations(self, limit: int = 20) -> list[dict[str, Any]]:
        return await self._request(
            "GET",
            "conversations",
            params={
                "select": "id,title,last_message_at,created_at",
                "order": "last_message_at.desc",
                "limit": str(limit),
            },
        )

    async def list_messages(
        self,
        conversation_id: UUID,
        limit: int = 40,
    ) -> list[dict[str, Any]]:
        rows = await self._request(
            "GET",
            "messages",
            params={
                "conversation_id": f"eq.{conversation_id}",
                "select": (
                    "id,conversation_id,role,message_type,content,audio_path,duration_ms,created_at"
                ),
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
        return list(reversed(rows))

    async def list_memories(self, limit: int = 30) -> list[dict[str, Any]]:
        return await self._request(
            "GET",
            "memories",
            params={
                "select": "id,category,content,confidence,explicitly_stated,last_confirmed_at",
                "order": "last_confirmed_at.desc",
                "limit": str(limit),
            },
        )

    async def create_message(
        self,
        *,
        conversation_id: UUID,
        role: str,
        content: str,
        message_type: str = "text",
        audio_path: str | None = None,
        duration_ms: int | None = None,
    ) -> dict[str, Any]:
        rows = await self._request(
            "POST",
            "messages",
            json={
                "conversation_id": str(conversation_id),
                "user_id": str(self.user_id),
                "role": role,
                "content": content,
                "message_type": message_type,
                "audio_path": audio_path,
                "duration_ms": duration_ms,
            },
            prefer="return=representation",
        )
        return rows[0]

    async def touch_conversation(self, conversation_id: UUID) -> None:
        await self._request(
            "PATCH",
            "conversations",
            params={"id": f"eq.{conversation_id}"},
            json={"last_message_at": datetime.now(UTC).isoformat()},
            prefer="return=minimal",
        )

    async def attach_message_audio(
        self,
        message_id: UUID,
        audio_path: str,
        duration_ms: int | None,
    ) -> None:
        await self._request(
            "PATCH",
            "messages",
            params={"id": f"eq.{message_id}"},
            json={"audio_path": audio_path, "duration_ms": duration_ms},
            prefer="return=minimal",
        )

    async def save_memories(
        self,
        memories: list[MemoryCandidate],
        source_message_id: str,
    ) -> None:
        if not memories:
            return
        existing = await self.list_memories(limit=100)
        keys = {(row["category"], "".join(row["content"].split()).casefold()) for row in existing}
        new_rows = []
        for memory in memories:
            key = (memory.category, "".join(memory.content.split()).casefold())
            if key in keys:
                continue
            keys.add(key)
            new_rows.append(
                {
                    "user_id": str(self.user_id),
                    "category": memory.category,
                    "content": memory.content,
                    "confidence": memory.confidence,
                    "explicitly_stated": memory.explicitly_stated,
                    "source_message_id": source_message_id,
                }
            )
        if new_rows:
            await self._request(
                "POST",
                "memories",
                json=new_rows,
                prefer="return=minimal",
            )
