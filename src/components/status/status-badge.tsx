import React from "react";
import { cn } from "@/lib/utils";
import type { StatusVariant } from "@/lib/status/status";

function classesForVariant(variant: StatusVariant) {
  if (variant === "destructive") return "border-red-200 bg-red-50 text-red-700";
  if (variant === "secondary") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (variant === "outline") return "border-border bg-background text-foreground";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function StatusBadge({
  label,
  variant = "default",
  className,
}: {
  label: string;
  variant?: StatusVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        classesForVariant(variant),
        className
      )}
    >
      {label}
    </span>
  );
}