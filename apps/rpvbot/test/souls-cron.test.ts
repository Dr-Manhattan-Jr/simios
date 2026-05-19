import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { MessageRecord } from "../src/domain/message.js";
import { capSoul, groupMessagesByUser } from "../src/domain/soul.js";

function msg(over: Partial<MessageRecord> & { message_id: number }): MessageRecord {
  return {
    sent_at: "2026-05-18T12:00:00.000Z",
    user_id: 1,
    first_name: "Alice",
    text: "hello",
    reply_to_id: 0,
    ...over,
  };
}

const WINDOW = {
  startUtc: "2026-05-18T00:00:00.000Z",
  endUtc: "2026-05-19T00:00:00.000Z",
};

describe("capSoul", () => {
  it("returns text unchanged when under the cap", () => {
    assert.equal(capSoul("short", 100), "short");
  });

  it("returns text unchanged at exactly the cap", () => {
    assert.equal(capSoul("abcde", 5), "abcde");
  });

  it("truncates and appends ellipsis when over the cap", () => {
    const out = capSoul("abcdefghij", 5);
    assert.equal(out, "abcd…");
    assert.equal(Array.from(out).length, 5);
  });

  it("does not split a multi-code-unit emoji mid-codepoint", () => {
    // 🧠 is one code point but two UTF-16 code units; naive .slice(2) would split it.
    const out = capSoul("🧠🧠🧠🧠🧠", 3);
    const codepoints = Array.from(out);
    assert.equal(codepoints.length, 3);
    // The last char must be the ellipsis, not a lone surrogate.
    assert.equal(codepoints[codepoints.length - 1], "…");
  });

  it("returns empty string for non-positive cap", () => {
    assert.equal(capSoul("hello", 0), "");
  });
});

describe("groupMessagesByUser", () => {
  it("returns empty map when no messages fall in window", () => {
    const r = groupMessagesByUser(
      [msg({ message_id: 1, sent_at: "2026-05-17T22:00:00.000Z" })],
      WINDOW,
    );
    assert.equal(r.size, 0);
  });

  it("groups messages by user_id", () => {
    const r = groupMessagesByUser(
      [
        msg({ message_id: 1, user_id: 1, sent_at: "2026-05-18T08:00:00.000Z" }),
        msg({ message_id: 2, user_id: 2, sent_at: "2026-05-18T09:00:00.000Z" }),
        msg({ message_id: 3, user_id: 1, sent_at: "2026-05-18T10:00:00.000Z" }),
      ],
      WINDOW,
    );
    assert.equal(r.size, 2);
    assert.equal(r.get(1)?.length, 2);
    assert.equal(r.get(2)?.length, 1);
  });

  it("preserves chronological order within each user group", () => {
    const r = groupMessagesByUser(
      [
        msg({ message_id: 3, user_id: 1, sent_at: "2026-05-18T18:00:00.000Z", text: "third" }),
        msg({ message_id: 1, user_id: 1, sent_at: "2026-05-18T08:00:00.000Z", text: "first" }),
        msg({ message_id: 2, user_id: 1, sent_at: "2026-05-18T12:00:00.000Z", text: "second" }),
      ],
      WINDOW,
    );
    const aliceMessages = r.get(1) ?? [];
    assert.equal(aliceMessages[0]?.text, "first");
    assert.equal(aliceMessages[1]?.text, "second");
    assert.equal(aliceMessages[2]?.text, "third");
  });

  it("excludes messages outside the window (both before and after)", () => {
    const r = groupMessagesByUser(
      [
        msg({ message_id: 1, sent_at: "2026-05-17T23:59:59.999Z" }), // day before
        msg({ message_id: 2, sent_at: "2026-05-18T12:00:00.000Z" }), // in window
        msg({ message_id: 3, sent_at: "2026-05-19T00:00:00.000Z" }), // exclusive end
      ],
      WINDOW,
    );
    assert.equal(r.size, 1);
    assert.equal(r.get(1)?.length, 1);
    assert.equal(r.get(1)?.[0]?.message_id, 2);
  });
});
