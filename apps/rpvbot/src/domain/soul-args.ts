/**
 * `/soul` takes exactly one argument: a member's @username. The leading
 * `@` is optional ("/soul @vidal" and "/soul vidal" both work). Bare
 * `/soul` with no argument is rejected with a usage hint — unlike /rpv
 * there's no sensible default target.
 */
export type ParsedSoulArgs =
  | { readonly ok: true; readonly username: string }
  | { readonly ok: false; readonly error: string };

const USAGE = "Usage: /soul <@username>. Example: /soul @vidal";

// Telegram usernames are 5–32 chars of [A-Za-z0-9_]. We accept a slightly
// looser 1–32 so a typo gets a clean "no soul found" reply downstream
// rather than a confusing usage error, but still reject anything with
// spaces or punctuation that can't be a handle.
const USERNAME_RE = /^[A-Za-z0-9_]{1,32}$/;

export function parseSoulArgs(text: string): ParsedSoulArgs {
  // Same anchoring as parseRpvArgs: handle "/soul@botname rest",
  // "/soul rest", and bare "/soul" without mis-parsing "/soulvidal".
  const match = /^\/soul(?:@\S+)?(\s+(.+))?$/.exec(text.trim());
  if (match === null) {
    return { ok: false, error: USAGE };
  }
  const afterCommand = (match[2] ?? "").trim();
  if (afterCommand.length === 0) {
    return { ok: false, error: USAGE };
  }
  // Strip a single optional leading "@" — anything else is a real arg.
  const handle = afterCommand.startsWith("@")
    ? afterCommand.slice(1)
    : afterCommand;
  if (!USERNAME_RE.test(handle)) {
    return { ok: false, error: USAGE };
  }
  return { ok: true, username: handle };
}
