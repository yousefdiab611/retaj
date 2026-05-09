import { useState } from "react";

import { BRAND_LOGO_FALLBACK_SRC, BRAND_LOGO_PRIMARY_SRC } from "@/lib/branding";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  /** Tailwind max width class, e.g. max-h-10 */
  imgClassName?: string;
};

export function BrandLogo({ className, imgClassName }: BrandLogoProps) {
  const [src, setSrc] = useState(BRAND_LOGO_PRIMARY_SRC);
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <img
        src={src}
        alt="Retaj Store"
        className={cn("h-auto w-full max-w-[160px] object-contain", imgClassName)}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onError={() => setSrc((current) => (current === BRAND_LOGO_PRIMARY_SRC ? BRAND_LOGO_WHITE_SRC : BRAND_LOGO_FALLBACK_SRC))}
      />
    </div>
  );
}
