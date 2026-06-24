import * as React from "react";
import { cn } from "../../lib/utils";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: string[];
};

export const Select = React.forwardRef<HTMLSelectElement, Props>(({ className, options, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {options.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ))}
  </select>
));
Select.displayName = "Select";
