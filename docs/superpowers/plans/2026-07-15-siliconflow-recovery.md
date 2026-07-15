# SiliconFlow Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore real SiliconFlow/LangChain responses and replace repetitive static fallback copy with context-aware, non-repeating replies.

**Architecture:** Keep `ChatOpenAI` as the provider adapter, but pass SiliconFlow-only request fields through `extra_body` so the OpenAI SDK emits the exact compatible JSON. Bound short-term history at the service boundary and move local fallback selection into a focused pure module that can be tested independently.

**Tech Stack:** Python 3.12, FastAPI, LangChain, langchain-openai, httpx, pytest, Supabase PostgreSQL, Next.js.

## Global Constraints

- Production model remains `Qwen/Qwen3.5-35B-A3B` unless configured otherwise.
- Qwen thinking mode remains disabled.
- Provider request contains at most 10 messages.
- Fallback replies must not claim a physical location or create emotional dependency.
- No new external dependency is introduced.

---

### Task 1: SiliconFlow-compatible HTTP payload

**Files:**

- Modify: `apps/api/app/ai/chains.py`
- Modify: `apps/api/tests/test_chains.py`

**Interfaces:**

- Consumes: `Settings.chat_model`, `Settings.memory_model`, `Settings.openai_base_url`.
- Produces: `build_chat_model()` and `build_memory_model()` whose final request JSON uses `max_tokens`.

- [ ] **Step 1: Write a failing HTTP payload test**

Use `httpx.MockTransport` and an injected `http_async_client` to capture the JSON emitted by `ChatOpenAI.astream()`. Assert that it contains `max_tokens == 320`, `enable_thinking is False`, and no `max_completion_tokens`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `uv run pytest tests/test_chains.py -q`

Expected: FAIL because the current payload contains `max_completion_tokens`.

- [ ] **Step 3: Implement the provider-specific fields**

Construct the chat model with:

```python
extra_body={"enable_thinking": False, "max_tokens": 320}
```

Remove `max_tokens=320`. Apply the equivalent `max_tokens: 256` change to the memory model.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `uv run pytest tests/test_chains.py -q`

Expected: all chain tests pass.

### Task 2: Provider message-count boundary

**Files:**

- Modify: `apps/api/app/services/chat.py`
- Modify: `apps/api/tests/test_chat_service.py`

**Interfaces:**

- Consumes: `ChatRepository.list_messages(conversation_id, limit)`.
- Produces: model history containing at most seven stored messages.

- [ ] **Step 1: Write a failing history-limit assertion**

Make `FakeRepository.list_messages` record the supplied limit, then assert it equals `7` after `ChatService.stream()`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `uv run pytest tests/test_chat_service.py -q`

Expected: FAIL because `list_messages` currently receives no explicit limit.

- [ ] **Step 3: Bound the history**

Change the service call to:

```python
history_rows = await self.repository.list_messages(conversation_id, limit=7)
```

- [ ] **Step 4: Run the service tests and verify GREEN**

Run: `uv run pytest tests/test_chat_service.py -q`

Expected: all service tests pass.

### Task 3: Context-aware fallback engine

**Files:**

- Create: `apps/api/app/ai/fallback.py`
- Create: `apps/api/tests/test_fallback.py`
- Modify: `apps/api/app/services/chat.py`
- Modify: `apps/api/tests/test_chat_service.py`

**Interfaces:**

- Produces: `build_fallback_reply(user_text: str, history_rows: list[dict]) -> str`.
- Consumes: ordered stored history rows containing `role` and `content`.

- [ ] **Step 1: Write failing intent and continuity tests**

Cover fatigue, presence/location, reset, repetition complaint and generic inputs. Include a history whose latest assistant reply equals one candidate and assert the engine chooses another.

- [ ] **Step 2: Run fallback tests and verify RED**

Run: `uv run pytest tests/test_fallback.py -q`

Expected: collection/import failure because the fallback module does not exist.

- [ ] **Step 3: Implement pure fallback selection**

Define intent-specific candidate tuples, select the first non-recent candidate from a stable hash-derived offset, and keep replies to one or two natural sentences. Pass `history_rows` from `ChatService` to the function.

- [ ] **Step 4: Run fallback and service tests**

Run: `uv run pytest tests/test_fallback.py tests/test_chat_service.py -q`

Expected: all tests pass and provider failure still emits `start`, `delta`, `message`, `done`.

### Task 4: Full verification and production release

**Files:**

- Verify all modified files.

**Interfaces:**

- Produces: pushed `master` commit and verified Render deployment.

- [ ] **Step 1: Run formatting and all quality gates**

Run:

```powershell
pnpm format
pnpm test
pnpm lint
pnpm build
git diff --check
```

Expected: Web and API tests, lint, typecheck and build all succeed.

- [ ] **Step 2: Commit and push**

Stage only intentional files, commit with `fix siliconflow request compatibility`, and push `master`.

- [ ] **Step 3: Verify deployment revision and production conversation**

Wait for `/health` to report the new revision. Send a unique production message, verify the reply is not any local fallback string, query Supabase for both roles, reload the page and confirm history restoration and zero browser errors.
