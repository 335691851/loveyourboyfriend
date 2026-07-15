from __future__ import annotations

from datetime import UTC, datetime

from app.jobs.cleanup_voice import collect_expired_paths


class FakeBucket:
    def list(self, path: str, options: dict) -> list[dict]:
        del options
        if not path:
            return [{"id": None, "name": "user-a"}]
        return [
            {
                "id": "old",
                "name": "old.webm",
                "created_at": "2026-03-01T00:00:00Z",
            },
            {
                "id": "new",
                "name": "new.webm",
                "created_at": "2026-07-10T00:00:00Z",
            },
        ]

    def remove(self, paths: list[str]) -> list[dict]:
        return [{"name": path} for path in paths]


def test_collect_expired_voice_paths_respects_retention_window() -> None:
    result = collect_expired_paths(
        FakeBucket(),
        now=datetime(2026, 7, 15, tzinfo=UTC),
        retention_days=90,
    )

    assert result == ["user-a/old.webm"]
