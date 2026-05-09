export type BillingPlan = {
  key: string;
  title: string;
  description: string;
  interval: "MONTHLY" | "YEARLY" | "TRIAL";
  amountCents: number;
  currency: string;
  trialDays?: number;
};

export type AdminDashboardStats = {
  totalCustomers: number;
  activeSubscriptions: number;
  activeLicenses: number;
  expiredLicenses: number;
  monthlyRevenue: number;
  failedLogins: number;
  ordersToday: number;
  revenueToday: number;
  pendingOfflineSyncs: number;
  lastOfflineSyncAt: string | null;
  newCustomers: number;
  licenseStatus: string;
  plan: string;
  lastBackupAt: string | null;
  appVersion: string;
  lowStockCount: number;
  topProducts: Array<{ productId: string; name: string; quantitySold: number; revenue: number }>;
  databaseStatus: {
    online: boolean;
    provider: string;
    prismaStatus: string;
    syncEngineStatus: string;
    lastError?: string;
  };
};

export type LicenseRow = {
  id: string;
  licenseKey: string;
  status: string;
  expiresAt: string | null;
  trialMode: boolean;
  deviceId: string | null;
  deviceFingerprint: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
  loyaltyPoints: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  createdAt: string;
};
