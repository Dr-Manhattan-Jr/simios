import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  formatRemaining,
  randomSnark,
  snarkWithCooldown,
} from "../src/domain/snark.js";

describe("randomSnark", () => {
  it("returns a non-empty Spanish string on non-Friday", () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSnark("es");
      assert.equal(typeof s, "string");
      assert.ok(s.length > 0);
    }
  });

  it("returns a non-empty English string on Friday", () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSnark("en");
      assert.equal(typeof s, "string");
      assert.ok(s.length > 0);
    }
  });

  it("varies output across many calls (probabilistic)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(randomSnark("es"));
    // With 8 strings and 100 draws, seeing only 1 is astronomically unlikely.
    assert.ok(seen.size >= 2, `expected variety, only saw: ${[...seen].length}`);
  });
});

describe("formatRemaining (MM:SS)", () => {
  it("formats seconds only", () => {
    assert.equal(formatRemaining(42_000), "00:42");
  });

  it("formats whole minutes", () => {
    assert.equal(formatRemaining(120_000), "02:00");
  });

  it("formats minutes + seconds", () => {
    assert.equal(formatRemaining(5 * 60_000 + 12_000), "05:12");
  });

  it("rounds up sub-second remainder so 0 is never displayed", () => {
    assert.equal(formatRemaining(500), "00:01");
    assert.equal(formatRemaining(1), "00:01");
  });

  it("pads single digits", () => {
    assert.equal(formatRemaining(9_000), "00:09");
    assert.equal(formatRemaining(60_000 + 9_000), "01:09");
  });
});

describe("snarkWithCooldown", () => {
  it("appends (MM:SS) when remaining is positive", () => {
    const s = snarkWithCooldown("es", 42_000);
    assert.match(s, /\(00:42\)$/);
  });

  it("omits the parenthetical when remaining is 0 (in-flight)", () => {
    const s = snarkWithCooldown("es", 0);
    assert.equal(s.includes("("), false);
  });
});
