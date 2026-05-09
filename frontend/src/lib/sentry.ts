/**
 * Lazy Sentry bootstrap. Errors are silently ignored when:
 *   - VITE_SENTRY_DSN is not set, or
 *   - the @sentry/react package is unavailable in the bundle.
 */
export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: (import.meta.env.VITE_APP_RELEASE as string | undefined) ?? "dev",
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 1.0,
      sendDefaultPii: false,
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[sentry] init skipped", err);
    }
  }
}
