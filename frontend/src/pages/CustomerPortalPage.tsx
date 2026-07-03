import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchCustomerProfile,
  fetchCustomerSubscription,
  fetchCustomerDevices,
  fetchCustomerLicenses,
  sendSupportRequest,
} from "@/lib/api";

import type { LicenseRow } from "@/types/billing";
import type { AuthUser } from "@/types/user";

type CustomerTenant = {
  id: string;
  name: string;
  plan: string;
  billingStatus: string;
  planExpiresAt: string | null;
};

type CustomerProfile = {
  user: AuthUser;
  tenant: CustomerTenant;
};

type CustomerSubscription = {
  id: string;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
};

type CustomerDevice = {
  id: string;
  deviceId: string;
  type: string;
  isActive: boolean;
  updatedAt: string;
};

export function CustomerPortalPage() {
  const [profile, setProfile] = useState<CustomerProfile["user"] | null>(null);
  const [subscription, setSubscription] = useState<CustomerSubscription[]>([]);
  const [devices, setDevices] = useState<CustomerDevice[]>([]);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [profileData, subData, deviceData, licenseData] = await Promise.all([
          fetchCustomerProfile(),
          fetchCustomerSubscription(),
          fetchCustomerDevices(),
          fetchCustomerLicenses(),
        ]);
        setProfile(profileData.user);
        setSubscription(subData.subscriptions);
        setDevices(deviceData.devices);
        setLicenses(licenseData.licenses);
      } catch {
        setStatus("Unable to load customer portal data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSubmitSupport() {
    setStatus(null);
    try {
      await sendSupportRequest(subject, description);
      setStatus("Support request submitted successfully.");
      setSubject("");
      setDescription("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to submit support request");
    }
  }

  return (
    <div className="min-h-dvh bg-muted/25">
      <MainNav />
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Customer portal</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              View subscription status, desktop license keys, approved devices, and request support.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>{profile?.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{profile?.email ?? "No email on file"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>{subscription[0]?.plan ?? "No active plan"}</p>
              <p className="text-sm text-muted-foreground">{subscription[0]?.status ?? "Pending"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Devices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                {devices.length} authorized device{devices.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-muted-foreground">
                Most recent: {devices[0]?.updatedAt ? new Date(devices[0].updatedAt).toLocaleString() : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>License keys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading licenses…</p>
              ) : licenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licenses yet.</p>
              ) : (
                licenses.map((license) => (
                  <div key={license.id} className="rounded-md border border-border/60 p-3">
                    <div className="font-medium">{license.licenseKey}</div>
                    <div className="text-xs text-muted-foreground">
                      {license.status} • expires{" "}
                      {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : "never"}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Request support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted-foreground">Subject</label>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Ticket title"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted-foreground">Details</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe your issue"
                  rows={5}
                />
              </div>
              <Button
                type="button"
                onClick={onSubmitSupport}
                disabled={!subject || !description}
                className="w-full gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Submit request
              </Button>
              {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
