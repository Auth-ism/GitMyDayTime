import type { DayLog, TaskEntry, PlanItem, CreateTaskInput, CreatePlanInput } from "@gmd/shared";

const BASE = "/api";
const TOKEN_KEY = "gmd-token";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
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
