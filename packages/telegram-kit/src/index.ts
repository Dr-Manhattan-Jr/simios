import { createServer, type Server } from "node:http";
import { Context, MiddlewareFn, NextFunction } from "grammy";
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
