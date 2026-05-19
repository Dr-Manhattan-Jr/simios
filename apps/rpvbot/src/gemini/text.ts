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
  generate(args: {
    system: string;
    user: string;
    /** Sampling temperature. Defaults to 0.5 — modest variety; high
     * values produce purple "ship's-log" prose for trivial input. */
    temperature?: number;
  }): Promise<string>;
}

export function createGeminiTextClient(params: {
  readonly apiKey: string;
  readonly model: string;
}): GeminiTextClient {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(params.model)}:generateContent`;
  return {
    async generate({ system, user, temperature }) {
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
            temperature: temperature ?? 0.5,
            // Narratives are longer than los_piratas_bot one-liners; allow
            // multiple paragraphs without hitting the cap.
            maxOutputTokens: 2000,
            // Disable Gemini 2.5 Flash's internal "thinking" tokens —
            // they share the maxOutputTokens budget and silently truncate
            // the visible reply. The persona doesn't need chain-of-thought.
            thinkingConfig: { thinkingBudget: 0 },
          },
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
