import { useCallback, useEffect, useState } from "react";
import { listFxConfigs, type FxConfig } from "../services/api";

export function useFxConfigs(enabled: boolean) {
  const [fxConfigs, setFxConfigs] = useState<FxConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await listFxConfigs();
      setFxConfigs(data);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { fxConfigs, loading, reload };
}
