import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isFriday } from "../src/domain/day.js";

describe("isFriday", () => {
  it("returns true on a known Friday in UTC", () => {
    // 2026-05-15 is a Friday.
    assert.equal(isFriday(new Date("2026-05-15T12:00:00Z"), "UTC"), true);
  });

  it("returns false on a known Thursday in UTC", () => {
    assert.equal(isFriday(new Date("2026-05-14T12:00:00Z"), "UTC"), false);
  });

  it("respects timezone for the boundary", () => {
    // Friday 23:30 UTC = Saturday 01:30 Madrid (UTC+2).
    const lateFridayUtc = new Date("2026-05-15T23:30:00Z");
    assert.equal(isFriday(lateFridayUtc, "UTC"), true);
    assert.equal(isFriday(lateFridayUtc, "Europe/Madrid"), false);

    // Saturday 00:30 UTC = Saturday 02:30 Madrid — still Saturday everywhere.
    const saturdayMorning = new Date("2026-05-16T00:30:00Z");
    assert.equal(isFriday(saturdayMorning, "UTC"), false);
    assert.equal(isFriday(saturdayMorning, "Europe/Madrid"), false);
  });
});
