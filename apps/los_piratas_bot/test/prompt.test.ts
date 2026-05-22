import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  modeForLanguage,
} from "../src/domain/prompt.js";

describe("modeForLanguage", () => {
  it("maps es to insult", () => {
    assert.equal(modeForLanguage("es"), "insult");
  });
  it("maps en to correct", () => {
    assert.equal(modeForLanguage("en"), "correct");
  });
  it("maps other to undefined", () => {
    assert.equal(modeForLanguage("other"), undefined);
  });
});

describe("buildUserPrompt", () => {
  it("uses @username when known", () => {
    const p = buildUserPrompt({
      mode: "insult",
      userMessage: "Hola tripulación",
      username: "josep",
    });
    assert.ok(p.includes("@josep"));
    assert.ok(p.includes("Hola tripulación"));
  });

  it("falls back to a generic label when username is missing", () => {
    const p = buildUserPrompt({
      mode: "insult",
      userMessage: "Hola",
      username: undefined,
    });
    assert.ok(p.includes("un grumete"));
  });

  it("includes the right intent for each mode", () => {
    const insult = buildUserPrompt({
      mode: "insult",
      userMessage: "hola",
      username: "x",
    });
    const correct = buildUserPrompt({
      mode: "correct",
      userMessage: "i has dog",
      username: "x",
    });
    assert.ok(insult.toLowerCase().includes("insult"));
    assert.ok(correct.toLowerCase().includes("correct"));
    assert.ok(correct.includes("SKIP"));
  });
});

describe("SYSTEM_PROMPT", () => {
  it("instructs the bot to output in pirate spanglish (not pure English)", () => {
    // The meta-prompt itself is in English now, but it must explicitly
    // tell the model that OUTPUT is spanglish.
    assert.ok(/spanglish/i.test(SYSTEM_PROMPT));
  });
  it("mentions Blas de Lezo by name", () => {
    assert.ok(SYSTEM_PROMPT.includes("Blas de Lezo"));
  });
  it("forbids revealing it's an AI/bot/Gemini", () => {
    assert.ok(/AI/.test(SYSTEM_PROMPT) || /bot/.test(SYSTEM_PROMPT));
  });
  it("defines the SKIP sentinel for clean English", () => {
    assert.ok(SYSTEM_PROMPT.includes("SKIP"));
  });
  it("explicitly lists obvious typos as do-not-correct", () => {
    // Regression test for the maretingk false-positive.
    assert.ok(/maretingk|typo/i.test(SYSTEM_PROMPT));
  });
  it("forbids adding a possessive to a proper noun", () => {
    // Regression test for "cool on claudio" → wrongly "corrected" to
    // "Claudio's". Names used as a plain object need no apostrophe.
    assert.ok(/proper noun/i.test(SYSTEM_PROMPT));
    assert.ok(SYSTEM_PROMPT.includes("claudio"));
  });
  it("tells insult mode to stay short", () => {
    // Regression test for rambling 3-sentence Friday insults.
    assert.ok(/LENGTH/.test(SYSTEM_PROMPT));
    assert.ok(/two at the very most/i.test(SYSTEM_PROMPT));
  });
  it("does not treat a correctly-placed article as an error", () => {
    // Regression test for "the wall of shame prize" → wrongly
    // "corrected" by removing "the". Adding/removing an article is a
    // style choice, not an error.
    assert.ok(SYSTEM_PROMPT.includes("wall of shame prize"));
    assert.ok(/present, correct/i.test(SYSTEM_PROMPT));
  });
  it("has a closed whitelist of exactly four correctable error types", () => {
    // The enumerated NEVER-list and the two-question gate both failed —
    // seven false corrections in. The whitelist inverts the logic: the
    // model may correct ONLY four named categories; everything else is
    // SKIP by default.
    assert.ok(/THE WHITELIST/.test(SYSTEM_PROMPT));
    assert.ok(/VERB TENSE/.test(SYSTEM_PROMPT));
    assert.ok(/SUBJECT.VERB AGREEMENT/.test(SYSTEM_PROMPT));
    assert.ok(/FALSE FRIEND/.test(SYSTEM_PROMPT));
    assert.ok(/MISSING OBLIGATORY ARTICLE/.test(SYSTEM_PROMPT));
  });
  it("treats hyphenation as never an error", () => {
    // Regression test for "actual real world" → wrongly "corrected" to
    // "actual real-world". Open/hyphenated/closed compounds are all fine.
    assert.ok(/HYPHENATION/.test(SYSTEM_PROMPT));
    assert.ok(SYSTEM_PROMPT.includes("actual real world"));
  });
  it("treats contractions and their expansions as equally correct", () => {
    // Regression test for "if you're technical" → wrongly "corrected"
    // to "if you are technical". Contracting/expanding is a style choice.
    assert.ok(/CONTRACTIONS/.test(SYSTEM_PROMPT));
    assert.ok(SYSTEM_PROMPT.includes("if you're technical"));
  });
});

describe("buildUserPrompt insult length", () => {
  it("the insult user prompt asks for one or two sentences", () => {
    const p = buildUserPrompt({
      mode: "insult",
      userMessage: "Hola tripulación",
      username: "josep",
    });
    assert.ok(/SHORT/i.test(p));
    assert.ok(/two at most/i.test(p));
  });
});
