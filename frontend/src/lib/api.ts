import type { AdminDashboardStats, AuditLogRow, CustomerRow, LicenseRow } from "@/types/billing";
import type { InvoiceTransaction } from "@/types/invoice";
import type { Product } from "@/types/product";
import type { AuthUser, BranchBrief } from "@/types/user";

import { isDesktopApp } from "@/lib/electron";
import { searchOfflineCustomers } from "@/lib/offline/customersDb";
import {
  getCachedProducts,
  lookupCachedProductByCode,
  saveCachedProducts,
  setProductCacheTimestamp,
} from "@/lib/offline/productsDb";

const TOKEN_KEY = "retaj-store_access_token";
const REFRESH_KEY = "retaj-store_refresh_token";
const USER_KEY = "retaj-store_user";
const BRANCH_KEY = "retaj-store_selected_branch_id";

function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    // The Electron preload script forwards the chosen backend port via
    // a global so the renderer doesn't have to guess (and so we don't
    // collide with whatever the user already has on :3001).
    const desktopBoot = (window as unknown as { __RETAJ_BOOT__?: { apiBaseUrl?: string | null } }).__RETAJ_BOOT__;
    if (desktopBoot?.apiBaseUrl) {
      return desktopBoot.apiBaseUrl.replace(/\/$/, "");
    }
    const protocol = window.location.protocol;
    if (protocol === "file:" || isDesktopApp()) {
      return "http://127.0.0.1:38217";
    }
  }
  return "";
}

function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_KEY);
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as AuthUser;
    if (!u.branches) u.branches = [];
    if (u.username == null && u.email) {
      u.username = u.email.includes("@") ? (u.email.split("@")[0] ?? null) : u.email;
    }
    return u;
  } catch {
    return null;
  }
}

export function getSelectedBranchId(): string | null {
  return localStorage.getItem(BRANCH_KEY);
}

export function setSelectedBranchId(id: string): void {
  localStorage.setItem(BRANCH_KEY, id);
}

export function clearBranchSelection(): void {
  localStorage.removeItem(BRANCH_KEY);
}

/** After login / when user loads: persist default branch for managers and admins. */
export function ensureDefaultBranchSelection(user: AuthUser): void {
  if (user.role === "CASHIER") {
    if (user.branchId) setSelectedBranchId(user.branchId);
    return;
  }
  const saved = getSelectedBranchId();
  if (saved && user.branches.some((b) => b.id === saved)) return;
  if (user.branches[0]) setSelectedBranchId(user.branches[0].id);
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function clearSession(): void {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  clearToken();
  clearUser();
  clearRefreshToken();
  clearBranchSelection();
  if (refreshToken) {
    void fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
}

async function readError(res: Response): Promise<string> {
  if (res.status === 404) {
    return "Server connection issue";
  }
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(apiUrl("/api/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    return false;
  }
  const data = (await res.json()) as { accessToken: string; refreshToken?: string };
  if (!data.accessToken) return false;
  setToken(data.accessToken);
  if (data.refreshToken) {
    setRefreshToken(data.refreshToken);
  }
  return true;
}

function applyBranchHeader(headers: Headers): void {
  const user = getUser();
  if (!user) return;
  if (user.role === "CASHIER") {
    if (user.branchId) headers.set("X-Branch-Id", user.branchId);
    return;
  }
  const bid = getSelectedBranchId() ?? user.branches?.[0]?.id;
  if (bid) headers.set("X-Branch-Id", bid);
}

export async function apiFetch(
  path: string,
  init: RequestInit & { _retry?: boolean; skipBranchHeader?: boolean } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!init.skipBranchHeader) {
    applyBranchHeader(headers);
  }
  const { _retry, skipBranchHeader: _sb, ...restInit } = init;
  const res = await fetch(apiUrl(path), { ...restInit, headers });
  if (res.status === 401 && !_retry) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return apiFetch(path, { ...init, _retry: true });
    }
    clearSession();
    if (!path.includes("/api/auth/")) {
      window.location.href = "/login";
    }
  }
  return res;
}

export async function loginRequest(
  username: string,
  password: string,
): Promise<{ accessToken: string; user: AuthUser }> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers,
    body: JSON.stringify({ username: username.trim(), password }),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { accessToken: string; refreshToken?: string; user: AuthUser };
  if (!data.accessToken || !data.user) {
    throw new Error("Invalid login response");
  }
  if (!data.user.branches) data.user.branches = [];
  if (data.user.email === undefined) data.user.email = null;
  if (data.user.username === undefined) data.user.username = null;
  setToken(data.accessToken);
  if (data.refreshToken) {
    setRefreshToken(data.refreshToken);
  }
  ensureDefaultBranchSelection(data.user);
  return { accessToken: data.accessToken, user: data.user };
}

