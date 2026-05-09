import { Download, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchReportSummary, fetchReportTransactions, type ReportTransactionRow } from "@/lib/api";
import { downloadReportTransactionsCsv } from "@/lib/exportReportsCsv";
import { cn } from "@/lib/utils";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReportsPage() {
  const defaultRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return { from: startOfDay(from), to: endOfDay(to) };
  }, []);

  const [fromStr, setFromStr] = useState(() => toInputDate(defaultRange.from));
  const [toStr, setToStr] = useState(() => toInputDate(defaultRange.to));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchReportSummary>> | null>(null);
  const [rows, setRows] = useState<ReportTransactionRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = startOfDay(new Date(fromStr + "T12:00:00"));
      const to = endOfDay(new Date(toStr + "T12:00:00"));
      if (from > to) {
        setError("From date must be before To date");
        setLoading(false);
        return;
      }
      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const [s, t] = await Promise.all([
        fetchReportSummary(fromIso, toIso),
        fetchReportTransactions(fromIso, toIso, 200),
      ]);
      setSummary(s);
      setRows(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [fromStr, toStr]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "SAR" }).format(n);

  return (
    <div className="min-h-dvh bg-muted/25">
      <MainNav />
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sales reports</h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Cashiers see only their own sales. Managers and admins see all transactions.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3 sm:ms-auto">
            <div className="space-y-1">
              <Label htmlFor="rep-from">From</Label>
              <Input id="rep-from" type="date" value={fromStr} onChange={(e) => setFromStr(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-to">To</Label>
              <Input id="rep-to" type="date" value={toStr} onChange={(e) => setToStr(e.target.value)} />
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={loading || !summary}
              onClick={() => {
                if (!summary) return;
                downloadReportTransactionsCsv(rows, summary.summary, fromStr, toStr);
              }}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading && !summary ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading…
          </div>
        ) : summary ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {summary.summary.transactionCount}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {money(summary.summary.revenue)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tax</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {money(summary.summary.tax)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Discounts</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {money(summary.summary.discount)}
                </CardContent>
              </Card>
            </div>

            {summary.byDay.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Daily revenue</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-start text-muted-foreground">
                        <th className="py-2 pe-4 font-medium">Date</th>
                        <th className="py-2 pe-4 font-medium">Transactions</th>
                        <th className="py-2 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byDay.map((d) => (
                        <tr key={d.date} className="border-b border-border/60">
                          <td className="py-2 pe-4 tabular-nums">{d.date}</td>
                          <td className="py-2 pe-4 tabular-nums">{d.count}</td>
                          <td className="py-2 tabular-nums">{money(d.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent transactions</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-start text-muted-foreground">
                      <th className="py-2 pe-3 font-medium">Reference</th>
                      <th className="py-2 pe-3 font-medium">When</th>
                      <th className="py-2 pe-3 font-medium">Cashier</th>
                      <th className="py-2 pe-3 font-medium">Customer</th>
                      <th className="py-2 pe-3 font-medium">Payment</th>
                      <th className="py-2 font-medium text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/60">
                        <td className="py-2 pe-3 font-mono text-xs">{r.reference.slice(0, 8)}…</td>
                        <td className="py-2 pe-3 tabular-nums text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pe-3">{r.user.name}</td>
                        <td className="py-2 pe-3">{r.customer?.name ?? "—"}</td>
                        <td className="py-2 pe-3 capitalize">{r.paymentMethod ?? "—"}</td>
                        <td className="py-2 text-end tabular-nums font-medium">{money(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No transactions in this range.</p>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
