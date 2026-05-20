# @simios/telegram-kit

Shared grammY bootstrap helpers used by all bots in the monorepo. Single-group enforcement, user parsing, mention formatting, a long-poll retry loop, and a tiny HTTP healthcheck server.

## Exports

### `parseTelegramUser(ctx) → TelegramUser | undefined`

Parses `ctx.from` through a zod schema and returns a typed `{ user_id, username?, first_name }`. Returns `undefined` for messages without an identifiable sender (anonymous channel posts).

```ts
const user = parseTelegramUser(ctx);
if (user === undefined) return;
```

### `TelegramUserSchema` / `TelegramUser`

The zod schema and its inferred type. Both are exported so callers that need to validate user-shaped data elsewhere can reuse them.

### `onlyChat(chatId)` — middleware

```ts
bot.use(onlyChat(config.chatId));
```

Drops any update that isn't from the configured chat ID. Logs a `console.warn` listing the rejected chat ID so misconfigured deploys are obvious in logs (a frequent source of "the bot doesn't respond" confusion is putting a basic-group ID where a supergroup needed `-100` prefix).

### `mention(user) → string`

Returns `@username` when set, or just the first name otherwise. Plain text — Telegram auto-detects `@`-mentions and notifies the user. Avoids MarkdownV2 escaping bugs.

### `startBotWith409Retry(bot, { onStart, deadlineMs?, retryDelayMs?, label? }) → Promise<void>`

`bot.start()` wrapped with retry for Telegram's `409 Conflict: terminated by other getUpdates request`. Used by every bot in the monorepo because rolling deploys briefly race the new container against the old one for the long poll; without retry, the new container dies instantly.

```ts
await startBotWith409Retry(bot, {
  label: "ciclobot",
  onStart: () => { healthy = true; console.log("ciclobot: long polling started"); },
});
```

Two 409 phases are handled differently:

- **Cold start** — before the bot ever polls successfully, a 409 is retried only until `deadlineMs` (default 120s). If the token can't be taken at all within that window, the error is thrown (fatal).
- **Post-start** — once `onStart` has fired (the first `getUpdates` succeeded), a later 409 is retried **indefinitely**. A running long-poll bot that briefly loses its token must keep trying, not crash — otherwise a transient mid-run 409 kills the process, Railway restarts it, the fresh process races the dying one, and the bot enters a permanent crash loop.

The retry delay carries ±50% jitter so two racing containers desynchronise and one wins the token cleanly. Defaults: 120s cold-start deadline, 3s base retry delay. Resolves on graceful stop; throws on any non-409 failure.

### `startHealthServer({ port?, isHealthy }) → http.Server`

Tiny HTTP server on `PORT` (Railway sets this automatically; defaults to `8080`). Exposes `GET /health` returning 200 once `isHealthy()` is true, 503 before. Needed because Railway has no other way to confirm a long-polling bot is actually working — without it, deploys flicker between SUCCESS and FAILED.

```ts
let healthy = false;
startHealthServer({ isHealthy: () => healthy });
await startBotWith409Retry(bot, {
  onStart: () => { healthy = true; },
});
```

Pair with `railway.toml`:

```toml
[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 60
```

## Why this exists

Every bot in the monorepo needs the same five things: single-chat lock, user parsing, mention formatting, deploy-resilient bot start, and an HTTP healthcheck. Centralised here so adding a new bot is `import` not `copy-paste`.

## See also

- [`apps/ciclobot/src/index.ts`](../../apps/ciclobot/src/index.ts), [`apps/tractorbot/src/index.ts`](../../apps/tractorbot/src/index.ts), [`apps/los_piratas_bot/src/index.ts`](../../apps/los_piratas_bot/src/index.ts) — three call sites that all use this kit identically.
