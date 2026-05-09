import { Search, Users, Edit3 } from "lucide-react";
import { useEffect, useState } from "react";

import type { CustomerRow } from "@/types/billing";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchAdminCustomers, updateCustomerRequest } from "@/lib/api";

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [customerNotes, setCustomerNotes] = useState("");
  const [customerLoyalty, setCustomerLoyalty] = useState(0);

  const loadCustomers = async (query = "") => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminCustomers(query);
      setCustomers(data.customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers(searchQuery);
  }, [searchQuery]);

  const openCustomerEditor = (customer: CustomerRow) => {
    setSelectedCustomer(customer);
    setCustomerNotes(customer.notes ?? "");
    setCustomerLoyalty(customer.loyaltyPoints ?? 0);
  };

  const closeCustomerEditor = () => {
    setSelectedCustomer(null);
    setCustomerNotes("");
    setCustomerLoyalty(0);
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer) return;
    setIsSaving(true);
    try {
      await updateCustomerRequest(selectedCustomer.id, {
        name: selectedCustomer.name,
        email: selectedCustomer.email ?? undefined,
        phone: selectedCustomer.phone ?? undefined,
        notes: customerNotes || null,
        loyaltyPoints: customerLoyalty,
      });
      await loadCustomers(searchQuery);
      closeCustomerEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update customer");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-muted/25">
      <MainNav />
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Customer management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Review customers, balances, loyalty points, and notes for your store.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label htmlFor="customer-search" className="sr-only">
              Search customers
            </Label>
            <div className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 shadow-sm sm:w-auto">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setSearchQuery(searchTerm);
                  }
                }}
                placeholder="Search by name, email, phone"
                className="border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
              />
            </div>
            <Button type="button" onClick={() => setSearchQuery(searchTerm)}>
              Search
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>
                <Users className="mr-2 inline h-4 w-4 align-text-bottom" />
                Customer count
              </CardTitle>
            </CardHeader>
            <CardContent className="text-4xl font-semibold">{loading ? "…" : customers.length}</CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-start text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">Customer</th>
                  <th className="py-2 pe-3 font-medium">Email</th>
                  <th className="py-2 pe-3 font-medium">Phone</th>
                  <th className="py-2 pe-3 font-medium">Balance</th>
                  <th className="py-2 pe-3 font-medium">Loyalty</th>
                  <th className="py-2 pe-3 font-medium">Notes</th>
                  <th className="py-2 font-medium">Joined</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      Loading customers…
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-border/60">
                      <td className="py-2 pe-3 font-medium">{customer.name}</td>
                      <td className="py-2 pe-3 text-muted-foreground">{customer.email ?? "—"}</td>
                      <td className="py-2 pe-3 text-muted-foreground">{customer.phone ?? "—"}</td>
                      <td className="py-2 pe-3 tabular-nums">${customer.balance.toFixed(2)}</td>
                      <td className="py-2 pe-3 tabular-nums text-muted-foreground">
                        {customer.loyaltyPoints}
                      </td>
                      <td className="py-2 pe-3 text-muted-foreground">
                        {customer.notes ? customer.notes.slice(0, 40) : "—"}
                      </td>
                      <td className="py-2 tabular-nums text-muted-foreground">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openCustomerEditor(customer)}
                        >
                          <Edit3 className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedCustomer)} onOpenChange={(open) => !open && closeCustomerEditor()}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedCustomer ? `Edit ${selectedCustomer.name}` : "Edit customer"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="customer-notes">Notes</Label>
                <Textarea
                  id="customer-notes"
                  value={customerNotes}
                  onChange={(event) => setCustomerNotes(event.target.value)}
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="customer-loyalty">Loyalty points</Label>
                <Input
                  id="customer-loyalty"
                  type="number"
                  min={0}
                  value={customerLoyalty}
                  onChange={(event) => setCustomerLoyalty(Number(event.target.value))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeCustomerEditor}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveCustomer} disabled={isSaving || !selectedCustomer}>
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
