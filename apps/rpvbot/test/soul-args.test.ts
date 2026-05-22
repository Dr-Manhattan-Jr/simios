import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseSoulArgs } from "../src/domain/soul-args.js";

describe("parseSoulArgs", () => {
  it("accepts a bare @username", () => {
    const parsed = parseSoulArgs("/soul @vidal");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.username, "vidal");
  });

  it("accepts a username without the leading @", () => {
    const parsed = parseSoulArgs("/soul vidal");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.username, "vidal");
  });

  it("strips only a single leading @", () => {
    // "@@x" → handle "@x" → not a valid handle → usage error.
    assert.equal(parseSoulArgs("/soul @@vidal").ok, false);
  });

  it("handles the /soul@botname form", () => {
    const parsed = parseSoulArgs("/soul@rpv_bot @vidal");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.username, "vidal");
  });

  it("rejects a bare /soul with no argument", () => {
    assert.equal(parseSoulArgs("/soul").ok, false);
    assert.equal(parseSoulArgs("/soul   ").ok, false);
  });

  it("rejects a handle with spaces or punctuation", () => {
    assert.equal(parseSoulArgs("/soul josep vidal").ok, false);
    assert.equal(parseSoulArgs("/soul @vi.dal").ok, false);
    assert.equal(parseSoulArgs("/soul @vidal!").ok, false);
  });

  it("does not mis-parse /soulvidal as the command", () => {
    assert.equal(parseSoulArgs("/soulvidal").ok, false);
  });

  it("tolerates surrounding whitespace", () => {
    const parsed = parseSoulArgs("  /soul   @vidal  ");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.username, "vidal");
  });

  it("preserves username case (caller lowercases for matching)", () => {
    const parsed = parseSoulArgs("/soul @VidaL");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.username, "VidaL");
  });
});
