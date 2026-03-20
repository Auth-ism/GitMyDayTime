import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { CreateTaskInput, CreatePlanInput, TaskEntry, PlanItem, ChecklistItem, DayLog } from "@gmd/shared";

export function useDayLog(date: string) {
  const qc = useQueryClient();
  const key = ["daylog", date];
  const injectedRef = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.getDayLog(date),
  });

  // Auto-inject recurring tasks when day data loads
  useEffect(() => {
    if (query.data && !injectedRef.current.has(date)) {
      injectedRef.current.add(date);
      api.injectRecurring(date).then((res) => {
        if (res.injected > 0) {
          qc.invalidateQueries({ queryKey: key });
        }
      }).catch(() => { });
    }
  }, [query.data, date]);

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
          duration: data.duration,
          completed: false,
          order: prev.plan.length,
          scheduledTime: data.scheduledTime,
          checklist: [],
          itemType: "plan",
          priority: (data as any).priority ?? "normal",
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

  const reorderPlan = useMutation({
    mutationFn: (ids: string[]) => api.reorderPlan(date, ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        const idSet = new Set(ids);
        const planMap = new Map(prev.plan.map((p) => [p.id, p]));
        const reordered = ids.map((id, i) => {
          const item = planMap.get(id)!;
          return { ...item, order: i };
        });
        // Preserve items not in the reorder list (reminders, filtered-out items)
        const rest = prev.plan.filter((p) => !idSet.has(p.id));
        qc.setQueryData<DayLog>(key, { ...prev, plan: [...reordered, ...rest] });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidateWithStats,
  });

  const addChecklist = useMutation({
    mutationFn: ({ planId, description }: { planId: string; description: string }) =>
      api.addChecklist(date, planId, { description }),
    onMutate: async ({ planId, description }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        const optimistic: ChecklistItem = {
          id: crypto.randomUUID(),
          planId,
          description,
          completed: false,
          order: prev.plan.find((p) => p.id === planId)?.checklist?.length ?? 0,
        };
        qc.setQueryData<DayLog>(key, {
          ...prev,
          plan: prev.plan.map((p) =>
            p.id === planId ? { ...p, checklist: [...(p.checklist || []), optimistic] } : p
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const updateChecklist = useMutation({
    mutationFn: ({ planId, clId, ...data }: { planId: string; clId: string } & Partial<ChecklistItem>) =>
      api.updateChecklist(date, planId, clId, data),
    onMutate: async ({ planId, clId, ...data }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        qc.setQueryData<DayLog>(key, {
          ...prev,
          plan: prev.plan.map((p) =>
            p.id === planId
              ? { ...p, checklist: (p.checklist || []).map((c) => c.id === clId ? { ...c, ...data } : c) }
              : p
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const deleteChecklist = useMutation({
    mutationFn: ({ planId, clId }: { planId: string; clId: string }) =>
      api.deleteChecklist(date, planId, clId),
    onMutate: async ({ planId, clId }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        qc.setQueryData<DayLog>(key, {
          ...prev,
          plan: prev.plan.map((p) =>
            p.id === planId
              ? { ...p, checklist: (p.checklist || []).filter((c) => c.id !== clId) }
              : p
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const addReminder = useMutation({
    mutationFn: (data: Omit<CreatePlanInput, "itemType">) => api.addPlan(date, { ...data, itemType: "reminder" }),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        const optimistic: PlanItem = {
          id: crypto.randomUUID(),
          description: data.description,
          category: "other",
          completed: false,
          order: prev.plan.length,
          scheduledTime: data.scheduledTime,
          checklist: [],
          itemType: "reminder",
          priority: "normal",
        };
        qc.setQueryData<DayLog>(key, { ...prev, plan: [...prev.plan, optimistic] });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const deleteReminder = deletePlan;

  return { query, addTask, updateTask, deleteTask, addPlan, updatePlan, deletePlan, reorderPlan, addReminder, deleteReminder, addChecklist, updateChecklist, deleteChecklist };
}
