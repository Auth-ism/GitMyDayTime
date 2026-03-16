import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreateRecurringTaskInput, RecurringTask } from "@gmd/shared";

const KEY = ["recurring-tasks"];

export function useRecurringTasks() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => api.getRecurringTasks(),
  });

  const create = useMutation({
    mutationFn: (data: CreateRecurringTaskInput) => api.createRecurringTask(data),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateRecurringTaskInput> & { active?: boolean }) =>
      api.updateRecurringTask(id, data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<RecurringTask[]>(KEY);
      if (prev) {
        qc.setQueryData<RecurringTask[]>(KEY, prev.map((t) =>
          t.id === vars.id ? { ...t, ...vars } : t
        ));
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRecurringTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<RecurringTask[]>(KEY);
      if (prev) {
        qc.setQueryData<RecurringTask[]>(KEY, prev.filter((t) => t.id !== id));
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return { query, create, update, remove };
}
