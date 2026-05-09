import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { LicenseRow } from "@/types/billing";
import type { ChangeEvent } from "react";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchAdminLicenses } from "@/lib/api";

export function AdminLicensesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminLicenses();
        setLicenses(data.licenses);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load licenses");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return licenses.filter((license) =>
      query.trim() === "" ? true : license.licenseKey.toLowerCase().includes(query.toLowerCase()),
    );
  }, [licenses, query]);

  return (
    <div className="min-h-dvh bg-muted/25">
      <MainNav />
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">License management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              View and manage licenses for your tenants with activation state, expiry, and device binding
              details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Search license key"
              className="min-w-[240px]"
            />
            <Button type="button" variant="secondary" className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Licenses</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-start text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">License key</th>
                  <th className="py-2 pe-3 font-medium">Status</th>
                  <th className="py-2 pe-3 font-medium">Expires</th>
                  <th className="py-2 pe-3 font-medium">Device</th>
                  <th className="py-2 pe-3 font-medium">Fingerprint</th>
                  <th className="py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Loading licenses…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No licenses found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((license) => (
                    <tr key={license.id} className="border-b border-border/60">
                      <td className="py-2 pe-3 font-mono text-xs">{license.licenseKey}</td>
                      <td className="py-2 pe-3 capitalize">{license.status.toLowerCase()}</td>
                      <td className="py-2 pe-3 tabular-nums">
                        {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="py-2 pe-3">{license.deviceId ?? "Unbound"}</td>
                      <td className="py-2 pe-3 truncate text-xs text-muted-foreground">
                        {license.deviceFingerprint ?? "—"}
                      </td>
                      <td className="py-2 tabular-nums text-muted-foreground">
                        {new Date(license.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
