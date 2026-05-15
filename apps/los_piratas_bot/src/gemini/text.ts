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
      const candidate = parsed.data.candidates[0];
      if (candidate === undefined) {
        throw new Error("Gemini returned no candidates");
      }
      const parts = candidate.content?.parts ?? [];
      const text = parts.map((p) => p.text).join("").trim();
      const finishReason = candidate.finishReason ?? "UNKNOWN";

      // STOP = model finished cleanly (full sentence, natural end).
      // MAX_TOKENS = hit the maxOutputTokens cap — increase the cap.
      // SAFETY = Gemini's safety filter killed the generation mid-stream
      //   despite BLOCK_NONE settings (yes, this happens — the model has
      //   internal hard-stops the API can't fully disable).
      // Other values: RECITATION, OTHER, BLOCKLIST — all bad.
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
    },
  };
}
