import { useEffect, useState } from "react";

import { countDirtyOfflineCustomers } from "./customersDb";
import { countPendingSales } from "./pendingSalesDb";
import { getLastSyncAt } from "./syncMeta";

export function useOfflineSyncStatus() {
  const [pendingSales, setPendingSales] = useState(0);
  const [pendingCustomers, setPendingCustomers] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const [sales, customers, lastSync] = await Promise.all([
        countPendingSales(),
        countDirtyOfflineCustomers(),
        getLastSyncAt(),
      ]);
      if (!mounted) return;
      setPendingSales(sales);
      setPendingCustomers(customers);
      setLastSyncAt(lastSync);
    }

    void refresh();
    const handle = window.setInterval(() => void refresh(), 10_000);
    return () => {
      mounted = false;
      window.clearInterval(handle);
    };
  }, []);

  return { pendingSales, pendingCustomers, lastSyncAt };
}
