# simios

A small monorepo of personal Telegram bots and the shared bits they're built on. Public so anyone can copy, fork, or take ideas — nothing here is secret.

## What's inside

### Bots

- **[ciclobot](apps/ciclobot)** — tracks a small group's weekly 5×5 weightlifting numbers (bench, squat, deadlift; optionally clean-and-jerk and snatch) plus body weight, in a Google Sheet. Sunday-evening reminder for anyone who hasn't logged. See [apps/ciclobot/README.md](apps/ciclobot/README.md) for full setup.

More bots will land here over time, each as its own package under `apps/`.

### Shared packages

- **[@simios/env](packages/env)** — zod-based env parsing helpers.
- **[@simios/sheets-client](packages/sheets-client)** — thin googleapis wrapper for service-account-authenticated Google Sheets I/O.
- **[@simios/telegram-kit](packages/telegram-kit)** — grammY bootstrap helpers shared by all bots (single-group chat guard, user parsing, mention formatting).

## Who this is for

Mostly me, and a handful of friends. If you want to:

- run your own weightlifting group tracker → fork the repo, follow [apps/ciclobot/README.md](apps/ciclobot/README.md).
- build your own Telegram bot in TypeScript → the `packages/*` libs and the project setup (pnpm workspaces + strict TS + zod schemas as source of truth) are a reasonable starting template.

## Conventions

- **TypeScript strict mode** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- **Zod is the source of truth for every data shape.** TS types are derived via `z.infer`. No `as`, no `!`, no `any` — enforced by `eslint`.
- **pnpm workspaces.** Each app and each shared package has its own `package.json` and `tsconfig.json` extending `tsconfig.base.json`.
- **Dockerfile at the root** builds whichever app is configured to deploy (currently `ciclobot`).

## Develop

```
pnpm install
pnpm typecheck   # all packages
pnpm lint
pnpm -F ciclobot dev   # run a specific app with watch
```

## License

MIT — see [LICENSE](LICENSE) if/when added.
