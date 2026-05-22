import type { SummaryLanguage } from "./day.js";
import { parseSoulCard, type SoulCard, type SoulRecord } from "./soul.js";
import { stripControlChars } from "./sanitise.js";

/**
 * The /soul command renders cards with Telegram's legacy `Markdown`
 * parse mode (NOT MarkdownV2). Legacy Markdown only treats `*`, `_`,
 * and `` ` `` as special, so the escaping surface is tiny — and unlike
 * MarkdownV2 it doesn't choke on stray `.`, `-`, `(`, `)` etc. that
 * member-written card text is full of.
 *
 * Card text is member-influenced (souls evolve from what people say in
 * chat), so every interpolated field is escaped before it lands in a
 * Markdown-parsed message — otherwise a member could forge bold/italic
 * or break parsing. This is the same "treat stored text as untrusted"
 * stance the <msg> fence gives the question prompt.
 */
export const SOUL_CARD_PARSE_MODE = "Markdown";

/**
 * Escape every legacy-Markdown metacharacter in interpolated text.
 * Backslash MUST be first in the class — it's the escape character
 * itself, so it has to be doubled before `* _ \`` get their prefix.
 * Miss it and a literal `\` in card text (the `¯\_(ツ)_/¯` kaomoji is
 * the canonical case) leaves a `\\` + bare metacharacter, which
 * Telegram parses as an escaped backslash plus an UNBALANCED entity —
 * a 400 "Can't parse entities" that drops the whole message.
 */
function esc(text: string): string {
  return stripControlChars(text).replace(/[\\*_`]/g, "\\$&");
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
 * Render the six stat lines, label-padded to the longest label so the
 * bars line up in Telegram's proportional font as well as it can.
 */
function renderStats(card: SoulCard, language: SummaryLanguage): string {
  const labels = STAT_LABELS[language];
  const width = Math.max(...STAT_AXES.map((axis) => labels[axis].length));
  return STAT_AXES.map((axis) => {
    const value = card.stats[axis];
    const label = labels[axis].padEnd(width);
    return `\`${label}\` ${statBar(value)} \`${String(value).padStart(2)}\``;
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
    updated: (at, runs) => `_actualizada ${at} · evolución nº${String(runs)}_`,
  },
  en: {
    stats: "📊 *Stats*",
    essence: "✨ *Essence*",
    traits: "🔮 *Traits*",
    quirks: "🌀 *Quirks*",
    skills: "⚔️ *Skills*",
    updated: (at, runs) => `_updated ${at} · evolution #${String(runs)}_`,
  },
};

/** "Josep (@vidal)" / "Josep" — the member identity sub-header. */
function memberLine(soul: SoulRecord): string {
  if (soul.username !== undefined && soul.username.length > 0) {
    return `${esc(soul.first_name)} (@${esc(soul.username)})`;
  }
  return esc(soul.first_name);
}

/** Calendar date (YYYY-MM-DD) of an ISO timestamp, for the footer. */
function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Render a member's soul as a Telegram-styled character card, ready to
 * send with `parse_mode: SOUL_CARD_PARSE_MODE`. Returns null when the
 * stored `soul_text` doesn't parse as a card (a legacy free-text soul) —
 * the caller treats that the same as "no soul yet".
 *
 * The card's `notes` field is deliberately NOT rendered: it's an
 * internal running memory for the souls cron and the /rpv question
 * context, not something to surface publicly. Omitting it also keeps
 * the rendered card comfortably under Telegram's 4096-char limit — the
 * remaining fields, even all at their zod caps, sum to ~2.6k.
 */
export function renderSoulCard(
  soul: SoulRecord,
  language: SummaryLanguage,
): string | null {
  const card = parseSoulCard(soul.soul_text);
  if (card === null) return null;
  const t = SECTIONS[language];

  const lines: string[] = [`🃏 *${esc(card.title)}*`, memberLine(soul)];
  if (card.catchphrase !== undefined && card.catchphrase.length > 0) {
    lines.push("", `_“${esc(card.catchphrase)}”_`);
  }
  lines.push("", t.stats, renderStats(card, language));
  lines.push("", t.essence, esc(card.essence));
  if (card.traits.length > 0) {
    lines.push("", t.traits, bulletList(card.traits));
  }
  if (card.quirks.length > 0) {
    lines.push("", t.quirks, bulletList(card.quirks));
  }
  if (card.skills.length > 0) {
    lines.push("", t.skills, bulletList(card.skills));
  }
  lines.push("", t.updated(dateOnly(soul.updated_at), soul.runs));
  return lines.join("\n");
}
