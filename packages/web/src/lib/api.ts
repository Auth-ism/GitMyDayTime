import type { DayLog, TaskEntry, PlanItem, CreateTaskInput, CreatePlanInput } from "@gmd/shared";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) throw new Error(`API error: ${res.status}`);
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
    }>(`/stats?${params}`);
  },
};
