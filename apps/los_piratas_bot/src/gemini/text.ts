import { z } from "zod";

const ResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string() })),
        }),
      }),
    )
    .min(1),
});

export interface GeminiTextClient {
  generate(args: { system: string; user: string }): Promise<string>;
}

export function createGeminiTextClient(params: {
  readonly apiKey: string;
  readonly model: string;
}): GeminiTextClient {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(params.model)}:generateContent`;
  return {
    async generate({ system, user }) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 400,
          },
          // The persona is a vulgar drunk pirate — Gemini's default safety
          // filters will truncate or refuse. Set the four categories to
          // BLOCK_NONE so the model can deliver the bilingual cursing the
          // persona is built around. This is a closed group of friends,
          // adults only, opt-in via /join — appropriate context.
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
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
      const parts = parsed.data.candidates[0]?.content.parts ?? [];
      const text = parts.map((p) => p.text).join("").trim();
      if (text.length === 0) {
        throw new Error("Gemini returned empty text");
      }
      return text;
    },
  };
}
