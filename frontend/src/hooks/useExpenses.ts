import { useCallback, useEffect, useState } from "react";
import { listExpenses, type Expense } from "../services/api";

export function useExpenses(enabled: boolean) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await listExpenses();
      setExpenses(data);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { expenses, loading, reload };
}
