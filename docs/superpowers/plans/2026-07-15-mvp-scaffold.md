# MVP Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a locally runnable monorepo skeleton that Vercel and Render can import from the same GitHub `master` branch.

**Architecture:** A Next.js App Router frontend lives in `apps/web`; a FastAPI and LangChain backend lives in `apps/api`. Supabase SQL migrations live at the repository root and no secret is committed.

**Tech Stack:** Next.js 16+, React 19.2+, TypeScript, Tailwind CSS 4, Vitest, Python 3.12, FastAPI, LangChain, pytest, uv, Supabase PostgreSQL.

## Global Constraints

- Use one cloud production environment and one Git branch named `master`.
- Vercel automatically deploys `apps/web`; Render automatically deploys `apps/api`.
- The UI is mobile-first and uses the approved immersive black-rose theme.
- The API must not require secrets to start or answer `/health`.
- Never commit OpenAI, Supabase secret or database credentials.
- Keep text, audio and memory data for 90 days.

---

### Task 1: Repository and API skeleton

**Files:**

- Create: `.gitignore`, `.env.example`, `.python-version`, `README.md`
- Create: `apps/api/pyproject.toml`, `apps/api/app/__init__.py`, `apps/api/app/main.py`, `apps/api/app/config.py`
- Test: `apps/api/tests/test_health.py`, `apps/api/tests/test_config.py`

**Interfaces:**

- Produces: `GET /health -> {"status":"ok","service":"loveyourboyfriend-api"}`
- Produces: `Settings` with environment-backed API configuration and safe defaults

- [ ] **Step 1: Write failing API tests**

```python
def test_health_returns_service_status(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "loveyourboyfriend-api"}
```

- [ ] **Step 2: Verify the tests fail because the application does not exist**

Run: `uv run --project apps/api pytest apps/api/tests -q`
Expected: collection failure for missing `app.main`.

- [ ] **Step 3: Implement the minimal FastAPI application and configuration**

```python
app = FastAPI(title="Love Your Boyfriend API")

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "loveyourboyfriend-api"}
```

- [ ] **Step 4: Lock dependencies and verify API tests**

Run: `uv lock --project apps/api && uv run --project apps/api pytest apps/api/tests -q`
Expected: all API tests pass.

### Task 2: Mobile web shell

**Files:**

- Create: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- Create: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`
- Create: `apps/web/src/components/chat-shell.tsx`
- Test: `apps/web/src/components/chat-shell.test.tsx`, `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`

**Interfaces:**

- Produces: `ChatShell` client component with character header, welcome state and text/voice composer

- [ ] **Step 1: Write a failing UI test**

```tsx
render(<ChatShell />);
expect(
  screen.getByRole("heading", { name: "今晚想聊点什么？" }),
).toBeInTheDocument();
expect(screen.getByLabelText("输入消息")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "发送语音" })).toBeInTheDocument();
```

- [ ] **Step 2: Verify the test fails because `ChatShell` is missing**

Run: `pnpm --filter web test`
Expected: module resolution failure for `chat-shell`.

- [ ] **Step 3: Implement the minimal responsive black-rose chat shell**

The component renders the tested semantic elements, mobile safe areas, decorative gradients and a fixed composer. Interactive controls are local-only at this milestone.

- [ ] **Step 4: Verify frontend tests, types and production build**

Run: `pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web build`
Expected: tests and Next.js production build pass.

### Task 3: Supabase and deployment contract

**Files:**

- Create: `supabase/config.toml`
- Create: `supabase/migrations/20260715000100_initial_chat_schema.sql`
- Modify: `README.md`, `.env.example`

**Interfaces:**

- Produces: `profiles`, `conversations`, `messages` and `memories` tables keyed by `auth.users.id`
- Produces: owner-only RLS policies and expiry indexes

- [ ] **Step 1: Add a schema contract test that checks required tables and RLS clauses**

Run: `uv run --project apps/api pytest apps/api/tests/test_schema_contract.py -q`
Expected: failure because the migration is missing.

- [ ] **Step 2: Add the initial additive SQL migration**

The migration creates UUID-owned tables, enables RLS and defines policies using `(select auth.uid()) = user_id`. It does not apply itself to the remote production project.

- [ ] **Step 3: Verify all repository checks**

Run: `pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web build && uv run --project apps/api pytest apps/api/tests -q && uv run --project apps/api ruff check apps/api`
Expected: every command exits with status 0.

- [ ] **Step 4: Review repository hygiene**

Run: `git status --short && git diff --check`
Expected: no secrets, build products, local environments or whitespace errors are tracked.
