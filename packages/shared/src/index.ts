import { z } from "zod";

export const Category = z.string().min(1).max(50);
export type Category = z.infer<typeof Category>;

export const DEFAULT_CATEGORIES = ["dev", "meeting", "review", "ops", "learning", "personal", "other"] as const;
export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

export const ItemType = z.enum(["plan", "reminder"]);
export type ItemType = z.infer<typeof ItemType>;

export const PriorityType = z.enum(["urgent", "high", "normal"]);
export type PriorityType = z.infer<typeof PriorityType>;

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
  priority: PriorityType.default("normal"),
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
  priority: PriorityType.default("normal"),
});
export type CreatePlanInput = z.infer<typeof CreatePlanInput>;

export const PlanTemplateItemSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  description: z.string(),
  category: Category,
  duration: z.number().optional(),
  scheduledTime: z.string().optional(),
  priority: PriorityType.default("normal"),
  order: z.number(),
});
export type PlanTemplateItem = z.infer<typeof PlanTemplateItemSchema>;

export const PlanTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(PlanTemplateItemSchema),
  createdAt: z.string(),
});
export type PlanTemplate = z.infer<typeof PlanTemplateSchema>;

export const CreateTemplateInput = z.object({
  name: z.string().min(1).max(64),
  items: z.array(z.object({
    description: z.string().min(1),
    category: Category.default("other"),
    duration: z.number().optional(),
    scheduledTime: z.string().optional(),
    priority: PriorityType.default("normal"),
  })),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateInput>;

export const CATEGORY_LABELS: Record<string, string> = {
  dev: "Development",
  meeting: "Meeting",
  review: "Review",
  ops: "DevOps",
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  pushNotifications: z.boolean(),
  planEmailNotifications: z.boolean(),
  planSmsNotifications: z.boolean(),
  planPushNotifications: z.boolean(),
  reminderEmailNotifications: z.boolean(),
  reminderSmsNotifications: z.boolean(),
  reminderPushNotifications: z.boolean(),
  hiddenCategories: z.array(z.string()),
  notifyBeforeMinutes: z.number(),
  silentHoursStart: z.string().nullable(),
  silentHoursEnd: z.string().nullable(),
  fontSize: z.enum(["small", "normal", "large", "xlarge"]),
  onboarded: z.boolean(),
  weeklyRecapEnabled: z.boolean(),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateProfileInput = z.object({
  displayName: z.string().max(64).nullable().optional(),
  bio: z.string().max(256).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().max(64).optional(),
  locale: z.enum(["tr", "en"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  pomodoroDuration: z.number().min(1).max(120).optional(),
  breakDuration: z.number().min(1).max(60).optional(),
  dailyGoal: z.number().min(1).max(100).nullable().optional(),
  workStartTime: z.string().nullable().optional(),
  workEndTime: z.string().nullable().optional(),
  defaultCategory: z.string().optional(),
  isPublic: z.boolean().optional(),
  notificationEnabled: z.boolean().optional(),
  phoneNumber: z.string().regex(/^5\d{9}$/, "Invalid phone number (5XXXXXXXXX)").nullable().optional(),
  smsNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  planEmailNotifications: z.boolean().optional(),
  planSmsNotifications: z.boolean().optional(),
  planPushNotifications: z.boolean().optional(),
  reminderEmailNotifications: z.boolean().optional(),
  reminderSmsNotifications: z.boolean().optional(),
  reminderPushNotifications: z.boolean().optional(),
  hiddenCategories: z.array(z.string()).optional(),
  notifyBeforeMinutes: z.number().min(0).max(60).optional(),
  silentHoursStart: z.string().nullable().optional(),
  silentHoursEnd: z.string().nullable().optional(),
  fontSize: z.enum(["small", "normal", "large", "xlarge"]).optional(),
  onboarded: z.boolean().optional(),
  weeklyRecapEnabled: z.boolean().optional(),
  email: z.string().email().optional(),
  username: z.string().min(2).max(32).optional(),
  currentPassword: z.string().min(1).optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;

// ─────────────────────────────────────────────────────────────────
// Project Management
// ─────────────────────────────────────────────────────────────────

export const ProjectRole = z.enum(["owner", "admin", "developer", "reporter", "viewer"]);
export type ProjectRole = z.infer<typeof ProjectRole>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  projectKey: z.string(),
  boardType: z.enum(["kanban", "scrum"]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  memberCount: z.number().optional(),
  myRole: ProjectRole.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInput = z.object({
  name: z.string().min(1).max(64),
  projectKey: z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/, "2-10 uppercase letters/digits, start with letter"),
  description: z.string().max(256).optional(),
  boardType: z.enum(["kanban", "scrum"]).default("kanban"),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).nullable().optional(),
  boardType: z.enum(["kanban", "scrum"]).optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

export const ProjectMemberSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  role: ProjectRole,
  joinedAt: z.string(),
  username: z.string().optional(),
  displayName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  email: z.string().optional(),
});
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;

export const InviteMemberInput = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "developer", "reporter", "viewer"]).default("developer"),
});
export type InviteMemberInput = z.infer<typeof InviteMemberInput>;

export const UpdateMemberRoleInput = z.object({
  role: z.enum(["admin", "developer", "reporter", "viewer"]),
});
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleInput>;

export const TransferOwnerInput = z.object({
  newOwnerId: z.string().uuid(),
});
export type TransferOwnerInput = z.infer<typeof TransferOwnerInput>;

export const WorkflowStatusSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  color: z.string(),
  category: z.enum(["todo", "in_progress", "done"]),
  sortOrder: z.number(),
  isDefault: z.boolean(),
  createdAt: z.string(),
});
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const IssuePriority = z.enum(["critical", "high", "medium", "low", "none"]);
export type IssuePriority = z.infer<typeof IssuePriority>;

