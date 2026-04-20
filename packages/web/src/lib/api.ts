import type { DayLog, TaskEntry, PlanItem, ChecklistItem, CreateTaskInput, CreatePlanInput, CreateChecklistInput, RecurringTask, CreateRecurringTaskInput, UserProfile, UpdateProfileInput, UserCategory, CreateCategoryInput, PlanTemplate, CreateTemplateInput, Project, ProjectMember, WorkflowStatus, Issue, IssueComment, IssueDetail, IssueLink, BoardData, CreateProjectInput, UpdateProjectInput, CreateIssueInput, UpdateIssueInput, CreateCommentInput, InviteMemberInput, UpdateMemberRoleInput, TransferOwnerInput, AddToPlanInput, Sprint, CreateSprintInput, UpdateSprintInput, CompleteSprintInput } from "@gmd/shared";

const BASE = "/api";

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
      window.location.href = "/login";
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
      issues: Array<{ id: string; issueKey: string; title: string; projectId: string; projectName: string; priority: string; issueType: string; statusName: string; statusColor: string }>;
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

  // ── Projects ────────────────────────────────────────────────────
  getProjects: () => request<Project[]>("/projects"),

  getProject: (id: string) =>
    request<Project & { members: ProjectMember[]; statuses: WorkflowStatus[] }>(`/projects/${id}`),

  createProject: (data: CreateProjectInput) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),

  updateProject: (id: string, data: UpdateProjectInput) =>
    request<Project>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" }),

  inviteMember: (id: string, data: InviteMemberInput) =>
    request<{ ok: boolean; invitationId: string; expiresAt: string }>(`/projects/${id}/invitations`, {
      method: "POST", body: JSON.stringify(data),
    }),

  joinProject: (token: string) =>
    request<{ projectId: string; projectName: string }>(`/projects/join/${token}`),

  leaveProject: (id: string) =>
    request<{ ok: boolean }>(`/projects/${id}/leave`, { method: "DELETE" }),

  removeMember: (id: string, userId: string) =>
    request<{ ok: boolean }>(`/projects/${id}/members/${userId}`, { method: "DELETE" }),

  updateMemberRole: (id: string, userId: string, data: UpdateMemberRoleInput) =>
    request<ProjectMember>(`/projects/${id}/members/${userId}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),

  transferOwnership: (id: string, data: TransferOwnerInput) =>
    request<{ ok: boolean }>(`/projects/${id}/transfer`, {
      method: "POST", body: JSON.stringify(data),
    }),

  getWorkflowStatuses: (id: string) =>
    request<WorkflowStatus[]>(`/projects/${id}/statuses`),

  getBoard: (id: string, sprintId?: string | null) =>
    request<BoardData>(`/projects/${id}/board${sprintId ? `?sprintId=${sprintId}` : ""}`),

  getIssues: (id: string, params?: Record<string, string | number | undefined>) => {
    const qs = params
      ? "?" + Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
      : "";
    return request<{ issues: Issue[]; total: number }>(`/projects/${id}/issues${qs}`);
  },

  getIssue: (id: string, issueId: string) =>
    request<IssueDetail>(`/projects/${id}/issues/${issueId}`),

  createIssue: (id: string, data: CreateIssueInput) =>
    request<Issue>(`/projects/${id}/issues`, { method: "POST", body: JSON.stringify(data) }),

  updateIssue: (id: string, issueId: string, data: UpdateIssueInput) =>
    request<Issue>(`/projects/${id}/issues/${issueId}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteIssue: (id: string, issueId: string) =>
    request<{ ok: boolean }>(`/projects/${id}/issues/${issueId}`, { method: "DELETE" }),

  restoreIssue: (id: string, issueId: string) =>
    request<{ ok: boolean }>(`/projects/${id}/issues/${issueId}/restore`, { method: "PATCH" }),

  permanentDeleteIssue: (id: string, issueId: string) =>
    request<{ ok: boolean }>(`/projects/${id}/issues/${issueId}/permanent`, { method: "DELETE" }),

  getArchivedIssues: (id: string) =>
    request<{ issues: Issue[]; total: number }>(`/projects/${id}/issues/archived`),

  updateIssueStatus: (id: string, issueId: string, statusId: string) =>
    request<Issue>(`/projects/${id}/issues/${issueId}/status`, {
      method: "PATCH", body: JSON.stringify({ statusId }),
    }),

  addComment: (id: string, issueId: string, data: CreateCommentInput) =>
    request<IssueComment>(`/projects/${id}/issues/${issueId}/comments`, {
      method: "POST", body: JSON.stringify(data),
    }),

  updateComment: (id: string, issueId: string, commentId: string, data: CreateCommentInput) =>
    request<IssueComment>(`/projects/${id}/issues/${issueId}/comments/${commentId}`, {
      method: "PUT", body: JSON.stringify(data),
    }),

  deleteComment: (id: string, issueId: string, commentId: string) =>
    request<{ ok: boolean }>(`/projects/${id}/issues/${issueId}/comments/${commentId}`, {
      method: "DELETE",
    }),

  addIssueToPlan: (id: string, issueId: string, data: AddToPlanInput) =>
    request<{ planItemId: string; ok: boolean }>(`/projects/${id}/issues/${issueId}/add-to-plan`, {
      method: "POST", body: JSON.stringify(data),
    }),

  removeIssueFromPlan: (id: string, issueId: string) =>
    request<{ ok: boolean }>(`/projects/${id}/issues/${issueId}/add-to-plan`, { method: "DELETE" }),

  getMyAssignments: (date?: string) =>
    request<Array<{ issueId: string; projectId: string; planItemId: string | null; issueKey: string; title: string }>>(
      `/projects/my-assignments${date ? `?date=${date}` : ""}`
    ),

  getProjectLabels: (id: string) =>
    request<string[]>(`/projects/${id}/labels`),

  reorderIssues: (projectId: string, orders: Array<{ issueId: string; sortOrder: number }>) =>
    request<{ ok: boolean }>(`/projects/${projectId}/issues/reorder`, {
      method: "PATCH", body: JSON.stringify({ orders }),
    }),

  // Notifications
  getNotifications: () =>
    request<{ notifications: Array<{ id: string; type: string; message: string; url: string | null; read: boolean; actorName: string | null; createdAt: string; projectId: string | null; issueId: string | null }>; unread: number }>("/notifications"),

  getUnreadCount: () =>
    request<{ count: number }>("/notifications/unread-count"),

  markRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: "PATCH" }),

  markAllRead: () =>
    request<{ ok: boolean }>("/notifications/read-all", { method: "PATCH" }),

  // Sprints
  getSprints: (id: string) =>
    request<Sprint[]>(`/projects/${id}/sprints`),

  createSprint: (id: string, data: CreateSprintInput) =>
    request<Sprint>(`/projects/${id}/sprints`, { method: "POST", body: JSON.stringify(data) }),

  updateSprint: (id: string, sprintId: string, data: UpdateSprintInput) =>
    request<Sprint>(`/projects/${id}/sprints/${sprintId}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteSprint: (id: string, sprintId: string) =>
    request<{ ok: boolean }>(`/projects/${id}/sprints/${sprintId}`, { method: "DELETE" }),

  completeSprint: (id: string, sprintId: string, data: CompleteSprintInput) =>
    request<{ ok: boolean; completedCount: number; movedCount: number }>(
      `/projects/${id}/sprints/${sprintId}/complete`,
      { method: "POST", body: JSON.stringify(data) }
    ),

  setIssueSprint: (id: string, issueId: string, sprintId: string | null) =>
    request<{ ok: boolean }>(`/projects/${id}/issues/${issueId}/sprint`, {
      method: "POST", body: JSON.stringify({ sprintId }),
    }),

  getIssueLinks: (id: string, issueId: string) =>
    request<IssueLink[]>(`/projects/${id}/issues/${issueId}/links`),

  createIssueLink: (id: string, issueId: string, data: { targetId: string; linkType: string }) =>
    request<IssueLink>(`/projects/${id}/issues/${issueId}/links`, { method: "POST", body: JSON.stringify(data) }),

  deleteIssueLink: (id: string, issueId: string, linkId: string) =>
    request<{ ok: boolean }>(`/projects/${id}/issues/${issueId}/links/${linkId}`, { method: "DELETE" }),

  createStatus: (id: string, data: { name: string; color: string; category: string }) =>
    request<WorkflowStatus>(`/projects/${id}/statuses`, { method: "POST", body: JSON.stringify(data) }),

  updateStatus: (id: string, sid: string, data: { name?: string; color?: string; category?: string; isDefault?: boolean }) =>
    request<WorkflowStatus>(`/projects/${id}/statuses/${sid}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteStatus: (id: string, sid: string) =>
    request<{ ok: boolean }>(`/projects/${id}/statuses/${sid}`, { method: "DELETE" }),

  reorderStatuses: (id: string, orders: Array<{ statusId: string; sortOrder: number }>) =>
    request<{ ok: boolean }>(`/projects/${id}/statuses/reorder`, { method: "PATCH", body: JSON.stringify({ orders }) }),

  // Calendar subscribe tokens
  listCalendarTokens: () =>
    request<{ tokens: Array<{ id: string; createdAt: string; lastUsedAt: string | null }> }>(
      `/calendar/tokens`,
    ),

  createCalendarToken: () =>
    request<{ id: string; token: string; url: string }>(`/calendar/tokens`, { method: "POST" }),

  revokeCalendarToken: (id: string) =>
    request<void>(`/calendar/tokens/${id}`, { method: "DELETE" }),
};
