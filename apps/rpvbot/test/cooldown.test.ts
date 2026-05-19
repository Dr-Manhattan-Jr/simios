import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  createCooldown,
  createUserCooldown,
} from "../src/domain/cooldown.js";

describe("createCooldown (group-wide)", () => {
  it("first call always passes with remainingMs 0", () => {
    const cd = createCooldown(30_000);
    const r = cd.tryFire(1000);
    assert.equal(r.fired, true);
    assert.equal(r.remainingMs, 0);
  });

  it("blocks any caller within the window with accurate remainingMs", () => {
    const cd = createCooldown(30_000);
    cd.tryFire(0);
    const r1 = cd.tryFire(1);
    assert.equal(r1.fired, false);
    assert.equal(r1.remainingMs, 29_999);
    const r2 = cd.tryFire(29_999);
    assert.equal(r2.fired, false);
    assert.equal(r2.remainingMs, 1);
  });

  it("re-opens exactly at the window boundary", () => {
    const cd = createCooldown(30_000);
    cd.tryFire(0);
    const r = cd.tryFire(30_000);
    assert.equal(r.fired, true);
  });
});

describe("createUserCooldown (per-user)", () => {
  it("first call from any user passes", () => {
    const cd = createUserCooldown(60_000);
    assert.equal(cd.tryFire(1, 1000).fired, true);
    assert.equal(cd.tryFire(2, 1000).fired, true);
  });

  it("blocks the same user inside their window with remainingMs", () => {
    const cd = createUserCooldown(60_000);
    cd.tryFire(1, 0);
    const r = cd.tryFire(1, 1);
    assert.equal(r.fired, false);
    assert.equal(r.remainingMs, 59_999);
  });

  it("allows the same user past their window", () => {
    const cd = createUserCooldown(60_000);
    cd.tryFire(1, 0);
    assert.equal(cd.tryFire(1, 60_000).fired, true);
  });

  it("user A is not blocked by user B firing", () => {
    const cd = createUserCooldown(60_000);
    cd.tryFire(1, 0);
    assert.equal(cd.tryFire(2, 1).fired, true);
    assert.equal(cd.tryFire(2, 30_000).fired, false);
    assert.equal(cd.tryFire(1, 59_999).fired, false);
  });
});
