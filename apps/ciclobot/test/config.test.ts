import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.js";

const VALID_SA = JSON.stringify({
  client_email: "x@y.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
});

function withEnv<T>(vars: NodeJS.ProcessEnv, fn: () => T): T {
  const original = { ...process.env };
  for (const k of Object.keys(process.env)) {
    if (
      k === "BOT_TOKEN" ||
      k === "SHEET_ID" ||
      k === "GOOGLE_SERVICE_ACCOUNT_JSON" ||
      k === "CHAT_ID" ||
      k === "TZ"
    ) {
      delete process.env[k];
    }
  }
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(process.env)) {
      delete process.env[k];
    }
    Object.assign(process.env, original);
  }
}

describe("loadConfig", () => {
  it("parses a valid env into a typed Config", () => {
    const config = withEnv(
      {
        BOT_TOKEN: "abc:def",
        SHEET_ID: "spreadsheet_id_here",
        GOOGLE_SERVICE_ACCOUNT_JSON: VALID_SA,
        CHAT_ID: "-1001234567890",
        TZ: "Europe/Madrid",
      },
      () => loadConfig(),
    );
    assert.equal(config.botToken, "abc:def");
    assert.equal(config.sheetId, "spreadsheet_id_here");
    assert.equal(config.chatId, -1001234567890);
    assert.equal(config.timeZone, "Europe/Madrid");
    assert.equal(config.serviceAccount.client_email, "x@y.iam.gserviceaccount.com");
  });

  it("rejects missing BOT_TOKEN", () => {
    withEnv(
      {
        SHEET_ID: "x",
        GOOGLE_SERVICE_ACCOUNT_JSON: VALID_SA,
        CHAT_ID: "-1",
      },
      () => {
        assert.throws(() => loadConfig(), /BOT_TOKEN/);
      },
    );
  });

  it("rejects malformed service account JSON", () => {
    withEnv(
      {
        BOT_TOKEN: "abc",
        SHEET_ID: "x",
        GOOGLE_SERVICE_ACCOUNT_JSON: "not json",
        CHAT_ID: "-1",
      },
      () => {
        assert.throws(() => loadConfig(), /GOOGLE_SERVICE_ACCOUNT_JSON/);
      },
    );
  });

  it("defaults TZ to Europe/Madrid", () => {
    const config = withEnv(
      {
        BOT_TOKEN: "abc",
        SHEET_ID: "x",
        GOOGLE_SERVICE_ACCOUNT_JSON: VALID_SA,
        CHAT_ID: "-1",
      },
      () => loadConfig(),
    );
    assert.equal(config.timeZone, "Europe/Madrid");
  });
});
