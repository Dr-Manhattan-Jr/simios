import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { MessageRecord } from "../src/domain/message.js";
import { renderTranscript } from "../src/domain/transcript.js";

const MADRID = "Europe/Madrid";

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

describe("renderTranscript", () => {
  it("renders username when present", () => {
    const out = renderTranscript(
      [msg({ message_id: 1, username: "alice", text: "hi" })],
      MADRID,
    );
    assert.match(out, /@alice \(Alice\): hi/);
  });

  it("renders just first name when username absent", () => {
    const out = renderTranscript(
      [msg({ message_id: 1, first_name: "Carlos", text: "buenas" })],
      MADRID,
    );
    assert.match(out, /Carlos: buenas/);
    assert.equal(out.includes("(no @"), false);
  });

  it("converts UTC timestamp to configured time zone", () => {
    const out = renderTranscript(
      [
        msg({
          message_id: 1,
          sent_at: "2026-05-18T12:30:00.000Z",
          username: "alice",
        }),
      ],
      MADRID,
    );
    // 12:30 UTC in May = 14:30 CEST
    assert.match(out, /\[2026-05-18 14:30\]/);
  });

  it("emits [↩ to X] when reply target is in the window", () => {
    const out = renderTranscript(
      [
        msg({ message_id: 1, username: "alice", text: "anyone?" }),
        msg({
          message_id: 2,
          username: "bob",
          first_name: "Bob",
          text: "yes",
          reply_to_id: 1,
        }),
      ],
      MADRID,
    );
    assert.match(out, /@bob \(Bob\) \[↩ to alice\]: yes/);
  });

  it("omits [↩ to X] when reply target is NOT in the window", () => {
    const out = renderTranscript(
      [
        msg({ message_id: 2, username: "bob", text: "yes", reply_to_id: 99 }),
      ],
      MADRID,
    );
    assert.equal(out.includes("↩"), false);
  });

  it("decodes \\n back to real newlines", () => {
    const out = renderTranscript(
      [msg({ message_id: 1, username: "alice", text: "line1\\nline2" })],
      MADRID,
    );
    assert.match(out, /line1\nline2/);
  });

  it("orders messages by their array position (caller pre-sorts)", () => {
    const out = renderTranscript(
      [
        msg({ message_id: 1, text: "first" }),
        msg({ message_id: 2, text: "second" }),
      ],
      MADRID,
    );
    const lines = out.split("\n");
    assert.match(lines[0] ?? "", /first/);
    assert.match(lines[1] ?? "", /second/);
  });
});
