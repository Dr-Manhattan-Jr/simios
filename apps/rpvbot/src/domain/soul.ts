import { z } from "zod";
import { NOTES_MAX_CHARS } from "./cap.js";
import { fenceBody } from "./fence.js";
import { decodeNewlines, type MessageRecord } from "./message.js";
import { stripControlChars } from "./sanitise.js";

/**
 * Six fixed numeric stat axes, each scored 1–10 relative to a normal
 * group member (5 = average). Fixed and shared across every member's
 * card — this is the "common ground" that makes cards comparable.
 */
export const SoulStatsSchema = z.object({
  verbosity: z.number().int().min(1).max(10),
  humor: z.number().int().min(1).max(10),
  chaos: z.number().int().min(1).max(10),
  wisdom: z.number().int().min(1).max(10),
  horniness: z.number().int().min(1).max(10),
  menace: z.number().int().min(1).max(10),
});
export type SoulStats = z.infer<typeof SoulStatsSchema>;

// Field caps. Named so the schema and clampSoulCard share one source of
// truth — clamping must trim to exactly what the schema then accepts.
const TITLE_MAX = 80;
const ESSENCE_MAX = 400;
const TRAITS_MAX_ITEMS = 5;
const TRAIT_MAX = 120;
const QUIRKS_MAX_ITEMS = 4;
const QUIRK_MAX = 160;
const SKILLS_MAX_ITEMS = 5;
const SKILL_MAX = 140;
const CATCHPHRASE_MAX = 200;

/**
 * A member's soul, as a dark-fantasy RPG character card. The numeric
 * stats are the fixed shared axes; title / traits / quirks are free,
 * imaginative, person-specific text the souls cron writes from chat.
 */
export const SoulCardSchema = z.object({
  // Dark-fantasy class title, e.g. "El Arquitecto de la Medianoche".
  title: z.string().min(1).max(TITLE_MAX),
  // 1–2 sentence personality essence.
  essence: z.string().min(1).max(ESSENCE_MAX),
  // Free, imaginative trait phrases.
  traits: z.array(z.string().min(1).max(TRAIT_MAX)).min(1).max(TRAITS_MAX_ITEMS),
  // Free, imaginative quirk phrases.
  quirks: z.array(z.string().min(1).max(QUIRK_MAX)).min(1).max(QUIRKS_MAX_ITEMS),
  // Funny RPG-style "abilities" / special skills, e.g. "Necromancy of
  // dead group chats", "+5 to procrastination". Free and imaginative.
  skills: z.array(z.string().min(1).max(SKILL_MAX)).min(1).max(SKILLS_MAX_ITEMS),
  // A characteristic line/catchphrase — not everyone has one.
  catchphrase: z.string().max(CATCHPHRASE_MAX).optional(),
  // Free-text running memory — looser than the structured fields above.
  // The daily cron rewrites it each run, folding in the new day, so it
  // holds nuance / in-jokes / evolving context that doesn't fit a
  // trait/quirk/skill slot. Required (every card has it) but may be an
  // empty string for a near-silent member.
  notes: z.string().max(NOTES_MAX_CHARS),
  stats: SoulStatsSchema,
});
export type SoulCard = z.infer<typeof SoulCardSchema>;

/**
 * Trim a raw Gemini soul-card object to the schema's caps BEFORE
 * validation: Gemini routinely over-runs the soft limits (a 150-char
 * skill, a 5th quirk). Without this, zod rejects the whole otherwise-
 * good card and the member is skipped. clampSoulCard repairs the
 * fixable over-runs — over-long strings truncated, over-long arrays
 * sliced — so the card passes. It does NOT fix structural problems
 * (a missing field, a stat of 15, a non-array `traits`); those still
 * fail safeParse and trigger the cron's retry.
 *
 * Garbage / non-object input is returned unchanged — let zod reject it.
 */
export function clampSoulCard(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return raw;
  }
  // Object.entries on `object` is typed [string, unknown][] — no cast.
  const obj = new Map<string, unknown>(Object.entries(raw));

  const clampStr = (key: string, max: number): void => {
    const v = obj.get(key);
    if (typeof v === "string" && v.length > max) {
      obj.set(key, v.slice(0, max).trimEnd());
    }
  };
  const clampArr = (key: string, maxItems: number, maxChars: number): void => {
    const v = obj.get(key);
    if (!Array.isArray(v)) return;
    obj.set(
      key,
      v
        .slice(0, maxItems)
        .map((item: unknown) =>
          typeof item === "string" && item.length > maxChars
            ? item.slice(0, maxChars).trimEnd()
            : item,
        ),
    );
  };

  clampStr("title", TITLE_MAX);
  clampStr("essence", ESSENCE_MAX);
  clampStr("catchphrase", CATCHPHRASE_MAX);
  clampStr("notes", NOTES_MAX_CHARS);
  clampArr("traits", TRAITS_MAX_ITEMS, TRAIT_MAX);
  clampArr("quirks", QUIRKS_MAX_ITEMS, QUIRK_MAX);
  clampArr("skills", SKILLS_MAX_ITEMS, SKILL_MAX);
  return Object.fromEntries(obj);
}

/**
 * One row per group member with at least one stored message. Updated
 * daily at 12:00 Madrid by the souls cron, which folds the previous
 * day's messages from this user into the existing card via Gemini.
 *
 * Stored on the `rpv_souls` tab. Keyed on user_id so updates are upsert
 * in place — total storage is bounded by the member count, not by time.
 *
 * `soul_text` holds the card as a newline-encoded JSON string. Legacy
 * rows from before the card format hold free prose; parseSoulCard
 * returns null for those and the cron regenerates them.
 */
