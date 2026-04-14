import { useCallback, useEffect, useState } from "react";
import { listConsultants, type Consultant } from "../services/api";

export function useConsultants(enabled: boolean) {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await listConsultants();
      setConsultants(data);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { consultants, loading, reload };
}
