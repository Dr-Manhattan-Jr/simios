import { z } from "zod";

export const ImageThemeSchema = z.enum(["tractor", "luddite"]);
export type ImageTheme = z.infer<typeof ImageThemeSchema>;

export const TriggerGroupSchema = z.object({
  theme: ImageThemeSchema,
  words: z.array(z.string().min(1)).min(1),
});
export type TriggerGroup = z.infer<typeof TriggerGroupSchema>;
