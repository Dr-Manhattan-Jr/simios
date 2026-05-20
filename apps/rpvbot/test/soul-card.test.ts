import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { encodeNewlines } from "../src/domain/message.js";
import {
  parseSoulCard,
  renderSouls,
  serialiseSoulCard,
  SoulCardSchema,
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

/** A card with no catchphrase (it's optional in the schema). */
function cardWithoutCatchphrase(): Omit<SoulCard, "catchphrase"> {
  const { catchphrase: _omit, ...rest } = card();
  return rest;
}

function soulRow(
  over: Partial<SoulRecord> & { user_id: number },
): SoulRecord {
  return {
    first_name: "Alice",
    soul_text: encodeNewlines(serialiseSoulCard(card())),
    soul_chars: 100,
    updated_at: "2026-05-19T12:00:00.000Z",
    runs: 1,
    ...over,
  };
}

describe("SoulCardSchema", () => {
  it("accepts a valid card", () => {
    assert.equal(SoulCardSchema.safeParse(card()).success, true);
  });

  it("rejects a stat below 1", () => {
    const bad = card({ stats: { ...card().stats, chaos: 0 } });
    assert.equal(SoulCardSchema.safeParse(bad).success, false);
  });

  it("rejects a stat above 10", () => {
    const bad = card({ stats: { ...card().stats, menace: 11 } });
    assert.equal(SoulCardSchema.safeParse(bad).success, false);
  });

  it("rejects a missing stat axis", () => {
    const stats: Record<string, number> = { ...card().stats };
    delete stats["wisdom"];
    const bad = { ...card(), stats };
    assert.equal(SoulCardSchema.safeParse(bad).success, false);
  });

  it("rejects more than 5 traits", () => {
    const bad = card({ traits: ["a", "b", "c", "d", "e", "f"] });
    assert.equal(SoulCardSchema.safeParse(bad).success, false);
  });

  it("rejects empty traits array", () => {
    const bad = card({ traits: [] });
    assert.equal(SoulCardSchema.safeParse(bad).success, false);
  });

  it("rejects empty skills array", () => {
    const bad = card({ skills: [] });
    assert.equal(SoulCardSchema.safeParse(bad).success, false);
  });

  it("accepts a card with no catchphrase", () => {
    assert.equal(
      SoulCardSchema.safeParse(cardWithoutCatchphrase()).success,
      true,
    );
  });
});

describe("parseSoulCard", () => {
  it("round-trips a serialised card", () => {
    const stored = encodeNewlines(serialiseSoulCard(card()));
    const parsed = parseSoulCard(stored);
    assert.notEqual(parsed, null);
    assert.equal(parsed?.title, "El Arquitecto de la Medianoche");
    assert.equal(parsed?.stats.chaos, 3);
  });

  it("returns null for legacy free-text soul", () => {
    assert.equal(parseSoulCard("wry, likes coffee, night owl"), null);
  });

  it("returns null for malformed JSON", () => {
    assert.equal(parseSoulCard("{not json"), null);
  });

  it("returns null for truncated JSON", () => {
    const full = serialiseSoulCard(card());
    assert.equal(parseSoulCard(full.slice(0, full.length - 20)), null);
  });

  it("returns null for valid JSON that isn't a card", () => {
    assert.equal(parseSoulCard('{"foo":"bar"}'), null);
  });

  it("returns null for empty string", () => {
    assert.equal(parseSoulCard(""), null);
  });
});

describe("renderSouls (card-aware)", () => {
  it("returns empty string for no souls", () => {
    assert.equal(renderSouls([]), "");
  });

  it("returns empty string when no soul parses as a card", () => {
    const out = renderSouls([
      soulRow({ user_id: 1, soul_text: "legacy free text" }),
    ]);
    assert.equal(out, "");
  });

  it("renders only the parseable cards, skipping legacy rows", () => {
    const out = renderSouls([
      soulRow({ user_id: 1, first_name: "Ana", username: "ana" }),
      soulRow({ user_id: 2, first_name: "Bob", soul_text: "legacy" }),
    ]);
    assert.match(out, /Ana \(@ana\)/);
    assert.equal(out.includes("Bob"), false);
  });

  it("includes the card header with title and the six stats + skills", () => {
    const out = renderSouls([
      soulRow({ user_id: 1, first_name: "Ana", username: "ana" }),
    ]);
    assert.match(out, /Ana \(@ana\) — El Arquitecto de la Medianoche/);
    assert.match(out, /verbosity 7/);
    assert.match(out, /humor 8/);
    assert.match(out, /chaos 3/);
    assert.match(out, /wisdom 8/);
    assert.match(out, /horniness 2/);
    assert.match(out, /menace 4/);
    assert.match(out, /skills:.*Nigromancia/);
  });

  it("fences the compact card body in <msg>…</msg>", () => {
    const out = renderSouls([
      soulRow({ user_id: 1, first_name: "Ana", username: "ana" }),
    ]);
    assert.equal(out.split("<msg>").length - 1, 1);
    assert.equal(out.split("</msg>").length - 1, 1);
  });

  it("a member-steered title with control chars can't inject structure", () => {
    // Title carries a bidi-override (U+202E) — must be stripped from the
    // header line, which sits OUTSIDE the <msg> fence.
    const bidiOverride = "‮";
    const evil = card({ title: `Evil ${bidiOverride}Title` });
    const out = renderSouls([
      soulRow({
        user_id: 1,
        first_name: "Ana",
        username: "ana",
        soul_text: encodeNewlines(serialiseSoulCard(evil)),
      }),
    ]);
    // Still exactly one fence pair; control char stripped from the header.
    assert.equal(out.split("<msg>").length - 1, 1);
    assert.equal(out.split("</msg>").length - 1, 1);
    assert.equal(out.includes(bidiOverride), false);
  });

  it("renders Name (no @handle) when username absent", () => {
    const out = renderSouls([soulRow({ user_id: 1, first_name: "Carlos" })]);
    assert.match(out, /Carlos \(no @handle\)/);
  });

  it("sorts members by first_name", () => {
    const out = renderSouls([
      soulRow({ user_id: 2, first_name: "Zoe" }),
      soulRow({ user_id: 1, first_name: "Ana" }),
    ]);
    const lines = out.split("\n");
    assert.match(lines[0] ?? "", /^Ana /);
  });
});
