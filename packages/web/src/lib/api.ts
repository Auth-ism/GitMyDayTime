import type { DayLog, TaskEntry, PlanItem, ChecklistItem, CreateTaskInput, CreatePlanInput, CreateChecklistInput, RecurringTask, CreateRecurringTaskInput, UserProfile, UpdateProfileInput, UserCategory, CreateCategoryInput, PlanTemplate, CreateTemplateInput } from "@gmd/shared";

const BASE = "/api";

// Auth context can register a callback to clear user state on 401
// instead of a hard page reload (which breaks service-worker routing).
let _onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  _onUnauthorized = fn;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `API error: ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) errorMessage = data.error;
    } catch {}

    if (res.status === 401) {
      if (_onUnauthorized) _onUnauthorized();
      else window.location.href = "/";
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const secs = retryAfter ? parseInt(retryAfter, 10) : 60;
      throw new Error(`429: ${secs}s`);
    }

    throw new Error(errorMessage);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getDayLog: (date: string) => request<DayLog>(`/days/${date}`),

  addTask: (date: string, data: CreateTaskInput) =>
    request<TaskEntry>(`/days/${date}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTask: (date: string, id: string, data: Partial<TaskEntry>) =>
    request<TaskEntry>(`/days/${date}/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTask: (date: string, id: string) =>
    request<void>(`/days/${date}/tasks/${id}`, { method: "DELETE" }),

  moveTask: (date: string, id: string, newDate: string) =>
    request<TaskEntry>(`/days/${date}/tasks/${id}/move`, {
      method: "PUT",
      body: JSON.stringify({ newDate }),
    }),

  addPlan: (date: string, data: CreatePlanInput) =>
    request<PlanItem>(`/days/${date}/plan`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePlan: (date: string, id: string, data: Partial<PlanItem>) =>
    request<PlanItem>(`/days/${date}/plan/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deletePlan: (date: string, id: string) =>
    request<void>(`/days/${date}/plan/${id}`, { method: "DELETE" }),

  reorderPlan: (date: string, ids: string[]) =>
    request<PlanItem[]>(`/days/${date}/plan/reorder`, {
      method: "PUT",
      body: JSON.stringify({ ids }),
    }),

  movePlan: (date: string, id: string, newDate: string) =>
    request<PlanItem>(`/days/${date}/plan/${id}/move`, {
      method: "PUT",
      body: JSON.stringify({ newDate }),
    }),

  // Checklist
  addChecklist: (date: string, planId: string, data: CreateChecklistInput) =>
    request<ChecklistItem>(`/days/${date}/plan/${planId}/checklist`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateChecklist: (date: string, planId: string, clId: string, data: Partial<ChecklistItem>) =>
    request<ChecklistItem>(`/days/${date}/plan/${planId}/checklist/${clId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteChecklist: (date: string, planId: string, clId: string) =>
    request<void>(`/days/${date}/plan/${planId}/checklist/${clId}`, { method: "DELETE" }),

  getCarryOver: (date: string) =>
    request<PlanItem[]>(`/days/${date}/carryover`),

  doCarryOver: (date: string) =>
    request<{ moved: number }>(`/days/${date}/carryover`, { method: "POST" }),

  search: (q: string) =>
    request<{
      plans: (PlanItem & { date: string })[];
      tasks: (TaskEntry & { date: string })[];
    }>(`/search?q=${encodeURIComponent(q)}`),

  getStats: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request<{
      totalTasks: number;
      totalMinutes: number;
      byCategory: Record<string, { count: number; minutes: number }>;
      dailyActivity: { date: string; tasks: number; planned: number; completedPlan: number; minutes: number }[];
      streak: number;
      daysTracked: number;
      categoryRates: Record<string, { total: number; completed: number }>;
      estimateAccuracy: { avgEstimate: number; avgActual: number; count: number };
    }>(`/stats?${params}`);
  },

  getYearlyActivity: () => request<{ date: string; count: number }[]>("/stats/yearly"),

  // Journal
  getJournal: (date: string) => request<{ content: string }>(`/days/${date}/journal`),

  updateJournal: (date: string, content: string) =>
    request<{ ok: boolean }>(`/days/${date}/journal`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  // Templates
  getTemplates: () => request<PlanTemplate[]>("/templates"),

  createTemplate: (data: CreateTemplateInput) =>
    request<PlanTemplate>("/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: string) =>
    request<void>(`/templates/${id}`, { method: "DELETE" }),

  // Copy day plans
  copyDayPlans: (date: string, fromDate: string) =>
    request<{ copied: number }>(`/days/${date}/copy-from/${fromDate}`, { method: "POST" }),

  // One year ago
  getOneYearAgo: (date: string) =>
    request<{ date: string; plan: PlanItem[] }>(`/days/${date}/one-year-ago`),

  // Export / Import
  exportData: () => fetch("/api/export", { credentials: "include" }),

  importData: (data: object) =>
    request<{ plans: number; tasks: number; recurringTasks: number; journals: number }>("/export/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Web Push
  getVapidKey: () => request<{ publicKey: string }>("/push/vapid-key"),

  subscribePush: (subscription: PushSubscriptionJSON) =>
    request<{ ok: boolean }>("/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    }),

  unsubscribePush: () =>
    request<{ ok: boolean }>("/push/subscribe", { method: "DELETE" }),

  // Recurring tasks
  getRecurringTasks: () => request<RecurringTask[]>("/recurring"),

  createRecurringTask: (data: CreateRecurringTaskInput) =>
    request<RecurringTask>("/recurring", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRecurringTask: (id: string, data: Partial<CreateRecurringTaskInput> & { active?: boolean }) =>
    request<RecurringTask>(`/recurring/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteRecurringTask: (id: string) =>
    request<void>(`/recurring/${id}`, { method: "DELETE" }),

  injectRecurring: (date: string) =>
    request<{ injected: number; items: PlanItem[] }>(`/recurring/inject/${date}`, {
      method: "POST",
    }),

  // Profile
  getProfile: () => request<UserProfile>("/profile"),

  updateProfile: (data: UpdateProfileInput) =>
    request<UserProfile>("/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/profile/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteAccount: (password: string) =>
    request<{ ok: boolean }>("/profile/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),

  uploadAvatar: (avatar: string) =>
    request<{ ok: boolean }>("/profile/avatar", {
      method: "PUT",
      body: JSON.stringify({ avatar }),
    }),

  // Categories
  getCategories: () => request<UserCategory[]>("/categories"),

  createCategory: (data: CreateCategoryInput) =>
    request<UserCategory>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCategory: (id: string, data: Partial<CreateCategoryInput>) =>
    request<UserCategory>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: string) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }),

  // Notifications
  getNotifications: () =>
    request<{ notifications: Array<{ id: string; type: string; message: string; url: string | null; read: boolean; actorName: string | null; createdAt: string; projectId: string | null; issueId: string | null }>; unread: number }>("/notifications"),

  getUnreadCount: () =>
    request<{ count: number }>("/notifications/unread-count"),

  markRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: "PATCH" }),

  markAllRead: () =>
    request<{ ok: boolean }>("/notifications/read-all", { method: "PATCH" }),

  // Calendar subscribe tokens
  listCalendarTokens: () =>
    request<{ tokens: Array<{ id: string; createdAt: string; lastUsedAt: string | null }> }>(
      `/calendar/tokens`,
    ),

  createCalendarToken: () =>
    request<{ id: string; token: string; url: string }>(`/calendar/tokens`, { method: "POST" }),

  revokeCalendarToken: (id: string) =>
    request<void>(`/calendar/tokens/${id}`, { method: "DELETE" }),

  // Personal Access Tokens
  listApiTokens: () =>
    request<{ tokens: Array<{ id: string; name: string; createdAt: string; lastUsedAt: string | null }> }>(
      `/profile/api-tokens`,
    ),

  createApiToken: (name: string) =>
    request<{ id: string; token: string; name: string }>(`/profile/api-tokens`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  revokeApiToken: (id: string) =>
    request<void>(`/profile/api-tokens/${id}`, { method: "DELETE" }),

  // API Key Request
  getApiKeyRequest: () =>
    request<{ request: { id: string; status: string; requestedAt: string } | null }>(
      `/profile/api-key-request`,
    ),

  submitApiKeyRequest: (reason?: string) =>
    request<{ ok: boolean }>(`/profile/api-key-request`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
