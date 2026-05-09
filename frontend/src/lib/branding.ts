/** Primary logo: add `logo.png` (official art) to `public/` for best quality; falls back in UI. */
export const BRAND_LOGO_PRIMARY_SRC = "/logo.png";
/** White logo variation for dark backgrounds or fallback. */
export const BRAND_LOGO_WHITE_SRC = "/logo-white.png";
/** Bundled vector fallback (always present). */
export const BRAND_LOGO_FALLBACK_SRC = "/brand/retaj-logo.svg";
/** Used for print windows and preload (resolved URL). */
export const BRAND_LOGO_SRC = BRAND_LOGO_FALLBACK_SRC;

let preloadDone = false;

/** Decode once at startup; keeps later screen renders cheap. */
export function preloadBrandLogo(): void {
  if (preloadDone || typeof window === "undefined") return;
  preloadDone = true;
  const run = (src: string) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    if ("decode" in img) {
      void (img as HTMLImageElement).decode?.().catch(() => undefined);
    }
  };
  run(BRAND_LOGO_PRIMARY_SRC);
  run(BRAND_LOGO_FALLBACK_SRC);
}
