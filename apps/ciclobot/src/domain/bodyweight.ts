import { z } from "zod";
import { BodyweightKgSchema } from "./participant.js";
import { IsoWeekSchema } from "./week.js";

export const BodyweightEntrySchema = z.object({
  iso_week: IsoWeekSchema,
  week_start: z.string().min(1),
  user_id: z.number().int(),
  username: z.string().optional(),
  weight_kg: BodyweightKgSchema,
  logged_at: z.string().min(1),
});
export type BodyweightEntry = z.infer<typeof BodyweightEntrySchema>;
