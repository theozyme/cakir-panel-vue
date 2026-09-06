import * as React from "react";

import { cn } from "@/lib/utils";
import { uppercaseBusinessInput } from "@/lib/business-text";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input"> & { businessText?: boolean }>(
  ({ className, type, businessText = false, onChange, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
        onChange={(event) => {
          if (businessText && (!type || type === "text") && !/email|username|password/i.test(`${props.name ?? ""} ${props.id ?? ""} ${props.autoComplete ?? ""}`) && !props.inputMode?.match(/numeric|decimal|email|url|tel/)) {
            uppercaseBusinessInput(event);
          }
          onChange?.(event);
        }}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
