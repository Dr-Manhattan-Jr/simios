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
    const incoming = ctx.chat?.id;
    if (incoming !== chatId) {
      // Log dropped updates so it's debuggable when the bot is added to the
      // wrong chat or CHAT_ID was set to the wrong number (e.g. supergroup
      // ID without the -100 prefix). Keep noise low: log only if the
      // incoming chat is known.
      if (incoming !== undefined) {
        console.warn(
          `onlyChat: dropping update from chat ${String(incoming)} ` +
            `(expected ${String(chatId)})`,
        );
      }
      return;
    }
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
 * (another consumer of getUpdates owns this token).
 *
 * There are two distinct 409 situations and they need different
 * handling:
 *
 *  1. COLD-START RACE — a rolling deploy briefly runs the new container
 *     alongside the draining old one. The new one must retry until the
 *     old one lets go. We bound this with `deadlineMs`: if we can't get
 *     the poll at all within that window, something is genuinely wrong
 *     and the error bubbles to the fatal handler.
 *
 *  2. MID-RUN 409 — the bot polled fine for a while (`onStart` already
 *     fired), then `getUpdates` 409'd because another consumer grabbed
 *     the token mid-run. The OLD design counted this against the same
 *     deadline measured from process start, so a transient 409 after
 *     ~2min of uptime threw fatal → process exit → Railway restart →
 *     the fresh process races the dying one → another 409 → a permanent
 *     crash loop. A long-poll bot that loses its token should simply
 *     keep trying, not die. So once we've successfully started at least
 *     once, 409s are retried indefinitely — the deadline no longer
 *     applies.
 *
 * Retry delay carries jitter so two racing containers desynchronise and
 * one wins the token cleanly, instead of ping-ponging in lockstep.
 *
 * Resolves only on graceful stop. Throws on any non-409 failure, or on
 * a 409 that persists past `deadlineMs` *before the bot ever started*.
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
  // Flips true the first time bot.start()'s onStart fires — i.e. the
  // first getUpdates succeeded. After that the cold-start deadline no
  // longer applies; 409s are retried forever.
  let everStarted = false;
  const markStarted = (): void => {
    everStarted = true;
    args.onStart();
  };

  for (;;) {
    try {
      await bot.start({ onStart: markStarted });
      return;
    } catch (err: unknown) {
      if (!isConflict409(err)) throw err;
      // Before the first successful start, a 409 that outlasts the
      // deadline is fatal — we never managed to take the token at all.
      if (!everStarted && Date.now() - start >= deadlineMs) {
        throw err;
      }
      // Jittered delay: ±50% so racing containers desync.
      const jittered = Math.round(
        retryDelayMs * (0.5 + Math.random()),
      );
      const phase = everStarted ? "post-start" : "cold-start";
      const waited = Math.round((Date.now() - start) / 1000);
      console.log(
        `${label}: 409 from Telegram (another consumer holds the token), ` +
          `${phase} retry in ${String(Math.round(jittered / 1000))}s ` +
          `(waited ${String(waited)}s so far)`,
      );
      await new Promise((resolve) => setTimeout(resolve, jittered));
    }
  }
}
