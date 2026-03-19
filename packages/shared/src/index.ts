import { z } from "zod";

export const Category = z.string().min(1).max(50);
export type Category = z.infer<typeof Category>;

export const DEFAULT_CATEGORIES = ["dev", "meeting", "review", "ops", "learning", "personal", "other"] as const;
export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

export const ItemType = z.enum(["plan", "reminder"]);
export type ItemType = z.infer<typeof ItemType>;

export const UserCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  sortOrder: z.number(),
});
export type UserCategory = z.infer<typeof UserCategorySchema>;

export const CreateCategoryInput = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6b7280"),
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInput>;

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

export const ChecklistItemSchema = z.object({
  id: z.string(),
  planId: z.string(),
  description: z.string(),
  completed: z.boolean().default(false),
  order: z.number(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const CreateChecklistInput = z.object({
  description: z.string().min(1),
});
export type CreateChecklistInput = z.infer<typeof CreateChecklistInput>;

export const PlanItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: Category,
  duration: z.number().optional(),
  completed: z.boolean().default(false),
  order: z.number(),
  scheduledTime: z.string().optional(),
  actualDuration: z.number().optional(),
  checklist: z.array(ChecklistItemSchema).default([]),
  itemType: ItemType.default("plan"),
  notificationSent: z.boolean().optional(),
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
  duration: z.number().optional(),
  scheduledTime: z.string().optional(),
  itemType: ItemType.default("plan"),
});
export type CreatePlanInput = z.infer<typeof CreatePlanInput>;

export const CATEGORY_LABELS: Record<string, string> = {
  dev: "Development",
  meeting: "Meeting",
  review: "Code Review",
  ops: "Operations",
  learning: "Learning",
  personal: "Personal",
  other: "Other",
};

export const CATEGORY_COLORS: Record<string, string> = {
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

// Recurring tasks
export const RecurrencePattern = z.enum(["daily", "weekdays", "weekly", "custom"]);
export type RecurrencePattern = z.infer<typeof RecurrencePattern>;

export const RecurringTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: Category,
  duration: z.number().optional(),
  scheduledTime: z.string().optional(),
  recurrence: RecurrencePattern,
  weekDay: z.number().min(0).max(6).optional(),
  customDays: z.array(z.number().min(0).max(6)).optional(),
  active: z.boolean().default(true),
  createdAt: z.string().optional(),
});
export type RecurringTask = z.infer<typeof RecurringTaskSchema>;

export const CreateRecurringTaskInput = z.object({
  description: z.string().min(1),
  category: Category.default("other"),
  duration: z.number().optional(),
  scheduledTime: z.string().optional(),
  recurrence: RecurrencePattern,
  weekDay: z.number().min(0).max(6).optional(),
  customDays: z.array(z.number().min(0).max(6)).optional(),
});
export type CreateRecurringTaskInput = z.infer<typeof CreateRecurringTaskInput>;

export const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "Weekly",
  custom: "Custom",
};

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Auth schemas
export const RegisterInput = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(32),
  password: z.string().min(6),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
}

// User profile
export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  timezone: z.string(),
  locale: z.string(),
  theme: z.string(),
  pomodoroDuration: z.number(),
  breakDuration: z.number(),
  dailyGoal: z.number().nullable(),
  workStartTime: z.string().nullable(),
  workEndTime: z.string().nullable(),
  defaultCategory: z.string(),
  isPublic: z.boolean(),
  notificationEnabled: z.boolean(),
  phoneNumber: z.string().nullable(),
  smsNotifications: z.boolean(),
  emailNotifications: z.boolean(),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateProfileInput = z.object({
  displayName: z.string().max(64).nullable().optional(),
  bio: z.string().max(256).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().max(64).optional(),
  locale: z.enum(["tr", "en"]).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  pomodoroDuration: z.number().min(1).max(120).optional(),
  breakDuration: z.number().min(1).max(60).optional(),
  dailyGoal: z.number().min(1).max(100).nullable().optional(),
  workStartTime: z.string().nullable().optional(),
  workEndTime: z.string().nullable().optional(),
  defaultCategory: z.string().optional(),
  isPublic: z.boolean().optional(),
  notificationEnabled: z.boolean().optional(),
  phoneNumber: z.string().max(20).nullable().optional(),
  smsNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  email: z.string().email().optional(),
  username: z.string().min(2).max(32).optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;
