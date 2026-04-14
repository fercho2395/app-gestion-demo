import { useCallback, useEffect, useState } from "react";
import { getPortfolio, type Portfolio } from "../services/api";

export function usePortfolio(enabled: boolean, baseCurrency?: string) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPortfolio(baseCurrency);
      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando portafolio");
    } finally {
      setLoading(false);
    }
  }, [enabled, baseCurrency]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { portfolio, loading, error, reload };
}
