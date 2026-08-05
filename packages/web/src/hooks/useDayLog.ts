import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import { showErrorToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";
import type { CreateTaskInput, CreatePlanInput, TaskEntry, PlanItem, ChecklistItem, DayLog } from "@gmd/shared";

export function useDayLog(date: string) {
  const qc = useQueryClient();
  const { t } = useI18n();
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
    onMutate: (data) => {
      qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      const current = prev ?? { date, plan: [], tasks: [] };
      const optimisticId = crypto.randomUUID();
      const optimistic: TaskEntry = {
        id: optimisticId,
        timestamp: new Date().toISOString(),
        description: data.description,
        category: data.category ?? "other",
        duration: data.duration,
        tags: data.tags ?? [],
        completed: false,
      };
      qc.setQueryData<DayLog>(key, { ...current, tasks: [...current.tasks, optimistic] });
      return { prev, optimisticId };
    },
    onSuccess: (serverItem, _vars, ctx) => {
      if (!serverItem || !ctx) return;
      qc.setQueryData<DayLog>(key, (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.map((t) => t.id === ctx.optimisticId ? serverItem : t) };
      });
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const updateTask = useMutation({
    mutationFn: ({ id, ...data }: Partial<TaskEntry> & { id: string }) =>
      api.updateTask(date, id, data),
    onMutate: (vars) => {
      qc.cancelQueries({ queryKey: key });
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
    onMutate: (id) => {
      qc.cancelQueries({ queryKey: key });
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
    onMutate: (data) => {
      qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      const current = prev ?? { date, plan: [], tasks: [] };
      const optimisticId = crypto.randomUUID();
      const optimistic: PlanItem = {
        id: optimisticId,
        description: data.description,
        category: data.category ?? "other",
        duration: data.duration,
        completed: false,
        order: current.plan.length,
        scheduledTime: data.scheduledTime,
        checklist: [],
        itemType: (data as any).itemType ?? "plan",
        priority: (data as any).priority ?? "normal",
      };
      qc.setQueryData<DayLog>(key, { ...current, plan: [...current.plan, optimistic] });
      return { prev, optimisticId };
    },
    onSuccess: (serverItem, _vars, ctx) => {
      if (!serverItem || !ctx) return;
      qc.setQueryData<DayLog>(key, (old) => {
        if (!old) return old;
        return { ...old, plan: old.plan.map((p) => p.id === ctx.optimisticId ? serverItem : p) };
      });
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      // Sunucu sadece 409 döndürüyor; metni burada çeviriyoruz ki TR/EN ayrışmasın (GMD-7).
      if (err instanceof ApiError && err.status === 409) showErrorToast(t("plan.duplicate"));
    },
    onSettled: invalidateWithStats,
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, ...data }: Partial<PlanItem> & { id: string }) =>
      api.updatePlan(date, id, data),
    onMutate: (vars) => {
      qc.cancelQueries({ queryKey: key });
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
    onMutate: (id) => {
      qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      if (prev) {
        qc.setQueryData<DayLog>(key, { ...prev, plan: prev.plan.filter((p) => p.id !== id) });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: () => {
      invalidateWithStats();
      // Invalidate all board caches — plan item may have been linked to a project issue
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["issue"] });
    },
  });

  const reorderPlan = useMutation({
    mutationFn: (ids: string[]) => api.reorderPlan(date, ids),
    onMutate: (ids) => {
      qc.cancelQueries({ queryKey: key });
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
    onMutate: ({ planId, description }) => {
      qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      const current = prev ?? { date, plan: [], tasks: [] };
      const optimisticId = crypto.randomUUID();
      const optimistic: ChecklistItem = {
        id: optimisticId,
        planId,
        description,
        completed: false,
        order: current.plan.find((p) => p.id === planId)?.checklist?.length ?? 0,
      };
      qc.setQueryData<DayLog>(key, {
        ...current,
        plan: current.plan.map((p) =>
          p.id === planId ? { ...p, checklist: [...(p.checklist || []), optimistic] } : p
        ),
      });
      return { prev, optimisticId, planId };
    },
    onSuccess: (serverItem, _vars, ctx) => {
      if (!serverItem || !ctx) return;
      qc.setQueryData<DayLog>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          plan: old.plan.map((p) =>
            p.id === ctx.planId
              ? { ...p, checklist: (p.checklist || []).map((c) => c.id === ctx.optimisticId ? serverItem : c) }
              : p
          ),
        };
      });
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const updateChecklist = useMutation({
    mutationFn: ({ planId, clId, ...data }: { planId: string; clId: string } & Partial<ChecklistItem>) =>
      api.updateChecklist(date, planId, clId, data),
    onMutate: ({ planId, clId, ...data }) => {
      qc.cancelQueries({ queryKey: key });
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
    onMutate: ({ planId, clId }) => {
      qc.cancelQueries({ queryKey: key });
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
    onMutate: (data) => {
      qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayLog>(key);
      const current = prev ?? { date, plan: [], tasks: [] };
      const optimistic: PlanItem = {
        id: crypto.randomUUID(),
        description: data.description,
        category: "other",
        completed: false,
        order: current.plan.length,
        scheduledTime: data.scheduledTime,
        checklist: [],
        itemType: "reminder",
        priority: "normal",
      };
      qc.setQueryData<DayLog>(key, { ...current, plan: [...current.plan, optimistic] });
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  const deleteReminder = deletePlan;

  return { query, addTask, updateTask, deleteTask, addPlan, updatePlan, deletePlan, reorderPlan, addReminder, deleteReminder, addChecklist, updateChecklist, deleteChecklist };
}
