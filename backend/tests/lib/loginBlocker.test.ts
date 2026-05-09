import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("loginBlocker", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_LOGIN_MAX_ATTEMPTS = "3";
    process.env.AUTH_BLOCK_DURATION_MINUTES = "5";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not block fewer than the configured failure threshold", async () => {
    const mod = await import("@/lib/loginBlocker");
    expect(mod.isLoginBlocked("1.1.1.1")).toBe(false);
    mod.reportLoginFailure("1.1.1.1");
    mod.reportLoginFailure("1.1.1.1");
    expect(mod.isLoginBlocked("1.1.1.1")).toBe(false);
  });

  it("blocks the IP after MAX_ATTEMPTS failures", async () => {
    const mod = await import("@/lib/loginBlocker");
    mod.reportLoginFailure("2.2.2.2");
    mod.reportLoginFailure("2.2.2.2");
    mod.reportLoginFailure("2.2.2.2");
    expect(mod.isLoginBlocked("2.2.2.2")).toBe(true);
  });

  it("clears the failure counter on a successful login", async () => {
    const mod = await import("@/lib/loginBlocker");
    mod.reportLoginFailure("3.3.3.3");
    mod.reportLoginFailure("3.3.3.3");
    mod.reportLoginSuccess("3.3.3.3");
    mod.reportLoginFailure("3.3.3.3");
    expect(mod.isLoginBlocked("3.3.3.3")).toBe(false);
  });

  it("releases the block after the configured duration elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const mod = await import("@/lib/loginBlocker");
    mod.reportLoginFailure("4.4.4.4");
    mod.reportLoginFailure("4.4.4.4");
    mod.reportLoginFailure("4.4.4.4");
    expect(mod.isLoginBlocked("4.4.4.4")).toBe(true);

    vi.setSystemTime(new Date("2026-01-01T00:06:00Z"));
    expect(mod.isLoginBlocked("4.4.4.4")).toBe(false);
  });
});
