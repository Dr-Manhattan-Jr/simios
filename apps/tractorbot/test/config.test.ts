import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.js";

const ENV_KEYS = [
  "BOT_TOKEN",
  "GEMINI_API_KEY",
  "CHAT_ID",
  "TRIGGER_WORDS",
  "COOLDOWN_SECONDS",
  "GEMINI_MODEL",
] as const;

function withEnv<T>(vars: NodeJS.ProcessEnv, fn: () => T): T {
  const original = { ...process.env };
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, original);
  }
}

describe("loadConfig", () => {
  it("parses a valid env into a typed Config", () => {
    const config = withEnv(
      {
        BOT_TOKEN: "abc:def",
        GEMINI_API_KEY: "key-123",
        CHAT_ID: "-1001234567890",
      },
      () => loadConfig(),
    );
    assert.equal(config.botToken, "abc:def");
    assert.equal(config.geminiApiKey, "key-123");
    assert.equal(config.chatId, -1001234567890);
    assert.deepEqual(config.triggerWords, ["claude", "claudio"]);
    assert.equal(config.cooldownSeconds, 30);
    assert.equal(config.geminiModel, "gemini-2.5-flash-image");
  });

  it("rejects missing BOT_TOKEN", () => {
    withEnv(
      {
        GEMINI_API_KEY: "k",
        CHAT_ID: "-1",
      },
      () => {
        assert.throws(() => loadConfig(), /BOT_TOKEN/);
      },
    );
  });

  it("rejects missing GEMINI_API_KEY", () => {
    withEnv(
      {
        BOT_TOKEN: "abc",
        CHAT_ID: "-1",
      },
      () => {
        assert.throws(() => loadConfig(), /GEMINI_API_KEY/);
      },
    );
  });

  it("parses custom trigger words (lowercased, trimmed)", () => {
    const config = withEnv(
      {
        BOT_TOKEN: "abc",
        GEMINI_API_KEY: "k",
        CHAT_ID: "-1",
        TRIGGER_WORDS: "Foo, Bar ,BAZ",
      },
      () => loadConfig(),
    );
    assert.deepEqual(config.triggerWords, ["foo", "bar", "baz"]);
  });

  it("rejects empty TRIGGER_WORDS", () => {
    withEnv(
      {
        BOT_TOKEN: "abc",
        GEMINI_API_KEY: "k",
        CHAT_ID: "-1",
        TRIGGER_WORDS: " , , ",
      },
      () => {
        assert.throws(() => loadConfig(), /TRIGGER_WORDS/);
      },
    );
  });
});
