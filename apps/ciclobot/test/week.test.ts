import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  IsoWeekSchema,
  currentIsoWeek,
  currentWeekStart,
} from "../src/domain/week.js";

describe("IsoWeekSchema", () => {
  it("accepts valid YYYY-Www format", () => {
    assert.equal(IsoWeekSchema.parse("2026-W20"), "2026-W20");
    assert.equal(IsoWeekSchema.parse("2024-W01"), "2024-W01");
    assert.equal(IsoWeekSchema.parse("2026-W53"), "2026-W53");
  });
  it("rejects malformed", () => {
    assert.equal(IsoWeekSchema.safeParse("2026-20").success, false);
    assert.equal(IsoWeekSchema.safeParse("2026-W5").success, false);
    assert.equal(IsoWeekSchema.safeParse("W20").success, false);
  });
});

describe("currentIsoWeek", () => {
  it("returns ISO week for a known Monday", () => {
    const monday = new Date("2026-05-11T10:00:00Z");
    assert.equal(currentIsoWeek(monday, "UTC"), "2026-W20");
  });
  it("returns ISO week for a known Sunday", () => {
    const sunday = new Date("2026-05-17T22:00:00Z");
    assert.equal(currentIsoWeek(sunday, "UTC"), "2026-W20");
  });
  it("respects timezone for week boundary", () => {
    const sundayLate = new Date("2026-05-17T23:30:00Z");
    assert.equal(currentIsoWeek(sundayLate, "UTC"), "2026-W20");
    assert.equal(currentIsoWeek(sundayLate, "Europe/Madrid"), "2026-W21");
  });
});

describe("currentWeekStart", () => {
  it("returns the Monday of the current ISO week", () => {
    const wed = new Date("2026-05-13T12:00:00Z");
    assert.equal(currentWeekStart(wed, "UTC"), "2026-05-11");
  });
});
