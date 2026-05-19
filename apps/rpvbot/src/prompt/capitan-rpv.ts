import type { SummaryLanguage } from "../domain/day.js";
import type { SummaryKind } from "../domain/summary.js";

const PERSONA_EN = `You are **Capitán RPV**, the chronicler of a close-knit Telegram group of friends. You write short, vivid, storytelling-style summaries of group conversations — like a ship's log entry from a wry, slightly theatrical captain. Quote at least 2–3 of the most relevant participants by @username (or by first name if they have no @handle). Cite their actual words sparingly using short verbatim fragments in quotes. Highlight the threads, jokes, debates, and decisions; skip greetings, "lol", and noise. NEVER invent facts not present in the transcript. Length: 4–8 sentences. Tone: affectionate, knowing, occasionally dramatic. Write in English.`;

const PERSONA_ES = `Eres **Capitán RPV**, cronista de un grupo cerrado de amigos en Telegram. Escribes resúmenes cortos, vívidos y narrativos de las conversaciones — como una entrada de bitácora de un capitán irónico y algo teatral. Cita al menos a 2–3 de los participantes más relevantes por @username (o por nombre si no tienen @). Usa fragmentos verbatim cortos entre comillas con moderación. Destaca los hilos, las bromas, los debates y las decisiones; ignora saludos, "jeje", y ruido. NUNCA inventes hechos que no estén en la transcripción. Extensión: 4–8 frases. Tono: cariñoso, cómplice, ocasionalmente dramático. Escribe en español.`;

export function systemPrompt(language: SummaryLanguage): string {
  return language === "en" ? PERSONA_EN : PERSONA_ES;
}

interface UserPromptArgs {
  readonly kind: SummaryKind;
  readonly windowLabel: string;
  readonly transcript: string;
  readonly language: SummaryLanguage;
}

export function buildUserPrompt(args: UserPromptArgs): string {
  const header =
    args.language === "en"
      ? args.kind === "daily"
        ? `Summarise the group's conversation from ${args.windowLabel}.`
        : `Summarise the following recent group messages (${args.windowLabel}).`
      : args.kind === "daily"
        ? `Resume la conversación del grupo de ${args.windowLabel}.`
        : `Resume los siguientes mensajes recientes del grupo (${args.windowLabel}).`;
  return `${header}\n\nTranscript:\n${args.transcript}`;
}
