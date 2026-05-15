# simios

A small monorepo of personal Telegram bots and the shared bits they're built on. Public so anyone can copy, fork, or take ideas — nothing here is secret.

## What's inside

### Bots

- **[ciclobot](apps/ciclobot)** — tracks a small group's weekly 5×5 weightlifting numbers (bench, squat, deadlift; optionally clean-and-jerk and snatch) plus body weight, in a Google Sheet. Sunday-evening reminder for anyone who hasn't logged. See [apps/ciclobot/README.md](apps/ciclobot/README.md) for full setup.
- **[tractorbot](apps/tractorbot)** — listens to a group chat and, whenever someone says `claude` or `claudio`, replies with a freshly Gemini-generated image of a monkey driving a tractor. Each prompt randomises style, tractor, setting, and quirks; trailing text in the trigger message becomes a hint to the model. See [apps/tractorbot/README.md](apps/tractorbot/README.md) for full setup.
- **[los_piratas_bot](apps/los_piratas_bot)** — enforces "English Friday" in a Spanish-speaking Telegram group. Opt-in via `/join`. Insults Spanish messages from joined members on Fridays and corrects bad English, in the voice of a drunken pirate under Don Blas de Lezo. Stores its member list in a tab on ciclobot's spreadsheet; Gemini 2.5 Flash for the persona. See [apps/los_piratas_bot/README.md](apps/los_piratas_bot/README.md) for full setup.

More bots will land here over time, each as its own package under `apps/`.

### Shared packages

- **[@simios/env](packages/env)** — zod-based env parsing helpers.
- **[@simios/sheets-client](packages/sheets-client)** — thin googleapis wrapper for service-account-authenticated Google Sheets I/O.
- **[@simios/telegram-kit](packages/telegram-kit)** — grammY bootstrap helpers shared by all bots (single-group chat guard, user parsing, mention formatting).

## Who this is for

Mostly me, and a handful of friends. If you want to:

- run your own weightlifting group tracker → fork the repo, follow [apps/ciclobot/README.md](apps/ciclobot/README.md).
- run a Telegram bot that turns trigger words into AI-generated images → [apps/tractorbot/README.md](apps/tractorbot/README.md).
- enforce English-only days (or Spanish-only, or any other rule) in a group chat with an opt-in persona bot → [apps/los_piratas_bot/README.md](apps/los_piratas_bot/README.md).
- build your own Telegram bot in TypeScript → the `packages/*` libs and the project setup (pnpm workspaces + strict TS + zod schemas as source of truth) are a reasonable starting template.

## Conventions

- **TypeScript strict mode** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- **Zod is the source of truth for every data shape.** TS types are derived via `z.infer`. No `as`, no `!`, no `any` — enforced by `eslint`.
- **pnpm workspaces.** Each app and each shared package has its own `package.json` and `tsconfig.json` extending `tsconfig.base.json`.
- **One Dockerfile per app**, living alongside the app's source (e.g. `apps/ciclobot/Dockerfile`). Build context is always the repo root so the Dockerfile can pull in shared `packages/*` and the workspace lockfile.

## Develop

```
pnpm install
pnpm typecheck   # all packages
pnpm lint
pnpm -F ciclobot dev   # run a specific app with watch
```

## License

MIT — see [LICENSE](LICENSE) if/when added.
