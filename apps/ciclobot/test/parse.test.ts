import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CmSchema, KgSchema, MadeFlagSchema } from "../src/domain/parse.js";

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
