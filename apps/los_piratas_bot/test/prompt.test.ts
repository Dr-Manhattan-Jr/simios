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
