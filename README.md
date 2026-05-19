# simios

A small monorepo of personal Telegram bots and the shared bits they're built on. Public so anyone can copy, fork, or take ideas — nothing here is secret.

## What's inside

### Bots

- **[ciclobot](apps/ciclobot)** — tracks a small group's weekly 5×5 weightlifting numbers (bench, squat, deadlift; optionally clean-and-jerk and snatch) plus body weight, in a Google Sheet. Sunday-evening reminder for anyone who hasn't logged. See [apps/ciclobot/README.md](apps/ciclobot/README.md) for full setup.
- **[tractorbot](apps/tractorbot)** — listens to a group chat and, whenever someone says `claude` or `claudio`, replies with a freshly Gemini-generated image of a monkey driving a tractor. Each prompt randomises style, tractor, setting, and quirks; trailing text in the trigger message becomes a hint to the model. See [apps/tractorbot/README.md](apps/tractorbot/README.md) for full setup.
- **[los_piratas_bot](apps/los_piratas_bot)** — enforces "English Friday" in a Spanish-speaking Telegram group. Opt-in via `/join`. Insults Spanish messages from joined members on Fridays and corrects bad English, in the voice of a drunken pirate under Don Blas de Lezo. Stores its member list in a tab on ciclobot's spreadsheet; Gemini 2.5 Flash for the persona. See [apps/los_piratas_bot/README.md](apps/los_piratas_bot/README.md) for full setup.
- **[rpvbot](apps/rpvbot)** — **Capitán RPV**, group chronicler. Every morning at 09:00 Europe/Madrid posts a short narrative summary of yesterday's chat. Also exposes `/rpv [N]` for an on-demand summary of the last N messages (default 100, max 500). Spanish on Mon–Thu + weekends, English on Fridays. Persists messages to a `rpv_messages` tab on the shared spreadsheet (30-day rolling) and keeps all generated summaries in `rpv_summaries`. Gemini 2.5 Flash for the storytelling. See [apps/rpvbot/README.md](apps/rpvbot/README.md) for full setup.

More bots will land here over time, each as its own package under `apps/`.

### Shared packages

- **[@simios/env](packages/env)** — zod-based env parsing helpers (`NonEmptyString`, `JsonObject`, `parseEnv`).
- **[@simios/sheets-client](packages/sheets-client)** — googleapis wrapper for service-account-authenticated Google Sheets I/O, plus a `defineTable` factory so each bot's sheet tab is one tiny file.
- **[@simios/telegram-kit](packages/telegram-kit)** — grammY bootstrap helpers shared by all bots: single-group chat guard, user parsing, mention formatting, long-poll retry on Telegram 409s, and an HTTP healthcheck server for Railway.

## Who this is for

Mostly me, and a handful of friends. If you want to:

- run your own weightlifting group tracker → fork the repo, follow [apps/ciclobot/README.md](apps/ciclobot/README.md).
- run a Telegram bot that turns trigger words into AI-generated images → [apps/tractorbot/README.md](apps/tractorbot/README.md).
- enforce English-only days (or Spanish-only, or any other rule) in a group chat with an opt-in persona bot → [apps/los_piratas_bot/README.md](apps/los_piratas_bot/README.md).
- run a daily/on-demand AI chronicler that summarises group chat in storytelling form → [apps/rpvbot/README.md](apps/rpvbot/README.md).
- build your own Telegram bot in TypeScript → the `packages/*` libs and the project setup (pnpm workspaces + strict TS + zod schemas as source of truth) are a reasonable starting template.

## Conventions

- **Node 24** (current LTS). Pinned in `package.json` engines and both Dockerfiles' base image.
- **TypeScript strict mode** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- **Zod is the source of truth for every data shape.** TS types are derived via `z.infer`. No `as`, no `!`, no `any` — enforced by `eslint`.
- **pnpm workspaces.** Each app and each shared package has its own `package.json` and `tsconfig.json` extending `tsconfig.base.json`.
- **One Dockerfile per app**, living alongside the app's source (e.g. `apps/ciclobot/Dockerfile`). Build context is always the repo root so the Dockerfile can pull in shared `packages/*` and the workspace lockfile.
- **One `railway.toml` per app** under `apps/<bot>/railway.toml`. Railway needs each service's "Config Path" set to that path; otherwise Railway falls back to default detection and ignores the toml.

## Develop

```
pnpm install
pnpm typecheck   # all packages
pnpm lint
pnpm test
pnpm -F ciclobot dev          # run a specific app with watch
# also: pnpm -F tractorbot dev, pnpm -F los_piratas_bot dev, pnpm -F rpvbot dev
```

Each bot's `dev` script uses `tsx watch` and fails fast on missing env vars — see the app's README for the required env.

## Deploy

Push to `main`. Railway watches the GitHub repo and rebuilds the Dockerfile of every affected app. No CLI deploy step. After a push, `railway logs --service <name>` (e.g. `ciclobot`, `tractorbot`, `rpvbot`, or the los_piratas_bot service ID — see its README) confirms the rollout.

## License

MIT — see [LICENSE](LICENSE) if/when added.
