# GitHub README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, image-rich GitHub README that presents the product and accurately documents the current architecture, development workflow, and production deployment.

**Architecture:** Keep the README self-contained: one repository-hosted mobile screenshot provides the product visual, while GitHub-native Mermaid diagrams explain system topology and chat/voice/memory flow. All technical claims and commands are derived from the current source, migrations, package scripts, and deployment files.

**Tech Stack:** GitHub Flavored Markdown, Mermaid, Next.js 16, React 19, FastAPI, LangChain, SiliconFlow, Supabase, Vercel, Render

## Global Constraints

- Chinese is the primary language; official technology names remain in English.
- “陆川” is explicitly described as a fictional AI companion, never a real person.
- Use only repository-relative image links and GitHub-native Mermaid diagrams.
- Do not include API keys, database passwords, private user history, or unverified performance claims.
- Commands, environment variables, routes, models, and deployment settings must match the current repository.

---

### Task 1: Capture the production mobile interface

**Files:**

- Create: `docs/assets/loveyourboyfriend-mobile.png`

**Interfaces:**

- Consumes: production page `https://loveyourboyfriend.daidai634.com/`
- Produces: a 430 × 913 mobile screenshot referenced by `README.md`

- [x] **Step 1: Open the production page in an isolated browser tab**

Use a mobile viewport and wait until the title, “陆川” header, chat content, and message composer are visible. The in-app browser exports the visible content area as a 430 × 913 PNG after reserving its browser safety inset.

- [x] **Step 2: Verify screenshot privacy and currency**

Confirm the screen contains no browser chrome, developer tools, credentials, or real user history. The header must display “陆川” and the current dark mobile design.

- [x] **Step 3: Save and inspect the image**

Save the PNG as `docs/assets/loveyourboyfriend-mobile.png`, then visually inspect the local file at its original resolution.

Expected: a readable portrait screenshot with the entire mobile chat shell inside the frame.

### Task 2: Rewrite the repository README

**Files:**

- Modify: `README.md`
- Reference: `docs/assets/loveyourboyfriend-mobile.png`
- Reference: `docs/deployment.md`
- Reference: `render.yaml`
- Reference: `apps/web/.env.example`
- Reference: `apps/api/.env.example`

**Interfaces:**

- Consumes: the screenshot from Task 1 and the verified repository inventory
- Produces: the GitHub repository landing page

- [x] **Step 1: Build the product-facing opening**

Add the project title, concise positioning, production demo links, current MVP status, and the mobile screenshot. State that the experience is for adults and that “陆川” is a fictional AI persona.

- [x] **Step 2: Document implemented capabilities**

Cover anonymous Supabase sessions, restored conversation history, NDJSON streaming, Qwen chat through LangChain, structured long-term memory, voice input/output, private voice storage, contextual fallback, and 90-day retention.

- [x] **Step 3: Add the system architecture diagram**

Use Mermaid to connect Mobile H5 → Vercel Next.js → Render FastAPI → LangChain/SiliconFlow and Supabase Auth/PostgreSQL/Storage, including Render Cron and `pg_cron` cleanup responsibilities.

- [x] **Step 4: Add the core request-flow diagram**

Use Mermaid to show anonymous authentication, text or voice input, transcription, recent history plus confirmed memories, `ChatPromptTemplate → ChatOpenAI → StrOutputParser`, streaming persistence, structured memory extraction, and optional speech synthesis.

- [x] **Step 5: Explain modules and repository layout**

Document the responsibilities of `apps/web`, `apps/api/app/ai`, routes, services, repositories, tests, Supabase migrations, Render Blueprint, and deployment documentation.

- [x] **Step 6: Add reproducible development instructions**

Include prerequisites, environment file copy commands, `pnpm install`, `uv sync --project apps/api`, `pnpm dev:web`, `pnpm dev:api`, and the root test/lint/build/format commands exactly as defined in `package.json`.

- [x] **Step 7: Document configuration, API, deployment, and privacy**

List public and server-side environment variable groups without values, summarize the `/health`, `/v1/chat/stream`, conversation, message-audio, transcription, and speech routes, then explain the Vercel + Render + Supabase production chain, RLS isolation, private voice bucket, and cleanup jobs.

### Task 3: Verify documentation quality and publish

**Files:**

- Modify: `README.md` only if verification reveals an issue
- Modify: `docs/superpowers/plans/2026-07-15-github-readme.md` to mark completed steps

**Interfaces:**

- Consumes: Tasks 1–2 outputs
- Produces: a clean commit on `master` pushed to `origin`

- [x] **Step 1: Scan for placeholders and secrets**

Run:

```powershell
rg -n "TBD|TODO|sk-[A-Za-z0-9]|postgres(?:ql)?://[^\s]+:[^\s]+@" README.md docs/assets
```

Expected: no matches.

- [x] **Step 2: Verify every local README link**

Check the screenshot, deployment guide, environment examples, source directories, migrations, and plan/spec links resolve inside the repository.

- [x] **Step 3: Run formatting and project checks**

Run:

```powershell
pnpm exec prettier --check README.md docs/superpowers/plans/2026-07-15-github-readme.md
pnpm test
pnpm lint
pnpm build
git diff --check
```

Expected: Prettier, web/API tests, ESLint, TypeScript, Ruff, Next.js production build, and whitespace checks all pass.

- [x] **Step 4: Review the final diff and repository status**

Confirm only the intended README, screenshot, and implementation plan are changed.

- [x] **Step 5: Commit and push**

```powershell
git add README.md docs/assets/loveyourboyfriend-mobile.png docs/superpowers/plans/2026-07-15-github-readme.md
git commit -m "docs showcase project architecture and experience"
git -c http.proxy=http://127.0.0.1:19726 push origin master
```

Expected: `master` is pushed successfully to `origin` and `git status --short` is empty.
