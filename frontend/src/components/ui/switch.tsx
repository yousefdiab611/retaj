import * as React from "react";

import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <label
        className={cn(
          "inline-flex h-6 w-11 cursor-pointer items-center rounded-full border border-border bg-muted p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-muted",
          className,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          className="sr-only"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          {...props}
        />
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-background transition-transform duration-150",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </label>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
