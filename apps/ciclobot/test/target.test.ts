import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { descIsoWeek, parseTarget } from "../src/domain/target.js";

describe("parseTarget", () => {
  it("recognizes bodyweight aliases", () => {
    assert.deepEqual(parseTarget("bodyweight"), { kind: "bodyweight" });
    assert.deepEqual(parseTarget("BW"), { kind: "bodyweight" });
    assert.deepEqual(parseTarget("  bw  "), { kind: "bodyweight" });
  });
  it("recognizes lifts", () => {
    assert.deepEqual(parseTarget("bench"), { kind: "lift", lift: "bench" });
    assert.deepEqual(parseTarget("CLEAN_AND_JERK"), {
      kind: "lift",
      lift: "clean_and_jerk",
    });
  });
  it("rejects unknowns", () => {
    assert.equal(parseTarget("muscleups"), undefined);
    assert.equal(parseTarget(""), undefined);
  });
});

describe("descIsoWeek", () => {
  it("sorts newest first", () => {
    const rows = [
      { iso_week: "2026-W18" },
      { iso_week: "2026-W20" },
      { iso_week: "2026-W19" },
    ];
    rows.sort(descIsoWeek);
    assert.deepEqual(
      rows.map((r) => r.iso_week),
      ["2026-W20", "2026-W19", "2026-W18"],
    );
  });
});
