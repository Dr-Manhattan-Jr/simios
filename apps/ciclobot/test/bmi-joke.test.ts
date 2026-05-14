import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { shapeJoke } from "../src/domain/bmi-joke.js";

describe("shapeJoke", () => {
  it("returns flaco when weight is more than 2kg below height-100", () => {
    // 172cm → reference 72kg → flaco threshold 70kg
    const j = shapeJoke(172, 65, 1);
    assert.equal(j.verdict, "flaco");
    assert.ok(j.line.length > 0);
  });

  it("returns fat-ass when weight is more than 10kg above height-100", () => {
    // 172cm → reference 72kg → fat-ass threshold 82kg
    const j = shapeJoke(172, 95, 1);
    assert.equal(j.verdict, "fat-ass");
    assert.ok(j.line.length > 0);
  });

  it("returns healthy in the middle band", () => {
    // 172cm → 70..82kg is healthy
    const j = shapeJoke(172, 75, 1);
    assert.equal(j.verdict, "healthy");
    assert.ok(j.line.length > 0);
  });

  it("is deterministic for a given seed", () => {
    const a = shapeJoke(172, 75, 42);
    const b = shapeJoke(172, 75, 42);
    assert.equal(a.line, b.line);
  });

  it("varies the line across seeds", () => {
    const lines = new Set<string>();
    for (let i = 0; i < 30; i++) {
      lines.add(shapeJoke(172, 75, i).line);
    }
    // 3 healthy lines, so over 30 different seeds we should see all of them.
    assert.ok(lines.size > 1);
  });

  it("boundary: exactly at the flaco edge is healthy, not flaco", () => {
    // 172cm → reference 72 → flaco threshold 70 (weight < 70).
    // At 70, weight is NOT < 70, so healthy.
    const j = shapeJoke(172, 70, 1);
    assert.equal(j.verdict, "healthy");
  });

  it("boundary: exactly at the fat-ass edge is healthy, not fat-ass", () => {
    // 172cm → reference 72 → fat-ass threshold 82 (weight > 82).
    // At 82, weight is NOT > 82, so healthy.
    const j = shapeJoke(172, 82, 1);
    assert.equal(j.verdict, "healthy");
  });
});
