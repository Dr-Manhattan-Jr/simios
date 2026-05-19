import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseRpvArgs } from "../src/domain/args.js";

const OPTS = { defaultN: 100, maxN: 500 };

describe("parseRpvArgs", () => {
  it("bare /rpv returns default N", () => {
    const r = parseRpvArgs("/rpv", OPTS);
    assert.deepEqual(r, { ok: true, n: 100 });
  });

  it("/rpv with explicit N returns that N", () => {
    const r = parseRpvArgs("/rpv 50", OPTS);
    assert.deepEqual(r, { ok: true, n: 50 });
  });

  it("/rpv@botname with N strips the @mention", () => {
    const r = parseRpvArgs("/rpv@rpv_bot 75", OPTS);
    assert.deepEqual(r, { ok: true, n: 75 });
  });

  it("zero is rejected as non-positive", () => {
    const r = parseRpvArgs("/rpv 0", OPTS);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /positive/);
  });

  it("negative is rejected as non-positive", () => {
    const r = parseRpvArgs("/rpv -3", OPTS);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /positive/);
  });

  it("above max is rejected with explicit max error (not silently capped)", () => {
    const r = parseRpvArgs("/rpv 9999", OPTS);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /500/);
  });

  it("non-numeric argument is rejected with usage hint", () => {
    const r = parseRpvArgs("/rpv abc", OPTS);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /Usage/);
  });

  it("floats are rejected", () => {
    const r = parseRpvArgs("/rpv 50.5", OPTS);
    assert.equal(r.ok, false);
  });

  it("/rpv50 (no space) is NOT silently parsed as default; rejected", () => {
    const r = parseRpvArgs("/rpv50", OPTS);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /Usage/);
  });

  it("totally unrelated text is rejected (defensive — shouldn't reach handler)", () => {
    const r = parseRpvArgs("hello", OPTS);
    assert.equal(r.ok, false);
  });
});