export const IssueType = z.enum(["epic", "story", "task", "bug", "sub_task"]);
export type IssueType = z.infer<typeof IssueType>;

export const IssueSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  issueNumber: z.number(),
  issueKey: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  issueType: IssueType,
  statusId: z.string(),
  priority: IssuePriority,
  labels: z.array(z.string()),
  parentId: z.string().nullable(),
  epicId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  reporterId: z.string(),
  dueDate: z.string().nullable(),
  estimatedHours: z.number().nullable(),
  loggedHours: z.number(),
  sprintId: z.string().nullable(),
  customFields: z.record(z.unknown()),
  sortOrder: z.number(),
  planItemId: z.string().nullable(),
  storyPoints: z.number().int().min(0).max(9999).nullable(),
  notificationSent: z.boolean(),
  resolvedAt: z.string().nullable(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Joined fields
  statusName: z.string().optional(),
  statusColor: z.string().optional(),
  statusCategory: z.enum(["todo", "in_progress", "done"]).optional(),
  assigneeUsername: z.string().nullable().optional(),
  assigneeDisplayName: z.string().nullable().optional(),
  assigneeAvatarUrl: z.string().nullable().optional(),
  reporterUsername: z.string().optional(),
  parentIssueKey: z.string().nullable().optional(),
  parentTitle: z.string().nullable().optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const CreateIssueInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(51200).optional(),
  issueType: IssueType.default("task"),
  priority: IssuePriority.default("medium"),
  labels: z.array(z.string()).default([]),
  assigneeId: z.string().uuid().nullable().optional(),
  statusId: z.string().uuid().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().min(0).nullable().optional(),
  storyPoints: z.number().int().min(0).max(9999).nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
});
export type CreateIssueInput = z.infer<typeof CreateIssueInput>;

export const UpdateIssueInput = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(51200).nullable().optional(),
  issueType: IssueType.optional(),
  statusId: z.string().uuid().optional(),
  priority: IssuePriority.optional(),
  labels: z.array(z.string()).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().min(0).nullable().optional(),
  loggedHours: z.number().min(0).optional(),
  storyPoints: z.number().int().min(0).max(9999).nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().optional(),
  parentId: z.string().uuid().nullable().optional(),
});
export type UpdateIssueInput = z.infer<typeof UpdateIssueInput>;

