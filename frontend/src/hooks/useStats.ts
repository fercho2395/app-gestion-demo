import { useCallback, useEffect, useState } from "react";
import { getStatsOverview, type StatsOverview } from "../services/api";

export function useStats(enabled: boolean, baseCurrency = "USD") {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await getStatsOverview(baseCurrency);
      setStats(data);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [enabled, baseCurrency]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { stats, loading, lastUpdated, reload };
}
