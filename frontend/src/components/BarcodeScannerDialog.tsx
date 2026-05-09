import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BarcodeScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  manualLabel: string;
  manualPlaceholder: string;
  submitLabel: string;
  cancelLabel: string;
  cameraErrorHint: string;
  onScan: (code: string) => void;
};

const REGION_PREFIX = "retaj-store-scanner";

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  title,
  description,
  manualLabel,
  manualPlaceholder,
  submitLabel,
  cancelLabel,
  cameraErrorHint,
  onScan,
}: BarcodeScannerDialogProps) {
  const reactId = useId().replace(/:/g, "");
  const regionId = `${REGION_PREFIX}-${reactId}`;
  const [camError, setCamError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const onScanRef = useRef(onScan);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) {
      setCamError(null);
      setManual("");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const html5 = new Html5Qrcode(regionId, false);
        scannerRef.current = html5;
        await html5.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: { width: 280, height: 200 },
            aspectRatio: 1.777,
          },
          (decoded) => {
            const code = decoded.trim();
            if (!code || cancelled) return;
            cancelled = true;
            void html5
              .stop()
              .catch(() => {})
              .finally(() => {
                try {
                  html5.clear();
                } catch {
                  /* ignore */
                }
                scannerRef.current = null;
                onScanRef.current(code);
                onOpenChange(false);
              });
          },
          () => {},
        );
      } catch (e) {
        if (!cancelled) {
          setCamError(e instanceof Error ? e.message : cameraErrorHint);
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      void (async () => {
        try {
          await s?.stop();
          s?.clear();
        } catch {
          /* ignore */
        }
      })();
    };
  }, [open, regionId, onOpenChange, cameraErrorHint]);

  function submitManual() {
    const code = manual.replace(/\s+/g, "").trim();
    if (!code) return;
    onScanRef.current(code);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            id={regionId}
            className="mx-auto aspect-video w-full max-w-[340px] overflow-hidden rounded-lg border bg-muted/30"
          />

          {camError ? (
            <p className="rounded-md border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
              <span className="font-medium">{camError}</span>
              <span className="text-muted-foreground"> {cameraErrorHint}</span>
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="manual-barcode">{manualLabel}</Label>
            <div className="flex gap-2">
              <Input
                id="manual-barcode"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder={manualPlaceholder}
                autoComplete="off"
                className="font-mono text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitManual();
                }}
              />
              <Button type="button" variant="secondary" onClick={submitManual}>
                {submitLabel}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
