import { z } from "zod";

/**
 * Freelance brief extraction schema.
 * Claude должен вернуть ровно это — title, budget в USD, deadline как строку.
 *
 * budget_usd: number | null  — null если в тексте нет бюджета
 * deadline:   string | null  — null если дедлайн не указан
 */
export const BriefSchema = z.object({
  title: z.string().min(1),
  budget_usd: z.number().nullable(),
  deadline: z.string().nullable(),
});

export type Brief = z.infer<typeof BriefSchema>;
