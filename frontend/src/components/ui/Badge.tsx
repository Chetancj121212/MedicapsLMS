import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-primary/8 text-primary border border-primary/20",
    secondary: "bg-[#F0F3F8] text-primary-secondary border border-border-subtle",
    success: "bg-emerald-50 text-emerald-800 border border-emerald-200/70",
    warning: "bg-primary-secondary/10 text-primary-secondary border border-primary-secondary/20",
    destructive: "bg-primary/10 text-primary border border-primary/20",
    outline: "text-text-secondary border border-border-subtle bg-white",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
