import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { pickMonkeyPhrase } from "../src/domain/monkey-talk.js";

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe("pickMonkeyPhrase", () => {
  it("returns a non-empty string", () => {
    const phrase = pickMonkeyPhrase(seeded(1));
    assert.equal(typeof phrase, "string");
    assert.ok(phrase.length > 0);
  });

  it("varies output with different seeds", () => {
    const a = pickMonkeyPhrase(seeded(1));
    const b = pickMonkeyPhrase(seeded(99));
    assert.notEqual(a, b);
  });
});
