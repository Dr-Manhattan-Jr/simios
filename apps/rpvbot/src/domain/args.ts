import { z } from "zod";
import { sanitiseQuestion } from "./question.js";

/**
 * `/rpv` accepts EITHER a positive integer (last-N summary, max RPV_MAX_N)
 * OR a free-text question about the chat history. Bare `/rpv` with no arg
 * is rejected — the previous defaultN behavior was surprising once
 * questions became valid input.
 */
export type ParsedArgs =
  | { readonly ok: true; readonly kind: "count"; readonly n: number }
  | { readonly ok: true; readonly kind: "question"; readonly text: string }
  | { readonly ok: false; readonly error: string };

interface ParseOpts {
  readonly maxN: number;
  readonly questionMaxChars: number;
}

const USAGE = "Usage: /rpv <N> or /rpv <question>. Example: /rpv 50";

export function parseRpvArgs(text: string, opts: ParseOpts): ParsedArgs {
  // grammy doesn't strip the command for us in handlers; the raw text is
  // "/rpv@botname rest" or "/rpv rest" or just "/rpv". Anchor on /rpv
  // explicitly so "/rpv50" (no space) doesn't get parsed as command
  // "/rpv50" with empty args.
  const trimmed = text.trim();
  const match = /^\/rpv(?:@\S+)?(\s+(.+))?$/.exec(trimmed);
  if (match === null) {
    return { ok: false, error: USAGE };
  }
  const afterCommand = (match[2] ?? "").trim();
  if (afterCommand.length === 0) {
    return { ok: false, error: USAGE };
  }

  // Try the numeric branch first. A bare integer is unambiguously a
  // last-N request; we don't want "/rpv 50" turning into a question
  // about the number 50.
  if (/^-?\d+$/.test(afterCommand)) {
    const schema = z.coerce.number().int().positive().max(opts.maxN);
    const parsed = schema.safeParse(afterCommand);
    if (parsed.success) {
      return { ok: true, kind: "count", n: parsed.data };
    }
    const asNumber = Number(afterCommand);
    if (asNumber <= 0) {
      return { ok: false, error: "N must be a positive integer." };
    }
    return { ok: false, error: `N must be ≤ ${String(opts.maxN)}.` };
  }

  // Decimals like "50.5" look like an attempt to specify N — don't
  // silently treat them as a question about the literal text. Reject
  // with the same usage hint the count branch uses.
  if (/^-?\d*\.\d+$/.test(afterCommand)) {
    return { ok: false, error: "N must be a positive integer." };
  }

  // Everything else is treated as a question. Sanitiser caps length
  // and strips control chars; semantic defence lives in the system
  // prompt downstream.
  const sanitised = sanitiseQuestion(afterCommand, opts.questionMaxChars);
  if (!sanitised.ok) {
    return { ok: false, error: sanitised.error };
  }
  return { ok: true, kind: "question", text: sanitised.text };
}
