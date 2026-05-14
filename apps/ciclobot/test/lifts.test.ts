import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  ALL_LIFTS,
  OPTIONAL_LIFTS,
  REQUIRED_LIFTS,
  isRequired,
  parseLift,
} from "../src/domain/lifts.js";

describe("parseLift", () => {
  it("accepts each canonical lift name", () => {
    for (const lift of ALL_LIFTS) {
      assert.equal(parseLift(lift), lift);
    }
  });

  it("is case-insensitive", () => {
    assert.equal(parseLift("BENCH"), "bench");
    assert.equal(parseLift("Squat"), "squat");
    assert.equal(parseLift("CLEAN_AND_JERK"), "clean_and_jerk");
  });

  it("trims whitespace", () => {
    assert.equal(parseLift("  bench  "), "bench");
  });

  it("rejects aliases and partials", () => {
    assert.equal(parseLift("b"), undefined);
    assert.equal(parseLift("bp"), undefined);
    assert.equal(parseLift("bench press"), undefined);
    assert.equal(parseLift("cleanandjerk"), undefined);
    assert.equal(parseLift("dl"), undefined);
    assert.equal(parseLift(""), undefined);
  });

  it("rejects common typos so the user sees the allowlist", () => {
    assert.equal(parseLift("bency"), undefined);
    assert.equal(parseLift("benchpress"), undefined);
    assert.equal(parseLift("squats"), undefined);
    assert.equal(parseLift("deads"), undefined);
  });
});

describe("isRequired", () => {
  it("returns true for required lifts only", () => {
    for (const lift of REQUIRED_LIFTS) {
      assert.equal(isRequired(lift), true);
    }
    for (const lift of OPTIONAL_LIFTS) {
      assert.equal(isRequired(lift), false);
    }
  });
});