export const IssueCommentSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  authorId: z.string(),
  content: z.string(),
  mentions: z.array(z.string()),
  editedAt: z.string().nullable(),
  createdAt: z.string(),
  authorUsername: z.string().optional(),
  authorDisplayName: z.string().nullable().optional(),
  authorAvatarUrl: z.string().nullable().optional(),
});
export type IssueComment = z.infer<typeof IssueCommentSchema>;

export const CreateCommentInput = z.object({
  content: z.string().min(1).max(10000),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

export const IssueHistorySchema = z.object({
  id: z.string(),
  issueId: z.string(),
  changedBy: z.string(),
  fieldName: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  changedAt: z.string(),
  changedByUsername: z.string().optional(),
});
export type IssueHistory = z.infer<typeof IssueHistorySchema>;

export const AddToPlanInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().optional(),
});
export type AddToPlanInput = z.infer<typeof AddToPlanInput>;

export interface BoardColumn {
  status: WorkflowStatus;
  issues: Issue[];
}

export interface BoardData {
  statuses: WorkflowStatus[];
  columns: Record<string, BoardColumn>;
  members: ProjectMember[];
  project: Project;
}

export interface IssueDetail extends Issue {
  comments: IssueComment[];
  history: IssueHistory[];
  links?: IssueLink[];
  children?: Issue[];
}

export const IssueLinkType = z.enum(["relates_to", "blocks", "is_blocked_by", "duplicates", "is_duplicated_by"]);
export type IssueLinkType = z.infer<typeof IssueLinkType>;

export const IssueLinkSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  linkType: IssueLinkType,
  createdAt: z.string(),
  // Joined fields
  targetIssueKey: z.string().optional(),
  targetTitle: z.string().optional(),
  targetStatusName: z.string().optional(),
  targetStatusColor: z.string().optional(),
  targetPriority: z.string().optional(),
});
export type IssueLink = z.infer<typeof IssueLinkSchema>;

// ─────────────────────────────────────────────────────────────────
// Sprints
// ─────────────────────────────────────────────────────────────────

export const SprintStatus = z.enum(["planning", "active", "completed"]);
export type SprintStatus = z.infer<typeof SprintStatus>;

export const SprintSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  goal: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: SprintStatus,
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  issueCount: z.number().optional(),
});
export type Sprint = z.infer<typeof SprintSchema>;

export const CreateSprintInput = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().max(500).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CreateSprintInput = z.infer<typeof CreateSprintInput>;

export const UpdateSprintInput = CreateSprintInput.partial().extend({
  status: SprintStatus.optional(),
});
export type UpdateSprintInput = z.infer<typeof UpdateSprintInput>;

export const CompleteSprintInput = z.object({
  // What to do with incomplete issues: move to backlog or to another sprint
  incompleteAction: z.enum(["backlog", "next_sprint"]),
  nextSprintId: z.string().uuid().optional(), // required if incompleteAction === "next_sprint"
});
export type CompleteSprintInput = z.infer<typeof CompleteSprintInput>;

// ─────────────────────────────────────────────────────────────────
// Spaces  (UI deferred — schema/types ready for future wiring)
// ─────────────────────────────────────────────────────────────────

export const SpaceRole = z.enum(["owner", "admin", "member"]);
export type SpaceRole = z.infer<typeof SpaceRole>;

export const SpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string(),
  ownerId: z.string(),
  settings: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Joined
  myRole: SpaceRole.optional(),
  memberCount: z.number().optional(),
  projectCount: z.number().optional(),
});
export type Space = z.infer<typeof SpaceSchema>;

export const CreateSpaceInput = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Küçük harf, rakam ve tire"),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type CreateSpaceInput = z.infer<typeof CreateSpaceInput>;

export const UpdateSpaceInput = CreateSpaceInput.partial();
export type UpdateSpaceInput = z.infer<typeof UpdateSpaceInput>;

export const SpaceMemberSchema = z.object({
  spaceId: z.string(),
  userId: z.string(),
  role: SpaceRole,
  joinedAt: z.string(),
  username: z.string().optional(),
  displayName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  email: z.string().optional(),
});
export type SpaceMember = z.infer<typeof SpaceMemberSchema>;
