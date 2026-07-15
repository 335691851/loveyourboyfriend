from pathlib import Path

MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase"
    / "migrations"
    / "20260715040027_initial_chat_schema.sql"
)


def test_initial_migration_defines_owned_chat_tables() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for table in ("profiles", "conversations", "messages", "memories"):
        assert f"create table public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql

    assert "(select auth.uid()) = user_id" in sql
    assert "grant select, insert, update, delete" in sql
