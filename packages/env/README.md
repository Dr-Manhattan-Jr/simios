# @simios/env

Zod-based helpers for parsing `process.env` inside the simios bots. Small on purpose — just two reusable schemas and one helper function.

## Exports

### `NonEmptyString`

```ts
import { NonEmptyString } from "@simios/env";
// equivalent to: z.string().min(1)
```

Reject empty strings at the env boundary. Use as a building block for required-string env vars.

### `JsonObject`

```ts
import { JsonObject } from "@simios/env";

const EnvSchema = z.object({
  GOOGLE_SERVICE_ACCOUNT_JSON: JsonObject.pipe(ServiceAccountSchema),
});
```

A `z.string()` that `JSON.parse`s the value, then asserts the parsed value is a non-null object. Designed to be `.pipe`d into a typed schema for the JSON contents — useful for env vars that hold a whole JSON blob (service account credentials, config bundles).

### `parseEnv(schema, source?)`

```ts
import { parseEnv, NonEmptyString } from "@simios/env";

const ConfigSchema = z.object({
  BOT_TOKEN: NonEmptyString,
  CHAT_ID: z.coerce.number().int(),
}).transform((raw) => ({
  botToken: raw.BOT_TOKEN,
  chatId: raw.CHAT_ID,
}));

export const config = parseEnv(ConfigSchema);
```

Runs the schema against `process.env` (or a custom source). On failure, throws an `Error` whose message lists every invalid field on its own line — easy to read in a Railway log. On success, returns the parsed value, typed as `z.infer<typeof schema>`.

## Why this exists

Every bot in the monorepo parses env vars on startup before doing anything else. They all want:
- Clear failure mode (missing var → fail fast with a precise message).
- A typed value to flow through the rest of the app.
- Boundary-only validation — no `unknown` past this layer.

This package gives them the same toolkit so every bot's `config.ts` looks the same.

## See also

- [`apps/ciclobot/src/config.ts`](../../apps/ciclobot/src/config.ts) — full real-world usage.
- [`@simios/sheets-client`](../sheets-client) — exports `ServiceAccountCredentialsSchema`, designed to pair with `JsonObject` for the `GOOGLE_SERVICE_ACCOUNT_JSON` env var.
