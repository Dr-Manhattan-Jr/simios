import { createServer, type Server } from "node:http";
import { Bot, Context, MiddlewareFn, NextFunction } from "grammy";
import { z } from "zod";

export const TelegramUserSchema = z.object({
  user_id: z.number().int(),
  username: z.string().optional(),
  first_name: z.string(),
});
export type TelegramUser = z.infer<typeof TelegramUserSchema>;

const RawFromSchema = z.object({
  id: z.number().int(),
  username: z.string().optional(),
  first_name: z.string(),
});

export function parseTelegramUser(ctx: Context): TelegramUser | undefined {
  const from = ctx.from;
  if (from === undefined) return undefined;
  const parsed = RawFromSchema.safeParse(from);
  if (!parsed.success) return undefined;
  const value: TelegramUser = parsed.data.username !== undefined
    ? {
        user_id: parsed.data.id,
        username: parsed.data.username,
        first_name: parsed.data.first_name,
      }
    : {
        user_id: parsed.data.id,
        first_name: parsed.data.first_name,
      };
  return value;
}

/** Reject updates from any chat other than the configured chat. */
export function onlyChat(chatId: number): MiddlewareFn<Context> {
  return async (ctx: Context, next: NextFunction) => {
    if (ctx.chat?.id !== chatId) return;
    await next();
  };
}

/**
 * Render a plain-text mention. `@username` notifies the user automatically
 * when Telegram auto-detects it; users without a username get a non-linkable
 * label (their first name). Plain text avoids MarkdownV2 escaping bugs.
 */
export function mention(user: TelegramUser): string {
  if (user.username !== undefined && user.username.length > 0) {
    return `@${user.username}`;
  }
  return user.first_name;
}

/**
 * Start a tiny HTTP server on PORT (Railway sets this automatically) so the
 * host can run an HTTP healthcheck against a long-polling bot. Without this,
 * Railway has no way to confirm the bot is actually alive — it just sees a
 * process running and times out the deploy.
 *
 * Routes:
 *   GET /health → 200 "ok" once isHealthy() returns true, else 503.
 *   anything else → 404.
 */
export function startHealthServer(args: {
  port?: number;
  isHealthy: () => boolean;
}): Server {
  const port = args.port ?? Number(process.env["PORT"] ?? "8080");
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      if (args.isHealthy()) {
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain");
        res.end("ok");
      } else {
        res.statusCode = 503;
        res.setHeader("content-type", "text/plain");
        res.end("starting");
      }
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(port, () => {
    console.log(`health server listening on :${String(port)}`);
  });
  return server;
}

function isConflict409(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "error_code" in err &&
    err.error_code === 409
  );
}

/**
 * Start a grammY bot's long poll, retrying when Telegram returns 409
 * (another consumer of getUpdates owns this token). Rolling deploys
 * always race the new container against the old one for the poll —
 * without retry, the new container would die instantly and Railway
 * never tears the old one down. We keep trying until the previous
 * owner gives up (or until `deadlineMs` elapses, in which case the
 * error bubbles up to the fatal-409 handler).
 *
 * Resolves only on graceful stop. Throws the original error on any
 * non-409 failure, or the most recent 409 after the deadline.
 */
export async function startBotWith409Retry<C extends Context>(
  bot: Bot<C>,
  args: {
    onStart: () => void;
    deadlineMs?: number;
    retryDelayMs?: number;
    label?: string;
  },
): Promise<void> {
  const deadlineMs = args.deadlineMs ?? 120_000;
  const retryDelayMs = args.retryDelayMs ?? 3_000;
  const label = args.label ?? "bot";
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < deadlineMs) {
    try {
      await bot.start({ onStart: args.onStart });
      return;
    } catch (err: unknown) {
      lastErr = err;
      if (!isConflict409(err)) throw err;
      const waited = Math.round((Date.now() - start) / 1000);
      console.log(
        `${label}: 409 from Telegram (another consumer holds the token), ` +
          `retrying in ${String(retryDelayMs / 1000)}s (waited ${String(waited)}s so far)`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw lastErr;
}