export const SoulRecordSchema = z.object({
  user_id: z.number().int(),
  username: z.string().optional(),
  first_name: z.string().min(1),
  soul_text: z.string(),
  // Denormalised length of soul_text (post-encoding) so monitoring the
  // cap is a single column read instead of a string scan.
  soul_chars: z.number().int().nonnegative(),
  updated_at: z.string().min(1),
  // Monotonic counter — helps spot members who go silent.
  runs: z.number().int().nonnegative(),
});
export type SoulRecord = z.infer<typeof SoulRecordSchema>;

/**
 * Decode a stored `soul_text` cell into a SoulCard. Returns null for
 * anything that isn't a valid card — legacy free-text souls, malformed
 * or truncated JSON. A null result means "no usable card": the cron
 * treats the member as having no prior card and regenerates one.
 */
export function parseSoulCard(soulText: string): SoulCard | null {
  const decoded = decodeNewlines(soulText).trim();
  if (decoded.length === 0) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(decoded);
  } catch {
    return null;
  }
  const parsed = SoulCardSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Serialise a card for storage in the `soul_text` cell. */
export function serialiseSoulCard(card: SoulCard): string {
  return JSON.stringify(card);
}

/**
 * Group messages that fall inside `window` by user_id, preserving
 * chronological order within each user's bucket. Pure helper — lives in
 * the domain so cron files stay pure orchestration.
 */
export function groupMessagesByUser(
  allMessages: readonly MessageRecord[],
  window: { readonly startUtc: string; readonly endUtc: string },
): Map<number, MessageRecord[]> {
  const inWindow = allMessages
    .filter((m) => m.sent_at >= window.startUtc && m.sent_at < window.endUtc)
    .sort((a, b) =>
      a.sent_at < b.sent_at ? -1 : a.sent_at > b.sent_at ? 1 : 0,
    );
  const byUser = new Map<number, MessageRecord[]>();
  for (const m of inWindow) {
    const arr = byUser.get(m.user_id) ?? [];
    arr.push(m);
    byUser.set(m.user_id, arr);
  }
  return byUser;
}

/**
 * Member label for a soul. Members are most often referred to by their
 * @handle in questions ("what is @vidal like?"), so the handle must be
 * front and centre when present. Format: "Josep (@vidal)" — name then
 * handle. When a member has no public username, say so explicitly so
 * the model doesn't treat the absence as meaningful.
 */
function soulLabel(s: SoulRecord): string {
  if (s.username !== undefined && s.username.length > 0) {
    return `${s.first_name} (@${s.username})`;
  }
  return `${s.first_name} (no @handle)`;
}

/**
 * Compact, single-line text form of a card for the question prompt. All
 * the card's text fields are member-influenced (a member shapes their
 * own card over time), so strip control chars — zero-width spaces, bidi
 * overrides — before interpolating, on top of the <msg> fence the caller
 * adds.
 */
function compactCard(card: SoulCard): string {
  const s = card.stats;
  const statsLine =
    `stats: verbosity ${String(s.verbosity)}, humor ${String(s.humor)}, ` +
    `chaos ${String(s.chaos)}, wisdom ${String(s.wisdom)}, ` +
    `horniness ${String(s.horniness)}, menace ${String(s.menace)}`;
  const parts = [
    `class: ${card.title}`,
    statsLine,
    `essence: ${card.essence}`,
    `traits: ${card.traits.join("; ")}`,
    `quirks: ${card.quirks.join("; ")}`,
    `skills: ${card.skills.join("; ")}`,
  ];
  if (card.catchphrase !== undefined && card.catchphrase.length > 0) {
    parts.push(`catchphrase: ${card.catchphrase}`);
  }
  if (card.notes.length > 0) {
    parts.push(`notes: ${card.notes}`);
  }
  // Strip control chars, then collapse whitespace so the fenced body
  // stays on one line — same convention as transcript bodies.
  return stripControlChars(parts.join(" | ")).replace(/\s+/g, " ").trim();
}

/**
 * Render all member souls into a text block for the /rpv question
 * prompt. Each member is two lines — a "Name (@handle) — Title" header,
 * then the card's compact form fenced in <msg>…</msg>. Returns "" for an
 * empty list, or when no soul parses as a card (legacy free-text rows
 * are skipped — the question is still answered transcript-only).
 *
 * The fence keeps an injection-shaped card (a member can influence their
 * own card over time) from forging prompt structure — same defence as
 * transcript message bodies.
 */
export function renderSouls(souls: readonly SoulRecord[]): string {
  const blocks: string[] = [];
  for (const s of [...souls].sort((a, b) =>
    a.first_name.localeCompare(b.first_name),
  )) {
    const card = parseSoulCard(s.soul_text);
    if (card === null) continue;
    // The title sits OUTSIDE the <msg> fence in the header line, so it
    // can't rely on fenceBody — strip control chars and collapse
    // whitespace so a member-steered title can't inject newlines or
    // fake structure. The fenced compactCard carries the title too.
    const safeTitle = stripControlChars(card.title).replace(/\s+/g, " ").trim();
    blocks.push(
      `${soulLabel(s)} — ${safeTitle}\n${fenceBody(compactCard(card))}`,
    );
  }
  return blocks.join("\n");
}

/**
 * Truncate a string to `maxChars` code points (not UTF-16 code units),
 * so emoji and combining marks are never split mid-character. The "…"
 * suffix is included in the cap.
 */
export function capSoul(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  const codepoints = Array.from(text);
  if (codepoints.length <= maxChars) return text;
  const headLen = Math.max(0, maxChars - 1);
  return codepoints.slice(0, headLen).join("").trimEnd() + "…";
}
