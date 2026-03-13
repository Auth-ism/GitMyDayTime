import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreateTaskInput, CreatePlanInput, TaskEntry, PlanItem } from "@gmd/shared";

export function useDayLog(date: string) {
  const qc = useQueryClient();
  const key = ["daylog", date];

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.getDayLog(date),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const addTask = useMutation({
    mutationFn: (data: CreateTaskInput) => api.addTask(date, data),
    onSuccess: invalidate,
  });

  const updateTask = useMutation({
    mutationFn: ({ id, ...data }: Partial<TaskEntry> & { id: string }) =>
      api.updateTask(date, id, data),
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.deleteTask(date, id),
    onSuccess: invalidate,
  });

  const addPlan = useMutation({
    mutationFn: (data: CreatePlanInput) => api.addPlan(date, data),
    onSuccess: invalidate,
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, ...data }: Partial<PlanItem> & { id: string }) =>
      api.updatePlan(date, id, data),
    onSuccess: invalidate,
  });

  const deletePlan = useMutation({
    mutationFn: (id: string) => api.deletePlan(date, id),
    onSuccess: invalidate,
  });

  return { query, addTask, updateTask, deleteTask, addPlan, updatePlan, deletePlan };
}
