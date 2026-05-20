import { z } from "zod";

/**
 * Download a Telegram file by file_id, for the OCR cron — which runs
 * without a grammY Context and so calls the Bot HTTP API directly.
 *
 * Two steps:
 *  1. getFile → returns the file_path and file_size.
 *  2. GET the file content from the file endpoint.
 *
 * Both fetches are wrapped in an AbortController timeout, same pattern
 * as the Gemini client. The getFile JSON response is zod-parsed at the
 * boundary.
 */

const REQUEST_TIMEOUT_MS = 60_000;

const GetFileResponseSchema = z.object({
  ok: z.boolean(),
  result: z
    .object({
      file_path: z.string().min(1).optional(),
      file_size: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type DownloadResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | {
      readonly ok: false;
      /** "too_big" → over the size cap; "gone" → file no longer on
       * Telegram (expired); "error" → transient/unknown failure. */
      readonly reason: "too_big" | "gone" | "error";
      readonly detail: string;
    };

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const handle = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(handle);
  }
}

/**
 * Download a file. `maxBytes` is checked against the size reported by
 * getFile BEFORE the content is fetched, so an oversized image never
 * gets downloaded.
 */
export async function downloadTelegramFile(args: {
  readonly botToken: string;
  readonly fileId: string;
  readonly maxBytes: number;
}): Promise<DownloadResult> {
  const { botToken, fileId, maxBytes } = args;
  // encodeURIComponent on the token too — it's a path segment.
  const getFileUrl =
    `https://api.telegram.org/bot${encodeURIComponent(botToken)}/getFile` +
    `?file_id=${encodeURIComponent(fileId)}`;

  let metaRaw: unknown;
  try {
    const metaResponse = await fetchWithTimeout(getFileUrl);
    if (metaResponse.status === 400 || metaResponse.status === 404) {
      // 400 "file not found" / 404 — the file_id is no longer valid.
      return { ok: false, reason: "gone", detail: `getFile ${String(metaResponse.status)}` };
    }
    if (!metaResponse.ok) {
      return {
        ok: false,
        reason: "error",
        detail: `getFile ${String(metaResponse.status)} ${metaResponse.statusText}`,
      };
    }
    metaRaw = await metaResponse.json();
  } catch (err) {
    return { ok: false, reason: "error", detail: errMessage(err) };
  }

  const meta = GetFileResponseSchema.safeParse(metaRaw);
  if (!meta.success || !meta.data.ok || meta.data.result?.file_path === undefined) {
    return { ok: false, reason: "gone", detail: "getFile returned no file_path" };
  }
  const filePath = meta.data.result.file_path;
  const fileSize = meta.data.result.file_size;
  if (fileSize !== undefined && fileSize > maxBytes) {
    return {
      ok: false,
      reason: "too_big",
      detail: `file_size ${String(fileSize)} > ${String(maxBytes)}`,
    };
  }

  const contentUrl =
    `https://api.telegram.org/file/bot${encodeURIComponent(botToken)}/` +
    filePath;
  try {
    const contentResponse = await fetchWithTimeout(contentUrl);
    if (contentResponse.status === 404) {
      return { ok: false, reason: "gone", detail: "file content 404" };
    }
    if (!contentResponse.ok) {
      return {
        ok: false,
        reason: "error",
        detail: `download ${String(contentResponse.status)} ${contentResponse.statusText}`,
      };
    }
    const buffer = await contentResponse.arrayBuffer();
    // Defence in depth — if getFile didn't report a size, check here.
    if (buffer.byteLength > maxBytes) {
      return {
        ok: false,
        reason: "too_big",
        detail: `downloaded ${String(buffer.byteLength)} > ${String(maxBytes)}`,
      };
    }
    return { ok: true, bytes: new Uint8Array(buffer) };
  } catch (err) {
    return { ok: false, reason: "error", detail: errMessage(err) };
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.name === "AbortError" ? "request timed out" : err.message;
  }
  return String(err);
}
