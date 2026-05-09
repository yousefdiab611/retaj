import { afterAll, beforeAll, beforeEach } from "vitest";

beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET ??= "test-only-jwt-secret-change-me-please-1234";
  process.env.LOG_LEVEL ??= "silent";
  process.env.DISABLE_SCHEDULED_BACKUPS = "1";
});

beforeEach(() => {
  // Reset rate limiter state if helpers expose it. Intentionally empty for now.
});

afterAll(() => {
  // Allow services with timers to detach.
});
