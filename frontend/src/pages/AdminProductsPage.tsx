import { Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createAdminProduct, fetchAdminProducts, updateAdminProduct, type AdminProduct } from "@/lib/api";
import { cn } from "@/lib/utils";

const emptyForm = {
  sku: "",
  barcode: "",
  name: "",
  category: "",
  description: "",
  price: "",
  cost: "",
  stockQty: "0",
  lowStockAt: "",
  isActive: true,
};

export function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAdminProducts();
      setProducts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
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

  function openEdit(p: AdminProduct) {
    setEditing(p);
    setForm({
      sku: p.sku,
      barcode: p.barcode ?? "",
      name: p.name,
      category: p.category ?? "",
      description: p.description ?? "",
      price: String(p.price),
      cost: p.cost != null ? String(p.cost) : "",
      stockQty: String(p.stockQty),
      lowStockAt: p.lowStockAt != null ? String(p.lowStockAt) : "",
      isActive: p.isActive,
    });
    setDialogOpen(true);
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const price = Number.parseFloat(form.price);
      const stockQty = Number.parseInt(form.stockQty, 10);
      if (
        !form.sku.trim() ||
        !form.name.trim() ||
        Number.isNaN(price) ||
        price < 0 ||
        Number.isNaN(stockQty) ||
        stockQty < 0
      ) {
        setError("Check SKU, name, price, and stock.");
        setSaving(false);
        return;
      }
      const costStr = form.cost.trim();
      const cost = costStr === "" ? null : Number.parseFloat(costStr);
      if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
        setError("Invalid cost");
        setSaving(false);
        return;
      }
      const lowStr = form.lowStockAt.trim();
      const lowStockAt = lowStr === "" ? null : Number.parseInt(lowStr, 10);
      if (lowStockAt !== null && (Number.isNaN(lowStockAt) || lowStockAt < 0)) {
        setError("Invalid low-stock threshold");
        setSaving(false);
        return;
      }

      const barcodeVal = form.barcode.trim() ? form.barcode.trim() : null;
      if (editing) {
        await updateAdminProduct(editing.id, {
          sku: form.sku.trim(),
          name: form.name.trim(),
          barcode: barcodeVal,
          category: form.category.trim() || null,
          description: form.description.trim() || null,
          price,
          cost,
          stockQty,
          lowStockAt,
          isActive: form.isActive,
        });
      } else {
        await createAdminProduct({
          sku: form.sku.trim(),
          name: form.name.trim(),
          barcode: barcodeVal,
          category: form.category.trim() || undefined,
          description: form.description.trim() || undefined,
          price,
          cost,
          stockQty,
          lowStockAt,
          isActive: form.isActive,
        });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const money = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "SAR" }).format(n);

  return (
    <div className="min-h-dvh bg-background">
      <MainNav />
      <div className="mx-auto max-w-[1600px] space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Catalog</h1>
            <p className="text-sm text-muted-foreground">Manage SKUs, barcodes, and stock.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:ms-auto">
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button type="button" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New product
            </Button>
          </div>
        </div>

        {error && !dialogOpen ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">All products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && products.length === 0 ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[min(70vh,560px)]">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-start text-muted-foreground">
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Barcode</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium text-end">Price</th>
                      <th className="px-4 py-3 font-medium text-end">Stock</th>
                      <th className="px-4 py-3 font-medium">Active</th>
                      <th className="px-4 py-3 font-medium w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-border/60">
                        <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                          {p.barcode ?? "—"}
                        </td>
                        <td className="px-4 py-2 font-medium">{p.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{p.category ?? "—"}</td>
                        <td className="px-4 py-2 text-end tabular-nums">{money(p.price)}</td>
                        <td className="px-4 py-2 text-end tabular-nums">{p.stockQty}</td>
                        <td className="px-4 py-2">{p.isActive ? "Yes" : "No"}</td>
                        <td className="px-4 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          {error && dialogOpen ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pf-sku">SKU</Label>
                <Input
                  id="pf-sku"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pf-barcode">Barcode</Label>
                <Input
                  id="pf-barcode"
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                  placeholder="EAN / UPC / internal"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf-stock">Stock qty</Label>
              <Input
                id="pf-stock"
                inputMode="numeric"
                value={form.stockQty}
                onChange={(e) => setForm((f) => ({ ...f, stockQty: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf-name">Name</Label>
              <Input
                id="pf-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf-cat">Category</Label>
              <Input
                id="pf-cat"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pf-price">Price</Label>
                <Input
                  id="pf-price"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pf-cost">Cost (optional)</Label>
                <Input
                  id="pf-cost"
                  inputMode="decimal"
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf-low">Low-stock alert (optional)</Label>
              <Input
                id="pf-low"
                inputMode="numeric"
                value={form.lowStockAt}
                onChange={(e) => setForm((f) => ({ ...f, lowStockAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf-desc">Description</Label>
              <Input
                id="pf-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Active (visible in POS)
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
