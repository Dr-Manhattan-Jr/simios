import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseRpvArgs } from "../src/domain/args.js";

const OPTS = { maxN: 500, questionMaxChars: 400 };

describe("parseRpvArgs", () => {
  it("bare /rpv is rejected with usage", () => {
    const r = parseRpvArgs("/rpv", OPTS);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /Usage/);
  });

  it("/rpv@bot with no arg is rejected", () => {
    const r = parseRpvArgs("/rpv@rpv_bot", OPTS);
    assert.equal(r.ok, false);
  });

  it("integer arg → kind=count", () => {
    const r = parseRpvArgs("/rpv 50", OPTS);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.kind, "count");
      if (r.kind === "count") assert.equal(r.n, 50);
    }
  });

  it("/rpv@botname 75 strips the @mention", () => {
    const r = parseRpvArgs("/rpv@rpv_bot 75", OPTS);
    assert.equal(r.ok, true);
    if (r.ok && r.kind === "count") assert.equal(r.n, 75);
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

  it("above max is rejected with explicit max error", () => {
    const r = parseRpvArgs("/rpv 9999", OPTS);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /500/);
  });

  it("free-text question → kind=question", () => {
    const r = parseRpvArgs("/rpv what did alice say about padel?", OPTS);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.kind, "question");
      if (r.kind === "question") {
        assert.match(r.text, /padel/);
      }
    }
  });

  it("Spanish question with accents is preserved", () => {
    const r = parseRpvArgs("/rpv ¿de qué hablaron ayer?", OPTS);
    assert.equal(r.ok, true);
    if (r.ok && r.kind === "question") {
      assert.match(r.text, /qué hablaron/);
    }
  });

  it("/rpv50 (no space) is rejected", () => {
    const r = parseRpvArgs("/rpv50", OPTS);
    assert.equal(r.ok, false);
  });

  it("/rpv 50.5 (float) is rejected as not a positive integer", () => {
    const r = parseRpvArgs("/rpv 50.5", OPTS);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /positive integer/);
  });
});
