import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { PirateEvent } from "../src/domain/event.js";
import { displayName, topByKind } from "../src/domain/leaderboard.js";

function ev(
  user_id: number,
  kind: "spanish" | "correction",
  fired_at: string,
  username?: string,
  first_name = `User${String(user_id)}`,
): PirateEvent {
  const base = {
    id: `evt-${user_id}-${kind}-${fired_at}`,
    user_id,
    first_name,
    kind,
    fired_at,
  };
  return username !== undefined ? { ...base, username } : base;
}

describe("topByKind", () => {
  it("returns empty array when there are no matching events", () => {
    const top = topByKind([], "spanish", 3);
    assert.deepEqual(top, []);
  });

  it("filters by kind", () => {
    const events: PirateEvent[] = [
      ev(1, "spanish", "2026-05-15T10:00:00Z", "alice"),
      ev(2, "correction", "2026-05-15T10:01:00Z", "bob"),
    ];
    const spanish = topByKind(events, "spanish", 3);
    assert.equal(spanish.length, 1);
    assert.equal(spanish[0]?.user_id, 1);
  });

  it("counts per user and sorts by count desc", () => {
    const events: PirateEvent[] = [
      ev(1, "spanish", "t1", "alice"),
      ev(1, "spanish", "t2", "alice"),
      ev(1, "spanish", "t3", "alice"),
      ev(2, "spanish", "t4", "bob"),
      ev(2, "spanish", "t5", "bob"),
      ev(3, "spanish", "t6", "carol"),
    ];
    const top = topByKind(events, "spanish", 3);
    assert.deepEqual(
      top.map((e) => [e.user_id, e.count]),
      [
        [1, 3],
        [2, 2],
        [3, 1],
      ],
    );
  });

  it("respects the limit", () => {
    const events: PirateEvent[] = [
      ev(1, "spanish", "t1"),
      ev(2, "spanish", "t2"),
      ev(3, "spanish", "t3"),
      ev(4, "spanish", "t4"),
    ];
    const top = topByKind(events, "spanish", 2);
    assert.equal(top.length, 2);
  });

  it("uses the most recent display label per user", () => {
    const events: PirateEvent[] = [
      ev(1, "spanish", "2026-05-15T10:00:00Z", "old_handle", "OldName"),
      ev(1, "spanish", "2026-05-15T11:00:00Z", "new_handle", "NewName"),
    ];
    const top = topByKind(events, "spanish", 1);
    assert.equal(top[0]?.username, "new_handle");
    assert.equal(top[0]?.first_name, "NewName");
  });

  it("ties break by user_id asc for determinism", () => {
    const events: PirateEvent[] = [
      ev(7, "spanish", "t1"),
      ev(3, "spanish", "t2"),
      ev(5, "spanish", "t3"),
    ];
    const top = topByKind(events, "spanish", 3);
    assert.deepEqual(
      top.map((e) => e.user_id),
      [3, 5, 7],
    );
  });

  it("omits username when absent (exactOptionalPropertyTypes)", () => {
    const events: PirateEvent[] = [
      ev(1, "spanish", "t1"), // no username
    ];
    const top = topByKind(events, "spanish", 1);
    assert.equal(Object.prototype.hasOwnProperty.call(top[0], "username"), false);
  });
});

describe("displayName", () => {
  it("uses @username when set", () => {
    assert.equal(
      displayName({
        user_id: 1,
        username: "alice",
        first_name: "Alice",
        count: 5,
      }),
      "@alice",
    );
  });
  it("falls back to first_name when username is absent", () => {
    assert.equal(
      displayName({ user_id: 1, first_name: "Alice", count: 5 }),
      "Alice",
    );
  });
});
