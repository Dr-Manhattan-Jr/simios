import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createDedup } from "../src/domain/dedup.js";

describe("createDedup", () => {
  it("first sighting of an id passes; second blocks", () => {
    const d = createDedup(100);
    assert.equal(d.acceptOnce(42), true);
    assert.equal(d.acceptOnce(42), false);
  });

  it("different ids each pass once", () => {
    const d = createDedup(100);
    assert.equal(d.acceptOnce(1), true);
    assert.equal(d.acceptOnce(2), true);
    assert.equal(d.acceptOnce(3), true);
    assert.equal(d.acceptOnce(1), false);
    assert.equal(d.acceptOnce(2), false);
  });

  it("evicts oldest entries when over capacity", () => {
    const d = createDedup(3);
    d.acceptOnce(1);
    d.acceptOnce(2);
    d.acceptOnce(3);
    // 1 is still tracked (capacity 3, exactly full).
    assert.equal(d.acceptOnce(1), false);
    // Adding 4 evicts 1.
    d.acceptOnce(4);
    // Now 1 is forgotten and passes again.
    assert.equal(d.acceptOnce(1), true);
  });
});
