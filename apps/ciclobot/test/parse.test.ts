import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  CmSchema,
  DurationSecondsSchema,
  KgSchema,
  KmSchema,
  MadeFlagSchema,
} from "../src/domain/parse.js";

describe("KgSchema", () => {
  it("parses plain numbers", () => {
    assert.equal(KgSchema.parse("100"), 100);
    assert.equal(KgSchema.parse("82.5"), 82.5);
  });
  it("strips kg suffix", () => {
    assert.equal(KgSchema.parse("100kg"), 100);
    assert.equal(KgSchema.parse("82.5 kg"), 82.5);
    assert.equal(KgSchema.parse("100KG"), 100);
  });
  it("rejects non-numeric", () => {
    assert.equal(KgSchema.safeParse("heavy").success, false);
    assert.equal(KgSchema.safeParse("").success, false);
  });
});

describe("CmSchema", () => {
  it("parses cm values", () => {
    assert.equal(CmSchema.parse("178"), 178);
    assert.equal(CmSchema.parse("178cm"), 178);
    assert.equal(CmSchema.parse("1.78"), 1.78);
  });
});

describe("KmSchema", () => {
  it("parses km values", () => {
    assert.equal(KmSchema.parse("40"), 40);
    assert.equal(KmSchema.parse("40km"), 40);
    assert.equal(KmSchema.parse("1.5"), 1.5);
    assert.equal(KmSchema.parse("1.5 km"), 1.5);
  });
  it("rejects non-numeric", () => {
    assert.equal(KmSchema.safeParse("far").success, false);
    assert.equal(KmSchema.safeParse("").success, false);
  });
});

describe("DurationSecondsSchema", () => {
  it("parses HH:MM:SS", () => {
    assert.equal(DurationSecondsSchema.parse("1:05:00"), 3900);
    assert.equal(DurationSecondsSchema.parse("0:00:45"), 45);
    assert.equal(DurationSecondsSchema.parse("2:30:30"), 9030);
  });
  it("parses MM:SS", () => {
    assert.equal(DurationSecondsSchema.parse("52:30"), 3150);
    assert.equal(DurationSecondsSchema.parse("00:45"), 45);
  });
  it("parses bare minutes and m/min suffixes", () => {
    assert.equal(DurationSecondsSchema.parse("52"), 3120);
    assert.equal(DurationSecondsSchema.parse("52m"), 3120);
    assert.equal(DurationSecondsSchema.parse("52min"), 3120);
    assert.equal(DurationSecondsSchema.parse("52.5"), 3150);
  });
  it("rejects out-of-range minutes/seconds in colon form", () => {
    assert.equal(DurationSecondsSchema.safeParse("1:75").success, false);
    assert.equal(DurationSecondsSchema.safeParse("1:00:99").success, false);
  });
  it("rejects nonsense and zero", () => {
    assert.equal(DurationSecondsSchema.safeParse("fast").success, false);
    assert.equal(DurationSecondsSchema.safeParse("").success, false);
    assert.equal(DurationSecondsSchema.safeParse("0").success, false);
    assert.equal(DurationSecondsSchema.safeParse("1:2:3:4").success, false);
  });
  it("rejects scientific/hex notation that Number() would accept", () => {
    assert.equal(DurationSecondsSchema.safeParse("5e2").success, false);
    assert.equal(DurationSecondsSchema.safeParse("0x10").success, false);
    assert.equal(DurationSecondsSchema.safeParse("5e2m").success, false);
  });
});

describe("MadeFlagSchema", () => {
  for (const t of [
    "made",
    "MADE",
    "y",
    "yes",
    "Y",
    "TRUE",
    "true",
    "1",
    "✅",
  ]) {
    it(`accepts "${t}" as true`, () => {
      assert.equal(MadeFlagSchema.parse(t), true);
    });
  }
  for (const f of [
    "missed",
    "miss",
    "MISSED",
    "n",
    "no",
    "N",
    "FALSE",
    "false",
    "0",
    "❌",
  ]) {
    it(`accepts "${f}" as false`, () => {
      assert.equal(MadeFlagSchema.parse(f), false);
    });
  }
  it("rejects nonsense", () => {
    assert.equal(MadeFlagSchema.safeParse("maybe").success, false);
    assert.equal(MadeFlagSchema.safeParse("done").success, false);
  });
});
