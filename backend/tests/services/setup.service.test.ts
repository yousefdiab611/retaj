import { describe, expect, it, vi, beforeEach } from "vitest";

type MockUser = { id: string; username: string };

const userTable: MockUser[] = [];
const tenantTable: { id: string; name: string }[] = [];
const branchTable: { id: string; tenantId: string; name: string }[] = [];

vi.mock("../../src/lib/prisma", () => {
  const tx = {
    user: {
      count: vi.fn(async () => userTable.length),
      create: vi.fn(async ({ data }: { data: MockUser & Record<string, unknown> }) => {
        const row = { ...data, id: data.id ?? `u_${userTable.length + 1}` } as MockUser;
        userTable.push(row);
        return row;
      }),
    },
    tenant: {
      create: vi.fn(async ({ data }: { data: { name: string } }) => {
        const row = { id: `t_${tenantTable.length + 1}`, ...data };
        tenantTable.push(row);
        return row;
      }),
    },
    branch: {
      create: vi.fn(async ({ data }: { data: { tenantId: string; name: string } }) => {
        const row = { id: `b_${branchTable.length + 1}`, ...data };
        branchTable.push(row);
        return row;
      }),
    },
  };
  const prisma = {
    user: {
      count: vi.fn(async () => userTable.length),
      findUnique: vi.fn(
        async ({ where }: { where: { username: string } }) =>
          userTable.find((u) => u.username === where.username) ?? null,
      ),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma };
});

import { isFreshInstall, performInitialSetup } from "../../src/services/setup.service";

beforeEach(() => {
  userTable.length = 0;
  tenantTable.length = 0;
  branchTable.length = 0;
});

describe("setup.service", () => {
  it("reports fresh install when no users exist", async () => {
    expect(await isFreshInstall()).toBe(true);
  });

  it("creates the first tenant + branch + super admin", async () => {
    const res = await performInitialSetup({
      businessName: "Acme",
      branchName: "Main",
      adminName: "Owner",
      adminUsername: "owner",
      adminPassword: "Sup3r-Secret!",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tenantId).toMatch(/^t_/);
      expect(res.branchId).toMatch(/^b_/);
      expect(res.userId).toMatch(/^u_/);
    }
    expect(userTable).toHaveLength(1);
    expect(tenantTable).toHaveLength(1);
    expect(branchTable).toHaveLength(1);
  });

  it("rejects re-initialization once any user exists", async () => {
    userTable.push({ id: "u_existing", username: "old" });
    const res = await performInitialSetup({
      businessName: "Should-not-create",
      branchName: "Main",
      adminName: "Imposter",
      adminUsername: "imposter",
      adminPassword: "Sup3r-Secret!",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("ALREADY_INITIALIZED");
    }
    expect(tenantTable).toHaveLength(0);
    expect(userTable).toHaveLength(1);
  });

  it("rejects when the chosen username collides with a pre-seeded record", async () => {
    userTable.push({ id: "u_existing", username: "owner" });
    // isFreshInstall would now return false, so we need to wipe and re-add
    // a user that wasn't visible to the count check. In practice this
    // protects against future schemas where seeding may pre-create a row.
    userTable.length = 0;
    const seeded: MockUser = { id: "u_existing", username: "owner" };
    // Simulate a race where count() == 0 but the username is taken via a
    // different precondition (e.g. partial restore). The service still
    // must refuse a duplicate username.
    const { prisma } = await import("../../src/lib/prisma");
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(seeded);
    const res = await performInitialSetup({
      businessName: "Acme",
      branchName: "Main",
      adminName: "Owner",
      adminUsername: "owner",
      adminPassword: "Sup3r-Secret!",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("USERNAME_TAKEN");
    }
  });
});
