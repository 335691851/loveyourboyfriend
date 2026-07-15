# Companion Experience V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Lu Chuan into a proactive high-tension flirtatious companion with adaptive multi-bubble replies, meaningful new/returning-user entry flows, editable user emotional context, and dynamic companion states.

**Architecture:** Extend the existing NDJSON stream with companion-state and indexed bubble events. Keep one model call per turn, parse state and bubble markers incrementally, persist each bubble separately, normalize consecutive history roles before Qwen requests, and store short-term profile context in Supabase. The Next.js client gates initial rendering until session, profile, and history are known, then chooses onboarding, returning check-in, or conversation mode.

**Tech Stack:** Python 3.12, FastAPI, LangChain, Pydantic, Supabase PostgreSQL/PostgREST, Next.js 16, React 19, TypeScript 6, Vitest, Pytest

## Global Constraints

- Relationship starts as an ambiguous romantic interest, not an established partner.
- Reply style is bold and flirtatious but never coercive, humiliating, exclusive, deceptive, or dependency-seeking.
- Every model turn uses one call and produces 1–3 bubbles separated by `[BUBBLE]`.
- No A/B choice questions, counseling scripts, repeated openings, or mandatory questions.
- Loading must not flash the welcome state or history before data is ready.
- Profile context is short-term state, not long-term memory.
- Existing stored single-bubble messages remain compatible without data migration.
- All implementation follows red-green-refactor; no production behavior is added before its failing test.
- The final implementation is one commit after `2a06a92`, then pushed to `origin/master`.

---

### Task 1: Database and profile-context contracts

**Files:**

- Create: `supabase/migrations/20260715190000_companion_experience_v2.sql`
- Modify: `apps/api/app/models.py`
- Modify: `apps/api/tests/test_models.py`
- Modify: `apps/api/tests/test_schema_contract.py`

**Interfaces:**

- Produces: `ProfileContext`, `ProfileContextUpdate`, `OpeningRequest`, `CompanionState`
- Produces columns: `profiles.current_mood`, `profiles.emotional_need`, `profiles.mood_updated_at`, `messages.companion_state`

- [ ] **Step 1: Add failing model and schema tests**

```python
def test_profile_context_accepts_supported_values() -> None:
    value = ProfileContext(current_mood="心动", emotional_need="暧昧一点")
    assert value.current_mood == "心动"

def test_v2_migration_adds_profile_and_companion_state_columns() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "current_mood" in sql
    assert "emotional_need" in sql
    assert "companion_state" in sql
```

- [ ] **Step 2: Run the focused tests and observe missing contracts**

Run: `uv run --project apps/api pytest apps/api/tests/test_models.py apps/api/tests/test_schema_contract.py -q`

Expected: FAIL because the new models and migration do not exist.

- [ ] **Step 3: Add strict Pydantic values and idempotent SQL**

Use exact allowed values:

```python
Mood = Literal["轻松", "开心", "疲惫", "委屈", "心烦", "心动"]
EmotionalNeed = Literal["听我说", "哄哄我", "逗我开心", "陪我吐槽", "暧昧一点"]
CompanionState = Literal[
    "approaching", "attentive", "teasing", "soft",
    "proud", "jealous", "thinking", "calm",
]
```

The migration adds nullable profile fields, a nullable constrained message state, and an index on `profiles.mood_updated_at`.

- [ ] **Step 4: Re-run focused tests**

Expected: model and schema-contract tests PASS.

### Task 2: Streaming reply parser, history normalizer, persona, and fallback

**Files:**

- Create: `apps/api/app/ai/segmentation.py`
- Create: `apps/api/app/ai/history.py`
- Create: `apps/api/tests/test_segmentation.py`
- Create: `apps/api/tests/test_history.py`
- Modify: `apps/api/app/ai/prompts.py`
- Modify: `apps/api/app/ai/fallback.py`
- Modify: `apps/api/tests/test_prompts.py`
- Modify: `apps/api/tests/test_fallback.py`

**Interfaces:**

- Produces: `ReplySegmenter.feed(chunk) -> list[SegmentEvent]`
- Produces: `ReplySegmenter.finish() -> list[SegmentEvent]`
- Produces: `normalize_chat_history(rows, max_messages=6) -> list[BaseMessage]`
- Produces: `FallbackReply(state: CompanionState, bubbles: list[str])`

- [ ] **Step 1: Write failing parser and history tests**

```python
def test_segmenter_parses_state_and_split_delimiter() -> None:
    parser = ReplySegmenter()
    events = parser.feed("[STATE:teasing]\n你还挺会")
    events += parser.feed("撩\n[BUB")
    events += parser.feed("BLE]\n差点被你骗到")
    events += parser.finish()
    assert completed_texts(events) == ["你还挺会撩", "差点被你骗到"]
    assert parser.state == "teasing"

def test_history_merges_consecutive_assistant_bubbles() -> None:
    history = normalize_chat_history([
        {"role": "user", "content": "在吗"},
        {"role": "assistant", "content": "在。"},
        {"role": "assistant", "content": "还挺想你的。"},
    ])
    assert [message.type for message in history] == ["human", "ai"]
    assert history[-1].content == "在。\n还挺想你的。"
```

