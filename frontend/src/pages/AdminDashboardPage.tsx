import { CreditCard, Key, Layers, ShieldAlert, Package, Users } from "lucide-react";
import { useEffect, useState } from "react";

import type { AdminDashboardStats } from "@/types/billing";

import { MainNav } from "@/components/MainNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAdminDashboardStats } from "@/lib/api";

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminDashboardStats();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-dvh bg-muted/25">
      <MainNav />
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Admin dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Track customers, revenue, subscriptions and license health from one centralized SaaS control
              plane.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">Customers</CardTitle>
                <Layers className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {loading ? "..." : stats?.totalCustomers}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">Orders today</CardTitle>
                <CreditCard className="h-4 w-4 text-secondary" />
              </div>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {loading ? "..." : stats?.ordersToday}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">Pending sync queue</CardTitle>
                <ShieldAlert className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {loading ? "..." : stats?.pendingOfflineSyncs}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">Low stock items</CardTitle>
                <Key className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {loading ? "..." : stats?.lowStockCount}
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">New customers today</CardTitle>
                <Users className="h-4 w-4 text-indigo-500" />
              </div>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {loading ? "..." : stats?.newCustomers}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">License status</CardTitle>
                <ShieldAlert className="h-4 w-4 text-sky-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-2xl font-semibold">{loading ? "..." : stats?.licenseStatus}</p>
              <p>{loading ? "..." : `Plan: ${stats?.plan}`}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">Last backup</CardTitle>
                <Package className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {loading
                ? "..."
                : stats?.lastBackupAt
                  ? new Date(stats.lastBackupAt).toLocaleString()
                  : "No backups yet"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">App version</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {loading ? "..." : stats?.appVersion}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Revenue this month</CardTitle>
            </CardHeader>
            <CardContent className="text-4xl font-semibold">
              {loading
                ? "…"
                : new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
                    stats?.monthlyRevenue ?? 0,
                  )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue today</CardTitle>
            </CardHeader>
            <CardContent className="text-4xl font-semibold">
              {loading
                ? "…"
                : new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
                    stats?.revenueToday ?? 0,
                  )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sync engine status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{loading ? "…" : (stats?.databaseStatus.provider ?? "--")}</p>
              <p className="font-medium">
                {loading ? "…" : (stats?.databaseStatus.syncEngineStatus ?? "UNKNOWN")}
              </p>
              <p className="text-xs text-muted-foreground">
                {loading
                  ? ""
                  : stats?.databaseStatus.online
                    ? "Database connected"
                    : "Database offline / fallback"}
              </p>
              {loading ? null : stats?.databaseStatus.lastError ? (
                <p className="text-xs text-destructive">{stats.databaseStatus.lastError}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Top products (30 days)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 border-b border-slate-200/60 px-2 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  <span>Product</span>
                  <span className="text-right">Sold</span>
                  <span className="text-right">Revenue</span>
                </div>
                {loading ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground">Loading products…</div>
                ) : stats?.topProducts.length ? (
                  stats.topProducts.map((product) => (
                    <div
                      key={product.productId}
                      className="grid grid-cols-[2fr_1fr_1fr] gap-4 border-b border-slate-200/60 px-2 py-3 text-sm"
                    >
                      <span>{product.name}</span>
                      <span className="text-right">{product.quantitySold}</span>
                      <span className="text-right">
                        {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
                          product.revenue,
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-4 text-sm text-muted-foreground">
                    No top product data available yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Offline sync health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Last offline sync attempt:{" "}
                {loading
                  ? "…"
                  : stats?.lastOfflineSyncAt
                    ? new Date(stats.lastOfflineSyncAt).toLocaleString()
                    : "No sync data"}
              </p>
              <p>Pending offline transaction queue: {loading ? "…" : stats?.pendingOfflineSyncs}</p>
              <p>Orders today from the POS: {loading ? "…" : stats?.ordersToday}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Operational readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                {loading
                  ? "…"
                  : stats?.databaseStatus.online
                    ? "Backend database ready"
                    : "Backend fallback mode active"}
              </p>
              <p>Provider: {loading ? "…" : stats?.databaseStatus.provider}</p>
              <p>Sync engine: {loading ? "…" : stats?.databaseStatus.syncEngineStatus}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
