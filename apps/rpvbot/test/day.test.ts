import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isFriday, summaryLanguage } from "../src/domain/day.js";

const MADRID = "Europe/Madrid";

describe("isFriday / summaryLanguage", () => {
  it("Friday noon Madrid → English", () => {
    // 2026-05-15 is a Friday
    const noon = new Date("2026-05-15T12:00:00+02:00");
    assert.equal(isFriday(noon, MADRID), true);
    assert.equal(summaryLanguage(noon, MADRID), "en");
  });

  it("Thursday noon Madrid → Spanish", () => {
    const noon = new Date("2026-05-14T12:00:00+02:00");
    assert.equal(isFriday(noon, MADRID), false);
    assert.equal(summaryLanguage(noon, MADRID), "es");
  });

  it("Saturday noon Madrid → Spanish", () => {
    const noon = new Date("2026-05-16T12:00:00+02:00");
    assert.equal(summaryLanguage(noon, MADRID), "es");
  });

  it("Friday 23:30 UTC is Saturday 00:30 Madrid in summer → Spanish", () => {
    // CEST is UTC+2
    const lateFridayUtc = new Date("2026-05-15T23:30:00Z");
    assert.equal(summaryLanguage(lateFridayUtc, MADRID), "es");
  });

  it("Friday 00:30 UTC is Friday 02:30 Madrid → English", () => {
    const earlyFridayUtc = new Date("2026-05-15T00:30:00Z");
    assert.equal(summaryLanguage(earlyFridayUtc, MADRID), "en");
  });
});
