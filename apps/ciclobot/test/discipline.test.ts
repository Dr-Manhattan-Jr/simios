import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  ALL_DISCIPLINES,
  parseDiscipline,
} from "../src/domain/discipline.js";

describe("parseDiscipline", () => {
  it("accepts each canonical discipline", () => {
    for (const d of ALL_DISCIPLINES) {
      assert.equal(parseDiscipline(d), d);
    }
  });
  it("is case-insensitive and trims", () => {
    assert.equal(parseDiscipline("BIKE"), "bike");
    assert.equal(parseDiscipline("  Run "), "run");
  });
  it("rejects aliases and partials", () => {
    assert.equal(parseDiscipline("cycling"), undefined);
    assert.equal(parseDiscipline("b"), undefined);
    assert.equal(parseDiscipline("running"), undefined);
    assert.equal(parseDiscipline(""), undefined);
  });
});
