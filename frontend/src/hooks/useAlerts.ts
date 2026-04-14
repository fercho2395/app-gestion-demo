import { useCallback, useEffect, useState } from "react";
import { getAlertsUnreadCount, listAlerts, type AppAlert } from "../services/api";

export function useAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [data, count] = await Promise.all([listAlerts({ resolved: false }), getAlertsUnreadCount()]);
      setAlerts(data);
      setUnreadCount(count);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { alerts, unreadCount, loading, reload };
}
