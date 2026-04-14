import { useCallback, useEffect, useState } from "react";
import { listRevenueEntries, type RevenueEntry } from "../services/api";

export function useRevenue(enabled: boolean, projectId?: string) {
  const [revenueEntries, setRevenueEntries] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await listRevenueEntries(projectId);
      setRevenueEntries(data);
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { revenueEntries, loading, reload };
}
