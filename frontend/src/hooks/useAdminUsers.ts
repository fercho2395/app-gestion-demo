import { useCallback, useEffect, useState } from "react";
import { listAdminUsers, type AdminUser } from "../services/api";

export function useAdminUsers(enabled: boolean) {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await listAdminUsers();
      setAdminUsers(data);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { adminUsers, loading, reload };
}
