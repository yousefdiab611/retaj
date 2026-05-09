import { Eye, Loader2, RefreshCw, Search, ShieldCheck, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTenantApi, fetchTenants, type TenantDto } from "@/lib/api";
import { cn } from "@/lib/utils";

const PLAN_OPTIONS = ["FREE", "PRO", "ENTERPRISE"] as const;

type PlanOption = (typeof PLAN_OPTIONS)[number];

export function TenantsPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<TenantDto | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchTenants();
      setTenants(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tenants;
    return tenants.filter((tenant) => {
      return (
        tenant.name.toLowerCase().includes(query) ||
        tenant.domain?.toLowerCase().includes(query) ||
        tenant.plan?.toLowerCase().includes(query) ||
        String(tenant.branchCount).includes(query)
      );
    });
  }, [search, tenants]);

  async function toggleTenantActive(tenant: TenantDto) {
    setSaving(true);
    try {
      const updated = await updateTenantApi(tenant.id, { isActive: !tenant.isActive });
      setTenants((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedTenant(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update tenant");
    } finally {
      setSaving(false);
    }
  }

  async function updateTenantPlan(plan: PlanOption) {
    if (!selectedTenant) return;
    setSaving(true);
    try {
      const updated = await updateTenantApi(selectedTenant.id, { plan });
      setTenants((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedTenant(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-muted/25">
      <MainNav />
      <main className="mx-auto max-w-[1200px] space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tenants</h1>
            <p className="text-sm text-muted-foreground">
              Global store registry, subscription status and branch coverage for your SaaS network.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void loadTenants()}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button type="button" size="sm" className="gap-2" onClick={() => setSearch("")}>
              <Search className="h-4 w-4" />
              Clear filter
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Search tenants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Input
                  placeholder="Search name, domain, plan, branches"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-3">
                  <span>Total tenants</span>
                  <strong>{tenants.length}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-3">
                  <span>Active stores</span>
                  <strong>{tenants.filter((t) => t.isActive).length}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-3">
                  <span>Suspended stores</span>
                  <strong>{tenants.filter((t) => !t.isActive).length}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Tenant directory</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading && tenants.length === 0 ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="border-b border-border/60 px-3 py-3">Tenant</th>
                    <th className="border-b border-border/60 px-3 py-3">Domain</th>
                    <th className="border-b border-border/60 px-3 py-3">Plan</th>
                    <th className="border-b border-border/60 px-3 py-3">Branches</th>
                    <th className="border-b border-border/60 px-3 py-3">Status</th>
                    <th className="border-b border-border/60 px-3 py-3">Created</th>
                    <th className="border-b border-border/60 px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b border-border/60 odd:bg-card even:bg-background">
                      <td className="px-3 py-3">
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-xs text-muted-foreground">{tenant.id}</div>
                      </td>
                      <td className="px-3 py-3">{tenant.domain ?? "—"}</td>
                      <td className="px-3 py-3">{tenant.plan ?? "FREE"}</td>
                      <td className="px-3 py-3">{tenant.branchCount}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]",
                            tenant.isActive
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {tenant.isActive ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-3 py-3">{tenant.createdAt.slice(0, 10)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                            onClick={() => setSelectedTenant(tenant)}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button
                            type="button"
                            variant={tenant.isActive ? "destructive" : "secondary"}
                            size="sm"
                            onClick={() => void toggleTenantActive(tenant)}
                            disabled={saving}
                          >
                            <Zap className="h-4 w-4" />
                            {tenant.isActive ? "Suspend" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedTenant)} onOpenChange={(open) => !open && setSelectedTenant(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedTenant ? selectedTenant.name : "Tenant details"}</DialogTitle>
            </DialogHeader>
            {selectedTenant ? (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label>Domain</Label>
                    <p className="rounded-md border border-border/60 bg-background p-3 text-sm text-foreground">
                      {selectedTenant.domain ?? "Not configured"}
                    </p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <p className="rounded-md border border-border/60 bg-background p-3 text-sm text-foreground">
                      {selectedTenant.isActive ? "Active" : "Suspended"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label>Plan</Label>
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background p-3 text-sm text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span>{selectedTenant.plan ?? "FREE"}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Branches</Label>
                    <p className="rounded-md border border-border/60 bg-background p-3 text-sm text-foreground">
                      {selectedTenant.branchCount}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-plan">Subscription plan</Label>
                  <select
                    id="tenant-plan"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm"
                    value={selectedTenant.plan ?? "FREE"}
                    onChange={(e) => updateTenantPlan(e.target.value as PlanOption)}
                    disabled={saving}
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedTenant(null)}>
                Close
              </Button>
              {selectedTenant ? (
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void toggleTenantActive(selectedTenant)}
                >
                  {selectedTenant.isActive ? "Suspend tenant" : "Activate tenant"}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
