import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { encodeNewlines } from "../src/domain/message.js";
import { renderSoulCard } from "../src/domain/soul-card-render.js";
import {
  serialiseSoulCard,
  type SoulCard,
  type SoulRecord,
} from "../src/domain/soul.js";

function card(over: Partial<SoulCard> = {}): SoulCard {
  return {
    title: "El Arquitecto de la Medianoche",
    essence: "Seco, preciso, alérgico a la paja.",
    traits: ["Perfeccionista nocturno", "Francotirador del sarcasmo"],
    quirks: ["Responde con monosílabos durante días"],
    skills: ["Nigromancia de chats muertos", "+5 a descarrilar"],
    catchphrase: "no, ¿qué estás fumando?",
    notes: "Lleva semanas peleándose con el deploy de Railway.",
    stats: {
      verbosity: 7,
      humor: 8,
      chaos: 3,
      wisdom: 8,
      horniness: 2,
      menace: 4,
    },
    ...over,
  };
}

function soulRow(over: Partial<SoulRecord> = {}): SoulRecord {
  return {
    user_id: 1,
    username: "vidal",
    first_name: "Josep",
    soul_text: encodeNewlines(serialiseSoulCard(card())),
    soul_chars: 200,
    updated_at: "2026-05-22T02:00:00.000Z",
    runs: 14,
    ...over,
  };
}

