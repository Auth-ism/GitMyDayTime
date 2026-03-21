import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DEFAULT_CATEGORIES, CATEGORY_COLORS, type Category } from "@gmd/shared";
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

export function useCategories() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const hiddenCategories = profile?.hiddenCategories ?? [];

  const { data: userCategories = [] } = useQuery({
    queryKey: ["categories"],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) => api.updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
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
