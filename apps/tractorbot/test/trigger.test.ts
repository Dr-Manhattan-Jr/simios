import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { compileTriggers, matchesTrigger } from "../src/domain/trigger.js";

const TRIGGERS = compileTriggers(["claude", "claudio"]);

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
