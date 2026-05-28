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

const GeminiImageSchema = z.object({
  mimeType: z.string().min(1),
  bytes: z.instanceof(Buffer),
});
export type GeminiImage = z.infer<typeof GeminiImageSchema>;

const GeminiImageClientSchema = z.object({
  generate: z.function().args(z.string()).returns(z.promise(GeminiImageSchema)),
});
export type GeminiImageClient = z.infer<typeof GeminiImageClientSchema>;

const GeminiImageClientParamsSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1),
});
type GeminiImageClientParams = z.infer<typeof GeminiImageClientParamsSchema>;

export function createGeminiImageClient(
  params: GeminiImageClientParams,
): GeminiImageClient {
  const parsedParams = GeminiImageClientParamsSchema.parse(params);
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(parsedParams.model)}:generateContent`;
  return {
    async generate(prompt: string): Promise<GeminiImage> {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": parsedParams.apiKey,
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
            return GeminiImageSchema.parse({
              mimeType: part.inlineData.mimeType,
              bytes: Buffer.from(part.inlineData.data, "base64"),
            });
          }
        }
      }
      throw new Error("Gemini response contained no inline image data");
    },
  };
}
