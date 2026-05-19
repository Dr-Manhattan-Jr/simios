import { z } from "zod";

export type ParsedArgs =
  | { readonly ok: true; readonly n: number }
  | { readonly ok: false; readonly error: string };

interface ParseOpts {
  readonly defaultN: number;
  readonly maxN: number;
}

/**
 * Parses the argument portion of a `/rpv` command. Telegram delivers the
 * raw text including the slash and bot mention, so we accept any trailing
 * token after stripping the command itself.
 *
 * "/rpv"          → { ok: true, n: defaultN }
 * "/rpv 50"       → { ok: true, n: 50 }
 * "/rpv 0"        → error
 * "/rpv 99999"    → error (above maxN — explicit, not silently capped)
 * "/rpv abc"      → error
 */
export function parseRpvArgs(text: string, opts: ParseOpts): ParsedArgs {
  // grammy doesn't strip the command for us in handlers; the raw text is
  // "/rpv@botname rest" or "/rpv rest" or just "/rpv". Anchor on /rpv
  // explicitly so "/rpv50" (no space) doesn't get parsed as command
  // "/rpv50" with empty args (which would silently return defaultN).
  const trimmed = text.trim();
  const match = /^\/rpv(?:@\S+)?(\s+(.*))?$/.exec(trimmed);
  if (match === null) {
    return {
      ok: false,
      error: `Usage: /rpv [N]. Example: /rpv ${String(opts.defaultN)}.`,
    };
  }
  const afterCommand = (match[2] ?? "").trim();
  if (afterCommand.length === 0) {
    return { ok: true, n: opts.defaultN };
  }

  const schema = z.coerce.number().int().positive().max(opts.maxN);
  const parsed = schema.safeParse(afterCommand);
  if (!parsed.success) {
    // Disambiguate between "not a number" and "out of range" by trying
    // a looser parse first.
    const asNumber = Number(afterCommand);
    if (!Number.isFinite(asNumber) || !Number.isInteger(asNumber)) {
      return {
        ok: false,
        error: `Usage: /rpv [N]. Example: /rpv ${String(opts.defaultN)}.`,
      };
    }
    if (asNumber <= 0) {
      return { ok: false, error: "N must be a positive integer." };
    }
    return { ok: false, error: `N must be ≤ ${String(opts.maxN)}.` };
  }
  return { ok: true, n: parsed.data };
}