- [ ] **Step 2: Run focused parser/history tests and observe imports fail**

Run: `uv run --project apps/api pytest apps/api/tests/test_segmentation.py apps/api/tests/test_history.py -q`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement minimal parser and history normalizer**

The parser emits `state`, `start`, `delta`, and `complete` events, buffers partial markers, removes formatting markers, drops empty segments, and merges content after the third bubble. The history normalizer coalesces adjacent roles, removes leading assistant content, and returns at most six messages.

- [ ] **Step 4: Add failing prompt and fallback behavior tests**

```python
def test_prompt_requires_flirty_multi_bubble_output_without_choices() -> None:
    assert "撩妹高手" in COMPANION_SYSTEM_PROMPT
    assert "[STATE:" in COMPANION_SYSTEM_PROMPT
    assert "[BUBBLE]" in COMPANION_SYSTEM_PROMPT
    assert "你是想 A，还是 B" in COMPANION_SYSTEM_PROMPT

def test_fallback_has_multiple_short_bubbles_and_no_choice_question() -> None:
    reply = build_fallback_reply("你说吧", [])
    assert 1 <= len(reply.bubbles) <= 3
    assert all("还是" not in bubble for bubble in reply.bubbles)
```

- [ ] **Step 5: Run prompt/fallback tests and observe old behavior fail**

Expected: FAIL because fallback returns a string and the prompt lacks the V2 output contract.

- [ ] **Step 6: Implement persona contract and structured local fallback**

Rewrite fallback candidates as short bubble tuples with a safe companion state. Remove every counseling-style choice and keep recent-bubble de-duplication.

- [ ] **Step 7: Run all Task 2 tests**

Expected: segmentation, history, prompt, and fallback tests PASS.

### Task 3: Repository, ChatService, and API V2

**Files:**

- Modify: `apps/api/app/repositories/chat.py`
- Modify: `apps/api/app/services/chat.py`
- Modify: `apps/api/app/routes/chat.py`
- Modify: `apps/api/tests/test_chat_service.py`
- Modify: `apps/api/tests/test_routes.py`

**Interfaces:**

- Produces repository methods `get_profile_context()`, `update_profile_context(update)`, and companion-state-aware `create_message(...)`
- Produces routes `GET /v1/profile/context`, `PATCH /v1/profile/context`, `POST /v1/chat/opening`
- Produces NDJSON events `companion_state`, `bubble_start`, indexed `delta`, indexed `message`

- [ ] **Step 1: Add failing ChatService multi-bubble tests**

```python
@pytest.mark.asyncio
async def test_chat_service_streams_and_persists_multiple_bubbles() -> None:
    chain = FakeChunkChain(["[STATE:teasing]\n别装。\n[BUBBLE]\n我看出来了。"])
    events = await collect(service(chain).stream(user, request))
    assert [e["type"] for e in events].count("bubble_start") == 2
    assert [row["content"] for row in repository.assistant_rows] == ["别装。", "我看出来了。"]
    assert repository.assistant_rows[-1]["companion_state"] == "teasing"
```

- [ ] **Step 2: Run the focused service test and observe single-message failure**

Expected: FAIL because the old service persists one assistant message and emits unindexed deltas.

- [ ] **Step 3: Implement repository context/state methods and ChatService V2**

Use `ReplySegmenter` for provider and fallback output. Persist bubbles after generation, mark only the last with `companion_state`, pass combined text to memory extraction, and use normalized history for the model.

- [ ] **Step 4: Add failing profile and opening route tests**

```python
def test_profile_context_patch_requires_valid_values(client, auth_headers) -> None:
    response = client.patch("/v1/profile/context", headers=auth_headers,
        json={"current_mood": "心动", "emotional_need": "暧昧一点"})
    assert response.status_code == 200

def test_opening_stream_does_not_create_user_message(client, auth_headers) -> None:
    response = client.post("/v1/chat/opening", headers=auth_headers, json={})
    assert response.status_code == 200
```

- [ ] **Step 5: Run route tests and observe 404 failures**

Expected: FAIL because the routes do not exist.

- [ ] **Step 6: Implement profile-context and proactive-opening routes**

Opening uses the same service pipeline, creates a conversation only when needed, persists assistant bubbles only, and skips memory extraction.

- [ ] **Step 7: Run the complete API test suite**

Run: `pnpm test:api`

Expected: all API tests PASS.

### Task 4: Web API types and chat state machine

**Files:**

- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`
- Modify: `apps/web/src/hooks/use-chat.ts`
- Create: `apps/web/src/hooks/use-chat.test.tsx`

**Interfaces:**

- Produces `ProfileContext`, `CompanionStateName`, indexed `StreamEvent`
- Produces `loadProfileContext`, `updateProfileContext`, `streamOpening`
- Extends `useChat()` with `entryMode`, `profileContext`, `companionState`, `updateContextAndOpen`, `continueHistory`

- [ ] **Step 1: Add failing NDJSON and API-contract tests**

```typescript
it("parses state and indexed bubble events", async () => {
  const events = await parse([
    '{"type":"companion_state","state":"teasing","emoji":"😏","label":"想逗你一下"}\n',
    '{"type":"bubble_start","index":0}\n',
    '{"type":"delta","index":0,"content":"别装。"}\n',
  ]);
  expect(events[1]).toMatchObject({ type: "bubble_start", index: 0 });
});
```

- [ ] **Step 2: Run web tests and observe missing event types**

Run: `pnpm --filter web test src/lib/api.test.ts`

Expected: FAIL at TypeScript compile or event assertions.

- [ ] **Step 3: Implement API types and functions**

Keep existing endpoints compatible and add profile/opening requests through the same authenticated `apiFetch` and NDJSON consumer.

- [ ] **Step 4: Add failing hook state-machine tests**

Test that loading exposes no entry mode, an empty history selects `new`, existing history selects `returning`, indexed events create independent bubbles, and voice synthesis receives one joined string.

- [ ] **Step 5: Implement the hook state machine**

Load profile and history together, avoid intermediate welcome rendering, update temporary bubbles by `index`, persist final IDs, restore the latest companion state, and attach one synthesized audio file to the final bubble.

- [ ] **Step 6: Run hook and API tests**

Expected: focused web tests PASS.

### Task 5: Emotion check-in and dynamic mobile UI

**Files:**

- Create: `apps/web/src/components/emotion-checkin.tsx`
- Create: `apps/web/src/components/emotion-checkin.test.tsx`
- Modify: `apps/web/src/components/chat-shell.tsx`
- Modify: `apps/web/src/components/chat-shell.test.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**

- Consumes: Task 4 `useChat()` state and actions
- Produces: new-user onboarding, returning-user check-in, status editor, loading gate, companion emoji state, multi-bubble visual grouping

- [ ] **Step 1: Add failing component tests**

```tsx
it("lets a new user choose mood and need", async () => {
  render(<EmotionCheckin mode="new" onConfirm={onConfirm} onSkip={onSkip} />);
  await user.click(screen.getByRole("button", { name: "心动" }));
  await user.click(screen.getByRole("button", { name: "暧昧一点" }));
  await user.click(screen.getByRole("button", { name: "让陆川来找我" }));
  expect(onConfirm).toHaveBeenCalledWith({
    current_mood: "心动",
    emotional_need: "暧昧一点",
  });
});
```

Add ChatShell assertions that connecting mode does not render the welcome heading, returning mode offers “直接继续上次”, and companion state renders its emoji and label.

- [ ] **Step 2: Run component tests and observe missing UI**

Run: `pnpm --filter web test src/components`

Expected: FAIL because `EmotionCheckin` and V2 states do not exist.

- [ ] **Step 3: Implement EmotionCheckin and ChatShell routing**

Use six mood chips, five need chips, a new-user confirmation CTA, a returning-user skip action, and the former back-button slot as “调整我的状态”. Keep the composer unavailable until an entry choice is resolved.

- [ ] **Step 4: Add V2 styles**

Add dark translucent check-in cards, compact emoji chips, state badge transitions, grouped assistant bubble spacing, and `prefers-reduced-motion` fallbacks. Reuse existing color tokens and mobile dimensions.

- [ ] **Step 5: Run component tests, ESLint, and TypeScript**

Run: `pnpm lint:web && pnpm test:web`

Expected: all web checks PASS.

### Task 6: Documentation and migration alignment

**Files:**

- Modify: `README.md`
- Modify: `docs/deployment.md`
- Modify: `docs/superpowers/specs/2026-07-15-companion-experience-v2-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-companion-experience-v2.md`

**Interfaces:**

- Documents: V2 profile context, proactive opening, dynamic state, multi-bubble protocol, and required migration

- [ ] **Step 1: Update repository documentation**

Document the new interaction flow and routes without claiming unverified latency or emotional outcomes. Keep all secrets out of docs.

- [ ] **Step 2: Mark this plan complete and format Markdown**

Run: `pnpm exec prettier --write README.md docs/**/*.md`

Expected: files format without errors.

### Task 7: Full verification, production build, commit, and push

**Files:**

- Verify all files changed in Tasks 1–6

**Interfaces:**

- Produces commit after `2a06a92` and updates `origin/master`

- [ ] **Step 1: Run full automated verification**

```powershell
pnpm test
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

Expected: API tests, Web tests, ESLint, TypeScript, Ruff, Next.js build, Prettier, and whitespace checks all PASS.

- [ ] **Step 2: Review security and behavior invariants**

Search for exposed credentials, A/B-choice fallback phrases, unhandled old event types, unbounded bubble counts, and migration/RLS regressions.

- [ ] **Step 3: Review the complete diff**

Confirm only V2 design, plan, migration, API, Web, tests, README, and deployment docs changed.

- [ ] **Step 4: Commit once and push master**

```powershell
git add .
git commit -m "feat upgrade companion conversation experience"
git -c http.proxy=http://127.0.0.1:19726 push origin master
```

- [ ] **Step 5: Confirm remote master**

Run `git ls-remote origin refs/heads/master` and confirm it matches `git rev-parse HEAD`; `git status --short` must be empty.
