import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { fetchSetupStatus } from "@/lib/api";

type Status = "loading" | "needsSetup" | "ready" | "error";

const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 40; // ~60 seconds — backend usually ready within 10s

/**
 * Polls `/api/setup/status` on first mount and reroutes accordingly:
 *   - needsSetup=true  → push the user to /setup
 *   - needsSetup=false but currently on /setup → push to /login
 *
 * Renders a small splash while the local backend warms up so the user
 * never sees a blank window again. Network failures are retried until
 * the backend becomes reachable, mirroring how the Electron main process
 * waits for /health on startup.
 */
export function SetupGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const probe = async () => {
      try {
        const res = await fetchSetupStatus();
        if (cancelled) return;
        if (res.needsSetup) {
          setStatus("needsSetup");
          if (location.pathname !== "/setup") {
            navigate("/setup", { replace: true });
          }
        } else {
          setStatus("ready");
          if (location.pathname === "/setup") {
            navigate("/login", { replace: true });
          }
        }
      } catch {
        if (cancelled) return;
        setAttempt((n) => {
          const next = n + 1;
          if (next >= MAX_ATTEMPTS) {
            setStatus("error");
          } else {
            timeoutId = setTimeout(probe, POLL_INTERVAL_MS);
          }
          return next;
        });
      }
    };

    void probe();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // We deliberately re-run only on first mount; subsequent navigation
    // doesn't need to re-poll the backend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "loading") {
    return (
      <Splash title="جاري التحضير…" subtitle="يتم تشغيل الخادم المحلي. الرجاء الانتظار." attempt={attempt} />
    );
  }
  if (status === "error") {
    return (
      <Splash
        title="تعذّر الاتصال بالخادم المحلي"
        subtitle="افتح لوجات التطبيق (مجلد retaj-store-frontend\\logs) وأعد المحاولة."
        attempt={attempt}
        showReload
      />
    );
  }
  return <>{children}</>;
}

function Splash({
  title,
  subtitle,
  attempt,
  showReload,
}: {
  title: string;
  subtitle: string;
  attempt: number;
  showReload?: boolean;
}) {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        textAlign: "center",
        padding: 32,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "4px solid rgba(250, 204, 21, 0.2)",
          borderTopColor: "#facc15",
          animation: "retaj-spin 0.9s linear infinite",
          marginBottom: 24,
        }}
      />
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{title}</h1>
      <p style={{ fontSize: 14, opacity: 0.75, maxWidth: 420 }}>{subtitle}</p>
      {attempt > 2 && <p style={{ marginTop: 12, fontSize: 12, opacity: 0.5 }}>محاولة {attempt} / 40</p>}
      {showReload && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 24,
            background: "#facc15",
            color: "#0f172a",
            border: 0,
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          إعادة المحاولة
        </button>
      )}
      <style>{`@keyframes retaj-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
