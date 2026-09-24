import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

    const variants = {
      default: "bg-btn-blue text-white hover:bg-btn-blue-dark focus-visible:ring-btn-blue shadow-xs",
      secondary: "bg-[#F0F3F8] text-text-primary hover:bg-border-subtle focus-visible:ring-btn-blue",
      outline: "border border-border-subtle bg-white text-text-primary hover:bg-slate-50 focus-visible:ring-btn-blue",
      ghost: "text-text-secondary hover:bg-btn-blue/8 hover:text-text-primary focus-visible:ring-btn-blue",
      destructive: "bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary shadow-xs",
      accent: "bg-btn-blue text-white hover:bg-btn-blue-dark focus-visible:ring-btn-blue shadow-xs",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-9 px-4 py-2 text-sm",
      lg: "h-11 px-5 text-[15px]",
      icon: "h-9 w-9 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
