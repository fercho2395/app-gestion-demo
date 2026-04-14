import { useCallback, useEffect, useState } from "react";
import { listTimeEntries, type TimeEntry } from "../services/api";

export function useTimeEntries(enabled: boolean) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await listTimeEntries();
      setTimeEntries(data);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { timeEntries, loading, reload };
}
