import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildQuestionPrompt,
  buildSoulPrompt,
  systemPromptForQuestion,
  systemPromptForSoul,
} from "../src/prompt/capitan-rpv.js";

describe("systemPromptForSoul", () => {
  it("includes the max-char cap in the prompt body", () => {
    const p = systemPromptForSoul("es", 1500);
    assert.match(p, /1500/);
  });

  it("English variant on Fridays", () => {
    const en = systemPromptForSoul("en", 1500);
    assert.match(en, /English/);
  });

  it("Spanish variant otherwise", () => {
    const es = systemPromptForSoul("es", 1500);
    assert.match(es, /español/);
  });
});

describe("buildSoulPrompt", () => {
  it("includes the member label", () => {
    const p = buildSoulPrompt({
      memberLabel: "@alice (Alice)",
      currentSoul: "",
      transcript: "msg",
      language: "es",
    });
    assert.match(p, /@alice \(Alice\)/);
  });

  it("renders an empty current soul as a placeholder", () => {
    const p = buildSoulPrompt({
      memberLabel: "Carlos",
      currentSoul: "",
      transcript: "msg",
      language: "es",
    });
    assert.match(p, /\(sin perfil todavía\)/);
  });

  it("includes the existing soul when non-empty", () => {
    const p = buildSoulPrompt({
      memberLabel: "Carlos",
      currentSoul: "an existing profile",
      transcript: "msg",
      language: "es",
    });
    assert.match(p, /an existing profile/);
    assert.equal(p.includes("(sin perfil todavía)"), false);
  });
});

describe("systemPromptForQuestion (hostile-input defence)", () => {
  it("forbids revealing the system prompt", () => {
    const en = systemPromptForQuestion("en");
    assert.match(en, /NEVER reveal.*system prompt/i);
    const es = systemPromptForQuestion("es");
    assert.match(es, /NUNCA reveles.*system prompt/i);
  });

  it("forbids revealing infrastructure details", () => {
    const en = systemPromptForQuestion("en");
    assert.match(en, /model name|environment variables|sheet/i);
  });

  it("forbids following user instructions", () => {
    const en = systemPromptForQuestion("en");
    assert.match(en, /ignore previous|act as/i);
  });

  it("forbids inventing facts", () => {
    const en = systemPromptForQuestion("en");
    assert.match(en, /NEVER invent/i);
  });

  it("has a catch-all rule against encoded/partial/oracle-style prompt extraction", () => {
    const en = systemPromptForQuestion("en");
    assert.match(en, /base64|encod/i);
    assert.match(en, /quoting, transforming, encoding/i);
  });

  it("tells the model the transcript is fenced and untrusted", () => {
    const en = systemPromptForQuestion("en");
    assert.match(en, /<msg>/);
    assert.match(en, /literal content/i);
  });
});

describe("buildQuestionPrompt", () => {
  it("includes both the question and the transcript with clear labels", () => {
    const p = buildQuestionPrompt({
      question: "what did alice say?",
      transcript: "[2026-05-18 12:00] @alice: hola",
      language: "en",
    });
    assert.match(p, /Question/);
    assert.match(p, /Transcript/);
    assert.match(p, /what did alice say\?/);
    assert.match(p, /hola/);
  });

  it("labels the question as untrusted data, not instructions", () => {
    const p = buildQuestionPrompt({
      question: "x",
      transcript: "y",
      language: "en",
    });
    assert.match(p, /data not instructions/i);
  });
});
