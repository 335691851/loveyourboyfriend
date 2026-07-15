from pathlib import Path

MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase"
    / "migrations"
    / "20260715062025_initial_chat_schema.sql"
)
V2_MIGRATION = MIGRATION.parent / "20260715190000_companion_experience_v2.sql"


def test_initial_migration_defines_owned_chat_tables() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for table in ("profiles", "conversations", "messages", "memories"):
        assert f"create table public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql

    assert "(select auth.uid()) = user_id" in sql
    assert "grant select, insert, update, delete" in sql


def test_messages_policy_requires_owned_conversation() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "conversation.user_id = (select auth.uid())" in sql


def test_database_hardening_revokes_public_function_and_indexes_memory_source() -> None:
    migrations_dir = MIGRATION.parent
    sql = "\n".join(
        path.read_text(encoding="utf-8").lower() for path in sorted(migrations_dir.glob("*.sql"))
    )

    assert "revoke all on function public.rls_auto_enable()" in sql
    assert "on public.memories (source_message_id)" in sql


def test_retention_cleanup_is_scheduled_and_extends_active_conversations() -> None:
    migrations_dir = MIGRATION.parent
    sql = "\n".join(
        path.read_text(encoding="utf-8").lower() for path in sorted(migrations_dir.glob("*.sql"))
    )

    assert "private.delete_expired_chat_data" in sql
    assert "cron.schedule" in sql
    assert "new.expires_at := now() + interval '90 days'" in sql
    assert "'voice-messages'" in sql
    assert "(storage.foldername(name))[1] = (select auth.uid())::text" in sql


def test_companion_v2_migration_adds_profile_and_message_state() -> None:
    sql = V2_MIGRATION.read_text(encoding="utf-8").lower()

    assert "add column if not exists current_mood" in sql
    assert "add column if not exists emotional_need" in sql
    assert "add column if not exists mood_updated_at" in sql
    assert "add column if not exists companion_state" in sql
    assert "profiles_mood_updated_idx" in sql