export async function fetchProducts(warehouseId?: string): Promise<Product[]> {
  const q = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : "";
  const url = `/api/products${q}`;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return getCachedProducts(warehouseId);
  }

  const res = await apiFetch(url);
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const message = await readError(res);
    const cached = await getCachedProducts(warehouseId);
    if (cached.length > 0) return cached;
    throw new Error(message);
  }

  const data = (await res.json()) as { products: Product[] };
  void saveCachedProducts(data.products, warehouseId).catch(() => undefined);
  void setProductCacheTimestamp(warehouseId ?? "global", Date.now()).catch(() => undefined);
  return data.products;
}

export type WarehouseBrief = {
  id: string;
  name: string;
  location: string | null;
  branchId: string | null;
  isDefault: boolean;
  createdAt: string;
};

export async function fetchWarehouses(): Promise<WarehouseBrief[]> {
  const res = await apiFetch("/api/warehouses");
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { warehouses: WarehouseBrief[] };
  return data.warehouses;
}

export async function lookupProductByCode(code: string, warehouseId?: string): Promise<Product> {
  const trimmed = code.trim().replace(/\s+/g, "");
  if (!trimmed) {
    throw new Error("Code is empty");
  }
  const params = new URLSearchParams({ code: trimmed });
  if (warehouseId) {
    params.set("warehouseId", warehouseId);
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return lookupCachedProductByCode(trimmed, warehouseId);
  }

  try {
    const res = await apiFetch(`/api/products/lookup?${params.toString()}`);
    if (res.status === 401) {
      clearSession();
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }
    if (res.status === 404) {
      throw new Error(await readError(res));
    }
    if (!res.ok) {
      throw new Error(await readError(res));
    }
    const data = (await res.json()) as { product: Product };
    return data.product;
  } catch (err) {
    return lookupCachedProductByCode(trimmed, warehouseId);
  }
}

export type PaymentMethod = "cash" | "card" | "wallet" | "split";

export async function createSaleRequest(payload: {
  customerId?: string | null;
  warehouseId?: string;
  discount: number;
  paymentMethod: PaymentMethod;
  lineItems: { productId: string; quantity: number }[];
  idempotencyKey?: string;
}): Promise<{
  transaction: {
    id: string;
    reference: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string | null;
    createdAt: string;
  };
}> {
  const res = await apiFetch("/api/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{
    transaction: {
      id: string;
      reference: string;
      subtotal: number;
      discount: number;
      tax: number;
      total: number;
      paymentMethod: string | null;
      createdAt: string;
    };
  }>;
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const res = await apiFetch("/api/admin/dashboard");
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as AdminDashboardStats;
  return data;
}

export async function fetchAdminLicenses(): Promise<{ licenses: LicenseRow[] }> {
  const res = await apiFetch("/api/admin/licenses");
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{ licenses: LicenseRow[] }>;
}

export type LicenseActivationResponse = {
  status: string;
  expiresAt: string | null;
  trialMode: boolean;
  graceRemainingDays: number;
  graceDays?: number;
  graceUntil?: string | null;
};

