import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Course } from "../domain/contracts";

export type RunRecord = {
  id: string;
  course: Course;
  started_at: string;
  elapsed_s: number;
  distance_m: number;
  rating: number;
  tags: string[];
  is_simulated: true;
};
type Session = {
  course: Course;
  startedAt: string;
  elapsed: number;
  running: boolean;
};
interface RunningState {
  session: Session | null;
  records: RunRecord[];
  begin: (course: Course) => void;
  tick: (seconds: number) => void;
  togglePause: () => void;
  finish: () => string | null;
  review: (id: string, rating: number, tags: string[]) => void;
}
export const useRunning = create<RunningState>()(
  persist(
    (set, get) => ({
      session: null,
      records: [],
      begin: (course) =>
        set({
          session: {
            course,
            startedAt: new Date().toISOString(),
            elapsed: 0,
            running: true,
          },
        }),
      tick: (seconds) =>
        set((s) =>
          s.session?.running
            ? {
                session: {
                  ...s.session,
                  elapsed: Math.min(
                    s.session.course.summary.estimated_duration_s,
                    s.session.elapsed + seconds,
                  ),
                },
              }
            : {},
        ),
      togglePause: () =>
        set((s) =>
          s.session
            ? { session: { ...s.session, running: !s.session.running } }
            : {},
        ),
      finish: () => {
        const session = get().session;
        if (!session || session.elapsed <= 0) return null;
        const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record: RunRecord = {
          id,
          course: session.course,
          started_at: session.startedAt,
          elapsed_s: session.elapsed,
          distance_m: Math.round(
            (session.course.summary.distance_m * session.elapsed) /
              session.course.summary.estimated_duration_s,
          ),
          rating: 0,
          tags: [],
          is_simulated: true,
        };
        set((s) => ({ records: [record, ...s.records], session: null }));
        return id;
      },
      review: (id, rating, tags) =>
        set((s) => ({
          records: s.records.map((r) =>
            r.id === id ? { ...r, rating, tags } : r,
          ),
        })),
    }),
    {
      name: "dalro-records-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ records: s.records }),
    },
  ),
);
