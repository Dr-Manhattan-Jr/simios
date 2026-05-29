import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  formatDuration,
  TriathlonEntrySchema,
  velocityKmh,
} from "../src/domain/triathlon.js";

const baseEntry = {
  iso_week: "2026-W22",
  week_start: "2026-05-25",
  user_id: 1,
  discipline: "bike" as const,
  distance_km: 40,
  duration_seconds: 3600,
  logged_at: "2026-05-29T10:00:00.000Z",
};

describe("velocityKmh", () => {
  it("derives km/h from distance and time", () => {
    const entry = TriathlonEntrySchema.parse(baseEntry);
    assert.equal(velocityKmh(entry), 40); // 40 km in 1 h
  });
  it("handles sub-hour sessions", () => {
    const entry = TriathlonEntrySchema.parse({
      ...baseEntry,
      distance_km: 10,
      duration_seconds: 1800, // 30 min
    });
    assert.equal(velocityKmh(entry), 20); // 10 km in 0.5 h
  });
});

describe("formatDuration", () => {
  it("omits hours when zero", () => {
    assert.equal(formatDuration(45), "00:45");
    assert.equal(formatDuration(3150), "52:30");
  });
  it("shows hours when present", () => {
    assert.equal(formatDuration(3900), "1:05:00");
    assert.equal(formatDuration(9030), "2:30:30");
  });
});

describe("TriathlonEntrySchema", () => {
  it("rejects non-positive distance and duration", () => {
    assert.equal(
      TriathlonEntrySchema.safeParse({ ...baseEntry, distance_km: 0 }).success,
      false,
    );
    assert.equal(
      TriathlonEntrySchema.safeParse({ ...baseEntry, duration_seconds: 0 })
        .success,
      false,
    );
  });
});
