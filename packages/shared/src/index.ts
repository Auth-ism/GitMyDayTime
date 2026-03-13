import { z } from "zod";

export const Category = z.enum([
  "dev",
  "meeting",
  "review",
  "ops",
  "learning",
  "personal",
  "other",
]);
export type Category = z.infer<typeof Category>;

export const TaskEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  description: z.string(),
  category: Category,
  duration: z.number().optional(),
  tags: z.array(z.string()).default([]),
  completed: z.boolean().default(false),
});
export type TaskEntry = z.infer<typeof TaskEntrySchema>;

export const PlanItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: Category,
  estimatedDuration: z.number().optional(),
  completed: z.boolean().default(false),
  order: z.number(),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

export const DayLogSchema = z.object({
  date: z.string(),
  plan: z.array(PlanItemSchema).default([]),
  tasks: z.array(TaskEntrySchema).default([]),
});
export type DayLog = z.infer<typeof DayLogSchema>;

export const CreateTaskInput = z.object({
  description: z.string().min(1),
  category: Category.default("other"),
  duration: z.number().optional(),
  tags: z.array(z.string()).default([]),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const CreatePlanInput = z.object({
  description: z.string().min(1),
  category: Category.default("other"),
  estimatedDuration: z.number().optional(),
});
export type CreatePlanInput = z.infer<typeof CreatePlanInput>;

export const CATEGORY_LABELS: Record<Category, string> = {
  dev: "Development",
  meeting: "Meeting",
  review: "Code Review",
  ops: "Operations",
  learning: "Learning",
  personal: "Personal",
  other: "Other",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  dev: "#6366f1",
  meeting: "#f59e0b",
  review: "#10b981",
  ops: "#ef4444",
  learning: "#8b5cf6",
  personal: "#06b6d4",
  other: "#6b7280",
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function parseDuration(input: string): number {
  const match = input.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?$/);
  if (!match) return parseInt(input) || 0;
  const hours = parseInt(match[1] || "0");
  const mins = parseInt(match[2] || "0");
  return hours * 60 + mins;
}

export function dateToPath(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}/${m}/${d}.json`;
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
