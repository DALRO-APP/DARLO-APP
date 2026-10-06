import { QueryClient, useQuery } from "@tanstack/react-query";
import { courseRepository } from "./repository";
import { usePreferences } from "../state/preferences";
import { useLocalDataReady } from "../state/hydration";
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60000, retry: 1 } },
});
export function useRecommendations() {
  const request = usePreferences((s) => s.request);
  const hydrated = useLocalDataReady();
  return useQuery({
    queryKey: ["courses", "recommendations", request],
    queryFn: ({ signal }) => courseRepository.recommend(request, signal),
    enabled: hydrated,
  });
}
export function useCourse(id: string) {
  return useQuery({
    queryKey: ["courses", id],
    queryFn: ({ signal }) => courseRepository.getCourse(id, signal),
    enabled: !!id,
  });
}
