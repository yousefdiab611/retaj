import { Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBranchApi, fetchBranches, fetchBranchStats, updateBranchApi, type BranchDto } from "@/lib/api";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  address: string;
  phone: string;
};

const emptyForm: FormState = { name: "", address: "", phone: "" };

export function BranchesPage() {
  const [rows, setRows] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [statsBranch, setStatsBranch] = useState<BranchDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchBranches();
      setRows(list as BranchDto[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(b: BranchDto) {
    setEditing(b);
    setForm({
      name: b.name,
      address: b.address ?? "",
      phone: b.phone ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (editing) {
        await updateBranchApi(editing.id, {
          name,
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
        });
      } else {
        await createBranchApi({
          name,
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
        });
      }
      setDialogOpen(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-muted/25">
      <MainNav />
      <main className="mx-auto max-w-[960px] space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Branches</h1>
            <p className="text-sm text-muted-foreground">Stores and POS inventory scope per location.</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button type="button" size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add branch
            </Button>
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Locations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[b.address, b.phone].filter(Boolean).join(" · ") || "No address"}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{b.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setStatsBranch(b)}>
                      Stats
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => openEdit(b)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {statsBranch ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Quick stats · {statsBranch.name}</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStatsBranch(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent>
              <StatsPanel branchId={statsBranch.id} />
            </CardContent>
          </Card>
        ) : null}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={(e) => void onSubmit(e)}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit branch" : "New branch"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="b-name">Name</Label>
                  <Input
                    id="b-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-address">Address</Label>
                  <Input
                    id="b-address"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-phone">Phone</Label>
                  <Input
                    id="b-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function StatsPanel({ branchId }: { branchId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchBranchStats>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchBranchStats(branchId);
        if (!cancelled) setData(s);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Stats failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  if (err) return <p className="text-sm text-destructive">{err}</p>;
  if (!data) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Period</dt>
        <dd className="font-mono text-xs">
          {data.period.from.slice(0, 10)} → {data.period.to.slice(0, 10)}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Transactions (30d default)</dt>
        <dd>{data.transactions.count}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Revenue</dt>
        <dd>{data.transactions.revenue.toFixed(2)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Active products</dt>
        <dd>{data.inventory.activeProducts}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Low stock SKUs</dt>
        <dd>{data.inventory.lowStockCount}</dd>
      </div>
    </dl>
  );
}
