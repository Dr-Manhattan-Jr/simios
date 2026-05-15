import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createCooldown } from "../src/domain/cooldown.js";

describe("createCooldown", () => {
  it("first call always passes", () => {
    const cd = createCooldown(60_000);
    assert.equal(cd.tryFire(1000), true);
  });

  it("blocks subsequent calls within the window", () => {
    const cd = createCooldown(60_000);
    cd.tryFire(0);
    assert.equal(cd.tryFire(1000), false);
    assert.equal(cd.tryFire(30_000), false);
    assert.equal(cd.tryFire(59_999), false);
  });

  it("re-opens exactly at the window boundary", () => {
    const cd = createCooldown(60_000);
    cd.tryFire(0);
    assert.equal(cd.tryFire(60_000), true);
  });

  it("records each successful fire as a new window start", () => {
    const cd = createCooldown(60_000);
    assert.equal(cd.tryFire(0), true);
    assert.equal(cd.tryFire(60_000), true);
    assert.equal(cd.tryFire(60_500), false);
    assert.equal(cd.tryFire(120_000), true);
  });
});
