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
  draft: RunRecord | null;
  begin: (course: Course) => void;
  tick: (seconds: number) => void;
  togglePause: () => void;
  finish: () => string | null;
  save: (id: string) => boolean;
  discard: (id: string) => void;
  review: (id: string, rating: number, tags: string[]) => void;
}
export const useRunning = create<RunningState>()(
  persist(
    (set, get) => ({
      session: null,
      records: [],
      draft: null,
      begin: (course) => {
        if (get().session || get().draft) return;
        set({
          session: {
            course,
            startedAt: new Date().toISOString(),
            elapsed: 0,
            running: true,
          },
        });
      },
      tick: (seconds) =>
        set((s) =>
          s.session?.running && Number.isFinite(seconds) && seconds > 0
            ? {
                session: {
                  ...s.session,
                  elapsed: Math.min(
                    s.session.course.summary.estimated_duration_s,
                    s.session.elapsed + seconds,
                  ),
                  running:
                    s.session.elapsed + seconds <
                    s.session.course.summary.estimated_duration_s,
                },
              }
            : {},
        ),
      togglePause: () =>
        set((s) =>
          s.session &&
          s.session.elapsed < s.session.course.summary.estimated_duration_s
            ? { session: { ...s.session, running: !s.session.running } }
            : {},
        ),
      finish: () => {
        const session = get().session;
        if (!session || session.elapsed <= 0) return get().draft?.id ?? null;
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
        set({ draft: record, session: null });
        return id;
      },
      save: (id) => {
        const { draft, records } = get();
        if (records.some((record) => record.id === id)) return true;
        if (!draft || draft.id !== id) return false;
        set({ records: [draft, ...records], draft: null });
        return true;
      },
      discard: (id) => {
        if (get().draft?.id === id) set({ draft: null });
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
      partialize: (s) => ({ records: s.records, draft: s.draft }),
    },
  ),
);
