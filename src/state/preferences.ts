import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  recommendationRequestSchema,
  type RecommendationRequest,
} from "../domain/contracts";
import { STARTS } from "../domain/catalog";
const initial: RecommendationRequest = {
  schema_version: "1.0",
  start: STARTS[0]!.coordinate,
  target_distance_m: 5000,
  purpose: "PACE",
  time_of_day: "day",
  route_type: "loop",
  distance_tolerance_ratio: 0.1,
};
interface Preferences {
  request: RecommendationRequest;
  favorites: string[];
  update: (patch: Partial<RecommendationRequest>) => void;
  toggleFavorite: (id: string) => void;
}
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      request: initial,
      favorites: [],
      update: (patch) =>
        set((state) => ({
          request: recommendationRequestSchema.parse({
            ...state.request,
            ...patch,
          }),
        })),
      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((item) => item !== id)
            : [...state.favorites, id],
        })),
    }),
    {
      name: "dalro-preferences-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ request: s.request, favorites: s.favorites }),
    },
  ),
);
