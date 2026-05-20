import { z } from "zod";

const CandidateSchema = z.object({
  content: z
    .object({
      parts: z.array(z.object({ text: z.string() })).optional(),
    })
    .optional(),
  finishReason: z.string().optional(),
});

const ResponseSchema = z.object({
  candidates: z.array(CandidateSchema).min(1),
});

/**
 * A Gemini "responseSchema" — a JSON-Schema-ish object that constrains
 * the model to emit JSON of a given shape. This is NOT a zod schema; it
 * is the decoding hint sent in the request. The caller still validates
 * the returned JSON with zod — the schema here only improves the odds
 * the model returns parseable JSON in the first place.
 */
export type GeminiResponseSchema = Record<string, unknown>;

/** An image to send to Gemini as multimodal input. */
export interface GeminiImage {
  /** Base64-encoded image bytes. */
  readonly base64: string;
  /** e.g. "image/jpeg", "image/webp". */
  readonly mimeType: string;
}

export interface GeminiGenerateArgs {
  readonly system: string;
  readonly user: string;
  /** Sampling temperature. Defaults to 0.5 — modest variety; high
   * values produce purple "ship's-log" prose for trivial input. */
  readonly temperature?: number;
  /** When set, the model is asked to return JSON matching this schema
   * (`responseMimeType: application/json`). */
  readonly responseSchema?: GeminiResponseSchema;
  /** When set, the image is sent alongside the text as multimodal
   * input — Gemini 2.5 Flash describes / OCRs it. */
  readonly image?: GeminiImage;
}

export interface GeminiTextClient {
  /** Free-text generation. Returns the model's text reply. */
  generate(args: GeminiGenerateArgs): Promise<string>;
  /** Structured generation. Returns the parsed-but-unvalidated JSON the
   * model produced — the caller MUST zod-validate it before use. */
  generateJson(args: {
    readonly system: string;
    readonly user: string;
    readonly temperature?: number;
    readonly responseSchema: GeminiResponseSchema;
  }): Promise<unknown>;
  /** Structured generation over an image — OCR + description. Returns
   * parsed-but-unvalidated JSON; the caller MUST zod-validate it. */
  describeImage(args: {
    readonly system: string;
    readonly user: string;
    readonly image: GeminiImage;
    readonly responseSchema: GeminiResponseSchema;
    readonly temperature?: number;
  }): Promise<unknown>;
}

// Hard cap on how long we wait for Gemini. Without this, a hung upstream
// request would deadlock the /rpv in-flight latch forever (every
// subsequent /rpv would snark-reply until the bot restarts), and would
// stall the souls / ocr crons mid-loop.
const REQUEST_TIMEOUT_MS = 60_000;

interface TextPart {
  readonly text: string;
}
interface InlineDataPart {
  readonly inlineData: { readonly mimeType: string; readonly data: string };
}
type ContentPart = TextPart | InlineDataPart;

export function createGeminiTextClient(params: {
  readonly apiKey: string;
  readonly model: string;
}): GeminiTextClient {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(params.model)}:generateContent`;

  async function generate(args: GeminiGenerateArgs): Promise<string> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const generationConfig: Record<string, unknown> = {
      temperature: args.temperature ?? 0.5,
      // Narratives are longer than los_piratas_bot one-liners; allow
      // multiple paragraphs without hitting the cap.
      maxOutputTokens: 2000,
      // Disable Gemini 2.5 Flash's internal "thinking" tokens — they
      // share the maxOutputTokens budget and silently truncate the
      // visible reply. The personas don't need chain-of-thought.
      thinkingConfig: { thinkingBudget: 0 },
    };
    if (args.responseSchema !== undefined) {
      generationConfig["responseMimeType"] = "application/json";
      generationConfig["responseSchema"] = args.responseSchema;
    }
    // The image part goes BEFORE the text part — Gemini's docs recommend
    // image-then-instruction ordering.
    const parts: ContentPart[] = [];
    if (args.image !== undefined) {
      parts.push({
        inlineData: {
          mimeType: args.image.mimeType,
          data: args.image.base64,
        },
      });
    }
    parts.push({ text: args.user });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: args.system }] },
          contents: [{ role: "user", parts }],
          generationConfig,
        }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `Gemini request timed out after ${String(REQUEST_TIMEOUT_MS)}ms`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Gemini ${String(response.status)} ${response.statusText}: ${body.slice(0, 500)}`,
      );
    }
    const raw: unknown = await response.json();
    const parsed = ResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Gemini response did not match expected shape: ${parsed.error.message}`,
      );
    }
    const candidate = parsed.data.candidates[0];
    if (candidate === undefined) {
      throw new Error("Gemini returned no candidates");
    }
    const responseParts = candidate.content?.parts ?? [];
    const text = responseParts.map((p) => p.text).join("").trim();
    const finishReason = candidate.finishReason ?? "UNKNOWN";

    if (finishReason !== "STOP") {
      throw new Error(
        `Gemini truncated reply (finishReason=${finishReason}, ` +
          `text="${text.slice(0, 120)}${text.length > 120 ? "…" : ""}")`,
      );
    }
    if (text.length === 0) {
      throw new Error("Gemini returned empty text with STOP");
    }
    return text;
  }

  function parseJsonReply(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `Gemini returned non-JSON despite responseSchema: ` +
          `"${text.slice(0, 120)}${text.length > 120 ? "…" : ""}"`,
      );
    }
  }

  return {
    generate,
    async generateJson({ system, user, temperature, responseSchema }) {
      const args: GeminiGenerateArgs = {
        system,
        user,
        responseSchema,
        ...(temperature !== undefined ? { temperature } : {}),
      };
      return parseJsonReply(await generate(args));
    },
    async describeImage({ system, user, image, responseSchema, temperature }) {
      const args: GeminiGenerateArgs = {
        system,
        user,
        image,
        responseSchema,
        ...(temperature !== undefined ? { temperature } : {}),
      };
      return parseJsonReply(await generate(args));
    },
  };
}
