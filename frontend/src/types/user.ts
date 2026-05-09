export type UserRole = "SUPER_ADMIN" | "TENANT_ADMIN" | "ADMIN" | "MANAGER" | "CASHIER";

export type BranchBrief = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

export type AuthUser = {
  id: string;
  tenantId: string;
  /** Login name (use for display "Welcome, …"). */
  username: string | null;
  /** Optional contact email (not used for login). */
  email: string | null;
  name: string;
  role: UserRole;
  plan?: string | null;
  /** Assigned branch for cashiers; admins may have null. */
  branchId: string | null;
  /** Branches the user may work with (all branches for admin/manager; single for cashier). */
  branches: BranchBrief[];
};
