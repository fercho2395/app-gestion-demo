import { useCallback, useEffect, useState } from "react";
import { listForecasts, type Forecast } from "../services/api";

export function useForecasts(enabled: boolean) {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await listForecasts();
      setForecasts(data);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { forecasts, loading, reload };
}
