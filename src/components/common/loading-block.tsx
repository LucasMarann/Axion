import React from "react";

export default function LoadingBlock({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground">
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}