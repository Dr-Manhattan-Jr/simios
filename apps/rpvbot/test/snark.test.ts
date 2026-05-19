import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { randomSnark } from "../src/domain/snark.js";

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
