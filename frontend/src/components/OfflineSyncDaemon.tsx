import { useEffect } from "react";

import { getToken } from "@/lib/api";
import { flushOfflineCustomerQueue } from "@/lib/offline/customerSync";
import { flushOfflineSalesQueue } from "@/lib/offline/flushOfflineQueue";
import { useOnlineStatus } from "@/lib/offline/useOnlineStatus";

/** Background flush of IndexedDB sale queue when authenticated and online. */
export function OfflineSyncDaemon() {
  const online = useOnlineStatus();

  useEffect(() => {
    if (!online || !getToken()) return;
    void flushOfflineSalesQueue();
    void flushOfflineCustomerQueue();
    const id = window.setInterval(() => {
      if (getToken()) {
        void flushOfflineSalesQueue();
        void flushOfflineCustomerQueue();
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [online]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && getToken()) {
        void flushOfflineSalesQueue();
        void flushOfflineCustomerQueue();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
