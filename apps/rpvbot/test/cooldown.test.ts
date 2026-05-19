import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  createCooldown,
  createUserCooldown,
} from "../src/domain/cooldown.js";

describe("createCooldown (group-wide)", () => {
  it("first call always passes", () => {
    const cd = createCooldown(30_000);
    assert.equal(cd.tryFire(1000), true);
  });

  it("blocks any caller within the window after a fire", () => {
    const cd = createCooldown(30_000);
    cd.tryFire(0);
    assert.equal(cd.tryFire(1), false);
    assert.equal(cd.tryFire(29_999), false);
  });

  it("re-opens exactly at the window boundary", () => {
    const cd = createCooldown(30_000);
    cd.tryFire(0);
    assert.equal(cd.tryFire(30_000), true);
  });
});

describe("createUserCooldown (per-user)", () => {
  it("first call from any user passes", () => {
    const cd = createUserCooldown(60_000);
    assert.equal(cd.tryFire(1, 1000), true);
    assert.equal(cd.tryFire(2, 1000), true);
  });

  it("blocks the same user inside their window", () => {
    const cd = createUserCooldown(60_000);
    cd.tryFire(1, 0);
    assert.equal(cd.tryFire(1, 1), false);
    assert.equal(cd.tryFire(1, 59_999), false);
  });

  it("allows the same user past their window", () => {
    const cd = createUserCooldown(60_000);
    cd.tryFire(1, 0);
    assert.equal(cd.tryFire(1, 60_000), true);
  });

  it("user A is not blocked by user B firing", () => {
    const cd = createUserCooldown(60_000);
    cd.tryFire(1, 0);
    assert.equal(cd.tryFire(2, 1), true);
    assert.equal(cd.tryFire(2, 30_000), false);
    assert.equal(cd.tryFire(1, 59_999), false);
  });
});
