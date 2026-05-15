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
    assert.ok(insult.toLowerCase().includes("insulto"));
    assert.ok(correct.toLowerCase().includes("corrección"));
    assert.ok(correct.includes("SKIP"));
  });
});

describe("SYSTEM_PROMPT", () => {
  it("instructs Spanish-only replies", () => {
    assert.ok(SYSTEM_PROMPT.includes("español"));
  });
  it("mentions Blas de Lezo by name", () => {
    assert.ok(SYSTEM_PROMPT.includes("Blas de Lezo"));
  });
  it("forbids revealing it's an AI", () => {
    assert.ok(SYSTEM_PROMPT.includes("IA") || SYSTEM_PROMPT.includes("bot"));
  });
  it("defines the SKIP sentinel for clean English", () => {
    assert.ok(SYSTEM_PROMPT.includes("SKIP"));
  });
});
