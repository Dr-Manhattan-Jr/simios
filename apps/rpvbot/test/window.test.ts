import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { previousCalendarDayBounds } from "../src/domain/window.js";

const MADRID = "Europe/Madrid";

describe("previousCalendarDayBounds", () => {
  it("morning run on 2026-05-15 in Madrid → 2026-05-14", () => {
    const now = new Date("2026-05-15T07:00:00Z"); // 09:00 CEST
    const w = previousCalendarDayBounds(now, MADRID);
    assert.equal(w.label, "2026-05-14");
    assert.equal(w.startUtc, "2026-05-13T22:00:00.000Z"); // 14 May 00:00 CEST
    assert.equal(w.endUtc, "2026-05-14T22:00:00.000Z"); // 15 May 00:00 CEST
  });

  it("crosses month boundary correctly", () => {
    const now = new Date("2026-06-01T07:00:00Z");
    const w = previousCalendarDayBounds(now, MADRID);
    assert.equal(w.label, "2026-05-31");
  });

  it("crosses year boundary correctly", () => {
    const now = new Date("2026-01-01T07:00:00Z");
    const w = previousCalendarDayBounds(now, MADRID);
    assert.equal(w.label, "2025-12-31");
  });

  it("DST spring-forward day (2026-03-29 in Madrid lost 02:00→03:00) — the day before is 23h", () => {
    // 2026-03-30 09:00 Madrid (CEST, UTC+2) → previous day 2026-03-29 was 23h long
    const now = new Date("2026-03-30T07:00:00Z");
    const w = previousCalendarDayBounds(now, MADRID);
    assert.equal(w.label, "2026-03-29");
    const start = new Date(w.startUtc).getTime();
    const end = new Date(w.endUtc).getTime();
    const hours = (end - start) / 3600_000;
    assert.equal(hours, 23);
  });

  it("DST fall-back day (2026-10-25 in Madrid gained 03:00→02:00) — the day before is 25h", () => {
    // 2026-10-26 09:00 Madrid (CET, UTC+1) → previous day 2026-10-25 was 25h long
    const now = new Date("2026-10-26T08:00:00Z");
    const w = previousCalendarDayBounds(now, MADRID);
    assert.equal(w.label, "2026-10-25");
    const start = new Date(w.startUtc).getTime();
    const end = new Date(w.endUtc).getTime();
    const hours = (end - start) / 3600_000;
    assert.equal(hours, 25);
  });
});
