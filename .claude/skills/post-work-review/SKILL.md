---
name: post-work-review
description: Final pass before declaring a task done in the simios monorepo — verify simios-specific rules (strict TS, zod-as-source-of-truth, no `as`/`!`/`any`, one command per file), run typecheck/lint/test for every touched package, then watch the Railway deploy roll out (deploys happen via git push, never by Claude directly).
---

Run this at the end of any non-trivial change in the simios monorepo. It runs **last**, after any general-purpose pre-completion review skills your environment provides (e.g. cross-diff cleanup or design/correctness review). Those are about general code quality across the diff; `/post-work-review` is about the simios-specific contract being intact and the deploy reaching production. If earlier review skills introduced fixes, this skill still runs on the post-fix tree. If your environment has no other review skills configured, run `/post-work-review` on its own.

## What to flag

### 1. Strict TypeScript violations

These are non-negotiable in this repo, enforced by ESLint:

- **`as` casts** — except `as const`. Use zod parsing, type guards, or `satisfies` instead.
- **Non-null assertions** (`!.foo`, `map.get(k)!`). Replace with explicit checks or `??`.
- **`any`** anywhere — type or value. Use `unknown` + a zod parse at the boundary.
- **`@ts-ignore` / `@ts-expect-error`** without a `--` reason.
- **`console.log`** left in committed code (use `console.error` for genuine error reporting in catch handlers).

### 2. Zod-as-source-of-truth violations

- A `type` / `interface` declared by hand that mirrors a zod schema's shape. Instead: `type Foo = z.infer<typeof FooSchema>`.
- An external boundary that doesn't parse through a schema: env vars, Telegram updates, Google Sheets rows, JSON env blobs. Every one of these must `.parse()` (or `.safeParse()`) before its value flows into business logic.
- `unknown` leaking past a parsing boundary. Once parsed, the value is trusted.

### 3. Per-app rules

When `apps/ciclobot/` changes:

- **One command per file** under `apps/ciclobot/src/commands/` (`log.ts`, `weight.ts`, ...). Don't bundle multiple commands into one file.
- **One sheet tab per file** under `apps/ciclobot/src/sheets/` (`participants.ts`, `log.ts`, `bodyweight.ts`). Each file defines a `createTable(...)` factory using `defineTable` from `@simios/sheets-client`. Don't hand-roll the `listAll`/`upsert`/`removeByKey` shapes — use `defineTable`.
- **Domain schemas live in `src/domain/`.** Sheet files import schemas from there; the reverse is forbidden (no `domain/*` importing `sheets/*`).
- **Commands receive `services: Services` from a factory** (e.g. `buildLog(services)`). They never instantiate their own sheet clients.
- **Bot is locked to `CHAT_ID`** via `onlyChat()` middleware (already wired in `index.ts`). Any new "respond to anyone" pattern should be flagged.

### 4. Shared-package boundaries

When `packages/*` changes:

- `@simios/env`, `@simios/sheets-client`, `@simios/telegram-kit` are **app-agnostic**. They must not import from any `apps/*` package.
- New exports must have explicit `z.infer` types in the public API. Don't export `unknown`.
- Each shared package keeps its own `tsconfig.json` extending `tsconfig.base.json`. Don't merge them.

### 5. Skill / docs drift

- If a new domain concept emerged (e.g. another tracked lift, another sheet tab, another bot), update `apps/<bot>/README.md` so a fresh reader can follow.
- If a new env var was added, add it to `.env.example` and document it in the app README's "Manual setup" section.
- If you discover a non-obvious gotcha worth remembering, update this skill (`.claude/skills/post-work-review/SKILL.md`) — but only when a concrete, reusable fact emerged.

## Verification (always run at the end)

From the repo root:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

All three must be green for any package you touched. If errors exist in code you modified, fix them before reporting done. If errors exist in files you did NOT touch, list them as "pre-existing" and move on.

If you changed something inside `apps/<bot>/` that touches the runtime path (commands, sheets, reminder, config), also run the local dev server briefly:

```bash
pnpm -F <bot> dev
```

It will fail-fast on missing env vars — that's expected without a `.env`. The point is to confirm the module graph still loads and config parsing throws a clear error rather than a stack trace.

## Deploy monitoring (Railway)

**Important:** deploys happen **via git push to main** — Railway watches the connected GitHub repo and rebuilds the Dockerfile on every push. Do NOT run `railway up` or any other CLI deploy command from Claude. The user controls when code goes out.

Your role is to **watch** the deploy that the user triggers by pushing. Steps:

### 1. Confirm the push happened

Don't assume. Ask if you're not sure, or check `git log origin/main..HEAD` (empty means everything is pushed).

### 2. Tail the build + runtime logs

Railway CLI is available globally. To stream logs from the active service:

```bash
railway logs --service ciclobot
```

(Or whatever the service is named in the user's Railway project.)

If the user hasn't linked the repo locally to a Railway project, `railway link` first:

```bash
railway link
# then pick "Josep Vidal's Projects" → the right project → ciclobot service
```

### 3. What "deployed successfully" looks like for ciclobot

The runtime log should show:

```
ciclobot starting — chat <CHAT_ID>, tz Europe/Madrid
```

That line means: env parsed, Google Sheets reachable (tabs ensured), Telegram bot token accepted, long polling started. If you see that line, the deploy is healthy.

### 4. What failure modes to watch for

- `Invalid environment configuration: ...` — env vars missing or malformed. The exact var is named. Fix in Railway → Variables tab.
- `Tab not found: <tab>` or 403s from sheets API — service account doesn't have Editor access on the sheet, or the sheet ID is wrong. Re-share / check `SHEET_ID`.
- `401 Unauthorized` from Telegram → wrong `BOT_TOKEN`.
- `Error: Cannot find module ...` → Dockerfile workspace deploy missed something. Look at the `pnpm deploy` step output.
- OOM during build → bump `NODE_OPTIONS=--max-old-space-size` in the Dockerfile.

### 5. Don't deploy on the user's behalf

If verification (`pnpm typecheck && pnpm lint && pnpm test`) is green and the user hasn't pushed yet, **stop**. Report that the work is ready to push. Do not run `git push` unless the user explicitly asks for it — pushes trigger production deploys.

## Output

End with one of:

- `Local verification green. Tests: N passed. Ready to push when you are.` (with any deploy-watching summary if you've already monitored a push).
- A short list of issues, what you fixed, and what still needs the user's judgement.
- `Deploy live — saw 'ciclobot starting' in Railway logs at <timestamp>.` (after a successful watched deploy).
