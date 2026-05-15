import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createCooldown } from "../src/domain/cooldown.js";

const ALICE = 1;
const BOB = 2;

describe("createCooldown (per-user)", () => {
  it("first call for a user always passes", () => {
    const cd = createCooldown(60_000);
    assert.equal(cd.tryFire(ALICE, 1000), true);
  });

  it("blocks subsequent calls for the same user within the window", () => {
    const cd = createCooldown(60_000);
    cd.tryFire(ALICE, 0);
    assert.equal(cd.tryFire(ALICE, 1000), false);
    assert.equal(cd.tryFire(ALICE, 30_000), false);
    assert.equal(cd.tryFire(ALICE, 59_999), false);
  });

  it("re-opens for the same user exactly at the window boundary", () => {
    const cd = createCooldown(60_000);
    cd.tryFire(ALICE, 0);
    assert.equal(cd.tryFire(ALICE, 60_000), true);
  });

  it("records each successful fire as a new window start", () => {
    const cd = createCooldown(60_000);
    assert.equal(cd.tryFire(ALICE, 0), true);
    assert.equal(cd.tryFire(ALICE, 60_000), true);
    assert.equal(cd.tryFire(ALICE, 60_500), false);
    assert.equal(cd.tryFire(ALICE, 120_000), true);
  });

  it("does not suppress one user's window because another fired", () => {
    const cd = createCooldown(60_000);
    assert.equal(cd.tryFire(ALICE, 0), true);
    // Bob hasn't fired before; his first call should pass even though
    // Alice just fired.
    assert.equal(cd.tryFire(BOB, 1), true);
    // But Alice is still locked out.
    assert.equal(cd.tryFire(ALICE, 1), false);
  });
});
