import type { SummaryLanguage } from "./day.js";
import { parseSoulCard, type SoulCard, type SoulRecord } from "./soul.js";
import { stripControlChars } from "./sanitise.js";

/**
 * The /soul command renders cards with Telegram's **MarkdownV2** parse
 * mode. MarkdownV2 is needed for ONE feature: the expandable blockquote
 * (`**>line\n>line||`) — the card body arrives collapsed and each user
 * taps "show more" on their own client. Legacy `Markdown` has no such
 * entity.
 *
 * The price is a much larger escape surface: MarkdownV2 treats
 * `_ * [ ] ( ) ~ \` > # + - = | { } . !` and `\` all as special, so
 * every interpolated character outside an entity must be escaped.
 *
 * Card text is member-influenced (souls evolve from what people say in
 * chat), so every interpolated field is escaped before it lands in the
 * message — otherwise a member could forge styling or break parsing,
 * which in MarkdownV2 means a 400 that drops the whole message.
 */
export const SOUL_CARD_PARSE_MODE = "MarkdownV2";

/**
 * Escape every MarkdownV2 metacharacter in interpolated text. Backslash
 * is in the class and the regex consumes it like any other char, so a
 * literal `\` (the `¯\_(ツ)_/¯` kaomoji) becomes `\\` — no dangling
 * escape. The full set is mandated by Telegram's MarkdownV2 spec.
 */
function esc(text: string): string {
  return stripControlChars(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/** Stat axis labels in display order, with a fixed-width pad for alignment. */
const STAT_AXES = [
  "verbosity",
  "humor",
  "chaos",
  "wisdom",
  "horniness",
  "menace",
] as const;
type StatAxis = (typeof STAT_AXES)[number];

const STAT_LABELS: Record<SummaryLanguage, Record<StatAxis, string>> = {
  es: {
    verbosity: "Verborrea",
    humor: "Humor",
    chaos: "Caos",
    wisdom: "Sabiduría",
    horniness: "Salidez",
    menace: "Amenaza",
  },
  en: {
    verbosity: "Verbosity",
    humor: "Humor",
    chaos: "Chaos",
    wisdom: "Wisdom",
    horniness: "Horniness",
    menace: "Menace",
  },
};

/** A 10-cell bar — `value` filled, the rest empty. `value` is 1–10. */
function statBar(value: number): string {
  const filled = Math.max(0, Math.min(10, value));
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
}

/**
 * Render the six stat lines. `▰▱` bar chars are not MarkdownV2
 * metacharacters; the static labels are escaped (they're plain words,
 * but escaping is uniform and cheap) and the value is a 1–10 integer.
 */
function renderStats(card: SoulCard, language: SummaryLanguage): string {
  const labels = STAT_LABELS[language];
  const width = Math.max(...STAT_AXES.map((axis) => labels[axis].length));
  return STAT_AXES.map((axis) => {
    const value = card.stats[axis];
    const label = esc(labels[axis].padEnd(width));
    return `${label}  ${statBar(value)}  ${esc(String(value))}`;
  }).join("\n");
}

/** A bulleted list of escaped items, or "" when the list is empty. */
function bulletList(items: readonly string[]): string {
  return items.map((item) => `• ${esc(item)}`).join("\n");
}

const SECTIONS: Record<
  SummaryLanguage,
  {
    readonly stats: string;
    readonly essence: string;
    readonly traits: string;
    readonly quirks: string;
    readonly skills: string;
    readonly updated: (at: string, runs: number) => string;
  }
> = {
  es: {
    stats: "📊 *Estadísticas*",
    essence: "✨ *Esencia*",
    traits: "🔮 *Rasgos*",
    quirks: "🌀 *Manías*",
    skills: "⚔️ *Habilidades*",
    updated: (at, runs) =>
      `_actualizada ${esc(at)} · evolución nº${esc(String(runs))}_`,
  },
  en: {
    stats: "📊 *Stats*",
    essence: "✨ *Essence*",
    traits: "🔮 *Traits*",
    quirks: "🌀 *Quirks*",
    skills: "⚔️ *Skills*",
    updated: (at, runs) =>
      `_updated ${esc(at)} · evolution \\#${esc(String(runs))}_`,
  },
};

/** "Josep (@vidal)" / "Josep" — the member identity sub-header. */
function memberLine(soul: SoulRecord): string {
  if (soul.username !== undefined && soul.username.length > 0) {
    return `${esc(soul.first_name)} \\(@${esc(soul.username)}\\)`;
  }
  return esc(soul.first_name);
}

/** Calendar date (YYYY-MM-DD) of an ISO timestamp, for the footer. */
function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Wrap a multi-line body in a MarkdownV2 **expandable** blockquote:
 * every line gets a `>` prefix, the first line is prefixed `**` (the
 * "expandable" marker) and the last line suffixed `||`. The client
 * shows it collapsed with a "show more" — each viewer expands it on
 * their own. Blank lines inside still need the `>` so the quote isn't
 * split into two separate blocks.
 */
function expandableQuote(body: string): string {
  const quoted = body.split("\n").map((line) => `>${line}`);
  const first = quoted[0];
  const last = quoted[quoted.length - 1];
  if (first === undefined || last === undefined) return "";
  if (quoted.length === 1) return `**${first}||`;
  quoted[0] = `**${first}`;
  quoted[quoted.length - 1] = `${last}||`;
  return quoted.join("\n");
}

/**
 * Render a member's soul as a Telegram-styled character card, ready to
 * send with `parse_mode: SOUL_CARD_PARSE_MODE`. Returns null when the
 * stored `soul_text` doesn't parse as a card (a legacy free-text soul) —
 * the caller treats that the same as "no soul yet".
 *
 * Layout: the header (class title, member, catchphrase) is always
 * visible; everything below — stats, essence, traits, quirks, skills,
 * footer — sits inside an expandable blockquote so the card arrives
 * collapsed and the reader taps to see the full soul.
 *
 * The card's `notes` field is deliberately NOT rendered: it's an
 * internal running memory for the souls cron and the /rpv question
 * context, not something to surface publicly.
 */
export function renderSoulCard(
  soul: SoulRecord,
  language: SummaryLanguage,
): string | null {
  const card = parseSoulCard(soul.soul_text);
  if (card === null) return null;
  const t = SECTIONS[language];

  // Always-visible header — the "collapsed" view.
  const header: string[] = [`🃏 *${esc(card.title)}*`, memberLine(soul)];
  if (card.catchphrase !== undefined && card.catchphrase.length > 0) {
    header.push(`_“${esc(card.catchphrase)}”_`);
  }

  // Body — collapsed into the expandable blockquote.
  const body: string[] = [t.stats, renderStats(card, language)];
  body.push("", t.essence, esc(card.essence));
  if (card.traits.length > 0) {
    body.push("", t.traits, bulletList(card.traits));
  }
  if (card.quirks.length > 0) {
    body.push("", t.quirks, bulletList(card.quirks));
  }
  if (card.skills.length > 0) {
    body.push("", t.skills, bulletList(card.skills));
  }
  body.push("", t.updated(dateOnly(soul.updated_at), soul.runs));

  return `${header.join("\n")}\n${expandableQuote(body.join("\n"))}`;
}