describe("renderSoulCard", () => {
  it("renders a card with title, member line, and all sections", () => {
    const out = renderSoulCard(soulRow(), "es");
    assert.ok(out !== null);
    assert.ok(out.includes("🃏 *El Arquitecto de la Medianoche*"));
    // MarkdownV2 escapes the ( ) around the handle.
    assert.ok(out.includes("Josep \\(@vidal\\)"));
    assert.ok(out.includes("📊 *Estadísticas*"));
    assert.ok(out.includes("✨ *Esencia*"));
    assert.ok(out.includes("🔮 *Rasgos*"));
    assert.ok(out.includes("🌀 *Manías*"));
    assert.ok(out.includes("⚔️ *Habilidades*"));
  });

  it("wraps the card body in an expandable blockquote", () => {
    const out = renderSoulCard(soulRow(), "es");
    assert.ok(out !== null);
    const lines = out.split("\n");
    // Header lines (title, member) are NOT quoted — always visible.
    assert.ok(lines[0]?.startsWith("🃏 "));
    assert.ok(lines[1]?.startsWith("Josep "));
    // Exactly one line opens the expandable quote with `**>`.
    const openerIdx = lines.findIndex((l) => l.startsWith("**>"));
    assert.ok(openerIdx >= 0, "expected a **> opener");
    assert.equal(
      lines.filter((l) => l.startsWith("**>")).length,
      1,
      "the **> marker must appear exactly once",
    );
    // The last line closes the expandable quote with `||`.
    assert.ok(out.endsWith("||"));
    // Every line from the opener onward is `>`-prefixed so the quote is
    // one contiguous block (a non-quoted line would split it in two).
    for (const line of lines.slice(openerIdx)) {
      assert.ok(
        line.startsWith(">") || line.startsWith("**>"),
        `body line not quoted: ${JSON.stringify(line)}`,
      );
    }
    // No header line before the opener is quoted.
    for (const line of lines.slice(0, openerIdx)) {
      assert.ok(!line.startsWith(">"), `header line was quoted: ${line}`);
    }
  });

  it("never renders the internal notes field", () => {
    // `notes` is the souls cron's private running memory — not for
    // public display. It must never appear in the /soul card.
    const out = renderSoulCard(
      soulRow({
        soul_text: encodeNewlines(
          serialiseSoulCard(
            card({ notes: "SECRETO: chiste interno sobre el deploy" }),
          ),
        ),
      }),
      "es",
    );
    assert.ok(out !== null);
    assert.ok(!out.includes("SECRETO"));
    assert.ok(!out.includes("Crónica"));
    assert.ok(!out.includes("Chronicle"));
  });

  it("renders stat bars with the right fill for each value", () => {
    const out = renderSoulCard(
      soulRow({
        soul_text: encodeNewlines(
          serialiseSoulCard(
            card({
              stats: {
                verbosity: 1,
                humor: 10,
                chaos: 5,
                wisdom: 8,
                horniness: 2,
                menace: 4,
              },
            }),
          ),
        ),
      }),
      "es",
    );
    assert.ok(out !== null);
    // verbosity 1 → 1 filled, 9 empty.
    assert.ok(out.includes("▰▱▱▱▱▱▱▱▱▱"));
    // humor 10 → all filled.
    assert.ok(out.includes("▰▰▰▰▰▰▰▰▰▰"));
  });

  it("uses English labels on Fridays", () => {
    const out = renderSoulCard(soulRow(), "en");
    assert.ok(out !== null);
    assert.ok(out.includes("📊 *Stats*"));
    assert.ok(out.includes("✨ *Essence*"));
    assert.ok(out.includes("🔮 *Traits*"));
    assert.ok(out.includes("updated 2026\\-05\\-22"));
    // MarkdownV2 escapes the # in the footer.
    assert.ok(out.includes("evolution \\#14"));
  });

  it("includes the catchphrase when present and omits it otherwise", () => {
    const withPhrase = renderSoulCard(soulRow(), "es");
    assert.ok(withPhrase?.includes("¿qué estás fumando?"));

    const noPhraseCard = card();
    const { catchphrase: _omit, ...rest } = noPhraseCard;
    const without = renderSoulCard(
      soulRow({ soul_text: encodeNewlines(JSON.stringify(rest)) }),
      "es",
    );
    assert.ok(without !== null);
    assert.ok(!without.includes("“"));
  });

  it("keeps the catchphrase in the always-visible header, not the quote", () => {
    const out = renderSoulCard(soulRow(), "es");
    assert.ok(out !== null);
    const lines = out.split("\n");
    const phraseLine = lines.find((l) => l.includes("fumando"));
    assert.ok(phraseLine !== undefined);
    // The catchphrase is a header line — not `>`-quoted.
    assert.ok(!phraseLine.startsWith(">"));
    assert.ok(!phraseLine.startsWith("**>"));
  });

  it("shows just the first name when the member has no @handle", () => {
    const out = renderSoulCard(soulRow({ username: undefined }), "es");
    assert.ok(out !== null);
    assert.ok(out.includes("Josep"));
    assert.ok(!out.includes("\\(@"));
  });

  it("returns null for a legacy free-text soul", () => {
    assert.equal(
      renderSoulCard(soulRow({ soul_text: "una vieja alma en prosa" }), "es"),
      null,
    );
  });

  it("escapes MarkdownV2 metacharacters in member-written card text", () => {
    const out = renderSoulCard(
      soulRow({
        soul_text: encodeNewlines(
          serialiseSoulCard(
            card({
              title: "El *Falso* Negrita",
              essence: "Cita (con) puntos. y guion-bajo_ y #hash.",
            }),
          ),
        ),
      }),
      "es",
    );
    assert.ok(out !== null);
    // The literal metacharacters from card text are backslash-escaped;
    // the title's own surrounding * (our styling) stay unescaped.
    assert.ok(out.includes("El \\*Falso\\* Negrita"));
    assert.ok(out.includes("\\(con\\)"));
    assert.ok(out.includes("puntos\\."));
    assert.ok(out.includes("guion\\-bajo\\_"));
    assert.ok(out.includes("\\#hash"));
  });

  it("escapes a literal backslash so the shrug kaomoji doesn't break parsing", () => {
    // ¯\_(ツ)_/¯ — backslash + underscore + parens. Each literal `\`
    // must become `\\` so it doesn't dangle as an escape; each `_` `(`
    // `)` becomes `\_` `\(` `\)`.
    const out = renderSoulCard(
      soulRow({
        soul_text: encodeNewlines(
          serialiseSoulCard(card({ essence: "se encoge ¯\\_(ツ)_/¯ y calla" })),
        ),
      }),
      "es",
    );
    assert.ok(out !== null);
    // Literal `\` → `\\`, `_` → `\_`, `(` → `\(`, `)` → `\)`.
    assert.ok(out.includes("¯\\\\\\_\\(ツ\\)\\_/¯"));
    // Styling metacharacters stay balanced — even count of unescaped
    // `*` and `_` (escaped ones are preceded by a backslash).
    const unescapedStars = (out.match(/(?<!\\)\*/g) ?? []).length;
    const unescapedUnders = (out.match(/(?<!\\)_/g) ?? []).length;
    assert.equal(unescapedStars % 2, 0);
    assert.equal(unescapedUnders % 2, 0);
  });

  it("keeps a realistic maxed-out card within Telegram's 4096-char limit", () => {
    // Every visible field at its zod cap, filled with ordinary text (a
    // sprinkling of metacharacters, as real card text has). `notes` is
    // excluded from the render, so the visible content caps at ~2.6k and
    // an ordinary card stays under Telegram's 4096 limit after escaping.
    // A pathological all-metacharacter card CAN exceed 4096 — that case
    // is handled by sendCard's plain-text fallback, not by this cap.
    const fill = (n: number): string =>
      "palabra del alma_".repeat(n).slice(0, n);
    const maxed = card({
      title: fill(80),
      essence: fill(400),
      traits: Array.from({ length: 5 }, () => fill(120)),
      quirks: Array.from({ length: 4 }, () => fill(160)),
      skills: Array.from({ length: 5 }, () => fill(140)),
      catchphrase: fill(200),
      notes: "N".repeat(1200),
    });
    for (const language of ["es", "en"] as const) {
      const out = renderSoulCard(
        soulRow({ soul_text: encodeNewlines(serialiseSoulCard(maxed)) }),
        language,
      );
      assert.ok(out !== null);
      assert.ok(
        out.length <= 4096,
        `${language} card was ${String(out.length)} chars`,
      );
      assert.ok(out.includes(language === "en" ? "evolution \\#" : "evolución nº"));
    }
  });
});
