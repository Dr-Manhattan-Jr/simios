import { z } from "zod";

const InlineDataSchema = z.object({
  inlineData: z.object({
    mimeType: z.string().min(1),
    data: z.string().min(1),
  }),
});

const TextPartSchema = z.object({
  text: z.string(),
});

const PartSchema = z.union([InlineDataSchema, TextPartSchema]);

const ResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(PartSchema),
        }),
      }),
    )
    .min(1),
});

export interface GeminiImage {
  readonly mimeType: string;
  readonly bytes: Buffer;
}

export interface GeminiImageClient {
  generate(prompt: string): Promise<GeminiImage>;
}

export function createGeminiImageClient(params: {
  readonly apiKey: string;
  readonly model: string;
  readonly fetchImpl?: typeof fetch;
}): GeminiImageClient {
  const f = params.fetchImpl ?? fetch;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(params.model)}:generateContent`;
  return {
    async generate(prompt: string): Promise<GeminiImage> {
      const response = await f(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
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
      for (const candidate of parsed.data.candidates) {
        for (const part of candidate.content.parts) {
          if ("inlineData" in part) {
            return {
              mimeType: part.inlineData.mimeType,
              bytes: Buffer.from(part.inlineData.data, "base64"),
            };
          }
        }
      }
      throw new Error("Gemini response contained no inline image data");
    },
  };
}