export async function activateLicense(
  licenseKey: string,
  deviceId: string,
  deviceFingerprint: string,
): Promise<LicenseActivationResponse> {
  const res = await apiFetch("/api/licenses/activate", {
    method: "POST",
    body: JSON.stringify({ licenseKey, deviceId, deviceFingerprint }),
    skipBranchHeader: true,
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<LicenseActivationResponse>;
}

export async function validateLicense(
  licenseKey: string,
  deviceId: string,
  deviceFingerprint: string,
): Promise<LicenseActivationResponse> {
  const res = await apiFetch("/api/licenses/validate", {
    method: "POST",
    body: JSON.stringify({ licenseKey, deviceId, deviceFingerprint }),
    skipBranchHeader: true,
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<LicenseActivationResponse>;
}

export async function fetchAdminCustomers(query = ""): Promise<{ customers: CustomerRow[] }> {
  const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  const res = await apiFetch(`/api/admin/customers${qs}`);
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{ customers: CustomerRow[] }>;
}

export async function fetchAdminLogs(): Promise<{ logs: AuditLogRow[] }> {
  const res = await apiFetch("/api/admin/logs");
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{ logs: AuditLogRow[] }>;
}

export async function fetchCustomerProfile(): Promise<{
  user: AuthUser;
  tenant: { id: string; name: string; plan: string; billingStatus: string; planExpiresAt: string | null };
}> {
  const res = await apiFetch("/api/customer/me");
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{
    user: AuthUser;
    tenant: { id: string; name: string; plan: string; billingStatus: string; planExpiresAt: string | null };
  }>;
}

export async function fetchCustomerSubscription(): Promise<{
  subscriptions: Array<{ id: string; plan: string; status: string; currentPeriodEnd: string | null }>;
}> {
  const res = await apiFetch("/api/customer/me/subscription");
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{
    subscriptions: Array<{ id: string; plan: string; status: string; currentPeriodEnd: string | null }>;
  }>;
}

export async function fetchCustomerLicenses(): Promise<{ licenses: LicenseRow[] }> {
  const res = await apiFetch("/api/customer/me/licenses");
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{ licenses: LicenseRow[] }>;
}

export async function fetchCustomerDevices(): Promise<{
  devices: Array<{ id: string; deviceId: string; type: string; isActive: boolean; updatedAt: string }>;
}> {
  const res = await apiFetch("/api/customer/me/devices");
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{
    devices: Array<{ id: string; deviceId: string; type: string; isActive: boolean; updatedAt: string }>;
  }>;
}

export async function sendSupportRequest(subject: string, description: string): Promise<void> {
  const res = await apiFetch("/api/customer/me/support", {
    method: "POST",
    body: JSON.stringify({ subject, description }),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
}

export type OfflineSyncResultRow =
  | {
      idempotencyKey: string;
      ok: true;
      transaction: {
        id: string;
        reference: string;
        subtotal: number;
        discount: number;
        tax: number;
        total: number;
        paymentMethod: string | null;
        createdAt: string;
      };
      idempotentReplay?: boolean;
    }
  | { idempotencyKey: string; ok: false; code: string; message: string };

export async function syncOfflineTransactionsRequest(body: {
  items: Array<{
    idempotencyKey: string;
    customerId?: string | null;
    warehouseId?: string;
    discount: number;
    paymentMethod: PaymentMethod;
    lineItems: { productId: string; quantity: number }[];
  }>;
}): Promise<{ results: OfflineSyncResultRow[] }> {
  const res = await apiFetch("/api/sync/offline-transactions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<{ results: OfflineSyncResultRow[] }>;
}

export async function fetchTransactionInvoice(transactionId: string): Promise<InvoiceTransaction> {
  const res = await apiFetch(`/api/transactions/${encodeURIComponent(transactionId)}`);
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { transaction: InvoiceTransaction };
  return data.transaction;
}

export type CustomerBrief = {
  id: string;
  localId?: string;
  remoteId?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  dirty?: boolean;
};

export type SyncStatus = {
  ok: true;
  syncEngine: string;
  database: {
    online: boolean;
    provider: string;
    prismaStatus: string;
    syncEngineStatus: string;
    lastError?: string;
  };
};

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const res = await apiFetch("/api/sync/status");
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json() as Promise<SyncStatus>;
}

export async function searchCustomers(q: string): Promise<CustomerBrief[]> {
  const offline = await searchOfflineCustomers(q);
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return offline;
  }

  try {
    const res = await apiFetch(`/api/customers${qs}`);
    if (res.status === 401) {
      clearSession();
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      throw new Error(await readError(res));
    }
    const data = (await res.json()) as { customers: CustomerBrief[] };
    const merged = [...offline, ...data.customers];
    const seen = new Map<string, CustomerBrief>();
    for (const item of merged) {
      const key = item.remoteId ?? item.localId ?? item.id;
      if (!seen.has(key)) {
        seen.set(key, item);
      }
    }
    return Array.from(seen.values());
  } catch {
    return offline;
  }
}

export async function createCustomerRequest(payload: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<CustomerBrief> {
  const res = await apiFetch("/api/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { customer: CustomerBrief };
  return data.customer;
}

export async function updateCustomerRequest(
  id: string,
  payload: { name: string; email?: string; phone?: string; notes?: string | null; loyaltyPoints?: number },
): Promise<CustomerBrief> {
  const res = await apiFetch(`/api/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { customer: CustomerBrief };
  return data.customer;
}

export type ReportSummary = {
  summary: {
    transactionCount: number;
    revenue: number;
    tax: number;
    discount: number;
    subtotal: number;
  };
  byDay: { date: string; revenue: number; count: number }[];
};

export async function fetchReportSummary(fromIso: string, toIso: string): Promise<ReportSummary> {
  const qs = new URLSearchParams({ from: fromIso, to: toIso });
  const res = await apiFetch(`/api/reports/summary?${qs}`);
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<ReportSummary>;
}

export type ReportTransactionRow = {
  id: string;
  reference: string;
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  paymentMethod: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  customer: { id: string; name: string } | null;
  branch?: { id: string; name: string };
};

export async function fetchReportTransactions(
  fromIso: string,
  toIso: string,
  limit?: number,
): Promise<ReportTransactionRow[]> {
  const qs = new URLSearchParams({ from: fromIso, to: toIso });
  if (limit) qs.set("limit", String(limit));
  const res = await apiFetch(`/api/reports/transactions?${qs}`);
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { transactions: ReportTransactionRow[] };
  return data.transactions;
}

export type AdminProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  cost: number | null;
  stockQty: number;
  lowStockAt: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  const res = await apiFetch("/api/admin/products");
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (res.status === 403) throw new Error("You do not have access to product management");
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { products: AdminProduct[] };
  return data.products;
}

export async function createAdminProduct(payload: {
  sku: string;
  name: string;
  barcode?: string | null;
  category?: string;
  description?: string;
  price: number;
  cost?: number | null;
  stockQty: number;
  lowStockAt?: number | null;
  isActive?: boolean;
}): Promise<AdminProduct> {
  const res = await apiFetch("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (res.status === 403) throw new Error("Forbidden");
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { product: AdminProduct };
  return data.product;
}

export async function updateAdminProduct(
  id: string,
  payload: Partial<{
    sku: string;
    name: string;
    barcode: string | null;
    category: string | null;
    description: string | null;
    price: number;
    cost: number | null;
    stockQty: number;
    lowStockAt: number | null;
    isActive: boolean;
  }>,
): Promise<AdminProduct> {
  const res = await apiFetch(`/api/admin/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (res.status === 403) throw new Error("Forbidden");
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { product: AdminProduct };
  return data.product;
}

export type BranchDto = BranchBrief & { createdAt: string };
export type TenantPlan = "FREE" | "PRO" | "ENTERPRISE";
export type TenantDto = {
  id: string;
  name: string;
  domain: string | null;
  plan: TenantPlan | null;
  isActive: boolean;
  branchCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function fetchBranches(): Promise<BranchBrief[]> {
  const res = await apiFetch("/api/branches");
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { branches: BranchBrief[] };
  return data.branches;
}

export async function createBranchApi(payload: {
  name: string;
  address?: string | null;
  phone?: string | null;
}): Promise<BranchDto> {
  const res = await apiFetch("/api/branches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { branch: BranchDto };
  return data.branch;
}

export async function updateBranchApi(
  id: string,
  payload: Partial<{ name: string; address: string | null; phone: string | null }>,
): Promise<BranchDto> {
  const res = await apiFetch(`/api/branches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { branch: BranchDto };
  return data.branch;
}

export async function fetchBranchStats(
  branchId: string,
  fromIso?: string,
  toIso?: string,
): Promise<{
  period: { from: string; to: string };
  transactions: {
    count: number;
    revenue: number;
    tax: number;
    discount: number;
    subtotal: number;
  };
  inventory: { activeProducts: number; lowStockCount: number };
}> {
  const qs = new URLSearchParams();
  if (fromIso) qs.set("from", fromIso);
  if (toIso) qs.set("to", toIso);
  const res = await apiFetch(`/api/branches/${branchId}/stats?${qs}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{
    period: { from: string; to: string };
    transactions: {
      count: number;
      revenue: number;
      tax: number;
      discount: number;
      subtotal: number;
    };
    inventory: { activeProducts: number; lowStockCount: number };
  }>;
}

export async function fetchTenants(): Promise<TenantDto[]> {
  const res = await apiFetch("/api/tenants");
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (res.status === 403) {
    throw new Error("Forbidden");
  }
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { tenants: TenantDto[] };
  return data.tenants;
}

export async function updateTenantApi(
  id: string,
  payload: Partial<{ plan: TenantPlan | null; isActive: boolean }>,
): Promise<TenantDto> {
  const res = await apiFetch(`/api/tenants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (res.status === 403) {
    throw new Error("Forbidden");
  }
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { tenant: TenantDto };
  return data.tenant;
}
