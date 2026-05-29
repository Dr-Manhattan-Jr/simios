import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  compileTriggers,
  extractUserHint,
  findTriggerMatch,
  matchesTrigger,
  triggerWordsForTheme,
} from "../src/domain/trigger.js";
import { type TriggerGroup } from "../src/domain/theme.js";

const TRIGGER_GROUPS: readonly TriggerGroup[] = [
  { theme: "tractor", words: ["claude", "claudio"] },
  { theme: "luddite", words: ["ludita", "luditas", "luddite", "luddites"] },
];
const TRIGGERS = compileTriggers(TRIGGER_GROUPS);
const TRACTOR_WORDS = triggerWordsForTheme(TRIGGER_GROUPS, "tractor");
const LUDDITE_WORDS = triggerWordsForTheme(TRIGGER_GROUPS, "luddite");

describe("matchesTrigger", () => {
  it("matches tractor words at the start or end of a message", () => {
    assert.equal(matchesTrigger("claude what's up", TRIGGERS), true);
    assert.equal(matchesTrigger("hey claudio", TRIGGERS), true);
  });

  it("matches luddite words in Spanish and English", () => {
    assert.equal(matchesTrigger("ludita total", TRIGGERS), true);
    assert.equal(matchesTrigger("sois unos luditas", TRIGGERS), true);
    assert.equal(matchesTrigger("classic luddite behavior", TRIGGERS), true);
    assert.equal(matchesTrigger("the luddites return", TRIGGERS), true);
  });

  it("matches case-insensitively", () => {
    assert.equal(matchesTrigger("CLAUDE!", TRIGGERS), true);
    assert.equal(matchesTrigger("LuDiTa!", TRIGGERS), true);
  });

  it("matches with punctuation around the word", () => {
    assert.equal(matchesTrigger("hey, claude, look!", TRIGGERS), true);
    assert.equal(matchesTrigger("hey, ludita, mira esto", TRIGGERS), true);
  });

  it("does not match substrings inside other words", () => {
    assert.equal(matchesTrigger("claudette is here", TRIGGERS), false);
    assert.equal(matchesTrigger("preclaudio", TRIGGERS), false);
    assert.equal(matchesTrigger("antiludita", TRIGGERS), false);
    assert.equal(matchesTrigger("luditamente", TRIGGERS), false);
  });

  it("returns false when text is empty or no trigger word is present", () => {
    assert.equal(matchesTrigger("", TRIGGERS), false);
    assert.equal(matchesTrigger("nothing to see here", TRIGGERS), false);
  });
});

describe("findTriggerMatch", () => {
  it("returns the tractor theme for tractor words", () => {
    assert.deepEqual(findTriggerMatch("claude un buen john deere", TRIGGERS), {
      theme: "tractor",
      word: "claude",
    });
  });

  it("returns the luddite theme for luddite words", () => {
    assert.deepEqual(findTriggerMatch("ludita contra los patinetes", TRIGGERS), {
      theme: "luddite",
      word: "ludita",
    });
  });

  it("uses the earliest trigger word when a message contains several themes", () => {
    assert.deepEqual(findTriggerMatch("ludita contra claude", TRIGGERS), {
      theme: "luddite",
      word: "ludita",
    });
  });

  it("matches the longer trigger when the shorter would not fit (luditas, not ludita)", () => {
    assert.deepEqual(findTriggerMatch("sois unos luditas hoy", TRIGGERS), {
      theme: "luddite",
      word: "luditas",
    });
    assert.deepEqual(findTriggerMatch("the luddites return", TRIGGERS), {
      theme: "luddite",
      word: "luddites",
    });
  });
});

describe("extractUserHint", () => {
  it("strips tractor trigger words", () => {
    assert.equal(
      extractUserHint("claude un buen john deere", TRACTOR_WORDS),
      "un buen john deere",
    );
    assert.equal(
      extractUserHint("muddy field claudio", TRACTOR_WORDS),
      "muddy field",
    );
  });

  it("strips luddite trigger words", () => {
    assert.equal(
      extractUserHint("ludita contra los patinetes electricos", LUDDITE_WORDS),
      "contra los patinetes electricos",
    );
    assert.equal(
      extractUserHint("luddite against smart fridges", LUDDITE_WORDS),
      "against smart fridges",
    );
  });

  it("strips a mid-sentence trigger word", () => {
    assert.equal(
      extractUserHint("hey claude what about a banana?", TRACTOR_WORDS),
      "hey what about a banana?",
    );
  });

  it("strips all trigger words for the matched theme", () => {
    assert.equal(
      extractUserHint("claude claudio pirate ship", TRACTOR_WORDS),
      "pirate ship",
    );
    assert.equal(
      extractUserHint("ludita luddite smart toaster", LUDDITE_WORDS),
      "smart toaster",
    );
  });

  it("is case-insensitive", () => {
    assert.equal(
      extractUserHint("CLAUDE sunset over a vineyard", TRACTOR_WORDS),
      "sunset over a vineyard",
    );
    assert.equal(
      extractUserHint("LUDITA con un martillo", LUDDITE_WORDS),
      "con un martillo",
    );
  });

  it("returns undefined when only triggers + whitespace are present", () => {
    assert.equal(extractUserHint("  claude  claudio  ", TRACTOR_WORDS), undefined);
    assert.equal(extractUserHint("  ludita  luddites  ", LUDDITE_WORDS), undefined);
  });

  it("does not strip substrings inside other words", () => {
    assert.equal(
      extractUserHint("claudette is here, claude", TRACTOR_WORDS),
      "claudette is here,",
    );
    assert.equal(
      extractUserHint("antiludita pero ludita", LUDDITE_WORDS),
      "antiludita pero",
    );
  });

  it("truncates very long hints with an ellipsis", () => {
    const long = "ludita " + "a".repeat(500);
    const result = extractUserHint(long, LUDDITE_WORDS);
    assert.ok(result !== undefined);
    assert.ok(result.length <= 201);
    assert.ok(result.endsWith("…"));
  });
});
