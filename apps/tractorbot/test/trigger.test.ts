import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  compileTriggers,
  extractUserHint,
  matchesTrigger,
} from "../src/domain/trigger.js";

const TRIGGERS = compileTriggers(["claude", "claudio"]);
const TRIGGER_WORDS = ["claude", "claudio"];

describe("matchesTrigger", () => {
  it("matches the word at the start of a message", () => {
    assert.equal(matchesTrigger("claude what's up", TRIGGERS), true);
  });

  it("matches the word at the end of a message", () => {
    assert.equal(matchesTrigger("hey claudio", TRIGGERS), true);
  });

  it("matches case-insensitively", () => {
    assert.equal(matchesTrigger("CLAUDE!", TRIGGERS), true);
  });

  it("matches with punctuation around the word", () => {
    assert.equal(matchesTrigger("hey, claude, look!", TRIGGERS), true);
  });

  it("does not match substrings inside other words", () => {
    assert.equal(matchesTrigger("claudette is here", TRIGGERS), false);
    assert.equal(matchesTrigger("preclaudio", TRIGGERS), false);
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
      extractUserHint("claude un buen john deere", TRIGGER_WORDS),
      "un buen john deere",
    );
  });

  it("strips the trigger word at the end", () => {
    assert.equal(
      extractUserHint("muddy field claudio", TRIGGER_WORDS),
      "muddy field",
    );
  });

  it("strips a mid-sentence trigger word", () => {
    assert.equal(
      extractUserHint("hey claude what about a banana?", TRIGGER_WORDS),
      "hey what about a banana?",
    );
  });

  it("strips both trigger words when both appear", () => {
    assert.equal(
      extractUserHint("claude claudio pirate ship", TRIGGER_WORDS),
      "pirate ship",
    );
  });

  it("is case-insensitive", () => {
    assert.equal(
      extractUserHint("CLAUDE sunset over a vineyard", TRIGGER_WORDS),
      "sunset over a vineyard",
    );
  });

  it("returns undefined when only the trigger is present", () => {
    assert.equal(extractUserHint("claude", TRIGGER_WORDS), undefined);
  });

  it("returns undefined when only triggers + whitespace are present", () => {
    assert.equal(extractUserHint("  claude  claudio  ", TRIGGER_WORDS), undefined);
  });

  it("does not strip substrings inside other words", () => {
    assert.equal(
      extractUserHint("claudette is here, claude", TRIGGER_WORDS),
      "claudette is here,",
    );
  });

  it("truncates very long hints with an ellipsis", () => {
    const long = "claude " + "a".repeat(500);
    const result = extractUserHint(long, TRIGGER_WORDS);
    assert.ok(result !== undefined);
    assert.ok(result.length <= 201);
    assert.ok(result.endsWith("…"));
  });
});
