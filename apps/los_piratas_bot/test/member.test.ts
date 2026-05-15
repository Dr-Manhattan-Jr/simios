import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { MemberSchema, isActive } from "../src/domain/member.js";

describe("MemberSchema", () => {
  it("parses a minimal active member", () => {
    const m = MemberSchema.parse({
      user_id: 1,
      first_name: "Josep",
      joined_at: "2026-05-15T12:00:00Z",
    });
    assert.equal(m.user_id, 1);
    assert.equal(m.username, undefined);
    assert.equal(m.left_at, undefined);
  });

  it("parses a member with username and left_at", () => {
    const m = MemberSchema.parse({
      user_id: 2,
      username: "alice",
      first_name: "Alice",
      joined_at: "2026-05-15T12:00:00Z",
      left_at: "2026-05-16T12:00:00Z",
    });
    assert.equal(m.username, "alice");
    assert.equal(m.left_at, "2026-05-16T12:00:00Z");
  });

  it("rejects when first_name is missing", () => {
    const r = MemberSchema.safeParse({
      user_id: 3,
      joined_at: "2026-05-15T12:00:00Z",
    });
    assert.equal(r.success, false);
  });
});

describe("isActive", () => {
  it("returns true when left_at is undefined", () => {
    assert.equal(
      isActive({
        user_id: 1,
        first_name: "x",
        joined_at: "2026-05-15T12:00:00Z",
      }),
      true,
    );
  });
  it("returns false when left_at is set", () => {
    assert.equal(
      isActive({
        user_id: 1,
        first_name: "x",
        joined_at: "2026-05-15T12:00:00Z",
        left_at: "2026-05-16T12:00:00Z",
      }),
      false,
    );
  });
});
