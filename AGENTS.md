# Agent instructions for the simios monorepo

These instructions apply to any agent working in this repository. They sit on top of, and never replace, the user's global instructions at `~/.claude/CLAUDE.md`.

> `CLAUDE.md` in this repo is a symlink to this file — keep them identical by editing here.

## Critical rules

These are non-negotiable. Every change must pass each one. Flag and fix in the same turn.

1. **Strict TypeScript end-to-end.** `tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Don't relax any of these.
2. **Zod schemas are the source of truth for every shape.** TS types are derived via `z.infer<typeof Schema>`. Never hand-write an interface that duplicates a schema.
3. **No `as`, no `!`, no `any`** in source. Enforced by ESLint. The only legitimate `as` is `as const`. Use zod parsing, type guards, or `satisfies` instead.
4. **One command per file** under `apps/<bot>/src/commands/` (applies to every bot). Don't bundle multiple commands together.
5. **One sheet tab per file** under `apps/<bot>/src/sheets/`. Each exports a `createTable(...)` built on `defineTable` from `@simios/sheets-client`.
6. **No re-exports.** A module never re-exports a symbol it doesn't define. Even one `export { X } from "./other"` is a violation unless it's a package's main `index.ts` aggregating its public API.
7. **Shared packages stay app-agnostic.** `@simios/env`, `@simios/sheets-client`, `@simios/telegram-kit` must not import from any `apps/*` package.
8. **Domain → Sheets dependency is one-way.** `src/domain/*` defines schemas; `src/sheets/*` imports them. The reverse is forbidden.

## Task-completion sequence

**After completing any coding task (writing or modifying code), you MUST automatically run `/post-work-review`. Do NOT wait for the user to ask — invoke it proactively via the Skill tool as soon as the task is done.** Skip only for non-coding tasks (questions, research, chatting) or truly mechanical one-line edits (typo fix, single rename).

If your environment also provides higher-priority general-purpose review skills (e.g. one for cross-diff cleanup, another for design/correctness review), run those **first**, address their findings, then run `/post-work-review` last on the post-fix tree.

Don't declare the task done until `/post-work-review` reports green.

## Verification commands

```
pnpm typecheck    # all packages
pnpm lint
pnpm test
```

All three must be green for any package you touched.

## Deploys

Deploys to Railway happen by **pushing to GitHub** — Railway watches the repo and rebuilds the Dockerfile on every push to the deploy branch. Claude must not `railway up` or otherwise CLI-deploy on the user's behalf. After the user pushes, `/post-work-review` can tail Railway logs to confirm the rollout.

## File-touch reminders

- Adding a new env var? Update `.env.example`, document it in the relevant `apps/<bot>/README.md`, and parse it through a zod schema in `apps/<bot>/src/config.ts`.
- Adding a new sheet tab? Add a file under `apps/<bot>/src/sheets/`, register the table in `apps/<bot>/src/services.ts`, ensure it from `ensureSheetsReady()`, and document its columns in the app README.
- Adding a new Telegram command? Add a file under `apps/<bot>/src/commands/`, register it in `apps/<bot>/src/index.ts`, and add it to the `setMyCommands` array.
- Adding a new shared utility? It probably belongs in an existing `packages/*` package, not a new one. Only create a new shared package when the boundary is genuinely distinct.
