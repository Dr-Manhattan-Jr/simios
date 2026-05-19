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

### 3. Per-app rules (apply to every `apps/<bot>/`)

The monorepo currently hosts four bots: `ciclobot` (weightlifting tracker, sheets-backed), `tractorbot` (trigger-word image generation), `los_piratas_bot` (English-Friday persona), `rpvbot` (Capitán RPV — daily group chronicler + `/rpv N` on-demand summary). The rules below apply to all four and to any future bot.

- **One command per file** under `apps/<bot>/src/commands/` (`log.ts`, `weight.ts`, `join.ts`, `crew.ts`, …). Don't bundle multiple commands into one file.
- **One sheet tab per file** under `apps/<bot>/src/sheets/`. Each file defines a `createTable(...)` factory using `defineTable` from `@simios/sheets-client`. Don't hand-roll the `listAll`/`upsert`/`removeByKey` shapes.
- **Domain schemas live in `src/domain/`.** Sheet files import schemas from there; the reverse is forbidden (no `domain/*` importing `sheets/*`).
- **Commands receive `services: Services` from a factory** (e.g. `buildLog(services)`). They never instantiate their own sheet clients.
- **Bot is locked to `CHAT_ID`** via `onlyChat()` middleware (already wired in `index.ts`). Any new "respond to anyone" pattern should be flagged.
- **Use `startBotWith409Retry` + `startHealthServer`** from `@simios/telegram-kit` in every bot's bootstrap. Don't reinvent.
- **Per-bot Railway config:** every app has its own `apps/<bot>/Dockerfile` AND `apps/<bot>/railway.toml`. The toml sets `healthcheckPath = "/health"`, `overlapSeconds = 0`, and `drainingSeconds = 0` to prevent Telegram 409 conflicts during deploy handoffs. If you change `index.ts` startup, double-check the healthcheck still flips to true after `bot.start()`'s `onStart` fires.

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
railway logs --service tractorbot
```

For `los_piratas_bot`: its Railway service was named `piaratasbot` (with a typo) at creation time and the name has stuck. Use the service UUID instead of the name to avoid confusion:

```bash
# Discover service IDs once:
railway status --json | jq '.environments.edges[].node.serviceInstances.edges[].node | {name: .serviceName, id: .serviceId}'

# Then tail by ID (stable even if the name is renamed):
railway logs --service <service-uuid>
```

If the user hasn't linked the repo locally to a Railway project, `railway link` first:

```bash
railway link
# then pick "Josep Vidal's Projects" → the right project → service
```

### 2a. NEVER dump secrets to the conversation

`railway variables --service X --kv` and `railway variables --service X --json` both dump every variable's **value**, including `BOT_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and `GEMINI_API_KEY`. Putting those into the conversation transcript leaks them. Two safe patterns:

1. **List names only**, never values:

   ```bash
   railway variables --service ciclobot --json | jq 'keys'
   ```

2. **Compare/copy values via shell, without echoing**:

   ```bash
   SHEET=$(railway variables --service ciclobot --json | jq -r '.SHEET_ID')
   railway variables --service tractorbot --set "SHEET_ID=$SHEET"
   # Never `echo $SHEET` and never `printf "%s" "$SHEET"` to stdout.
   ```

If a secret does leak (it's happened — service-account private keys got pasted into chat during this project's setup), revoke it immediately: Google Cloud Console → IAM → service account → Keys → delete; Telegram BotFather → `/token` → revoke; etc.

### 3. What "deployed successfully" looks like

Each bot prints its own startup banner. Watch for these lines:

```
ciclobot starting — chat <CHAT_ID>, tz Europe/Madrid
ciclobot: long polling started
```

```
tractorbot starting — chat <CHAT_ID>, model gemini-2.5-flash-image
tractorbot: long polling started
```

```
los_piratas_bot starting — chat <CHAT_ID>, model gemini-2.5-flash
los_piratas_bot: members loaded (N active)
los_piratas_bot: long polling started
```

```
rpvbot starting — chat <CHAT_ID>, model gemini-2.5-flash, daily <cron> <tz>
rpvbot: long polling started
```

Those mean: env parsed, sheets reachable, Telegram token accepted, long polling started. Once `long polling started` appears the healthcheck flips to 200 and Railway marks the deploy SUCCESS.

A few transient 409 retry lines (`409 from Telegram (another consumer holds the token), retrying in 3s`) are expected right after a deploy — they're the old container draining. They self-recover via `startBotWith409Retry` within ~10 seconds.

### 4. What failure modes to watch for

- `Invalid environment configuration: ...` — env vars missing or malformed. The exact var is named. Fix in Railway → Variables tab.
- `Tab not found: <tab>` or 403s from sheets API — service account doesn't have Editor access on the sheet, or the sheet ID is wrong. Re-share / check `SHEET_ID`.
- `401 Unauthorized` from Telegram → wrong `BOT_TOKEN`.
- `Error: Cannot find module ...` → Dockerfile workspace deploy missed something. Look at the `pnpm deploy` step output.
- OOM during build → bump `NODE_OPTIONS=--max-old-space-size` in the Dockerfile.
- `onlyChat: dropping update from chat <id> (expected <other>)` in logs → the bot is in a different chat than `CHAT_ID` says. For supergroups, the bot-API chat ID is `-100` + the web client's peer ID; don't confuse the two. Run `/getUpdates` against the bot token to read Telegram's authoritative `chat.id`.
- `Gemini truncated reply (finishReason=MAX_TOKENS, text="...")` from los_piratas_bot → the model used all its tokens on internal "thinking" before generating. Fix: `thinkingConfig: { thinkingBudget: 0 }` in the generation config (already set in `gemini/text.ts` — flag if someone removes it).
- `configFile: None` in `railway status --json` → Railway can't find `railway.toml`. The service's Config Path setting needs to point at `apps/<bot>/railway.toml` (set per-service in the Railway dashboard, not via the toml itself).

### 5. Don't deploy on the user's behalf

If verification (`pnpm typecheck && pnpm lint && pnpm test`) is green and the user hasn't pushed yet, **stop**. Report that the work is ready to push. Do not run `git push` unless the user explicitly asks for it — pushes trigger production deploys.

## Output

End with one of:

- `Local verification green. Tests: N passed. Ready to push when you are.` (with any deploy-watching summary if you've already monitored a push).
- A short list of issues, what you fixed, and what still needs the user's judgement.
- `Deploy live — saw 'ciclobot starting' in Railway logs at <timestamp>.` (after a successful watched deploy).
