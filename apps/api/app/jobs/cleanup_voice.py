from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Protocol

from supabase import create_client

from app.config import get_settings

BUCKET_NAME = "voice-messages"


class StorageBucket(Protocol):
    def list(self, path: str, options: dict) -> list[dict]: ...

    def remove(self, paths: list[str]) -> list[dict]: ...


def collect_expired_paths(
    bucket: StorageBucket,
    *,
    now: datetime,
    retention_days: int,
) -> list[str]:
    cutoff = now - timedelta(days=retention_days)
    expired: list[str] = []
    folders = bucket.list("", {"limit": 1000, "offset": 0, "sortBy": {"column": "name"}})
    for folder in folders:
        if folder.get("id") or not folder.get("name"):
            continue
        prefix = folder["name"]
        offset = 0
        while True:
            objects = bucket.list(
                prefix,
                {"limit": 1000, "offset": offset, "sortBy": {"column": "created_at"}},
            )
            for item in objects:
                created_at = item.get("created_at")
                if not item.get("id") or not item.get("name") or not created_at:
                    continue
                created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                if created < cutoff:
                    expired.append(f"{prefix}/{item['name']}")
            if len(objects) < 1000:
                break
            offset += 1000
    return expired


def run_cleanup() -> int:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
    supabase = create_client(settings.supabase_url, settings.supabase_secret_key)
    bucket = supabase.storage.from_(BUCKET_NAME)
    paths = collect_expired_paths(
        bucket,
        now=datetime.now(UTC),
        retention_days=settings.data_retention_days,
    )
    for start in range(0, len(paths), 1000):
        bucket.remove(paths[start : start + 1000])
    return len(paths)


if __name__ == "__main__":
    deleted = run_cleanup()
    print(f"Deleted {deleted} expired voice objects")
