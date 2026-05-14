import { z } from "zod";
import { LiftSchema } from "./lifts.js";
import { IsoWeekSchema } from "./week.js";

export const LIFT_WEIGHT_MIN_KG = 1;
export const LIFT_WEIGHT_MAX_KG = 1000;

export const LogEntrySchema = z.object({
  iso_week: IsoWeekSchema,
  week_start: z.string().min(1),
  user_id: z.number().int(),
  username: z.string().optional(),
  lift: LiftSchema,
  weight_kg: z.number().min(LIFT_WEIGHT_MIN_KG).max(LIFT_WEIGHT_MAX_KG),
  completed: z.boolean(),
  logged_at: z.string().min(1),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;
