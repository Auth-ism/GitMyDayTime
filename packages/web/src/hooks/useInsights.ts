import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useInsights() {
  return useQuery({
    queryKey: ["stats", "insights"],
    queryFn: () => api.getInsights(),
    staleTime: 5 * 60 * 1000,
  });
}
