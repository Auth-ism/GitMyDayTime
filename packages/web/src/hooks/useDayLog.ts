import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreateTaskInput, CreatePlanInput, TaskEntry, PlanItem, DayLog } from "@gmd/shared";

export function useDayLog(date: string) {
  const qc = useQueryClient();
  const key = ["daylog", date];

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.getDayLog(date),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const invalidateWithStats = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const addTask = useMutation({
    mutationFn: (data: CreateTaskInput) => api.addTask(date, data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        const optimistic: TaskEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          description: data.description,
          category: data.category ?? "other",
          duration: data.duration,
          tags: data.tags ?? [],
          completed: false,
        };
        qc.setQueryData<DayLog>(key, { ...prev, tasks: [...prev.tasks, optimistic] });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const updateTask = useMutation({
    mutationFn: ({ id, ...data }: Partial<TaskEntry> & { id: string }) =>
      api.updateTask(date, id, data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        qc.setQueryData<DayLog>(key, {
          ...prev,
          tasks: prev.tasks.map((t) => t.id === vars.id ? { ...t, ...vars } : t),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.deleteTask(date, id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        qc.setQueryData<DayLog>(key, { ...prev, tasks: prev.tasks.filter((t) => t.id !== id) });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const addPlan = useMutation({
    mutationFn: (data: CreatePlanInput) => api.addPlan(date, data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        const optimistic: PlanItem = {
          id: crypto.randomUUID(),
          description: data.description,
          category: data.category ?? "other",
          estimatedDuration: data.estimatedDuration,
          completed: false,
          order: prev.plan.length,
          scheduledTime: data.scheduledTime,
        };
        qc.setQueryData<DayLog>(key, { ...prev, plan: [...prev.plan, optimistic] });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidateWithStats,
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, ...data }: Partial<PlanItem> & { id: string }) =>
      api.updatePlan(date, id, data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        qc.setQueryData<DayLog>(key, {
          ...prev,
          plan: prev.plan.map((p) => p.id === vars.id ? { ...p, ...vars } : p),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidateWithStats,
  });

  const deletePlan = useMutation({
    mutationFn: (id: string) => api.deletePlan(date, id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        qc.setQueryData<DayLog>(key, { ...prev, plan: prev.plan.filter((p) => p.id !== id) });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidateWithStats,
  });

  return { query, addTask, updateTask, deleteTask, addPlan, updatePlan, deletePlan };
}
