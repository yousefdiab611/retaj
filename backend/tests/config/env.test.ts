import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assertProductionEnv, validateDevelopmentEnv } from "../../src/config/env";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    process.env[k] = v;
  }
}

describe("env validators", () => {
  beforeEach(() => resetEnv());
  afterEach(() => resetEnv());

  describe("assertProductionEnv (Postgres path)", () => {
    it("throws when DATABASE_URL is not Postgres", () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_PROVIDER = "";
      process.env.DATABASE_URL = "mysql://example";
      process.env.JWT_SECRET = "x".repeat(32);
      process.env.ALLOWED_ORIGINS = "https://app.example";
      expect(() => assertProductionEnv()).toThrow(/PostgreSQL/);
    });

    it("throws when ALLOWED_ORIGINS is missing", () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_PROVIDER = "";
      process.env.DATABASE_URL = "postgresql://u:p@h/d";
      process.env.JWT_SECRET = "x".repeat(32);
      delete process.env.ALLOWED_ORIGINS;
      expect(() => assertProductionEnv()).toThrow(/ALLOWED_ORIGINS/);
    });
  });

  describe("assertProductionEnv (standalone desktop / SQLite path)", () => {
    it("accepts SQLite DATABASE_URL when DATABASE_PROVIDER=sqlite", () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_PROVIDER = "sqlite";
      process.env.DATABASE_URL = "file:/Users/joe/AppData/Roaming/Retaj Store/data/retaj.db";
      process.env.JWT_SECRET = "x".repeat(48);
      process.env.ALLOWED_ORIGINS = "*";
      expect(() => assertProductionEnv()).not.toThrow();
    });

    it("still enforces a strong JWT_SECRET on desktop", () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_PROVIDER = "sqlite";
      process.env.DATABASE_URL = "file:./retaj.db";
      process.env.JWT_SECRET = "tooshort";
      expect(() => assertProductionEnv()).toThrow(/JWT_SECRET/);
    });

    it("auto-detects desktop mode from a file: URL even if DATABASE_PROVIDER is unset", () => {
      process.env.NODE_ENV = "production";
      delete process.env.DATABASE_PROVIDER;
      process.env.DATABASE_URL = "file:./retaj.db";
      process.env.JWT_SECRET = "x".repeat(48);
      expect(() => assertProductionEnv()).not.toThrow();
    });
  });

  describe("validateDevelopmentEnv", () => {
    it("accepts SQLite URLs in dev", () => {
      process.env.NODE_ENV = "development";
      process.env.DATABASE_URL = "file:./dev.db";
      process.env.JWT_SECRET = "x".repeat(16);
      expect(() => validateDevelopmentEnv()).not.toThrow();
    });
  });
});
