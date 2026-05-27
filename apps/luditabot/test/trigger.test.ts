import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  compileTriggers,
  extractUserHint,
  matchesTrigger,
} from "../src/domain/trigger.js";

const TRIGGER_WORDS = ["ludita", "luditas", "luddite", "luddites"];
const TRIGGERS = compileTriggers(TRIGGER_WORDS);

describe("matchesTrigger", () => {
  it("matches the Spanish singular word", () => {
    assert.equal(matchesTrigger("ludita total", TRIGGERS), true);
  });

  it("matches the Spanish plural word", () => {
    assert.equal(matchesTrigger("sois unos luditas", TRIGGERS), true);
  });

  it("matches English variants", () => {
    assert.equal(matchesTrigger("classic luddite behavior", TRIGGERS), true);
    assert.equal(matchesTrigger("the luddites return", TRIGGERS), true);
  });

  it("matches case-insensitively", () => {
    assert.equal(matchesTrigger("LuDiTa!", TRIGGERS), true);
  });

  it("matches with punctuation around the word", () => {
    assert.equal(matchesTrigger("hey, ludita, mira esto", TRIGGERS), true);
  });

  it("does not match substrings inside other words", () => {
    assert.equal(matchesTrigger("antiludita", TRIGGERS), false);
    assert.equal(matchesTrigger("luditamente", TRIGGERS), false);
  });

  it("returns false when text is empty", () => {
    assert.equal(matchesTrigger("", TRIGGERS), false);
  });

  it("returns false when no trigger word is present", () => {
    assert.equal(matchesTrigger("nothing to see here", TRIGGERS), false);
  });
});

describe("extractUserHint", () => {
  it("strips the trigger word at the start", () => {
    assert.equal(
      extractUserHint("ludita contra los patinetes electricos", TRIGGER_WORDS),
      "contra los patinetes electricos",
    );
  });

  it("strips the trigger word at the end", () => {
    assert.equal(
      extractUserHint("quemando el algoritmo luditas", TRIGGER_WORDS),
      "quemando el algoritmo",
    );
  });

  it("strips English variants", () => {
    assert.equal(
      extractUserHint("luddite against smart fridges", TRIGGER_WORDS),
      "against smart fridges",
    );
  });

  it("strips all trigger words when several appear", () => {
    assert.equal(
      extractUserHint("ludita luddite smart toaster", TRIGGER_WORDS),
      "smart toaster",
    );
  });

  it("is case-insensitive", () => {
    assert.equal(
      extractUserHint("LUDITA con un martillo", TRIGGER_WORDS),
      "con un martillo",
    );
  });

  it("returns undefined when only triggers + whitespace are present", () => {
    assert.equal(extractUserHint("  ludita  luddites  ", TRIGGER_WORDS), undefined);
  });

  it("does not strip substrings inside other words", () => {
    assert.equal(
      extractUserHint("antiludita pero ludita", TRIGGER_WORDS),
      "antiludita pero",
    );
  });

  it("truncates very long hints with three dots", () => {
    const long = "ludita " + "a".repeat(500);
    const result = extractUserHint(long, TRIGGER_WORDS);
    assert.ok(result !== undefined);
    assert.ok(result.length <= 203);
    assert.ok(result.endsWith("..."));
  });
});
