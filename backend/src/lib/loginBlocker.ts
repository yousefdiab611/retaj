const loginFailures = new Map<string, { count: number; startedAt: number; blockedUntil?: number }>();

const MAX_ATTEMPTS = Math.max(1, Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? 10));
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_DURATION_MS = Math.max(5, Number(process.env.AUTH_BLOCK_DURATION_MINUTES ?? 30)) * 60 * 1000;

function getKey(ip?: string): string {
  return ip?.trim() || "unknown";
}

export function isLoginBlocked(ip?: string): boolean {
  const key = getKey(ip);
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
    return true;
  }
  if (entry.blockedUntil && entry.blockedUntil <= Date.now()) {
    loginFailures.delete(key);
    return false;
  }
  return false;
}

export function reportLoginFailure(ip?: string): void {
  const key = getKey(ip);
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || now - entry.startedAt > WINDOW_MS) {
    loginFailures.set(key, { count: 1, startedAt: now });
    return;
  }
  const nextCount = entry.count + 1;
  if (nextCount >= MAX_ATTEMPTS) {
    loginFailures.set(key, { count: nextCount, startedAt: entry.startedAt, blockedUntil: now + BLOCK_DURATION_MS });
    return;
  }
  loginFailures.set(key, { ...entry, count: nextCount });
}

export function reportLoginSuccess(ip?: string): void {
  const key = getKey(ip);
  loginFailures.delete(key);
}
