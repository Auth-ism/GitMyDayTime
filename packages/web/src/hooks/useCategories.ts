import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DEFAULT_CATEGORIES, CATEGORY_COLORS, type Category, type UserCategory } from "@gmd/shared";
import { useAuth } from "@/lib/auth";

export interface MergedCategory {
  key: string;
  label: string;
  color: string;
  isCustom: boolean;
}

const DEFAULT_CAT_LIST: MergedCategory[] = DEFAULT_CATEGORIES.map((key) => ({
  key,
  label: key,
  color: CATEGORY_COLORS[key as Category] || "#888",
  isCustom: false,
}));

const CAT_KEY = ["categories"];

export function useCategories() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const hiddenCategories = profile?.hiddenCategories ?? [];

  const { data: userCategories = [] } = useQuery({
    queryKey: CAT_KEY,
    queryFn: () => api.getCategories(),
    staleTime: 5 * 60 * 1000,
  });

  const allCategoriesUnfiltered: MergedCategory[] = [
    ...DEFAULT_CAT_LIST,
    ...userCategories.map((uc) => ({
      key: uc.id,
      label: uc.name,
      color: uc.color,
      isCustom: true,
    })),
  ];

  const allCategories: MergedCategory[] = allCategoriesUnfiltered.filter(
    (c) => c.isCustom || !hiddenCategories.includes(c.key)
  );

  const createCategory = useMutation({
    mutationFn: (data: { name: string; color: string }) => api.createCategory(data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: CAT_KEY });
      const prev = qc.getQueryData<UserCategory[]>(CAT_KEY);
      qc.setQueryData<UserCategory[]>(CAT_KEY, (old) => [
        ...(old || []),
        { id: `_temp_${Date.now()}`, name: data.name, color: data.color, sortOrder: (old?.length ?? 0) },
      ]);
      return { prev };
    },
    onError: (_err, _data, ctx) => {
      if (ctx?.prev) qc.setQueryData(CAT_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CAT_KEY }),
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) => api.updateCategory(id, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: CAT_KEY });
      const prev = qc.getQueryData<UserCategory[]>(CAT_KEY);
      qc.setQueryData<UserCategory[]>(CAT_KEY, (old) =>
        (old || []).map((c) => (c.id === id ? { ...c, ...data } : c))
      );
      return { prev };
    },
    onError: (_err, _data, ctx) => {
      if (ctx?.prev) qc.setQueryData(CAT_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CAT_KEY }),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: CAT_KEY });
      const prev = qc.getQueryData<UserCategory[]>(CAT_KEY);
      qc.setQueryData<UserCategory[]>(CAT_KEY, (old) =>
        (old || []).filter((c) => c.id !== id)
      );
      return { prev };
    },
    onError: (_err, _data, ctx) => {
      if (ctx?.prev) qc.setQueryData(CAT_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CAT_KEY }),
  });

  const getCategoryLabel = (key: string): string => {
    const found = allCategoriesUnfiltered.find((c) => c.key === key);
    return found ? found.label : key;
  };

  const getCategoryColor = (key: string): string => {
    const found = allCategoriesUnfiltered.find((c) => c.key === key);
    return found ? found.color : "#888";
  };

  return { allCategories, userCategories, createCategory, updateCategory, deleteCategory, getCategoryLabel, getCategoryColor };
}
