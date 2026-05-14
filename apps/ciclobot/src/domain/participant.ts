import { z } from "zod";

export const HEIGHT_MIN_CM = 100;
export const HEIGHT_MAX_CM = 250;
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;

export const HeightCmSchema = z
  .number()
  .min(HEIGHT_MIN_CM)
  .max(HEIGHT_MAX_CM);

export const BodyweightKgSchema = z
  .number()
  .min(WEIGHT_MIN_KG)
  .max(WEIGHT_MAX_KG);

export const ParticipantSchema = z.object({
  user_id: z.number().int(),
  username: z.string().optional(),
  height_cm: HeightCmSchema,
  joined_at: z.string().min(1),
  left_at: z.string().optional(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

export function isActive(p: Participant): boolean {
  return p.left_at === undefined;
}
