import { ShieldCheck, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import type { LocalLicenseData } from "@/types/electron";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { activateLicense, validateLicense } from "@/lib/api";
import { getDeviceFingerprint, getLocalLicense, isDesktopApp, saveLocalLicense } from "@/lib/electron";

export function LicenseActivationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [licenseKey, setLicenseKey] = useState("");
  const [localLicense, setLocalLicense] = useState<LocalLicenseData | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isDesktopApp());
    void (async () => {
      if (!isDesktopApp()) return;
      const device = await getDeviceFingerprint();
      setDeviceId(device);
      const license = await getLocalLicense();
      if (license) {
        setLocalLicense(license);
      }
    })();
  }, []);

  async function syncLocalLicense() {
    const license = await getLocalLicense();
    setLocalLicense(license);
  }

  async function handleActivate() {
    setError(null);
    setStatus(null);
    setLoading(true);

    try {
      const device = deviceId || (await getDeviceFingerprint());
      if (!device) {
        throw new Error("Unable to determine this device fingerprint.");
      }
      const response = await activateLicense(licenseKey.trim(), device, device);
      await saveLocalLicense({
        licenseKey: licenseKey.trim(),
        deviceId: device,
        deviceFingerprint: device,
        status: response.status,
        expiresAt: response.expiresAt,
        trialMode: response.trialMode,
        graceRemainingDays: response.graceRemainingDays,
        graceUntil: response.graceUntil ?? null,
        activatedAt: new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
      });
      navigate((location.state as { from?: Location })?.from?.pathname ?? "/pos", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to activate license.");
    } finally {
      setLoading(false);
      await syncLocalLicense();
    }
  }

  async function handleValidateExisting() {
    if (!localLicense) return;
    setError(null);
    setStatus(null);
    setLoading(true);

    try {
      const device = deviceId || (await getDeviceFingerprint());
      if (!device) {
        throw new Error("Unable to determine this device fingerprint.");
      }
      const response = await validateLicense(localLicense.licenseKey, device, device);
      await saveLocalLicense({
        ...localLicense,
        status: response.status,
        expiresAt: response.expiresAt,
        graceRemainingDays: response.graceRemainingDays,
        graceUntil: response.graceUntil ?? localLicense.graceUntil ?? null,
        lastValidatedAt: new Date().toISOString(),
      });
      setStatus("License validated successfully.");
      await syncLocalLicense();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to validate license.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClearLocalLicense() {
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      await saveLocalLicense(null);
      setLocalLicense(null);
      setStatus("Local license cleared. Enter a new license key to activate.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to clear local license.");
    } finally {
      setLoading(false);
    }
  }

  if (!isDesktop) {
    return (
      <div className="min-h-dvh bg-muted/25">
        <MainNav />
        <div className="mx-auto max-w-[600px] px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Desktop license activation</CardTitle>
              <CardDescription>
                License activation is only available from the Retaj desktop application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Please open Retaj POS in the installed desktop application to activate your professional
                license.
              </p>
              <div className="mt-6">
                <Link to="/login" className="text-primary underline">
                  Back to login
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/25">
      <MainNav />
      <div className="mx-auto max-w-[800px] px-4 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Activate your desktop license
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Enter your professional license key to bind this machine and unlock offline grace, device binding,
            and license enforcement.
          </p>
        </div>

        {localLicense ? (
          <Card className="mb-6 border border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Current desktop license status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">License key</div>
                  <div className="font-mono text-sm">{localLicense.licenseKey}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium">{localLicense.status}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Expires</div>
                  <div>
                    {localLicense.expiresAt ? new Date(localLicense.expiresAt).toLocaleDateString() : "Never"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Device ID</div>
                  <div className="truncate text-sm">{localLicense.deviceId}</div>
                </div>
                {localLicense.graceUntil ? (
                  <div>
                    <div className="text-sm text-muted-foreground">Grace valid until</div>
                    <div>{new Date(localLicense.graceUntil).toLocaleDateString()}</div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleValidateExisting}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Validate license now
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClearLocalLicense}
                  disabled={loading}
                  className="gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  Clear local license
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Activate desktop license</CardTitle>
            <CardDescription>
              Use your license key to bind this machine and enable offline grace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status ? (
              <div className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="inline h-4 w-4 align-text-bottom" /> {status}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">License key</label>
              <Input
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value)}
                placeholder="RETAJ-XXXX-XXXX-XXXX-XXXX"
                spellCheck={false}
                className="text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleActivate}
                disabled={loading || !licenseKey.trim()}
                className="gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                Activate license
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  navigate((location.state as { from?: Location })?.from?.pathname ?? "/pos", {
                    replace: true,
                  })
                }
                className="gap-2"
              >
                Back to app
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
