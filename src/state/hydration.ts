import { useEffect, useState } from "react";
import { usePreferences } from "./preferences";
import { useRunning } from "./running";

export function useLocalDataReady() {
  const ready = () =>
    usePreferences.persist.hasHydrated() && useRunning.persist.hasHydrated();
  const [hydrated, setHydrated] = useState(ready);
  useEffect(() => {
    const update = () => setHydrated(ready());
    const preferences = usePreferences.persist.onFinishHydration(update);
    const running = useRunning.persist.onFinishHydration(update);
    update();
    return () => {
      preferences();
      running();
    };
  }, []);
  return hydrated;
}
